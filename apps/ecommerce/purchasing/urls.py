

# apps/ecommerce/purchasing/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.contrib.auth.decorators import login_required
from .views import (
    PurchaseOrderViewSet,
    PurchaseOrderItemViewSet,
    PurchaseOrderListCreateAPIView,
    QuickPurchaseOrderAPIView,
    SupplierPurchaseHistoryAPIView,
    PurchaseOrderListView,
    PurchaseOrderCreateView,
    PurchaseOrderDetailView,
    PurchaseOrderDashboardView
)

# Router para ViewSets
router = DefaultRouter()
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchase-order')
router.register(r'purchase-order-items', PurchaseOrderItemViewSet, basename='purchase-order-item')

urlpatterns = [
    # API endpoints específicos
    path('purchase-orders/data/', PurchaseOrderListCreateAPIView.as_view(), name='purchase-orders-data'),
    path('purchase-orders/quick-create/', QuickPurchaseOrderAPIView.as_view(), name='quick-purchase-order'),
    path('suppliers/<int:supplier_id>/purchase-history/', SupplierPurchaseHistoryAPIView.as_view(), name='supplier-purchase-history'),
    
    # Incluir rutas del router
    path('', include(router.urls)),
    

]