
# apps/ecommerce/sales/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.contrib.auth.decorators import login_required
from .views import (
    SaleViewSet,
    SaleItemViewSet,
    SalePaymentViewSet,
    SaleListCreateAPIView,
    SaleTemplateView,
    SalePOSView
)

# Router para ViewSets
router = DefaultRouter()
router.register(r'sales', SaleViewSet, basename='sale')
router.register(r'sale-items', SaleItemViewSet, basename='sale-item')
router.register(r'sale-payments', SalePaymentViewSet, basename='sale-payment')

urlpatterns = [
    # API endpoints específicos
    path('sales/data/', SaleListCreateAPIView.as_view(), name='sales-data'),
    
    # ViewSets del router
    path('', include(router.urls)),
    
    # Vistas de plantillas (templates)

]
