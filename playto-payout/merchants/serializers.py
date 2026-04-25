from rest_framework import serializers
from django.db.models import Sum
from .models import Merchant, BankAccount
from payouts.models import LedgerEntry, Payout


class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = ['id', 'account_number', 'ifsc_code', 'account_holder', 'is_primary', 'created_at']


class MerchantBalanceSerializer(serializers.ModelSerializer):
    available_balance_paise = serializers.SerializerMethodField()
    held_balance_paise = serializers.SerializerMethodField()
    bank_accounts = BankAccountSerializer(many=True, read_only=True)

    class Meta:
        model = Merchant
        fields = ['id', 'name', 'email', 'available_balance_paise', 'held_balance_paise', 'bank_accounts', 'created_at']

    def get_available_balance_paise(self, obj):
        """
        available = total ledger sum - held by open payouts
        Both computed at DB level with SUM aggregation — no Python arithmetic on rows.
        """
        ledger_sum = LedgerEntry.objects.filter(merchant=obj).aggregate(
            total=Sum('amount_paise')
        )['total'] or 0

        held = Payout.objects.filter(
            merchant=obj,
            status__in=[Payout.PENDING, Payout.PROCESSING]
        ).aggregate(total=Sum('amount_paise'))['total'] or 0

        return ledger_sum - held

    def get_held_balance_paise(self, obj):
        return Payout.objects.filter(
            merchant=obj,
            status__in=[Payout.PENDING, Payout.PROCESSING]
        ).aggregate(total=Sum('amount_paise'))['total'] or 0
