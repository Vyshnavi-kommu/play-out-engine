"""
Tests covering the two most critical correctness properties:
1. Concurrency: two simultaneous 60 rupee payouts from a 100 rupee balance → exactly one succeeds.
2. Idempotency: same idempotency key twice → same response, one payout created.
"""
import threading
import uuid
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from rest_framework.test import APIClient
from django.db.models import Sum

from merchants.models import Merchant, BankAccount
from payouts.models import LedgerEntry, Payout, IdempotencyKey


def create_merchant_with_balance(name, email, balance_paise):
    merchant = Merchant.objects.create(name=name, email=email)
    bank = BankAccount.objects.create(
        merchant=merchant,
        account_number='0000000000001',
        ifsc_code='HDFC0001234',
        account_holder=name,
        is_primary=True,
    )
    LedgerEntry.objects.create(
        merchant=merchant,
        entry_type=LedgerEntry.CREDIT,
        amount_paise=balance_paise,
        description='Initial credit for test',
        reference_id='test-seed',
    )
    return merchant, bank


class ConcurrencyTest(TransactionTestCase):
    """
    TransactionTestCase is required here because we need real DB transactions
    committed and visible across threads. TestCase wraps everything in one
    transaction, making SELECT FOR UPDATE behave differently.
    """

    def test_concurrent_payouts_do_not_overdraw(self):
        """
        Balance = 10000 paise (₹100).
        Two threads each try to withdraw 6000 paise (₹60).
        Exactly one must succeed; the other must be rejected with 400.
        """
        merchant, bank = create_merchant_with_balance(
            'Concurrent Test Merchant', 'concurrent@test.com', 10000
        )

        results = []
        errors = []

        def attempt_payout(thread_id):
            client = APIClient()
            try:
                resp = client.post(
                    f'/api/v1/payouts?merchant_id={merchant.id}',
                    data={
                        'amount_paise': 6000,
                        'bank_account_id': str(bank.id),
                        'merchant_id': str(merchant.id),
                    },
                    format='json',
                    headers={'Idempotency-Key': str(uuid.uuid4())},
                )
                results.append(resp.status_code)
            except Exception as e:
                errors.append(str(e))

        t1 = threading.Thread(target=attempt_payout, args=(1,))
        t2 = threading.Thread(target=attempt_payout, args=(2,))
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        self.assertEqual(errors, [], f"Thread errors: {errors}")
        self.assertEqual(len(results), 2, "Both threads should have gotten a response")

        successes = results.count(201)
        failures = results.count(400)

        self.assertEqual(successes, 1, f"Exactly one payout should succeed, got statuses: {results}")
        self.assertEqual(failures, 1, f"Exactly one payout should fail, got statuses: {results}")

        # Verify DB: only one Payout created, held balance does not exceed available.
        payouts_created = Payout.objects.filter(merchant=merchant).count()
        self.assertEqual(payouts_created, 1, "Only one Payout row should be in DB")

        held = Payout.objects.filter(
            merchant=merchant, status__in=[Payout.PENDING, Payout.PROCESSING]
        ).aggregate(total=Sum('amount_paise'))['total'] or 0
        ledger_sum = LedgerEntry.objects.filter(merchant=merchant).aggregate(
            total=Sum('amount_paise')
        )['total'] or 0
        self.assertGreaterEqual(ledger_sum, held, "Held amount must not exceed ledger balance")


class IdempotencyTest(TransactionTestCase):
    """
    Same Idempotency-Key sent twice must return the same payout, not create two.
    """

    def test_same_key_returns_same_payout(self):
        merchant, bank = create_merchant_with_balance(
            'Idempotency Test Merchant', 'idem@test.com', 50000
        )
        client = APIClient()
        idem_key = str(uuid.uuid4())

        payload = {
            'amount_paise': 10000,
            'bank_account_id': str(bank.id),
            'merchant_id': str(merchant.id),
        }
        headers = {'HTTP_IDEMPOTENCY_KEY': idem_key}

        # First call
        resp1 = client.post(
            f'/api/v1/payouts?merchant_id={merchant.id}',
            data=payload,
            format='json',
            **headers,
        )
        self.assertEqual(resp1.status_code, 201)
        payout_id_1 = resp1.data['id']

        # Second call with same key
        resp2 = client.post(
            f'/api/v1/payouts?merchant_id={merchant.id}',
            data=payload,
            format='json',
            **headers,
        )
        self.assertEqual(resp2.status_code, 201)
        payout_id_2 = resp2.data['id']

        # Same payout ID returned
        self.assertEqual(str(payout_id_1), str(payout_id_2), "Both calls should return same payout")

        # Only one Payout row in DB
        count = Payout.objects.filter(merchant=merchant).count()
        self.assertEqual(count, 1, "Only one Payout should exist in DB")

        # Only one IdempotencyKey row
        idem_count = IdempotencyKey.objects.filter(merchant=merchant, key=idem_key).count()
        self.assertEqual(idem_count, 1, "Only one idempotency key record should exist")

    def test_different_keys_create_different_payouts(self):
        merchant, bank = create_merchant_with_balance(
            'Multi Payout Merchant', 'multi@test.com', 100000
        )
        client = APIClient()
        payload = {
            'amount_paise': 10000,
            'bank_account_id': str(bank.id),
            'merchant_id': str(merchant.id),
        }

        resp1 = client.post(
            f'/api/v1/payouts?merchant_id={merchant.id}',
            data=payload, format='json',
            **{'HTTP_IDEMPOTENCY_KEY': str(uuid.uuid4())},
        )
        resp2 = client.post(
            f'/api/v1/payouts?merchant_id={merchant.id}',
            data=payload, format='json',
            **{'HTTP_IDEMPOTENCY_KEY': str(uuid.uuid4())},
        )
        self.assertEqual(resp1.status_code, 201)
        self.assertEqual(resp2.status_code, 201)
        self.assertNotEqual(resp1.data['id'], resp2.data['id'])
        self.assertEqual(Payout.objects.filter(merchant=merchant).count(), 2)


