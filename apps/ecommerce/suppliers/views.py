# apps/suppliers/views.py
from rest_framework import generics, viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.db import models
from django.db.models import Q, Count
from .models import Supplier, SupplierContact
from .serializers import (
    SupplierSerializer, 
    SupplierCreateUpdateSerializer, 
    SupplierListSerializer,
    SupplierContactSerializer
)

class ActiveSupplierListAPIView(generics.ListAPIView):
    """Lista solo proveedores activos"""
    serializer_class = SupplierListSerializer

    def get_queryset(self):
        return Supplier.objects.filter(is_active=True).prefetch_related('contacts')

    def list(self, request):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"data": serializer.data})

class SupplierListCreateAPIView(generics.ListCreateAPIView):
    """Lista todos los proveedores con filtros y crea nuevos proveedores"""
    serializer_class = SupplierListSerializer

    def get_queryset(self):
        queryset = Supplier.objects.all().prefetch_related('contacts')
        
        # Filtro por estado activo/inactivo
        status_filter = self.request.query_params.get('status')
        if status_filter == 'active':
            queryset = queryset.filter(is_active=True)
        elif status_filter == 'inactive':
            queryset = queryset.filter(is_active=False)
        elif status_filter == 'preferred':
            queryset = queryset.filter(is_preferred=True)

        # Filtro por categoría
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)

        # Filtro por calificación
        rating = self.request.query_params.get('rating')
        if rating:
            queryset = queryset.filter(rating=rating)

        # Filtro por búsqueda de texto
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(company_name__icontains=search) |
                Q(contact_person__icontains=search) |
                Q(email__icontains=search) |
                Q(tax_id__icontains=search)
            )

        return queryset

    def list(self, request):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"data": serializer.data})

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return SupplierCreateUpdateSerializer
        return SupplierListSerializer

