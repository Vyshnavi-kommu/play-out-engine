# EXPLAINER.md — Playto Payout Engine

---

## 1. The Ledger

**Balance calculation query (from `merchants/serializers.py`):**

```python
ledger_sum = LedgerEntry.objects.filter(merchant=obj).aggregate(
    total=Sum('amount_paise')
)['total'] or 0

held = Payout.objects.filter(
    merchant=obj,
    status__in=[Payout.PENDING, Payout.PROCESSING]
).aggregate(total=Sum('amount_paise'))['total'] or 0

available = ledger_sum - held
```

This generates two SQL statements, both using `SUM()` at the database level:

```sql
SELECT SUM(amount_paise) FROM ledger_entries WHERE merchant_id = %s;
SELECT SUM(amount_paise) FROM payouts WHERE merchant_id = %s AND status IN ('pending','processing');
```

**Why I modelled it this way:**

Credits and debits are stored as a single `LedgerEntry` table with a **signed `amount_paise` BigIntegerField**: credits are positive, debits are negative. Balance is always `SUM(amount_paise)` — one aggregate. This is the append-only ledger pattern used by real payment systems (Stripe, Braintree). No balance column is ever written, so there is no drift possible. An audit is trivial: the sum of every row is the true balance by construction.

I deliberately chose **not** to store a running balance on the `Merchant` model. A cached balance column would need to be updated atomically on every credit and debit — adding a write and a potential race condition for nothing. The DB can compute a SUM over tens of thousands of rows in microseconds.

`BigIntegerField` (64-bit signed integer) is used throughout. No `FloatField` or `DecimalField`. Paise as integers avoids all floating-point representation errors. ₹1,00,00,000 is stored as `10_000_000_00` paise — well within 64-bit range.

---

## 2. The Lock

**Exact code from `payouts/views.py`:**

```python
with transaction.atomic():
    # Acquire a row-level exclusive lock on the merchant row.
    # No other transaction can SELECT FOR UPDATE or UPDATE this row
    # until our transaction commits or rolls back.
    locked_merchant = Merchant.objects.select_for_update().get(id=merchant.id)

    # Balance computed inside the lock — no stale reads possible.
    ledger_balance = LedgerEntry.objects.filter(
        merchant=locked_merchant
    ).aggregate(total=Sum('amount_paise'))['total'] or 0

    held = Payout.objects.filter(
        merchant=locked_merchant,
        status__in=[Payout.PENDING, Payout.PROCESSING],
    ).aggregate(total=Sum('amount_paise'))['total'] or 0

    available = ledger_balance - held

    if amount_paise > available:
        raise ValueError(f'Insufficient balance: available={available} paise')

    payout = Payout.objects.create(...)  # created inside the same transaction
```

**The database primitive:** PostgreSQL row-level locking via `SELECT ... FOR UPDATE`.

