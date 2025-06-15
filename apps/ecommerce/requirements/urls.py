# apps/requirements/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.contrib.auth.decorators import login_required
from .views import (
    RequirementViewSet,
    RequirementDetailViewSet,
    RequirementListCreateAPIView,
    RequirementTemplateView,
    RequirementDetailUpdateViewSet,
    RequirementFileUploadView
)

# Router para API REST
router = DefaultRouter()
router.register(r'requirements', RequirementViewSet, basename='requirement')
router.register(r'requirement-details', RequirementDetailViewSet, basename='requirement-detail')
router.register(r'requirement-details-update', RequirementDetailUpdateViewSet, basename='requirement-detail-update')
urlpatterns = [
    # API endpoints
    path('requirements/data/', RequirementListCreateAPIView.as_view(), name='requirements-data'),
    
    # Incluir todas las rutas del router
    path('', include(router.urls)),
    
  
]