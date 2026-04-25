from rest_framework import serializers
from .models import Payout, LedgerEntry
from merchants.models import BankAccount


class PayoutSerializer(serializers.ModelSerializer):
    merchant_name = serializers.CharField(source='merchant.name', read_only=True)
    bank_account_last4 = serializers.SerializerMethodField()

    class Meta:
        model = Payout
        fields = [
            'id', 'merchant', 'merchant_name', 'bank_account',
            'bank_account_last4', 'amount_paise', 'status',
            'failure_reason', 'retry_count', 'created_at', 'updated_at',
        ]

    def get_bank_account_last4(self, obj):
        return obj.bank_account.account_number[-4:]


class PayoutCreateSerializer(serializers.Serializer):
    amount_paise = serializers.IntegerField(min_value=1)
    bank_account_id = serializers.UUIDField()
    merchant_id = serializers.UUIDField(required=False)


class LedgerEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = LedgerEntry
        fields = ['id', 'entry_type', 'amount_paise', 'description', 'reference_id', 'created_at']
