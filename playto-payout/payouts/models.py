import uuid
from django.db import models
from django.utils import timezone


class LedgerEntry(models.Model):
    """
    Immutable double-entry ledger.
    amount_paise is SIGNED:  +ve = credit (money in), -ve = debit (money out).
    Balance = SUM(amount_paise) via DB aggregation — never calculated in Python
    from fetched rows, always a single DB SUM query.
    """
    CREDIT = 'credit'
    DEBIT = 'debit'
    ENTRY_TYPES = [(CREDIT, 'Credit'), (DEBIT, 'Debit')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    merchant = models.ForeignKey(
        'merchants.Merchant', on_delete=models.PROTECT, related_name='ledger_entries'
    )
    entry_type = models.CharField(max_length=10, choices=ENTRY_TYPES)
    # Signed: credits are +ve, debits are -ve.
    amount_paise = models.BigIntegerField()
    description = models.CharField(max_length=500)
    reference_id = models.CharField(max_length=255, blank=True)  # payout UUID or payment ref
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ledger_entries'
        indexes = [models.Index(fields=['merchant', 'created_at'])]

    def __str__(self):
        sign = '+' if self.amount_paise > 0 else ''
        return f"{self.merchant.name} | {sign}{self.amount_paise} paise | {self.description}"


class IdempotencyKey(models.Model):
    """
    Stores idempotency keys per merchant to detect duplicate requests.
    On a cache hit, return the stored response without creating a new payout.
    Keys expire after settings.IDEMPOTENCY_KEY_TTL_HOURS.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    merchant = models.ForeignKey(
        'merchants.Merchant', on_delete=models.CASCADE, related_name='idempotency_keys'
    )
    key = models.CharField(max_length=255)
    # The full serialised response body to replay on duplicate calls.
    response_body = models.JSONField(null=True, blank=True)
    # HTTP status code to replay.
    response_status = models.IntegerField(default=200)
    # NULL while the first request is still in-flight; set after completion.
    locked_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = 'idempotency_keys'
        # Unique per (merchant, key) — different merchants may use same key string.
        unique_together = [('merchant', 'key')]
        indexes = [models.Index(fields=['expires_at'])]

    def is_expired(self):
        return timezone.now() > self.expires_at

    def is_resolved(self):
        return self.resolved_at is not None


# ── Payout State Machine ──────────────────────────────────────────────────────
# Legal transitions:
#   pending     → processing  (worker picks it up)
#   processing  → completed   (bank success)
#   processing  → failed      (bank failure or max retries exceeded)
#
# All other transitions are ILLEGAL and raise ValueError.

LEGAL_TRANSITIONS = {
    'pending': {'processing'},
    'processing': {'completed', 'failed'},
    'completed': set(),   # terminal
    'failed': set(),      # terminal
}


class Payout(models.Model):
    PENDING = 'pending'
    PROCESSING = 'processing'
    COMPLETED = 'completed'
    FAILED = 'failed'

    STATUS_CHOICES = [
        (PENDING, 'Pending'),
        (PROCESSING, 'Processing'),
        (COMPLETED, 'Completed'),
        (FAILED, 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    merchant = models.ForeignKey(
        'merchants.Merchant', on_delete=models.PROTECT, related_name='payouts'
    )
    bank_account = models.ForeignKey(
        'merchants.BankAccount', on_delete=models.PROTECT, related_name='payouts'
    )
    amount_paise = models.BigIntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING)
    idempotency_key = models.CharField(max_length=255)
    failure_reason = models.CharField(max_length=500, blank=True)
    retry_count = models.IntegerField(default=0)
    processing_started_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payouts'
        indexes = [
            models.Index(fields=['merchant', 'status', 'created_at']),
            models.Index(fields=['status', 'processing_started_at']),
        ]

    def __str__(self):
        return f"Payout {self.id} | {self.merchant.name} | {self.amount_paise} paise | {self.status}"

    def transition_to(self, new_status, save=True):
        """
        Enforces the state machine. Raises ValueError on illegal transition.
        Called inside atomic transactions so partial writes never persist.
        """
        allowed = LEGAL_TRANSITIONS.get(self.status, set())
        if new_status not in allowed:
            raise ValueError(
                f"Illegal state transition: {self.status} → {new_status}"
            )
        self.status = new_status
        if save:
            self.save(update_fields=['status', 'updated_at'])
