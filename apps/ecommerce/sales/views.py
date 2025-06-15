# apps/ecommerce/sales/views.py
from rest_framework import generics, viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.db import models, transaction
from django.db.models import Q, Count, Sum, Avg
from django.http import HttpResponse
from datetime import date, timedelta
from .models import Sale, SaleItem, SalePayment
from .serializers import (
    SaleSerializer,
    SaleListSerializer,
    SaleCreateSerializer,
    SaleUpdateStatusSerializer,
    SaleQuickCreateSerializer,
    SaleItemSerializer,
    SalePaymentSerializer
)
from .services import SalesAnalyticsService, StockMovementService, SaleReportService
from apps.ecommerce.sales.services_notifications import SalesNotificationService
class SaleListCreateAPIView(generics.ListCreateAPIView):
    """Lista todas las ventas con filtros y crea nuevas ventas"""
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return SaleCreateSerializer
        return SaleListSerializer

    def get_queryset(self):
        queryset = Sale.objects.all().select_related('customer', 'created_by').prefetch_related('items')
        
        # Filtro por estado
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filtro por tipo de venta
        sale_type = self.request.query_params.get('sale_type')
        if sale_type:
            queryset = queryset.filter(sale_type=sale_type)
        
        # Filtro por método de pago
        payment_method = self.request.query_params.get('payment_method')
        if payment_method:
            queryset = queryset.filter(payment_method=payment_method)
        
        # Filtro por cliente
        customer_id = self.request.query_params.get('customer')
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        
        # Filtro por fecha
        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if fecha_desde:
            queryset = queryset.filter(sale_date__date__gte=fecha_desde)
        if fecha_hasta:
            queryset = queryset.filter(sale_date__date__lte=fecha_hasta)
        
        # Filtro por usuario
        created_by = self.request.query_params.get('created_by')
        if created_by:
            queryset = queryset.filter(created_by_id=created_by)
        
        # Filtro por búsqueda de texto
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(sale_number__icontains=search) |
                Q(customer__first_name__icontains=search) |
                Q(customer__last_name__icontains=search) |
                Q(customer__business_name__icontains=search) |
                Q(guest_customer_name__icontains=search) |
                Q(guest_customer_document__icontains=search)
            )
        
        return queryset.order_by('-created_at')
    
    def list(self, request):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"data": serializer.data})

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class SaleViewSet(viewsets.ModelViewSet):
    """ViewSet completo para operaciones CRUD de ventas"""
    queryset = Sale.objects.all().select_related('customer', 'created_by', 'updated_by').prefetch_related('items__product', 'payments')
    serializer_class = SaleSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_serializer_class(self):
        if self.action == 'create':
            return SaleCreateSerializer
        elif self.action == 'list':
            return SaleListSerializer
        elif self.action in ['update_status']:
            return SaleUpdateStatusSerializer
        return SaleSerializer

    def perform_create(self, serializer):
        sale = serializer.save(created_by=self.request.user)
        
        # Notificar nueva venta
        SalesNotificationService.notify_sale_created(sale, self.request.user)
        
        # Verificar si es venta grande
        # SalesNotificationService.notify_large_sale(sale)
        
        # Verificar si es cliente frecuente
        if sale.customer:
            SalesNotificationService.notify_frequent_customer_sale(sale, sale.customer)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        """Actualizar estado de la venta"""
        sale = get_object_or_404(Sale, pk=pk)
        serializer = SaleUpdateStatusSerializer(sale, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return Response({
                "message": f"Estado actualizado a {sale.status_display}",
                "status": sale.status,
                "status_display": sale.status_display,
                "status_color": sale.status_color
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'])
    def confirm(self, request, pk=None):
        sale = get_object_or_404(Sale, pk=pk)
        
        try:
            with transaction.atomic():
                # Verificar stock y productos que quedarán bajos
                low_stock_products = []
                for item in sale.items.all():
                    if item.product.stock_current - item.quantity <= item.product.stock_minimum:
                        low_stock_products.append(item.product)
                
                sale.confirm_sale(user=request.user)
                StockMovementService.record_sale_movement(sale, 'sale')
                
                # Notificar venta confirmada
                SalesNotificationService.notify_sale_confirmed(sale, request.user)
                
                # Notificar productos con stock bajo si los hay
                if low_stock_products:
                    SalesNotificationService.notify_low_stock_after_sale(sale, low_stock_products)
                
                return Response({
                    "message": "Venta confirmada exitosamente",
                    "status": sale.status,
                    "status_display": sale.status_display
                })
        except ValueError as e:
            return Response({
                "error": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'])
    def cancel(self, request, pk=None):
        sale = get_object_or_404(Sale, pk=pk)
        restore_stock = request.data.get('restore_stock', True)
        reason = request.data.get('reason', '')
        
        try:
            with transaction.atomic():
                sale.cancel_sale(user=request.user, restore_stock=restore_stock)
                
                # Notificar venta cancelada
                SalesNotificationService.notify_sale_cancelled(sale, request.user, reason)
                
                return Response({
                    "message": "Venta cancelada exitosamente",
                    "status": sale.status,
                    "status_display": sale.status_display
                })
        except ValueError as e:
            return Response({
                "error": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def quick_sale(self, request):
        """Crear venta rápida (POS)"""
        serializer = SaleQuickCreateSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                with transaction.atomic():
                    sale = serializer.save()
                    sale.created_by = request.user
                    sale.save()
                    
                    response_serializer = SaleSerializer(sale)
                    return Response({
                        "message": "Venta creada exitosamente",
                        "sale": response_serializer.data
                    }, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({
                    "error": f"Error creando venta: {str(e)}"
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def check_stock(self, request):
        """Verificar disponibilidad de stock para items"""
        items_data = request.data.get('items', [])
        
        if not items_data:
            return Response({
                "error": "Lista de items es requerida"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        availability = StockMovementService.check_stock_availability(items_data)
        return Response(availability)

    @action(detail=True, methods=['get'])
    def receipt(self, request, pk=None):
        """Generar recibo de venta en PDF"""
        sale = get_object_or_404(Sale, pk=pk)
        
        pdf_buffer = SaleReportService.generate_sale_receipt(sale.id)
        
        if pdf_buffer:
            filename = f"Recibo_{sale.sale_number}_{date.today().strftime('%Y%m%d')}.pdf"
            
            response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            return response
        else:
            return Response({
                "error": "Error generando recibo"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """Obtener analíticas de ventas"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        user_filter = request.query_params.get('user_id')
        
        # Convertir fechas
        if start_date:
            try:
                start_date = date.fromisoformat(start_date)
            except ValueError:
                start_date = None
        
        if end_date:
            try:
                end_date = date.fromisoformat(end_date)
            except ValueError:
                end_date = None
        
        # Obtener usuario si se especifica
        user = None
        if user_filter:
            try:
                from django.contrib.auth.models import User
                user = User.objects.get(id=user_filter)
            except User.DoesNotExist:
                pass
        
        analytics = SalesAnalyticsService.get_sales_analytics(
            start_date=start_date,
            end_date=end_date,
            user=user
        )
        
        return Response(analytics)

    @action(detail=False, methods=['get'])
    def by_status(self, request):
        """Obtener ventas agrupadas por estado"""
        status_choices = dict(Sale.STATUS_CHOICES)
        data = []
        
        for status_code, status_name in status_choices.items():
            sales = self.get_queryset().filter(status=status_code)
            data.append({
                'status_code': status_code,
                'status_name': status_name,
                'count': sales.count(),
                'total_amount': sales.aggregate(Sum('total_amount'))['total_amount__sum'] or 0,
                'sales': SaleListSerializer(sales[:10], many=True).data  # Solo primeros 10
            })
        
        return Response({"data": data})

    @action(detail=False, methods=['get'])
    def by_payment_method(self, request):
        """Obtener ventas agrupadas por método de pago"""
        payment_methods = dict(Sale.PAYMENT_METHOD_CHOICES)
        data = []
        
        for method_code, method_name in payment_methods.items():
            sales = self.get_queryset().filter(payment_method=method_code)
            total_amount = sales.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
            
            data.append({
                'method_code': method_code,
                'method_name': method_name,
                'count': sales.count(),
                'total_amount': float(total_amount)
            })
        
        # Ordenar por total descendente
        data.sort(key=lambda x: x['total_amount'], reverse=True)
        
        return Response({"data": data})

    @action(detail=False, methods=['get'])
    def dashboard_analytics(self, request):
        """Analíticas para el dashboard"""
        queryset = self.get_queryset()
        
        # Filtro por fecha (últimos 30 días por defecto)
        end_date = date.today()
        start_date = end_date - timedelta(days=30)
        
        period_sales = queryset.filter(
            sale_date__date__gte=start_date,
            sale_date__date__lte=end_date
        )
        
        # Estadísticas básicas
        total_sales = period_sales.count()
        total_amount = period_sales.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        avg_sale_amount = period_sales.aggregate(Avg('total_amount'))['total_amount__avg'] or 0
        
        # Ventas por estado
        sales_by_status = period_sales.values('status').annotate(
            count=Count('id'),
            total=Sum('total_amount')
        ).order_by('-total')
        
        # Ventas de hoy
        today_sales = queryset.filter(sale_date__date=end_date)
        today_count = today_sales.count()
        today_amount = today_sales.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        
        # Comparar con ayer
        yesterday = end_date - timedelta(days=1)
        yesterday_sales = queryset.filter(sale_date__date=yesterday)
        yesterday_count = yesterday_sales.count()
        yesterday_amount = yesterday_sales.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        
        # Calcular porcentajes de cambio
        count_change = 0
        amount_change = 0
        
        if yesterday_count > 0:
            count_change = ((today_count - yesterday_count) / yesterday_count) * 100
        
        if yesterday_amount > 0:
            amount_change = ((today_amount - yesterday_amount) / yesterday_amount) * 100
        
        return Response({
            'total_sales': total_sales,
            'total_amount': float(total_amount),
            'avg_sale_amount': float(avg_sale_amount),
            'today_sales': today_count,
            'today_amount': float(today_amount),
            'yesterday_sales': yesterday_count,
            'yesterday_amount': float(yesterday_amount),
            'count_change_percentage': round(count_change, 2),
            'amount_change_percentage': round(amount_change, 2),
            'sales_by_status': list(sales_by_status),
            'period': {
                'start_date': start_date,
                'end_date': end_date
            }
        })

    @action(detail=True, methods=['get'])
    def items_with_stock(self, request, pk=None):
        """Obtener items de la venta con información de stock"""
        sale = get_object_or_404(Sale, pk=pk)
        
        # Serializar la venta completa
        sale_data = SaleSerializer(sale).data
        
        # Agregar información adicional de stock para cada item
        for item in sale_data['items']:
            try:
                from apps.ecommerce.products.models import Product
                product = Product.objects.get(id=item['product'])
                item['current_stock'] = product.stock_current
                item['stock_status'] = product.stock_status
                item['stock_minimum'] = product.stock_minimum
                item['stock_maximum'] = product.stock_maximum
            except Product.DoesNotExist:
                item['current_stock'] = 0
                item['stock_status'] = 'unknown'
        
        return Response(sale_data)


class SaleItemViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar items de ventas"""
    queryset = SaleItem.objects.all().select_related('sale', 'product')
    serializer_class = SaleItemSerializer
    
    def get_queryset(self):
        sale_id = self.request.query_params.get('sale', None)
        if sale_id:
            return self.queryset.filter(sale_id=sale_id)
        return self.queryset
    
    def perform_create(self, serializer):
        # Verificar que la venta pueda ser editada
        sale = serializer.validated_data['sale']
        if not sale.can_edit:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("No se pueden agregar productos a esta venta en su estado actual")
        
        serializer.save()
    
    def perform_update(self, serializer):
        # Verificar que la venta pueda ser editada
        sale = serializer.instance.sale
        if not sale.can_edit:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("No se pueden modificar productos de esta venta en su estado actual")
        
        serializer.save()
    
    def perform_destroy(self, instance):
        # Verificar que la venta pueda ser editada
        if not instance.sale.can_edit:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("No se pueden eliminar productos de esta venta en su estado actual")
        
        instance.delete()


class SalePaymentViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar pagos de ventas"""
    queryset = SalePayment.objects.all().select_related('sale', 'created_by')
    serializer_class = SalePaymentSerializer
    
    def get_queryset(self):
        sale_id = self.request.query_params.get('sale', None)
        if sale_id:
            return self.queryset.filter(sale_id=sale_id)
        return self.queryset
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


# Vistas adicionales para plantillas
from django.views.generic import TemplateView
from web_project import TemplateLayout

class SaleTemplateView(TemplateView):
    """Vista base para plantillas de ventas"""
    
    def get_context_data(self, **kwargs):
        context = TemplateLayout.init(self, super().get_context_data(**kwargs))
        return context


class SalePOSView(SaleTemplateView):
    """Vista para punto de venta (POS)"""
    template_name = "app_sales_pos.html"
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # Datos iniciales para POS
        from apps.ecommerce.products.models import Product
        from apps.ecommerce.customers.models import Customer
        
        # Productos activos con stock
        products = Product.objects.filter(
            is_active=True, 
            stock_current__gt=0
        ).select_related('category')[:50]  # Limitar para performance
        
        # Clientes frecuentes
        frequent_customers = Customer.objects.filter(
            is_frequent=True, 
            is_active=True
        )[:20]
        
        context.update({
            'products': products,
            'frequent_customers': frequent_customers,
            'payment_methods': Sale.PAYMENT_METHOD_CHOICES
        })
        
        return context