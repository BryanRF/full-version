# apps/ecommerce/cotizacion/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.contrib.auth.decorators import login_required
from .views import (
    EnvioCotizacionViewSet,
    RespuestaCotizacionViewSet,
    EnvioCotizacionListCreateAPIView,
    ImportCotizacionResponseView,
    CotizacionListView,
    CotizacionCreateView,
    CotizacionDetailsView,
    CotizacionCompareView
)

# Router para ViewSets
router = DefaultRouter()
router.register(r'cotizacion/envios', EnvioCotizacionViewSet, basename='envio-cotizacion')
router.register(r'respuestas', RespuestaCotizacionViewSet, basename='respuesta-cotizacion')

urlpatterns = [
    # API endpoints específicos
    path('cotizacion/envios/data/', EnvioCotizacionListCreateAPIView.as_view(), name='envios-cotizacion-data'),
    
    # Importación de respuestas
    path('import-response/', ImportCotizacionResponseView.as_view(), name='import-cotizacion-response'),
    
    # ViewSets del router
    # Vistas de plantillas (templates)
   
]+ router.urls