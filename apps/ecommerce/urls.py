from django.urls import path, include
from .views import eCommerceView
from django.contrib.auth.decorators import login_required
from apps.ecommerce.sales.views import SalePOSView
from apps.ecommerce.purchasing.views import *
from apps.ecommerce.cotizacion.views import(
    EnvioCotizacionListCreateAPIView,
    ImportCotizacionResponseView,
    CotizacionListView,
    CotizacionCreateView,
    CotizacionDetailsView,
    CotizacionCompareView
)
urlpatterns = [
    path('purchasing/', include('apps.ecommerce.purchasing.urls')),
    path('api/', include('apps.ecommerce.categories.urls')),
    path('api/', include('apps.ecommerce.products.urls')),
    path('api/', include('apps.ecommerce.suppliers.urls')),
    path('api/', include('apps.ecommerce.requirements.urls')),
    path('api/', include('apps.ecommerce.cotizacion.urls')),
    path('api/', include('apps.ecommerce.customers.urls')),
    path('api/', include('apps.ecommerce.sales.urls')),
        # Vistas de plantillas
    path(
        "app/purchase-orders/list/",
        login_required(PurchaseOrderListView.as_view()),
        name="app-purchase-orders-list",
    ),
    path(
        "app/purchase-orders/create/",
        login_required(PurchaseOrderCreateView.as_view()),
        name="app-purchase-orders-create",
    ),
    path(
        "app/purchase-orders/detail/<int:po_id>/",
        login_required(PurchaseOrderDetailView.as_view()),
        name="app-purchase-orders-detail",
    ),
    path(
        "app/purchase-orders/dashboard/",
        login_required(PurchaseOrderDashboardView.as_view()),
        name="app-purchase-orders-dashboard",
    ),
    path(
        "app/ecommerce/dashboard/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_dashboard.html")),
        name="app-ecommerce-dashboard",
    ),
    path(
        "app/ecommerce/product/list/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_product_list.html")),
        name="app-ecommerce-product-list",
    ),
    path(
        "app/ecommerce/product/add/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_product_add.html")),
        name="app-ecommerce-product-add",
    ),
    path(
        "app/ecommerce/product/category/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_category_list.html")),
        name="app-ecommerce-product-category-list",
    ),
    path(
        "app/ecommerce/order/list/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_order_list.html")),
        name="app-ecommerce-order-list",
    ),
    path(
        "app/ecommerce/order/details/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_order_details.html")),
        name="app-ecommerce-order-details",
    ),
    path(
        "app/ecommerce/customer_all/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_customer_all.html")),
        name="app-ecommerce-customer-all",
    ),
    path(
        "app/ecommerce/customer/details/overview/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_customer_details_overview.html" )),
        name="app-ecommerce-customer-details-overview",
    ),
    path(
        "app/ecommerce/customer/details/security/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_customer_details_security.html")),
        name="app-ecommerce-customer-details-security",
    ),
    path(
        "app/ecommerce/customer/details/billing/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_customer_details_billing.html")),
        name="app-ecommerce-customer-details-billing",
    ),
    path(
        "app/ecommerce/customer/details/notifications/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_customer_details_notifications.html" )),
        name="app-ecommerce-customer-details-notifications",
    ),
    path(
        "app/ecommerce/manage_reviews/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_manage_reviews.html")),
        name="app-ecommerce-manage-reviews",
    ),
    path(
        "app/ecommerce/referrals/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_referral.html")),
        name="app-ecommerce-referrals",
    ),
    path(
        "app/ecommerce/settings/details/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_settings_detail.html")),
        name="app-ecommerce-settings-detail",
    ),
    path(
        "app/ecommerce/settings/payments/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_settings_payments.html")),
        name="app-ecommerce-settings-payments",
    ),
    path(
        "app/ecommerce/settings/checkout/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_settings_checkout.html")),
        name="app-ecommerce-settings-checkout",
    ),
    path(
        "app/ecommerce/settings/shipping/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_settings_shipping.html")),
        name="app-ecommerce-settings-shipping",
    ),
    path(
        "app/ecommerce/settings/locations/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_settings_locations.html")),
        name="app-ecommerce-settings-locations",
    ),
    path(
        "app/ecommerce/settings/notifications/",
        login_required(eCommerceView.as_view(template_name="app_ecommerce_settings_notifications.html")),
        name="app-ecommerce-settings-notifications",
    ),
    
        path(
        "app/sales/list/",
        login_required(eCommerceView.as_view(template_name="app_sales_list.html")),
        name="app-sales-list",
    ),
    path(
        "app/sales/add/",
        login_required(eCommerceView.as_view(template_name="app_sales_add.html")),
        name="app-sales-add",
    ),
    path(
        "app/sales/details/<int:sale_id>/",
        login_required(eCommerceView.as_view(template_name="app_sales_details.html")),
        name="app-sales-details",
    ),
    path(
        "app/sales/pos/",
        login_required(SalePOSView.as_view()),
        name="app-sales-pos",
    ),
    path(
        "app/sales/dashboard/",
        login_required(eCommerceView.as_view(template_name="app_sales_dashboard.html")),
        name="app-sales-dashboard",
    ),
     path(
        "app/customers/list/",
        login_required(eCommerceView.as_view(template_name="app_customers_list.html")),
        name="app-customers-list",
    ),
    path(
        "app/customers/add/",
        login_required(eCommerceView.as_view(template_name="app_customers_add.html")),
        name="app-customers-add",
    ),
    path(
        "app/customers/details/<int:customer_id>/",
        login_required(eCommerceView.as_view(template_name="app_customers_details.html")),
        name="app-customers-details",
    ),
    path(
        "app/customers/dashboard/",
        login_required(eCommerceView.as_view(template_name="app_customers_dashboard.html")),
        name="app-customers-dashboard",
    ),
      # Vistas de plantillas
    path(
        "app/requirements/list/",
        login_required(eCommerceView.as_view(template_name="app_requirements_list.html")),
        name="app-requirements-list",
    ),
    path(
        "app/requirements/add/",
        login_required(eCommerceView.as_view(template_name="app_requirements_add.html")),
        name="app-requirements-add",
    ),
    path(
        "app/requirements/details/<int:requirement_id>/",
        login_required(eCommerceView.as_view(template_name="app_requirements_details.html")),
        name="app-requirements-details",
    ),
    path(
        "app/requirements/dashboard/",
        login_required(eCommerceView.as_view(template_name="app_requirements_dashboard.html")),
        name="app-requirements-dashboard",
    ),
    # Nueva vista para editar
    path(
        "app/requirements/edit/<int:requirement_id>/",
        login_required(eCommerceView.as_view(template_name="app_requirements_edit.html")),
        name="app-requirements-edit",
    ),
    path(
        "app/cotizacion/list/",
        login_required(CotizacionListView.as_view()),
        name="app-cotizacion-list",
    ),
    path(
        "app/cotizacion/create/<int:requirement_id>/",
        login_required(CotizacionCreateView.as_view()),
        name="app-cotizacion-create",
    ),
    path(
        "app/cotizacion/details/<int:envio_id>/",
        login_required(CotizacionDetailsView.as_view()),
        name="app-cotizacion-details",
    ),
    path(
        "app/cotizacion/compare/<int:requirement_id>/",
        login_required(CotizacionCompareView.as_view()),
        name="app-cotizacion-compare",
    ),
    
  
]