class SupplierViewSet(viewsets.ModelViewSet):
    """ViewSet completo para operaciones CRUD de proveedores"""
    queryset = Supplier.objects.all().prefetch_related('contacts')
    serializer_class = SupplierSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return SupplierCreateUpdateSerializer
        elif self.action == 'list':
            return SupplierListSerializer
        return SupplierSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filtros opcionales
        category = self.request.query_params.get('category', None)
        status_filter = self.request.query_params.get('status', None)
        rating = self.request.query_params.get('rating', None)
        
        if category:
            queryset = queryset.filter(category=category)
        
        if status_filter:
            if status_filter == 'active':
                queryset = queryset.filter(is_active=True)
            elif status_filter == 'inactive':
                queryset = queryset.filter(is_active=False)
            elif status_filter == 'preferred':
                queryset = queryset.filter(is_preferred=True)
        
        if rating:
            queryset = queryset.filter(rating=rating)
        
        return queryset

    @action(detail=True, methods=['patch'])
    def toggle_active(self, request, pk=None):
        """Activar/desactivar proveedor"""
        supplier = get_object_or_404(Supplier, pk=pk)
        supplier.is_active = not supplier.is_active
        supplier.save()
        return Response({
            "message": f"Proveedor {'activado' if supplier.is_active else 'desactivado'}",
            "is_active": supplier.is_active
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'])
    def toggle_preferred(self, request, pk=None):
        """Marcar/desmarcar como proveedor preferido"""
        supplier = get_object_or_404(Supplier, pk=pk)
        supplier.is_preferred = not supplier.is_preferred
        supplier.save()
        return Response({
            "message": f"Proveedor {'marcado como preferido' if supplier.is_preferred else 'removido de preferidos'}",
            "is_preferred": supplier.is_preferred
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'])
    def update_rating(self, request, pk=None):
        """Actualizar calificación del proveedor"""
        supplier = get_object_or_404(Supplier, pk=pk)
        new_rating = request.data.get('rating')
        
        try:
            new_rating = int(new_rating)
            if new_rating not in [1, 2, 3, 4, 5]:
                return Response({
                    "error": "La calificación debe estar entre 1 y 5"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            supplier.rating = new_rating
            supplier.save()
            
            return Response({
                "message": f"Calificación actualizada a {new_rating}",
                "rating": supplier.rating,
                "rating_display": supplier.rating_display
            }, status=status.HTTP_200_OK)
            
        except (ValueError, TypeError):
            return Response({
                "error": "Calificación inválida"
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Obtener estadísticas de proveedores"""
        queryset = self.get_queryset()
        
        # Estadísticas básicas
        total_suppliers = queryset.count()
        active_suppliers = queryset.filter(is_active=True).count()
        preferred_suppliers = queryset.filter(is_preferred=True).count()
        
        # Estadísticas por categoría
        category_stats = queryset.values('category').annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Estadísticas por calificación
        rating_stats = queryset.values('rating').annotate(
            count=Count('id')
        ).order_by('rating')
        
        # Top proveedores (por calificación)
        top_suppliers = queryset.filter(
            is_active=True, rating__gte=4
        ).order_by('-rating', 'company_name')[:5]
        
        return Response({
            "total_suppliers": total_suppliers,
            "active_suppliers": active_suppliers,
            "inactive_suppliers": total_suppliers - active_suppliers,
            "preferred_suppliers": preferred_suppliers,
            "category_statistics": category_stats,
            "rating_statistics": rating_stats,
            "top_suppliers": SupplierListSerializer(top_suppliers, many=True).data
        })

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        """Obtener proveedores agrupados por categoría"""
        categories = Supplier.SUPPLIER_CATEGORIES
        data = []
        
        for category_code, category_name in categories:
            suppliers = self.get_queryset().filter(category=category_code, is_active=True)
            data.append({
                'category_code': category_code,
                'category_name': category_name,
                'supplier_count': suppliers.count(),
                'suppliers': SupplierListSerializer(suppliers, many=True).data
            })
        
        return Response({"data": data})

    @action(detail=False, methods=['get'])
    def dashboard_analytics(self, request):
        """Analíticas para el dashboard"""
        queryset = self.get_queryset()
        
        return Response({
            'total_suppliers': queryset.count(),
            'active_suppliers': queryset.filter(is_active=True).count(),
            'preferred_suppliers': queryset.filter(is_preferred=True).count(),
            'average_rating': queryset.aggregate(
                avg_rating=models.Avg('rating')
            )['avg_rating'] or 0,
            'total_credit_limit': queryset.aggregate(
                total_credit=models.Sum('credit_limit')
            )['total_credit'] or 0,
        })
    @action(detail=False, methods=['get'])
    def categorized(self, request):
        """Obtener proveedores agrupados por categoría"""
        categories = Supplier.SUPPLIER_CATEGORIES
        data = []
        
        for category_code, category_name in categories:
            suppliers = self.get_queryset().filter(category=category_code, is_active=True)
            data.append({
                'category_code': category_code,
                'category_name': category_name,
                'count': suppliers.count(),
                'with_email': suppliers.exclude(email__isnull=True).exclude(email='').count(),
                'suppliers': SupplierListSerializer(suppliers, many=True).data
            })
        
        return Response({"data": data})
    
    @action(detail=False, methods=['get'])
    def with_email(self, request):
        """Obtener solo proveedores con email"""
        suppliers = self.get_queryset().filter(
            is_active=True
        ).exclude(email__isnull=True).exclude(email='')
        
        serializer = SupplierListSerializer(suppliers, many=True)
        return Response({"data": serializer.data})
    
    @action(detail=False, methods=['get'])
    def without_email(self, request):
        """Obtener proveedores sin email (para envío manual)"""
        suppliers = self.get_queryset().filter(
            is_active=True
        ).filter(models.Q(email__isnull=True) | models.Q(email=''))
        
        serializer = SupplierListSerializer(suppliers, many=True)
        return Response({"data": serializer.data})
        

class SupplierContactViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar contactos de proveedores"""
    queryset = SupplierContact.objects.all()
    serializer_class = SupplierContactSerializer

    def get_queryset(self):
        supplier_id = self.request.query_params.get('supplier', None)
        if supplier_id:
            return self.queryset.filter(supplier_id=supplier_id)
        return self.queryset

    def perform_create(self, serializer):
        # Si se marca como contacto principal, desmarcar otros contactos del mismo proveedor
        if serializer.validated_data.get('is_primary', False):
            supplier = serializer.validated_data['supplier']
            SupplierContact.objects.filter(
                supplier=supplier, is_primary=True
            ).update(is_primary=False)
        
        serializer.save()

    def perform_update(self, serializer):
        # Si se marca como contacto principal, desmarcar otros contactos del mismo proveedor
        if serializer.validated_data.get('is_primary', False):
            supplier = serializer.instance.supplier
            SupplierContact.objects.filter(
                supplier=supplier, is_primary=True
            ).exclude(id=serializer.instance.id).update(is_primary=False)
        
        serializer.save()

# Vistas adicionales para plantillas
from django.views.generic import TemplateView
from web_project import TemplateLayout

class SupplierTemplateView(TemplateView):
    """Vista base para plantillas de proveedores"""
    
    def get_context_data(self, **kwargs):
        context = TemplateLayout.init(self, super().get_context_data(**kwargs))
        return context