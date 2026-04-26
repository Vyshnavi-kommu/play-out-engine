from django.db.models import Sum, Count, Q
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from merchants.models import Merchant, BankAccount
from .models import Payout, LedgerEntry
from .serializers import PayoutSerializer
from .tasks import check_stuck_payouts, process_payout


class AdminStatsView(APIView):
    """GET /api/v1/admin/stats/"""

    def get(self, request):
        agg = Payout.objects.aggregate(
            total=Count('id'),
            completed=Count('id', filter=Q(status=Payout.COMPLETED)),
            failed=Count('id', filter=Q(status=Payout.FAILED)),
            processing=Count('id', filter=Q(status=Payout.PROCESSING)),
            pending=Count('id', filter=Q(status=Payout.PENDING)),
            volume=Sum('amount_paise', filter=Q(status=Payout.COMPLETED)),
        )
        total = agg['total'] or 0
        success_rate = round((agg['completed'] / total * 100), 1) if total else 0.0

        return Response({
            'total_merchants': Merchant.objects.count(),
            'total_payouts': total,
            'total_volume_paise': agg['volume'] or 0,
            'completed': agg['completed'] or 0,
            'failed': agg['failed'] or 0,
            'processing': agg['processing'] or 0,
            'pending': agg['pending'] or 0,
            'success_rate': success_rate,
        })


class AdminPayoutsView(APIView):
    """GET /api/v1/admin/payouts/?status=processing"""

    def get(self, request):
        status_filter = request.query_params.get('status')
        qs = Payout.objects.select_related('merchant', 'bank_account').order_by('-created_at')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(PayoutSerializer(qs[:200], many=True).data)


class AdminPayoutActionView(APIView):
    """POST /api/v1/admin/payouts/<payout_id>/action/ — force complete or cancel."""

    def post(self, request, payout_id):
        action = request.data.get('action')
        if action not in ('complete', 'cancel'):
            return Response({'error': 'action must be "complete" or "cancel"'}, status=400)

        try:
            payout = Payout.objects.select_related('merchant', 'bank_account').get(id=payout_id)
        except (Payout.DoesNotExist, Exception):
            return Response({'error': 'Payout not found'}, status=404)

        if payout.status not in (Payout.PENDING, Payout.PROCESSING):
            return Response(
                {'error': f'Cannot {action} a payout in "{payout.status}" state'},
                status=400,
            )

        with transaction.atomic():
            payout = (
                Payout.objects
                .select_for_update()
                .select_related('merchant', 'bank_account')
                .get(id=payout_id)
            )

            if action == 'complete':
                # If still pending, transition to processing first so state machine is happy
                if payout.status == Payout.PENDING:
                    payout.transition_to(Payout.PROCESSING, save=False)
                    payout.processing_started_at = timezone.now()
                    payout.save(update_fields=['status', 'processing_started_at', 'updated_at'])

                # Debit ledger — this is what records money leaving the merchant balance
                LedgerEntry.objects.create(
                    merchant=payout.merchant,
                    entry_type=LedgerEntry.DEBIT,
                    amount_paise=-payout.amount_paise,
                    description=(
                        f'Admin forced completion — ••••{payout.bank_account.account_number[-4:]}'
                    ),
                    reference_id=str(payout.id),
                )
                payout.transition_to(Payout.COMPLETED, save=True)
                return Response({'status': 'completed', 'message': 'Payout marked as completed'})

            else:  # cancel
                # No ledger entry needed — funds were never debited, hold releases with status change
                payout.failure_reason = 'Cancelled by admin'
                payout.transition_to(Payout.FAILED, save=False)
                payout.save(update_fields=['status', 'failure_reason', 'updated_at'])
                return Response({'status': 'failed', 'message': 'Payout cancelled successfully'})


