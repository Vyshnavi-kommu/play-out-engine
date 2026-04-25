from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Sum
from .models import Merchant
from .serializers import MerchantBalanceSerializer
from payouts.models import LedgerEntry
from payouts.serializers import LedgerEntrySerializer


class MerchantListView(APIView):
    def get(self, request):
        merchants = Merchant.objects.prefetch_related('bank_accounts').all()
        return Response(MerchantBalanceSerializer(merchants, many=True).data)


class MerchantDetailView(APIView):
    def get(self, request, merchant_id):
        try:
            merchant = Merchant.objects.prefetch_related('bank_accounts').get(id=merchant_id)
        except Merchant.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(MerchantBalanceSerializer(merchant).data)


class MerchantLedgerView(APIView):
    def get(self, request, merchant_id):
        try:
            merchant = Merchant.objects.get(id=merchant_id)
        except Merchant.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        entries = LedgerEntry.objects.filter(merchant=merchant).order_by('-created_at')[:100]
        return Response(LedgerEntrySerializer(entries, many=True).data)
