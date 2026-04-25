"""
Seed script — run with: python manage.py shell < seed.py
Or as a management command: python manage.py seed_data
"""
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import transaction
from merchants.models import Merchant, BankAccount
from payouts.models import LedgerEntry

MERCHANTS = [
    {
        'name': 'Priya Creative Studio',
        'email': 'priya@creativestudio.in',
        'bank': {'account_number': '0012345678901', 'ifsc_code': 'HDFC0001234', 'account_holder': 'Priya Sharma'},
        'credits': [
            (500000, 'Payment from Acme Corp - Invoice #INV-001'),
            (750000, 'Payment from GlobalTech - Invoice #INV-002'),
            (200000, 'Payment from StartupXYZ - Invoice #INV-003'),
        ],
    },
    {
        'name': 'Ravi Freelance Dev',
        'email': 'ravi@freelancedev.io',
        'bank': {'account_number': '9876543210001', 'ifsc_code': 'ICIC0005678', 'account_holder': 'Ravi Kumar'},
        'credits': [
            (1000000, 'Project payment - E-commerce platform'),
            (300000, 'Maintenance retainer - March 2025'),
            (450000, 'Consulting fee - AI integration project'),
        ],
    },
    {
        'name': 'NexGen Digital Agency',
        'email': 'billing@nexgendigital.co',
        'bank': {'account_number': '1122334455667', 'ifsc_code': 'SBIN0009012', 'account_holder': 'NexGen Digital Pvt Ltd'},
        'credits': [
            (2000000, 'Retainer - Q1 2025'),
            (1500000, 'Campaign management - Brand X'),
            (800000, 'SEO & Analytics - Brand Y'),
        ],
    },
]

with transaction.atomic():
    for m_data in MERCHANTS:
        merchant, created = Merchant.objects.get_or_create(
            email=m_data['email'],
            defaults={'name': m_data['name']}
        )
        if created:
            print(f"Created merchant: {merchant.name} ({merchant.id})")
        else:
            print(f"Merchant exists: {merchant.name}")

        bank, _ = BankAccount.objects.get_or_create(
            merchant=merchant,
            account_number=m_data['bank']['account_number'],
            defaults={**m_data['bank'], 'is_primary': True}
        )

        if not LedgerEntry.objects.filter(merchant=merchant).exists():
            for amount, desc in m_data['credits']:
                LedgerEntry.objects.create(
                    merchant=merchant,
                    entry_type=LedgerEntry.CREDIT,
                    amount_paise=amount,
                    description=desc,
                    reference_id=f'seed-{merchant.id}',
                )
            print(f"  → Seeded {len(m_data['credits'])} credit entries")

print("\nSeed complete. Merchant IDs:")
for m in Merchant.objects.all():
    total = sum(e.amount_paise for e in m.ledger_entries.all())
    print(f"  {m.name}: {m.id}  |  balance: ₹{total/100:.2f}")
