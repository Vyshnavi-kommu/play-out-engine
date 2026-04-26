# EXPLAINER.md — Playto Payout Engine

---

## 1. The Ledger

**Balance calculation query (from `payouts/views.py` inside the lock):**

```python
ledger_balance = LedgerEntry.objects.filter(
    merchant=locked_merchant
).aggregate(total=Sum('amount_paise'))['total'] or 0

held = Payout.objects.filter(
    merchant=locked_merchant,
    status__in=[Payout.PENDING, Payout.PROCESSING],
).aggregate(total=Sum('amount_paise'))['total'] or 0

available = ledger_balance - held
```

This issues two SQL `SUM()` queries at the database level:

```sql
-- Ledger sum: all signed entries (credits +, debits -)
SELECT SUM(amount_paise) FROM ledger_entries WHERE merchant_id = %s;

-- Held: funds reserved by in-flight payouts (not yet settled)
SELECT SUM(amount_paise) FROM payouts
  WHERE merchant_id = %s AND status IN ('pending', 'processing');
```

**Why this model:**

Credits and debits share a single `LedgerEntry` table with a **signed `amount_paise` BigIntegerField**: credits are positive, debits are negative. Balance is always `SUM(amount_paise)` — one aggregate, no cached column. This is the append-only ledger pattern used by real payment systems (Stripe, Braintree).

The available balance is deliberately split into two parts:
- `ledger_balance` — settled money (seed credits + completed payout debits)
- `held` — funds locked by PENDING/PROCESSING payouts not yet settled

This separation means a payout's funds are effectively reserved the moment the payout is created, without writing a ledger debit until the bank confirms. If the payout fails, the hold dissolves when the status moves to FAILED — **no ledger correction needed** (see AI Audit for why this matters).

`BigIntegerField` (64-bit signed integer) is used everywhere. No `FloatField`, no `DecimalField`. Paise as integers eliminates all floating-point representation errors. ₹1,00,00,000 = `1_000_000_00` paise — well within 64-bit range.

---

## 2. The Lock

**Exact code from `payouts/views.py`:**

```python
with transaction.atomic():
    # Acquire a row-level exclusive lock on the merchant row.
    # No other transaction can SELECT FOR UPDATE or UPDATE this row
    # until our transaction commits or rolls back.
    locked_merchant = Merchant.objects.select_for_update().get(id=merchant.id)

    # Balance computed INSIDE the lock — no stale reads possible.
    ledger_balance = LedgerEntry.objects.filter(
        merchant=locked_merchant
    ).aggregate(total=Sum('amount_paise'))['total'] or 0

    held = Payout.objects.filter(
        merchant=locked_merchant,
        status__in=[Payout.PENDING, Payout.PROCESSING],
    ).aggregate(total=Sum('amount_paise'))['total'] or 0

    available = ledger_balance - held

    if amount_paise > available:
        raise ValueError(
            f'Insufficient balance: available={available} paise, requested={amount_paise} paise'
        )

    payout = Payout.objects.create(...)  # created inside the same transaction
```

**The database primitive:** PostgreSQL row-level locking via `SELECT ... FOR UPDATE`.

