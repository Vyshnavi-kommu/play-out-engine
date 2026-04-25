from django.contrib import admin
from .models import Merchant, BankAccount


@admin.register(Merchant)
class MerchantAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'created_at']
    search_fields = ['name', 'email']


@admin.register(BankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    list_display = ['account_holder', 'account_number', 'ifsc_code', 'merchant', 'is_primary']
    list_filter = ['is_primary']
