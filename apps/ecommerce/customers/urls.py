# apps/ecommerce/customers/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.contrib.auth.decorators import login_required
from .views import *

# Router para ViewSets
router = DefaultRouter()
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'customer-contacts', CustomerContactViewSet, basename='customer-contact')

urlpatterns = [
    # API endpoints específicos
    path('customers/data/', CustomerListCreateAPIView.as_view(), name='customers-data'),
    path('customers/quick-create/', CustomerQuickCreateAPIView.as_view(), name='customers-quick-create'),
     path('customers/search_document/', CustomerDocumentSearchAPIView.as_view(), name='customer-search-document'),  # Nueva ruta
    path('documents/search/', DocumentSearchAPIView.as_view(), name='document-search'),
    # ViewSets del router
    path('', include(router.urls)),
   
]
