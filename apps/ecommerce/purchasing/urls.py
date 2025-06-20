

# apps/ecommerce/purchasing/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.contrib.auth.decorators import login_required
from .views import (
    PurchaseOrderViewSet,
    PurchaseOrderItemViewSet,
    PurchaseOrderListCreateAPIView,
    PurchasingProductDetailAPIView,
    PurchasingProductsAPIView,
    PurchasingSupplierDetailAPIView,
    PurchasingSuppliersAPIView,
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
    
    
        # ✅ NUEVAS RUTAS PARA SUPPLIERS
    path('api/suppliers/', PurchasingSuppliersAPIView.as_view(), name='purchasing-suppliers'),
    path('api/suppliers/<int:pk>/', PurchasingSupplierDetailAPIView.as_view(), name='purchasing-supplier-detail'),
    
    # ✅ NUEVAS RUTAS PARA PRODUCTS
    path('api/products/', PurchasingProductsAPIView.as_view(), name='purchasing-products'),
    path('api/products/<int:pk>/', PurchasingProductDetailAPIView.as_view(), name='purchasing-product-detail'),
    
    # Incluir rutas del router
    path('', include(router.urls)),
    

]