When two concurrent requests arrive simultaneously for the same merchant:
1. Both enter `transaction.atomic()`.
2. Both issue `SELECT ... FOR UPDATE` on the same merchant row.
3. PostgreSQL grants the lock to exactly one. The other **blocks at the DB level** — not in Python, not with a `threading.Lock`, at the actual storage engine.
4. The winner reads balance, checks sufficiency, creates the payout, and commits. The lock is released on commit.
5. The loser now acquires the lock, re-reads the balance (which now reflects the winner's pending payout via the `held` calculation), finds insufficient funds, and raises `ValueError`.

This is **not** optimistic locking. It's pessimistic serialisation. The check and the deduct happen in the same serialised transaction — there is no window between them.

**Why not application-level locking (e.g. Redis SETNX)?** Application locks can leak if a process crashes. Database row locks are automatically released when the connection/transaction dies. For money, database-level is the right choice.

---

## 3. The Idempotency

**How the system knows it has seen a key before (`payouts/views.py`):**

```python
obj, created = IdempotencyKey.objects.get_or_create(
    merchant=merchant,
    key=raw_key,
    defaults={'expires_at': expires_at},
)
```

`IdempotencyKey` has a `unique_together = [('merchant', 'key')]` constraint. `get_or_create` is backed by PostgreSQL's `INSERT ... ON CONFLICT` semantics, making it atomic. The first request inserts a row and gets `created=True`. Every subsequent request finds the existing row and gets `created=False`.

**What happens if the first request is still in-flight when the second arrives:**

The `IdempotencyKey` row has two states:
- `resolved_at = NULL` — first request is still processing (in-flight).
- `resolved_at = <timestamp>` — first request finished; `response_body` and `response_status` are populated.

```python
if not created:
    if idem.is_resolved():
        # First request finished — replay its exact response.
        return Response(idem.response_body, status=idem.response_status)
    else:
        # First request still in-flight — return 409 Conflict.
        return Response(
            {'error': 'A request with this idempotency key is already in progress'},
            status=status.HTTP_409_CONFLICT,
        )
```

The second concurrent request gets a **409 Conflict**, not a duplicate payout. The client can retry after a short wait. This matches Stripe's behaviour.

Keys are scoped per merchant (`unique_together` on `(merchant, key)`) so merchant A using key `"abc"` never collides with merchant B's key `"abc"`. Keys expire after 24 hours and are treated as fresh after expiry.

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

`completed` and `failed` map to empty sets — nothing is allowed out of a terminal state. Attempting `completed → pending` or `failed → completed` raises `ValueError` immediately, before any DB write happens.

Every state change in the codebase goes through `transition_to()`. The background worker does:

```python
payout.transition_to(Payout.PROCESSING, save=False)
# ... bank call ...
payout.transition_to(Payout.COMPLETED, save=True)  # or FAILED
```

Both transitions are inside `transaction.atomic()` blocks with `select_for_update()`. If the atomic block fails (e.g. DB error), the transaction rolls back and the payout stays in its previous state — no partial transitions ever persist.

---

## 5. The AI Audit

**What AI wrote (initial Celery task):**

When I first prompted for the Celery task, the AI generated this pattern for the stuck-payout retry logic:

```python
# AI-generated version — WRONG
@shared_task
def check_stuck_payouts():
    stuck = Payout.objects.filter(
        status='processing',
        processing_started_at__lt=cutoff,
    )
    for payout in stuck:
        with transaction.atomic():
            payout.retry_count += 1
            payout.status = 'pending'
            payout.save()
            process_payout.delay(str(payout.id))
```

**What is wrong with this:**

Two bugs:

1. **No row lock.** The queryset fetches rows outside of `transaction.atomic()`, so between the `filter()` and the `with transaction.atomic():` block, another worker thread or beat instance could also pick up the same payout. Two workers would both set `retry_count += 1` and dispatch `process_payout` twice for the same payout. This is a double-retry race condition.

2. **No `skip_locked`.** Even inside the loop with a transaction, if two beat instances run concurrently, both will try to lock the same rows and one will block, then re-process after the other finishes — again causing double retries.

**What I replaced it with:**

```python
@shared_task
def check_stuck_payouts():
    cutoff = timezone.now() - timedelta(seconds=TIMEOUT)

    with transaction.atomic():
        stuck = Payout.objects.filter(
            status=Payout.PROCESSING,
            processing_started_at__lt=cutoff,
        ).select_for_update(skip_locked=True)  # ← key fix

        for payout in stuck:
            if payout.retry_count < MAX_RETRIES:
                backoff = 2 ** payout.retry_count
                payout.retry_count += 1
                payout.status = Payout.PENDING
                payout.processing_started_at = None
                payout.save(update_fields=[...])
                process_payout.apply_async(args=[str(payout.id)], countdown=backoff)
            else:
                _refund_to_ledger(payout)  # atomically inside same transaction
                payout.transition_to(Payout.FAILED, save=False)
                payout.save(update_fields=[...])
```

`select_for_update(skip_locked=True)` inside a single `transaction.atomic()` block means:
- All rows are locked in one DB round-trip.
- Any other concurrent beat instance that calls the same query will skip already-locked rows instead of blocking.
- The refund and status transition happen atomically — no payout can be failed without its funds being returned in the same commit.

The AI also initially wrote the balance check as:

```python
# AI version — fetches rows into Python, sums in memory — WRONG
entries = LedgerEntry.objects.filter(merchant=merchant)
balance = sum(e.amount_paise for e in entries)
```

This is wrong for two reasons: it loads every ledger row into Python memory (O(n) memory), and it reads outside the `SELECT FOR UPDATE` lock, creating a TOCTOU (time-of-check/time-of-use) window. I replaced it with the `aggregate(Sum(...))` query shown in sections 1 and 2.

---

## Architecture Summary

```
POST /api/v1/payouts
       │
       ├─ Idempotency check (get_or_create on unique constraint)
       │
       └─ transaction.atomic()
              ├─ SELECT merchant FOR UPDATE        ← row lock
              ├─ SUM(ledger_entries)               ← DB-level balance
              ├─ SUM(pending/processing payouts)   ← held funds
              ├─ balance check
              └─ INSERT payout (pending)
                     │
                     └─ Celery: process_payout.apply_async()
                            ├─ pending → processing
                            ├─ simulate bank (70/20/10)
                            ├─ success: INSERT debit ledger + processing → completed
                            └─ failure: INSERT credit refund + processing → failed
                                              (both atomic in same transaction)
```
