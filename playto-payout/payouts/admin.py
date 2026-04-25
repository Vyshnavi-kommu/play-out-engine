from django.contrib import admin
from .models import LedgerEntry, Payout, IdempotencyKey


@admin.register(LedgerEntry)
class LedgerEntryAdmin(admin.ModelAdmin):
    list_display = ['merchant', 'entry_type', 'amount_paise', 'description', 'created_at']
    list_filter = ['entry_type']
    search_fields = ['merchant__name', 'reference_id']
    readonly_fields = ['id', 'created_at']

    def has_change_permission(self, request, obj=None):
        return False  # Ledger is immutable

    def has_delete_permission(self, request, obj=None):
        return False  # Ledger is immutable


@admin.register(Payout)
class PayoutAdmin(admin.ModelAdmin):
    list_display = ['id', 'merchant', 'amount_paise', 'status', 'retry_count', 'created_at', 'updated_at']
    list_filter = ['status']
    search_fields = ['merchant__name', 'idempotency_key']
    readonly_fields = ['id', 'created_at', 'updated_at', 'idempotency_key']


@admin.register(IdempotencyKey)
class IdempotencyKeyAdmin(admin.ModelAdmin):
    list_display = ['merchant', 'key', 'response_status', 'locked_at', 'resolved_at', 'expires_at']
    list_filter = ['response_status']
    readonly_fields = ['id', 'locked_at']