When two concurrent requests arrive for the same merchant:
1. Both enter `transaction.atomic()`.
2. Both issue `SELECT ... FOR UPDATE` on the same merchant row.
3. PostgreSQL grants the lock to exactly one. The other **blocks at the DB level** — not in Python, not with a threading lock, at the storage engine.
4. The winner reads balance, checks sufficiency, creates the payout, and commits. The lock releases on commit.
5. The loser now acquires the lock, re-reads the balance (which now reflects the winner's payout in the `held` sum), finds insufficient funds, raises `ValueError`, and returns 400.

This is **pessimistic serialisation**. The check and the create happen in the same serialised transaction — zero window between them.

**Why not application-level locking (Redis SETNX)?** Application locks can leak if a process crashes mid-operation. Database row locks are automatically released when the connection or transaction dies. For money, the DB lock is the only safe choice.

---

## 3. The Idempotency

**How the system recognises a seen key (`payouts/views.py`):**

```python
obj, created = IdempotencyKey.objects.get_or_create(
    merchant=merchant,
    key=raw_key,
    defaults={'expires_at': expires_at},
)
```

`IdempotencyKey` has `unique_together = [('merchant', 'key')]`. `get_or_create` maps to `INSERT ... ON CONFLICT DO NOTHING` in PostgreSQL — atomic at the DB level. The first call inserts and gets `created=True`. Every subsequent call finds the existing row with `created=False`.

**What happens when the first request is still in-flight when the second arrives:**

The `IdempotencyKey` row has two states:
- `resolved_at = NULL` — first request is still processing.
- `resolved_at = <timestamp>` — first request finished; `response_body` and `response_status` are populated.

```python
if not created:
    if idem.is_resolved():
        # Replay the exact same response — idempotent.
        return Response(idem.response_body, status=idem.response_status)
    else:
        # First request still in-flight — 409 Conflict.
        return Response(
            {'error': 'A request with this idempotency key is already in progress'},
            status=status.HTTP_409_CONFLICT,
        )
```

The second concurrent request gets **409**, not a duplicate payout. The client retries after a short wait once the first request resolves. This matches Stripe's documented behaviour.

Keys are scoped per merchant via `unique_together` on `(merchant, key)` — merchant A's key `"abc"` never collides with merchant B's `"abc"`. Keys expire after 24 hours and are treated as fresh after expiry.

---

## 4. The State Machine

**Where illegal transitions are blocked (`payouts/models.py`):**

```python
LEGAL_TRANSITIONS = {
    'pending':    {'processing'},
    'processing': {'completed', 'failed'},
    'completed':  set(),   # terminal — no exits
    'failed':     set(),   # terminal — no exits
}

def transition_to(self, new_status, save=True):
    allowed = LEGAL_TRANSITIONS.get(self.status, set())
    if new_status not in allowed:
        raise ValueError(
            f"Illegal state transition: {self.status} → {new_status}"
        )
    self.status = new_status
    if save:
        self.save(update_fields=['status', 'updated_at'])
```

`completed` and `failed` map to empty sets — nothing exits a terminal state. `failed → completed` raises `ValueError` before any DB write. Every state change goes through `transition_to()`.

**Why the check lives in the model:** If it lived in the view or task, a future code path that bypasses the view could skip it. Keeping it on the model makes it impossible to transition without going through the guard.

Both transitions in the background worker are inside `transaction.atomic()` with `select_for_update()`. If the block fails (e.g. DB error), the transaction rolls back — no partial state transition ever persists.

---

## 5. The AI Audit

### Primary bug: phantom refund credit inflating merchant balances

**What the AI generated (`payouts/tasks.py` failure branch):**

```python
elif outcome == 'failure':
    # Refund and state change are ATOMIC — either both happen or neither.
    _refund_to_ledger(payout)          # ← creates +N credit entry
    payout.failure_reason = 'Bank declined the transfer'
    payout.transition_to(Payout.FAILED, save=False)
    payout.save(update_fields=['status', 'failure_reason', 'updated_at'])
```

The same pattern appeared in `check_stuck_payouts` when a payout exhausted its retries:

```python
else:
    _refund_to_ledger(payout)          # ← same mistake
    payout.transition_to(Payout.FAILED, save=False)
    payout.save(update_fields=[...])
```

Where `_refund_to_ledger` creates:

```python
LedgerEntry.objects.create(
    merchant=payout.merchant,
    entry_type=LedgerEntry.CREDIT,
    amount_paise=payout.amount_paise,   # +N paise credited back
    description=f'Refund for failed payout {payout.id}',
)
```

**Why this is subtly wrong:**

The AI reasoned by analogy to a cash register: "money went out on create, so credit it back on failure." But that is not how this ledger model works.

In this system, a payout's funds are held **virtually** — via the `held` calculation (`SUM of PENDING + PROCESSING payouts`), not via a ledger debit. No ledger entry is written when a payout is created. A debit entry is only written when the bank **confirms settlement** (success path). Therefore, on failure there is no prior debit to reverse.

Calling `_refund_to_ledger` on failure creates a credit entry with nothing to offset it. The result is money conjured from nothing:

```
Initial ledger:       +₹43,000  (seed credits)
₹40,000 payout fails: +₹40,000  (phantom refund credit)
                      ─────────
Reported balance:      ₹83,000  ← should still be ₹43,000
```

This was caught by observing the dashboard: NexGen Digital Agency's balance jumped from ₹43,000 to ₹83,000 after a single failed payout — money was created out of thin air.

**What I replaced it with:**

Remove `_refund_to_ledger` from all failure paths entirely:

```python
elif outcome == 'failure':
    # No ledger entry needed — funds were never debited from the ledger.
    # The hold releases automatically: when status moves out of
    # PENDING/PROCESSING, this payout exits the held SUM, so:
    #   available = ledger_balance - held  →  available increases.
    payout.failure_reason = 'Bank declined the transfer'
    payout.transition_to(Payout.FAILED, save=False)
    payout.save(update_fields=['status', 'failure_reason', 'updated_at'])
```

The invariant `available = SUM(ledger) - SUM(PENDING+PROCESSING payouts)` self-corrects: when a payout becomes FAILED it exits the held set, available rises to its correct pre-payout value. No extra ledger write.

---

### Secondary bug: balance aggregated in Python memory instead of at the DB level

**What the AI initially wrote:**

```python
# AI version — fetches all rows into Python, sums in memory
entries = LedgerEntry.objects.filter(merchant=merchant)
balance = sum(e.amount_paise for e in entries)
```

Two problems: (1) loads every ledger row into memory — O(n) for long-lived merchants; (2) this read happens **outside** the `SELECT FOR UPDATE` transaction, creating a TOCTOU window where another request can insert a ledger entry between the read and the balance check.

**Replacement:** A single DB-level `aggregate(Sum(...))` inside the same `transaction.atomic()` block that holds the merchant row lock — guarantees the read is consistent with the lock.

---

### Third bug: double-retry race in `check_stuck_payouts`

**What the AI initially wrote:**

```python
# AI version — no lock on the queryset
stuck = Payout.objects.filter(status='processing', processing_started_at__lt=cutoff)
for payout in stuck:
    with transaction.atomic():
        payout.retry_count += 1
        payout.status = 'pending'
        payout.save()
        process_payout.delay(str(payout.id))
```

The queryset is evaluated **outside** any transaction. If two beat instances run concurrently, both fetch the same stuck payouts, both enter the loop, and both re-queue the same payout — doubling retry counts and dispatching duplicate workers.

**Replacement:** `select_for_update(skip_locked=True)` inside a single `transaction.atomic()`:

```python
with transaction.atomic():
    stuck = Payout.objects.filter(
        status=Payout.PROCESSING,
        processing_started_at__lt=cutoff,
    ).select_for_update(skip_locked=True)

    for payout in stuck:
        ...  # all mutations inside the same transaction
```

`skip_locked=True` means a second concurrent beat instance skips rows already locked by the first — no double-retry, no blocking.

---

## Architecture: current data flow

```
POST /api/v1/payouts
       │
       ├─ Parse Idempotency-Key header (required)
       │
       ├─ IdempotencyKey.get_or_create()          ← atomic on unique_together
       │     ├─ created=False, resolved → replay stored response
       │     ├─ created=False, in-flight → 409 Conflict
       │     └─ created=True → proceed
       │
       └─ transaction.atomic()
              ├─ SELECT merchant FOR UPDATE        ← row-level lock
              ├─ SUM(ledger_entries)               ← DB-level balance, inside lock
              ├─ SUM(PENDING+PROCESSING payouts)   ← held funds, inside lock
              ├─ available = ledger_sum - held
              ├─ if amount > available → 400 (ValueError)
              └─ INSERT payout (status=pending)    ← committed with lock release
                     │
                     └─ Celery: process_payout.apply_async(countdown=1)
                            │
                            ├─ SELECT payout FOR UPDATE
                            ├─ pending → processing
                            │
                            ├─ simulate bank (70% success / 20% fail / 10% hung)
                            │
                            ├─ success:
                            │     INSERT LedgerEntry(amount=-N)   ← debit, money out
                            │     processing → completed
                            │
                            ├─ failure:
                            │     processing → failed             ← no ledger entry
                            │     (held releases automatically)
                            │
                            └─ hung: stays in processing
                                   └─ check_stuck_payouts (every 30s)
                                          ├─ retry < 3: reset to pending, backoff
                                          └─ retry = 3: processing → failed
                                                         (no ledger entry)

Admin override path:
  POST /api/v1/admin/payouts/<id>/action/
        ├─ action=complete:
        │     SELECT payout FOR UPDATE
        │     INSERT LedgerEntry(amount=-N)   ← debit, same as success path
        │     → completed
        └─ action=cancel:
              SELECT payout FOR UPDATE
              failure_reason = 'Cancelled by admin'
              → failed                        ← no ledger entry, hold releases
```

---

## 6. Admin Portal

### Access

The frontend Admin Portal is protected by a client-side password gate.

**Password:** `admin5657`

Click **Admin ⚙** in the top-right header, enter the password to unlock. The session persists in `sessionStorage` (cleared when the tab closes). Click **🔒 Lock** to log out.

### Capabilities

| Feature | Description |
|---------|-------------|
| System stats | Total merchants, payout volume, success rate, per-status counts |
| All payouts view | Cross-merchant table with status filter pills |
| Force complete | Creates debit ledger entry, transitions payout → completed |
| Force cancel | Transitions payout → failed, no ledger entry, hold releases |
| Auto-retry stuck | Backdates `processing_started_at`, triggers `check_stuck_payouts` |
| Add merchant | Creates Merchant + BankAccount + optional initial credit in one transaction |

### Why the admin portal adds evaluation value

Real payment operations always require a manual intervention layer. When bank simulations hang (the 10% hung path), automatic retry handles most cases — but operators need a break-glass mechanism to:

1. **Force-complete** a payout when the bank confirms settlement through an out-of-band channel
2. **Force-cancel** a payout that is unresolvable (bank rejected it verbally, no API response)
3. **Add merchants** without touching the database directly

The force-complete path deliberately follows the same ledger semantics as the auto-complete path: it creates a signed debit entry (`amount_paise = -N`) so the `SUM(ledger)` invariant stays correct. Force-cancel follows the failure path: no entry, the hold dissolves via status change.

### Add Merchant fields

| Field | Validation |
|-------|-----------|
| Business name | Required |
| Email | Required, unique |
| Account holder | Required |
| Account number | 8–18 digits |
| IFSC code | Exactly 11 chars, uppercased |
| Initial balance (₹) | Optional; credited to ledger immediately as `admin-initial-credit` |
