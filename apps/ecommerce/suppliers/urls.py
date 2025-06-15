# apps/suppliers/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.contrib.auth.decorators import login_required
from .views import (
    SupplierViewSet, 
    SupplierContactViewSet,
    ActiveSupplierListAPIView,
    SupplierListCreateAPIView,
    SupplierTemplateView
)

# Router para API REST
router = DefaultRouter()
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'supplier-contacts', SupplierContactViewSet, basename='supplier-contact')

urlpatterns = [
    # API endpoints
    path('suppliers/data/', SupplierListCreateAPIView.as_view(), name='suppliers-data'),
    path('suppliers/active/', ActiveSupplierListAPIView.as_view(), name='suppliers-active'),
    
    # Incluir todas las rutas del router
    path('', include(router.urls)),
    
    # Vistas de plantillas
    path(
        "app/suppliers/list/",
        login_required(SupplierTemplateView.as_view(template_name="app_suppliers_list.html")),
        name="app-suppliers-list",
    ),
    path(
        "app/suppliers/add/",
        login_required(SupplierTemplateView.as_view(template_name="app_suppliers_add.html")),
        name="app-suppliers-add",
    ),
    path(
        "app/suppliers/details/<int:supplier_id>/",
        login_required(SupplierTemplateView.as_view(template_name="app_suppliers_details.html")),
        name="app-suppliers-details",
    ),
    path(
        "app/suppliers/dashboard/",
        login_required(SupplierTemplateView.as_view(template_name="app_suppliers_dashboard.html")),
        name="app-suppliers-dashboard",
    ),
]