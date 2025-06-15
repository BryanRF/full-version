from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, ActiveProductListAPIView, ProductListCreateAPIView

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')

urlpatterns = [
    path('products/data/', ProductListCreateAPIView.as_view()),
    path('products/active/', ActiveProductListAPIView.as_view()),
] + router.urls