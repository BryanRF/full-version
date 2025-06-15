from rest_framework import generics,viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Category
from .serializers import CategorySerializer
from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from apps.ecommerce.categories.services import CategoryNotificationService
class ActiveCategoryListAPIView(generics.ListAPIView):
    serializer_class = CategorySerializer

    def get_queryset(self):
        return Category.objects.filter(is_active=True)

    def list(self, request):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"data": serializer.data})
# List and Create
class CategoryListCreateAPIView(generics.ListCreateAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    def list(self, request):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"data": serializer.data})
    
class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]


    @action(detail=True, methods=['patch'])
    def toggle_active(self, request, pk=None):
        category = get_object_or_404(Category, pk=pk)
        old_status = category.is_active
        category.is_active = not category.is_active
        category.save()
        
        # Notificar cambio de estado
        CategoryNotificationService.notify_category_status_changed(
            category, request.user, category.is_active
        )
        
        return Response({
            "message": f"Category {'enabled' if category.is_active else 'disabled'}",
            "is_active": category.is_active
        }, status=status.HTTP_200_OK)