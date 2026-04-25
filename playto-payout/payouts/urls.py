from django.urls import path
from . import views

urlpatterns = [
    path('payouts', views.PayoutCreateView.as_view(), name='payout-create'),
    path('payouts/', views.PayoutListView.as_view(), name='payout-list'),
    path('payouts/<uuid:payout_id>/', views.PayoutDetailView.as_view(), name='payout-detail'),
]
