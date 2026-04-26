from django.contrib import admin
from django.urls import path, include
from payouts import admin_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('merchants.urls')),
    path('api/v1/', include('payouts.urls')),
    # Admin portal API
    path('api/v1/admin/stats/',                              admin_views.AdminStatsView.as_view()),
    path('api/v1/admin/payouts/',                            admin_views.AdminPayoutsView.as_view()),
    path('api/v1/admin/payouts/<uuid:payout_id>/action/',    admin_views.AdminPayoutActionView.as_view()),
    path('api/v1/admin/retry-stuck/',                        admin_views.AdminRetryStuckView.as_view()),
    path('api/v1/admin/merchants/',                          admin_views.AdminMerchantsView.as_view()),
]
