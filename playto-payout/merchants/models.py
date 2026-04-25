import uuid
from django.db import models
from django.db.models import Sum


class Merchant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'merchants'

    def __str__(self):
        return self.name

    @property
    def available_balance_paise(self):
        """
        Available = total credits - total debits (settled).
        We do NOT subtract held amounts here; held is tracked separately.
        'available' means: credits - debits_settled - held_pending
        """
        from payouts.models import LedgerEntry, Payout
        agg = LedgerEntry.objects.filter(
            merchant=self
        ).aggregate(total=Sum('amount_paise'))
        # Sum is signed: credits +ve, debits -ve
        return agg['total'] or 0

    @property
    def held_balance_paise(self):
        """Sum of paise held by pending/processing payouts."""
        from payouts.models import Payout
        agg = Payout.objects.filter(
            merchant=self,
            status__in=['pending', 'processing']
        ).aggregate(total=Sum('amount_paise'))
        return agg['total'] or 0


class BankAccount(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    merchant = models.ForeignKey(Merchant, on_delete=models.CASCADE, related_name='bank_accounts')
    account_number = models.CharField(max_length=20)
    ifsc_code = models.CharField(max_length=11)
    account_holder = models.CharField(max_length=255)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'bank_accounts'

    def __str__(self):
        return f"{self.account_holder} - {self.account_number[-4:]}"
