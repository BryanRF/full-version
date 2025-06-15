from rest_framework import generics, viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.db import models
from .models import Product
from .serializers import ProductSerializer
from apps.ecommerce.categories.models import Category
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.notification.services import notification_service
from apps.notification.models import TipoNotificacion
from auth.models import Role
class ActiveProductListAPIView(generics.ListAPIView):
    serializer_class = ProductSerializer

    def get_queryset(self):
        return Product.objects.filter(is_active=True).select_related('category')

    def list(self, request):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"data": serializer.data})

class ProductListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = ProductSerializer

    def get_queryset(self):
        queryset = Product.objects.all().select_related('category')
        
        # Filtro por estado activo/inactivo
        status = self.request.query_params.get('status')
        if status == '1':
            queryset = queryset.filter(is_active=True)
        elif status == '0':
            queryset = queryset.filter(is_active=False)

        # Filtro por categoría
        category_id = self.request.query_params.get('category')
        if category_id:
            queryset = queryset.filter(category_id=category_id)

        # Filtro por stock
        stock_filter = self.request.query_params.get('stock')
        if stock_filter:
            if stock_filter == 'out_of_stock':
                queryset = queryset.filter(stock_current__lte=0)
            elif stock_filter == 'low_stock':
                queryset = queryset.filter(stock_current__gt=0, stock_current__lte=models.F('stock_minimum'))
            elif stock_filter == 'overstock':
                queryset = queryset.filter(stock_current__gte=models.F('stock_maximum'))
            elif stock_filter == 'in_stock':
                queryset = queryset.filter(stock_current__gt=models.F('stock_minimum'), stock_current__lt=models.F('stock_maximum'))

        return queryset

    def list(self, request):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"data": serializer.data})

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().select_related('category')
    serializer_class = ProductSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def notify_stock_update(self, product):
        """Notifica a través de WebSocket cuando un producto es creado o actualizado."""
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "stock_group",
            {
                "type": "send_stock_update",
                "data": {
                    "product_id": product.id,
                    "name": product.name,
                    "current_stock": product.stock_current,
                    "stock_status": product.stock_status,
                },
            }
        )

    def perform_create(self, serializer):
        product = serializer.save()
        self.notify_stock_update(product)
        request_user = getattr(self.request, 'user', None)
        if request_user:
            notification_service.enviar_notificacion_roles(
                roles=[Role.GERENTE_COMPRAS, Role.ADMINISTRADOR_SISTEMA],
                mensaje=f"Nuevo producto '{product.name}' agregado al inventario",
                titulo="Nuevo Producto",
                tipo=TipoNotificacion.PRODUCTO_ACTUALIZADO,
                icono='ri-add-box-line',
                color='success',
                url_accion=f'/app/ecommerce/product/add/?edit={product.id}',
                datos_adicionales={
                    'producto_id': product.id,
                    'producto_nombre': product.name,
                    'categoria': product.category.name if product.category else None
                },
                enviado_por=request_user
            )

    def perform_update(self, serializer):
        product = serializer.save()
        self.notify_stock_update(product)
        old_stock = None
        if self.get_object():
            old_stock = self.get_object().stock_current
        
        product = serializer.save()
        self.notify_stock_update(product)
        
        # Notificaciones automáticas del sistema
        if old_stock is not None and old_stock != product.stock_current:
            # Verificar alertas de stock
            if product.stock_current == 0:
                notification_service.notificar_producto_agotado(product)
            elif product.stock_current <= product.stock_minimum:
                notification_service.notificar_stock_bajo(product)
        
        # Notificar actualización de producto a roles relevantes
        request_user = getattr(self.request, 'user', None)
        if request_user:
            notification_service.notificar_producto_actualizado(product, request_user)
        
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filtros opcionales
        category_id = self.request.query_params.get('category', None)
        status_filter = self.request.query_params.get('status', None)
        stock_filter = self.request.query_params.get('stock', None)
        
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        
        if status_filter:
            if status_filter == 'active':
                queryset = queryset.filter(is_active=True)
            elif status_filter == 'inactive':
                queryset = queryset.filter(is_active=False)
            else:
                queryset = queryset.filter(status=status_filter)
        
        if stock_filter:
            if stock_filter == 'in_stock':
                queryset = queryset.filter(stock_current__gt=0)
            elif stock_filter == 'out_of_stock':
                queryset = queryset.filter(stock_current=0)
            elif stock_filter == 'low_stock':
                queryset = queryset.extra(where=['stock_current <= stock_minimum AND stock_current > 0'])
        
        return queryset
    

        
    @action(detail=True, methods=['patch'])
    def toggle_active(self, request, pk=None):
        """Activar/desactivar producto"""
        product = get_object_or_404(Product, pk=pk)
        product.is_active = not product.is_active
        product.save()
        return Response({
            "message": f"Producto {'activado' if product.is_active else 'desactivado'}",
            "is_active": product.is_active
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'])
    def update_stock(self, request, pk=None):
        """Actualizar stock del producto"""
        product = get_object_or_404(Product, pk=pk)
        stock_to_add = request.data.get('add_stock', 0)
        
        try:
            stock_to_add = int(stock_to_add)
            new_stock =  stock_to_add
            
            if new_stock < 0:
                return Response({
                    "error": "El stock no puede ser negativo"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            product.stock_current = new_stock
            product.save()
            self.notify_stock_update(product)


            
            return Response({
                "message": f"Stock actualizado. Nuevo stock: {product.stock_current}",
                "current_stock": product.stock_current,
                "stock_status": product.stock_status
            }, status=status.HTTP_200_OK)
            
        except (ValueError, TypeError):
            return Response({
                "error": "Cantidad de stock inválida"
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def stock_alerts(self, request):
        """Obtener productos con stock bajo o agotado"""
        low_stock = Product.objects.filter(
            is_active=True,
            stock_current__lte=models.F('stock_minimum'),
            stock_current__gt=0
        ).select_related('category')
        
        out_of_stock = Product.objects.filter(
            is_active=True,
            stock_current=0
        ).select_related('category')
        
        return Response({
            "low_stock": ProductSerializer(low_stock, many=True).data,
            "out_of_stock": ProductSerializer(out_of_stock, many=True).data,
            "low_stock_count": low_stock.count(),
            "out_of_stock_count": out_of_stock.count()
        })

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        """Obtener productos agrupados por categoría"""
        from django.db.models import Count
        
        categories_with_products = Category.objects.filter(
            is_active=True,
            products__is_active=True
        ).annotate(
            product_count=Count('products')
        ).prefetch_related('products')
        
        data = []
        for category in categories_with_products:
            products = category.products.filter(is_active=True)
            data.append({
                'category_id': category.id,
                'category_name': category.name,
                'product_count': products.count(),
                'products': ProductSerializer(products, many=True).data
            })
        
        return Response({"data": data})
    
    @action(detail=False, methods=['get'])
    def dashboard_analytics(self, request):
        products = self.get_queryset()
        return Response({
            'totalProducts': products.count(),
            'activeProducts': products.filter(is_active=True).count(),
            'lowStockProducts': products.filter(
                stock_current__lte=models.F('stock_minimum'),
                stock_current__gt=0
            ).count(),
            'outOfStockProducts': products.filter(stock_current=0).count(),
            'totalInventoryValue': products.aggregate(
                total=models.Sum(models.F('price') * models.F('stock_current'))
            )['total'] or 0,
        })