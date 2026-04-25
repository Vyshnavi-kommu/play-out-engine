import uuid
import logging
from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from merchants.models import Merchant, BankAccount
from .models import LedgerEntry, IdempotencyKey, Payout
from .serializers import PayoutSerializer, PayoutCreateSerializer
from .tasks import process_payout

logger = logging.getLogger(__name__)


def _get_or_create_idempotency_key(merchant, raw_key):
    """
    Returns (idem_key_obj, created: bool).
    Uses get_or_create which is atomic at the DB level due to unique_together constraint.
    If the row already exists, we return it (created=False).
    """
    from datetime import timedelta
    expires_at = timezone.now() + timedelta(hours=settings.IDEMPOTENCY_KEY_TTL_HOURS)

    try:
        obj, created = IdempotencyKey.objects.get_or_create(
            merchant=merchant,
            key=raw_key,
            defaults={'expires_at': expires_at},
        )
        if not created and obj.is_expired():
            # Expired key: delete and recreate — treat as fresh request.
            obj.delete()
            obj = IdempotencyKey.objects.create(
                merchant=merchant, key=raw_key, expires_at=expires_at
            )
            created = True
        return obj, created
    except Exception:
        # Duplicate insert race — another request won. Fetch the winner.
        obj = IdempotencyKey.objects.get(merchant=merchant, key=raw_key)
        return obj, False


class PayoutCreateView(APIView):
    """
    POST /api/v1/payouts
    Headers:  Idempotency-Key: <uuid>
    Body:     { amount_paise: int, bank_account_id: uuid }
    """

    def post(self, request):
        # request.headers works for real HTTP; test client uses META['HTTP_IDEMPOTENCY_KEY']
        raw_key = (
            request.headers.get('Idempotency-Key')
            or request.META.get('HTTP_IDEMPOTENCY_KEY', '')
        ).strip()
        if not raw_key:
            return Response(
                {'error': 'Idempotency-Key header is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- Parse input ---
        serializer = PayoutCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        amount_paise = serializer.validated_data['amount_paise']
        bank_account_id = serializer.validated_data['bank_account_id']

        # --- Resolve merchant (simplified: from query param or first merchant) ---
        merchant_id = request.query_params.get('merchant_id') or request.data.get('merchant_id')
        if not merchant_id:
            return Response({'error': 'merchant_id required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            merchant = Merchant.objects.get(id=merchant_id)
        except Merchant.DoesNotExist:
            return Response({'error': 'Merchant not found'}, status=status.HTTP_404_NOT_FOUND)

        # --- Idempotency check (outside main transaction) ---
        idem, created = _get_or_create_idempotency_key(merchant, raw_key)

        if not created:
            # Key already exists. Wait for it to resolve or replay stored response.
            if idem.is_resolved():
                return Response(idem.response_body, status=idem.response_status)
            else:
                # First request still in-flight. Return 409 Conflict.
                return Response(
                    {'error': 'A request with this idempotency key is already in progress'},
                    status=status.HTTP_409_CONFLICT,
                )

        # --- Main atomic transaction: balance check + hold + payout creation ---
        try:
            with transaction.atomic():
                # SELECT FOR UPDATE on merchant row.
                # This acquires a row-level lock in PostgreSQL, serialising all
                # concurrent payout requests for the same merchant.
                # The lock is held until the transaction commits, so no other
                # transaction can read-modify-write the balance concurrently.
                locked_merchant = Merchant.objects.select_for_update().get(id=merchant.id)

                # Balance = DB-level SUM of signed ledger entries (not Python arithmetic).
                ledger_balance = LedgerEntry.objects.filter(
                    merchant=locked_merchant
                ).aggregate(total=Sum('amount_paise'))['total'] or 0

                # Held = sum of pending+processing payouts (not yet settled in ledger).
                held = Payout.objects.filter(
                    merchant=locked_merchant,
                    status__in=[Payout.PENDING, Payout.PROCESSING],
                ).aggregate(total=Sum('amount_paise'))['total'] or 0

                available = ledger_balance - held

                try:
                    bank_account = BankAccount.objects.get(
                        id=bank_account_id, merchant=locked_merchant
                    )
                except BankAccount.DoesNotExist:
                    raise ValueError('Bank account not found or does not belong to merchant')

                if amount_paise <= 0:
                    raise ValueError('amount_paise must be positive')
                if amount_paise > available:
                    raise ValueError(
                        f'Insufficient balance: available={available} paise, requested={amount_paise} paise'
                    )

                payout = Payout.objects.create(
                    merchant=locked_merchant,
                    bank_account=bank_account,
                    amount_paise=amount_paise,
                    status=Payout.PENDING,
                    idempotency_key=raw_key,
                )

            # Transaction committed — funds are held (payout in PENDING state).
            response_data = PayoutSerializer(payout).data
            resp_status = status.HTTP_201_CREATED

            # Store response in idempotency record.
            # We use a trick to ensure it's JSON serializable (UUIDs -> strings)
            # which is needed for some DB backends like SQLite.
            from django.core.serializers.json import DjangoJSONEncoder
            import json
            serializable_data = json.loads(json.dumps(response_data, cls=DjangoJSONEncoder))

            IdempotencyKey.objects.filter(id=idem.id).update(
                response_body=serializable_data,
                response_status=resp_status,
                resolved_at=timezone.now(),
            )

            # Dispatch background worker.
            process_payout.apply_async(args=[str(payout.id)], countdown=1)

            return Response(response_data, status=resp_status)

        except ValueError as exc:
            err_body = {'error': str(exc)}
            err_status = status.HTTP_400_BAD_REQUEST
            IdempotencyKey.objects.filter(id=idem.id).update(
                response_body=err_body,
                response_status=err_status,
                resolved_at=timezone.now(),
            )
            return Response(err_body, status=err_status)

        except Exception as exc:
            logger.exception("Unexpected error creating payout")
            # Delete unresolved idempotency key so client can retry.
            IdempotencyKey.objects.filter(id=idem.id, resolved_at__isnull=True).delete()
            return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PayoutListView(APIView):
    """GET /api/v1/payouts?merchant_id=<uuid>"""

    def get(self, request):
        merchant_id = request.query_params.get('merchant_id')
        if not merchant_id:
            return Response({'error': 'merchant_id required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            merchant = Merchant.objects.get(id=merchant_id)
        except Merchant.DoesNotExist:
            return Response({'error': 'Merchant not found'}, status=status.HTTP_404_NOT_FOUND)

        payouts = Payout.objects.filter(merchant=merchant).order_by('-created_at')[:50]
        return Response(PayoutSerializer(payouts, many=True).data)


class PayoutDetailView(APIView):
    """GET /api/v1/payouts/<payout_id>?merchant_id=<uuid>"""

    def get(self, request, payout_id):
        merchant_id = request.query_params.get('merchant_id')
        try:
            payout = Payout.objects.get(id=payout_id, merchant_id=merchant_id)
        except Payout.DoesNotExist:
            return Response({'error': 'Payout not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(PayoutSerializer(payout).data)
