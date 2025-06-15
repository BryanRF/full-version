from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, ActiveCategoryListAPIView,CategoryListCreateAPIView

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')

urlpatterns = [
    path('categories/data/', CategoryListCreateAPIView.as_view()),
    path('categories/active/', ActiveCategoryListAPIView.as_view()),
] + router.urls
