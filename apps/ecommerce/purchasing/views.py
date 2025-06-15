# apps/ecommerce/purchasing/views.py
from rest_framework import generics, viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import models
from django.db.models import Q, Count, Sum
from django.http import HttpResponse
from django.views.generic import TemplateView
from django.contrib.auth.decorators import login_required
from web_project import TemplateLayout
from datetime import date, timedelta
from .models import PurchaseOrder, PurchaseOrderItem
from .serializers import (
    PurchaseOrderSerializer,
    PurchaseOrderCreateSerializer,
    PurchaseOrderListSerializer,
    PurchaseOrderItemSerializer,
    ReceiveItemsSerializer
)
from .services import (
    PurchaseOrderManagementService,
    PurchaseOrderCalculationService,
    PurchaseOrderReportService
)
from apps.ecommerce.suppliers.models import Supplier
from apps.ecommerce.products.models import Product
import logging

logger = logging.getLogger(__name__)

class PurchaseOrderListCreateAPIView(generics.ListCreateAPIView):
    """API para listar y crear órdenes de compra"""
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return PurchaseOrderCreateSerializer
        return PurchaseOrderListSerializer
    
    def get_queryset(self):
        queryset = PurchaseOrder.objects.all().select_related(
            'supplier', 'created_by'
        ).prefetch_related('items')
        
        # Filtros
        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)
        
        supplier_id = self.request.query_params.get('supplier')
        if supplier_id:
            queryset = queryset.filter(supplier_id=supplier_id)
        
        created_by = self.request.query_params.get('created_by')
        if created_by:
            queryset = queryset.filter(created_by_id=created_by)
        
        # Filtro por fechas
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            queryset = queryset.filter(order_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(order_date__lte=date_to)
        
        # Búsqueda
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(po_number__icontains=search) |
                Q(supplier__company_name__icontains=search) |
                Q(notes__icontains=search)
            )
        
        return queryset.order_by('-created_at')
    
    def list(self, request):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response({
                'data': serializer.data,
                'summary': self._get_list_summary(queryset)
            })
        
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'data': serializer.data,
            'summary': self._get_list_summary(queryset)
        })
    
    def _get_list_summary(self, queryset):
        """Obtener resumen de la lista"""
        total_pos = queryset.count()
        total_amount = queryset.aggregate(
            total=Sum('total_amount')
        )['total'] or 0
        
        status_counts = queryset.values('status').annotate(
            count=Count('id')
        )
        
        return {
            'total_purchase_orders': total_pos,
            'total_amount': float(total_amount),
            'status_breakdown': list(status_counts)
        }


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    """ViewSet completo para órdenes de compra"""
    queryset = PurchaseOrder.objects.all().select_related('supplier', 'created_by')
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return PurchaseOrderCreateSerializer
        elif self.action == 'list':
            return PurchaseOrderListSerializer
        elif self.action in ['receive_items']:
            return ReceiveItemsSerializer
        return PurchaseOrderSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filtros adicionales para acciones específicas
        if self.action == 'pending_delivery':
            queryset = queryset.filter(
                status__in=['sent', 'confirmed', 'partially_received']
            )
        elif self.action == 'overdue':
            queryset = queryset.filter(
                expected_delivery__lt=date.today(),
                status__in=['sent', 'confirmed', 'partially_received']
            )
        
        return queryset
    
    @action(detail=True, methods=['patch'])
    def send_to_supplier(self, request, pk=None):
        """Enviar orden de compra al proveedor"""
        purchase_order = get_object_or_404(PurchaseOrder, pk=pk)
        
        try:
            service = PurchaseOrderManagementService()
            success = service.send_purchase_order(purchase_order)
            
            if success:
                return Response({
                    'message': f'Orden {purchase_order.po_number} enviada exitosamente',
                    'status': purchase_order.status
                })
            else:
                return Response({
                    'error': 'Error al enviar la orden de compra'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['patch'])
    def confirm_order(self, request, pk=None):
        """Confirmar orden de compra (cambiar estado a confirmada)"""
        purchase_order = get_object_or_404(PurchaseOrder, pk=pk)
        
        if purchase_order.status != 'sent':
            return Response({
                'error': 'Solo se pueden confirmar órdenes enviadas'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        purchase_order.status = 'confirmed'
        purchase_order.save()
        
        return Response({
            'message': f'Orden {purchase_order.po_number} confirmada',
            'status': purchase_order.status
        })
    
    @action(detail=True, methods=['patch'])
    def cancel_order(self, request, pk=None):
        """Cancelar orden de compra"""
        purchase_order = get_object_or_404(PurchaseOrder, pk=pk)
        
        if purchase_order.status in ['completed', 'cancelled']:
            return Response({
                'error': 'No se puede cancelar una orden completada o ya cancelada'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Obtener motivo de cancelación
        reason = request.data.get('reason', '')
        if reason:
            purchase_order.notes = f"{purchase_order.notes}\n\nCANCELADA: {reason}" if purchase_order.notes else f"CANCELADA: {reason}"
        
        purchase_order.status = 'cancelled'
        purchase_order.save()
        
        return Response({
            'message': f'Orden {purchase_order.po_number} cancelada',
            'status': purchase_order.status
        })
    
    @action(detail=True, methods=['post'])
    def receive_items(self, request, pk=None):
        """Recibir items de la orden de compra"""
        purchase_order = get_object_or_404(PurchaseOrder, pk=pk)
        serializer = self.get_serializer(data=request.data)
        
        if serializer.is_valid():
            try:
                service = PurchaseOrderManagementService()
                service.receive_items(
                    purchase_order, 
                    serializer.validated_data['received_items']
                )
                
                # Actualizar datos para respuesta
                purchase_order.refresh_from_db()
                response_serializer = PurchaseOrderSerializer(purchase_order)
                
                return Response({
                    'message': 'Items recibidos exitosamente',
                    'purchase_order': response_serializer.data
                })
                
            except Exception as e:
                return Response({
                    'error': str(e)
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def export_pdf(self, request, pk=None):
        """Exportar orden de compra como PDF"""
        purchase_order = get_object_or_404(PurchaseOrder, pk=pk)
        
        try:
            from .services import PurchaseOrderPDFService
            
            pdf_buffer = PurchaseOrderPDFService.generate_po_pdf(purchase_order)
            filename = f"PO_{purchase_order.po_number}_{date.today().strftime('%Y%m%d')}.pdf"
            
            response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            return response
            
        except Exception as e:
            return Response({
                'error': f'Error generando PDF: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def dashboard_analytics(self, request):
        """Analíticas para dashboard"""
        analytics = PurchaseOrderReportService.get_po_analytics()
        
        # Agregar estadísticas adicionales
        queryset = self.get_queryset()
        
        # Órdenes próximas a vencer
        upcoming_deliveries = queryset.filter(
            expected_delivery__lte=date.today() + timedelta(days=7),
            status__in=['sent', 'confirmed', 'partially_received']
        ).count()
        
        # Órdenes vencidas
        overdue_orders = queryset.filter(
            expected_delivery__lt=date.today(),
            status__in=['sent', 'confirmed', 'partially_received']
        ).count()
        
        analytics.update({
            'upcoming_deliveries': upcoming_deliveries,
            'overdue_orders': overdue_orders,
            'pending_orders': queryset.filter(status='draft').count(),
            'this_month_orders': queryset.filter(
                order_date__year=date.today().year,
                order_date__month=date.today().month
            ).count()
        })
        
        return Response(analytics)
    
    @action(detail=False, methods=['get'])
    def pending_delivery(self, request):
        """Órdenes pendientes de entrega"""
        queryset = self.get_queryset()
        serializer = PurchaseOrderListSerializer(queryset, many=True)
        return Response({'data': serializer.data})
    
    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Órdenes vencidas"""
        queryset = self.get_queryset()
        serializer = PurchaseOrderListSerializer(queryset, many=True)
        return Response({'data': serializer.data})
    
    @action(detail=True, methods=['get'])
    def items_summary(self, request, pk=None):
        """Resumen de items de la orden"""
        purchase_order = get_object_or_404(PurchaseOrder, pk=pk)
        items = purchase_order.items.all()
        
        summary = {
            'total_items': items.count(),
            'total_ordered': sum(item.quantity_ordered for item in items),
            'total_received': sum(item.quantity_received for item in items),
            'pending_items': sum(item.pending_quantity for item in items),
            'completion_percentage': 0
        }
        
        if summary['total_ordered'] > 0:
            summary['completion_percentage'] = round(
                (summary['total_received'] / summary['total_ordered']) * 100, 2
            )
        
        return Response(summary)


class PurchaseOrderItemViewSet(viewsets.ModelViewSet):
    """ViewSet para items de órdenes de compra"""
    queryset = PurchaseOrderItem.objects.all().select_related('purchase_order', 'product')
    serializer_class = PurchaseOrderItemSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filtrar por orden de compra
        po_id = self.request.query_params.get('purchase_order')
        if po_id:
            queryset = queryset.filter(purchase_order_id=po_id)
        
        return queryset
    
    def perform_create(self, serializer):
        """Crear item y recalcular totales"""
        item = serializer.save()
        PurchaseOrderCalculationService.update_po_totals(item.purchase_order)
    
    def perform_update(self, serializer):
        """Actualizar item y recalcular totales"""
        item = serializer.save()
        PurchaseOrderCalculationService.update_po_totals(item.purchase_order)
    
    def perform_destroy(self, instance):
        """Eliminar item y recalcular totales"""
        purchase_order = instance.purchase_order
        instance.delete()
        PurchaseOrderCalculationService.update_po_totals(purchase_order)


class QuickPurchaseOrderAPIView(APIView):
    """API para crear órdenes de compra rápidas desde cotizaciones"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Crear orden de compra desde cotización seleccionada"""
        cotizacion_id = request.data.get('cotizacion_id')
        expected_delivery = request.data.get('expected_delivery')
        notes = request.data.get('notes', '')
        
        if not cotizacion_id or not expected_delivery:
            return Response({
                'error': 'cotizacion_id y expected_delivery son requeridos'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            from apps.ecommerce.cotizacion.models import RespuestaCotizacion
            
            # Obtener cotización
            cotizacion = RespuestaCotizacion.objects.get(id=cotizacion_id)
            
            # Preparar datos para crear PO
            po_data = {
                'supplier_id': cotizacion.envio.proveedor.id,
                'expected_delivery': expected_delivery,
                'notes': f"Generada desde cotización {cotizacion.envio.numero_envio}\n{notes}",
                'items': []
            }
            
            # Agregar items de la cotización
            for detalle in cotizacion.detalles.all():
                if detalle.producto:  # Solo si el producto está vinculado
                    po_data['items'].append({
                        'product_id': detalle.producto.id,
                        'quantity_ordered': detalle.cantidad_cotizada,
                        'unit_price': float(detalle.precio_unitario),
                        'notes': detalle.observaciones or ''
                    })
            
            if not po_data['items']:
                return Response({
                    'error': 'No se encontraron productos válidos en la cotización'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Crear orden de compra
            service = PurchaseOrderManagementService()
            purchase_order = service.create_purchase_order(po_data, request.user)
            
            # Serializar respuesta
            serializer = PurchaseOrderSerializer(purchase_order)
            
            return Response({
                'message': f'Orden de compra {purchase_order.po_number} creada exitosamente',
                'purchase_order': serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating quick PO: {str(e)}")
            return Response({
                'error': f'Error creando orden de compra: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SupplierPurchaseHistoryAPIView(APIView):
    """API para historial de compras por proveedor"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, supplier_id):
        """Obtener historial de compras de un proveedor"""
        try:
            supplier = Supplier.objects.get(id=supplier_id)
        except Supplier.DoesNotExist:
            return Response({
                'error': 'Proveedor no encontrado'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Obtener órdenes de compra del proveedor
        purchase_orders = PurchaseOrder.objects.filter(
            supplier=supplier
        ).order_by('-created_at')
        
        # Estadísticas
        total_orders = purchase_orders.count()
        total_spent = purchase_orders.aggregate(
            total=Sum('total_amount')
        )['total'] or 0
        
        completed_orders = purchase_orders.filter(status='completed').count()
        
        # Serializar datos
        serializer = PurchaseOrderListSerializer(purchase_orders[:20], many=True)
        
        return Response({
            'supplier': {
                'id': supplier.id,
                'name': supplier.company_name,
                'contact_person': supplier.contact_person,
                'email': supplier.email
            },
            'statistics': {
                'total_orders': total_orders,
                'total_spent': float(total_spent),
                'completed_orders': completed_orders,
                'completion_rate': round((completed_orders / total_orders) * 100, 2) if total_orders > 0 else 0
            },
            'recent_orders': serializer.data
        })


# Vistas de plantillas
class PurchaseOrderTemplateView(TemplateView):
    """Vista base para plantillas de órdenes de compra"""
    
    def get_context_data(self, **kwargs):
        context = TemplateLayout.init(self, super().get_context_data(**kwargs))
        return context


class PurchaseOrderListView(PurchaseOrderTemplateView):
    """Vista para lista de órdenes de compra"""
    template_name = "app_purchase_orders_list.html"


class PurchaseOrderCreateView(PurchaseOrderTemplateView):
    """Vista para crear orden de compra"""
    template_name = "app_purchase_orders_create.html"


class PurchaseOrderDetailView(PurchaseOrderTemplateView):
    """Vista para detalles de orden de compra"""
    template_name = "app_purchase_orders_detail.html"
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        po_id = kwargs.get('po_id')
        
        if po_id:
            try:
                purchase_order = PurchaseOrder.objects.select_related('supplier').get(id=po_id)
                context['purchase_order'] = purchase_order
            except PurchaseOrder.DoesNotExist:
                context['error'] = 'Orden de compra no encontrada'
        
        return context


class PurchaseOrderDashboardView(PurchaseOrderTemplateView):
    """Vista para dashboard de órdenes de compra"""
    template_name = "app_purchase_orders_dashboard.html"