class AdminRetryStuckView(APIView):
    """POST /api/v1/admin/retry-stuck/"""

    def post(self, request):
        stuck = Payout.objects.filter(status=Payout.PROCESSING)
        count = stuck.count()
        if count == 0:
            return Response({'retried': 0, 'message': 'No stuck payouts found'})

        stuck.update(processing_started_at=timezone.now() - timedelta(seconds=60))
        check_stuck_payouts()

        outcomes = {}
        for p in Payout.objects.filter(id__in=stuck.values_list('id', flat=True)):
            outcomes[str(p.id)[:8]] = p.status

        return Response({
            'retried': count,
            'message': f'Retried {count} stuck payout(s)',
            'outcomes': outcomes,
        })


class AdminMerchantsView(APIView):
    """
    GET  /api/v1/admin/merchants/  — all merchants with full stats
    POST /api/v1/admin/merchants/  — create a new merchant
    """

    def get(self, request):
        merchants = Merchant.objects.prefetch_related('bank_accounts').all()
        data = []
        for m in merchants:
            ledger = LedgerEntry.objects.filter(merchant=m).aggregate(
                total=Sum('amount_paise'))['total'] or 0
            held = Payout.objects.filter(
                merchant=m, status__in=[Payout.PENDING, Payout.PROCESSING]
            ).aggregate(total=Sum('amount_paise'))['total'] or 0
            payout_stats = Payout.objects.filter(merchant=m).aggregate(
                total=Count('id'),
                completed=Count('id', filter=Q(status=Payout.COMPLETED)),
                failed=Count('id', filter=Q(status=Payout.FAILED)),
                processing=Count('id', filter=Q(status=Payout.PROCESSING)),
            )
            bank_accounts = [
                {
                    'id': str(b.id),
                    'account_holder': b.account_holder,
                    'account_number': b.account_number,
                    'ifsc_code': b.ifsc_code,
                    'is_primary': b.is_primary,
                }
                for b in m.bank_accounts.all()
            ]
            data.append({
                'id': str(m.id),
                'name': m.name,
                'email': m.email,
                'available_balance_paise': ledger - held,
                'held_balance_paise': held,
                'total_payouts': payout_stats['total'],
                'completed_payouts': payout_stats['completed'],
                'failed_payouts': payout_stats['failed'],
                'processing_payouts': payout_stats['processing'],
                'bank_accounts': bank_accounts,
                'created_at': m.created_at,
            })
        return Response(data)

    def post(self, request):
        name = request.data.get('name', '').strip()
        email = request.data.get('email', '').strip()
        account_number = request.data.get('account_number', '').strip()
        ifsc_code = request.data.get('ifsc_code', '').strip().upper()
        account_holder = request.data.get('account_holder', '').strip()
        initial_balance_paise = int(request.data.get('initial_balance_paise', 0) or 0)

        errors = {}
        if not name:           errors['name'] = 'Required'
        if not email:          errors['email'] = 'Required'
        if not account_number: errors['account_number'] = 'Required'
        if not ifsc_code:      errors['ifsc_code'] = 'Required'
        if not account_holder: errors['account_holder'] = 'Required'
        if errors:
            return Response({'error': 'Validation failed', 'fields': errors}, status=400)

        if Merchant.objects.filter(email=email).exists():
            return Response({'error': 'A merchant with this email already exists'}, status=400)

        if len(account_number) < 8 or len(account_number) > 18:
            return Response({'error': 'Account number must be 8–18 digits'}, status=400)

        if len(ifsc_code) != 11:
            return Response({'error': 'IFSC code must be exactly 11 characters'}, status=400)

        with transaction.atomic():
            merchant = Merchant.objects.create(name=name, email=email)
            BankAccount.objects.create(
                merchant=merchant,
                account_number=account_number,
                ifsc_code=ifsc_code,
                account_holder=account_holder,
                is_primary=True,
            )
            if initial_balance_paise > 0:
                LedgerEntry.objects.create(
                    merchant=merchant,
                    entry_type=LedgerEntry.CREDIT,
                    amount_paise=initial_balance_paise,
                    description='Initial balance credited by admin',
                    reference_id='admin-initial-credit',
                )

        return Response({
            'id': str(merchant.id),
            'name': merchant.name,
            'email': merchant.email,
            'message': 'Merchant created successfully',
        }, status=201)