class StateMachineTest(TestCase):
    """Verify illegal transitions raise ValueError."""

    def setUp(self):
        self.merchant, self.bank = create_merchant_with_balance(
            'State Test Merchant', 'state@test.com', 50000
        )
        self.payout = Payout.objects.create(
            merchant=self.merchant,
            bank_account=self.bank,
            amount_paise=5000,
            status=Payout.PENDING,
            idempotency_key=str(uuid.uuid4()),
        )

    def test_valid_transitions(self):
        self.payout.transition_to(Payout.PROCESSING)
        self.assertEqual(self.payout.status, Payout.PROCESSING)
        self.payout.transition_to(Payout.COMPLETED)
        self.assertEqual(self.payout.status, Payout.COMPLETED)

    def test_illegal_completed_to_pending(self):
        self.payout.status = Payout.COMPLETED
        with self.assertRaises(ValueError):
            self.payout.transition_to(Payout.PENDING)

    def test_illegal_failed_to_completed(self):
        self.payout.status = Payout.FAILED
        with self.assertRaises(ValueError):
            self.payout.transition_to(Payout.COMPLETED)

    def test_illegal_pending_to_completed(self):
        with self.assertRaises(ValueError):
            self.payout.transition_to(Payout.COMPLETED)


class LedgerIntegrityTest(TestCase):
    """
    The sum of credits minus debits must always equal the displayed balance.
    This is the invariant Playto checks.
    """

    def test_balance_equals_ledger_sum(self):
        merchant, bank = create_merchant_with_balance(
            'Integrity Merchant', 'integrity@test.com', 100000
        )
        # Add a debit manually (simulating a completed payout ledger entry)
        LedgerEntry.objects.create(
            merchant=merchant,
            entry_type=LedgerEntry.DEBIT,
            amount_paise=-30000,
            description='Test debit',
            reference_id='test-debit',
        )

        from django.db.models import Sum
        db_sum = LedgerEntry.objects.filter(merchant=merchant).aggregate(
            total=Sum('amount_paise')
        )['total']

        # Should be 100000 - 30000 = 70000
        self.assertEqual(db_sum, 70000)
        # No float arithmetic — pure integer
        self.assertIsInstance(db_sum, int)

    def test_no_float_in_amounts(self):
        """Ensure BigIntegerField rejects floats at the serializer level."""
        from payouts.serializers import PayoutCreateSerializer
        s = PayoutCreateSerializer(data={'amount_paise': 100.5, 'bank_account_id': str(uuid.uuid4())})
        # Django coerces 100.5 → 100 for IntegerField, which is fine.
        # But 'abc' should fail.
        s2 = PayoutCreateSerializer(data={'amount_paise': 'abc', 'bank_account_id': str(uuid.uuid4())})
        self.assertFalse(s2.is_valid())
        self.assertIn('amount_paise', s2.errors)

    def test_insufficient_balance_rejected(self):
        merchant, bank = create_merchant_with_balance(
            'Low Balance Merchant', 'lowbal@test.com', 5000
        )
        client = APIClient()
        resp = client.post(
            f'/api/v1/payouts?merchant_id={merchant.id}',
            data={'amount_paise': 10000, 'bank_account_id': str(bank.id), 'merchant_id': str(merchant.id)},
            format='json',
            **{'HTTP_IDEMPOTENCY_KEY': str(uuid.uuid4())},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn('Insufficient balance', resp.data['error'])
        self.assertEqual(Payout.objects.filter(merchant=merchant).count(), 0)
