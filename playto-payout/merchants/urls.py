from django.urls import path
from . import views

urlpatterns = [
    path('merchants/', views.MerchantListView.as_view(), name='merchant-list'),
    path('merchants/<uuid:merchant_id>/', views.MerchantDetailView.as_view(), name='merchant-detail'),
    path('merchants/<uuid:merchant_id>/ledger/', views.MerchantLedgerView.as_view(), name='merchant-ledger'),
]
