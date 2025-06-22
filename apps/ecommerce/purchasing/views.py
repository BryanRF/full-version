# apps/ecommerce/purchasing/views.py

from rest_framework import generics, viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import models
from django.db.models import Q, Count, Sum, Avg
from django.http import HttpResponse
from django.views.generic import TemplateView
from django.contrib.auth.decorators import login_required
from web_project import TemplateLayout
from datetime import date, timedelta
from .models import PurchaseOrder, PurchaseOrderItem
from apps.ecommerce.suppliers.models import Supplier
from .serializers import PurchasingSupplierSerializer
from apps.ecommerce.products.models import Product

from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils import timezone


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
from rest_framework import serializers
import logging

logger = logging.getLogger(__name__)

class PurchaseOrderListCreateAPIView(generics.ListCreateAPIView):
    """API para listar y crear órdenes de compra"""
    permission_classes = [IsAuthenticated]
    def list(self, request, *args, **kwargs):
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response({
                "data": serializer.data
            })
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

        return queryset.order_by('-created_at')

class PurchaseOrderViewSet(viewsets.ModelViewSet):
    """ViewSet completo para operaciones CRUD de órdenes de compra"""
    queryset = PurchaseOrder.objects.all().select_related('supplier', 'created_by').prefetch_related('items')
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated]


    @action(detail=True, methods=['post'])
    def actions(self, request, pk=None):
        """Endpoint unificado para todas las acciones de la orden"""
        purchase_order = self.get_object()
        action_type = request.data.get('action')

        if not action_type:
            return Response(
                {'error': 'Acción no especificada'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            if action_type == 'change_status':
                return self._handle_change_status(purchase_order, request.data, request.user)
            elif action_type == 'cancel_order':
                return self._handle_cancel_order(purchase_order, request.data, request.user)
            elif action_type == 'duplicate_order':
                return self._handle_duplicate_order(purchase_order, request.data, request.user)
            elif action_type == 'send_reminder':
                return self._handle_send_reminder(purchase_order, request.data, request.user)
            else:
                return Response(
                    {'error': f'Acción no reconocida: {action_type}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            logger.error(f"Error in purchase order action {action_type}: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _handle_change_status(self, purchase_order, data, user):
        """Manejar cambio de estado"""
        new_status = data.get('new_status')

        if not new_status:
            return Response(
                {'error': 'Nuevo estado es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validar transición de estado
        valid_transitions = {
            'draft': ['sent', 'cancelled'],
            'sent': ['confirmed', 'cancelled'],
            'confirmed': ['partially_received', 'completed', 'cancelled'],
            'partially_received': ['completed', 'cancelled']
        }

        if new_status not in valid_transitions.get(purchase_order.status, []):
            return Response(
                {'error': 'Transición de estado no válida'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Cambiar estado
        old_status = purchase_order.status
        purchase_order.status = new_status
        purchase_order.save(update_fields=['status'])

        # Registrar en historial
        self._add_to_history(
            purchase_order,
            'status_changed',
            f'Estado cambiado de {old_status} a {new_status}',
            user
        )

        # Notificar cambio de estado si es necesario
        if new_status in ['sent', 'confirmed']:
            self._notify_supplier_status_change(purchase_order, new_status)

        # Serializar respuesta
        serializer = PurchaseOrderSerializer(purchase_order)
        return Response(serializer.data)

    def _handle_cancel_order(self, purchase_order, data,user):
        """Manejar cancelación de orden"""
        reason = data.get('reason', '').strip()

        if not reason:
            return Response(
                {'error': 'Razón de cancelación es requerida'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verificar si se puede cancelar
        if purchase_order.status in ['completed', 'cancelled']:
            return Response(
                {'error': 'No se puede cancelar una orden completada o ya cancelada'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Cancelar orden
        old_status = purchase_order.status
        purchase_order.status = 'cancelled'
        purchase_order.notes = f"{purchase_order.notes}\n\nCANCELADA: {reason}" if purchase_order.notes else f"CANCELADA: {reason}"
        purchase_order.save(update_fields=['status', 'notes'])

        # Registrar en historial
        self._add_to_history(
            purchase_order,
            'cancelled',
            f'Orden cancelada. Razón: {reason}',
            user
        )

        # Notificar cancelación al proveedor
        self._notify_supplier_cancellation(purchase_order, reason)

        # Serializar respuesta
        serializer = PurchaseOrderSerializer(purchase_order)
        return Response(serializer.data)

    def _handle_duplicate_order(self, purchase_order, data,user):
        """Manejar duplicación de orden"""
        options = data.get('options', {})
        expected_delivery = options.get('expected_delivery')
        copy_notes = options.get('copy_notes', True)
        copy_all_items = options.get('copy_all_items', True)
        additional_notes = options.get('additional_notes', '').strip()

        if not expected_delivery:
            return Response(
                {'error': 'Fecha de entrega es requerida'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Crear nueva orden
            new_po = PurchaseOrder.objects.create(
                supplier=purchase_order.supplier,
                expected_delivery=expected_delivery,
                notes=self._build_duplicate_notes(purchase_order, copy_notes, additional_notes),
                created_by=user,
                status='draft'
            )

            # Copiar items si se solicita
            if copy_all_items:
                for item in purchase_order.items.all():
                    PurchaseOrderItem.objects.create(
                        purchase_order=new_po,
                        product=item.product,
                        quantity_ordered=item.quantity_ordered,
                        unit_price=item.unit_price,
                        notes=item.notes
                    )

            # Recalcular totales
            PurchaseOrderCalculationService.update_po_totals(new_po)

            # Registrar en historial de la orden original
            self._add_to_history(
                purchase_order,
                'duplicated',
                f'Orden duplicada como {new_po.po_number}',
                user
            )

            # Registrar en historial de la nueva orden
            self._add_to_history(
                new_po,
                'created',
                f'Orden creada como duplicado de {purchase_order.po_number}',
                user
            )

            return Response({
                'message': 'Orden duplicada exitosamente',
                'new_po_id': new_po.id,
                'new_po_number': new_po.po_number
            })

        except Exception as e:
            logger.error(f"Error duplicating purchase order: {str(e)}")
            return Response(
                {'error': 'Error al duplicar la orden'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _handle_send_reminder(self, purchase_order, data,user):
        """Manejar envío de recordatorio"""
        reminder_options = data.get('reminder_options', {})
        reminder_type = reminder_options.get('type', 'delivery')
        message = reminder_options.get('message', '').strip()
        include_details = reminder_options.get('include_details', True)

        # Verificar que el proveedor tenga email
        if not purchase_order.supplier.email:
            return Response(
                {'error': 'El proveedor no tiene email configurado'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Enviar recordatorio
            self._send_reminder_email(
                purchase_order,
                reminder_type,
                message,
                include_details,
                user
            )

            # Registrar en historial
            self._add_to_history(
                purchase_order,
                'reminder_sent',
                f'Recordatorio enviado: {reminder_type}' + (f' - {message}' if message else ''),
                user
            )

            return Response({
                'message': 'Recordatorio enviado exitosamente',
                'sent_to': purchase_order.supplier.email
            })

        except Exception as e:
            logger.error(f"Error sending reminder: {str(e)}")
            return Response(
                {'error': 'Error al enviar el recordatorio'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Obtener historial de la orden"""
        purchase_order = self.get_object()

        # Obtener historial desde el campo JSON o base de datos
        history = self._get_order_history(purchase_order)

        return Response({
            'history': history,
            'total_events': len(history)
        })

    @action(detail=True, methods=['get'])
    def export_pdf(self, request, pk=None):
        """Exportar orden a PDF"""
        purchase_order = self.get_object()

        try:
            # Usar el servicio de PDF
            from .services import PurchaseOrderPDFService
            pdf_response = PurchaseOrderPDFService.generate_po_pdf(purchase_order)

            # Registrar en historial
            self._add_to_history(
                purchase_order,
                'exported',
                'PDF exportado',
                request.user
            )

            return pdf_response

        except Exception as e:
            logger.error(f"Error generating PDF: {str(e)}")
            return Response(
                {'error': 'Error al generar el PDF'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # ✅ Métodos auxiliares privados

    def _add_to_history(self, purchase_order, action, description, user):
        """Agregar evento al historial de la orden"""
        try:
            # Si existe un modelo de historial, usarlo
            # Si no, agregar al campo JSON

            history_entry = {
                'action': action,
                'description': description,
                'user': user.username if user else 'Sistema',
                'timestamp': timezone.now().isoformat(),
                'details': None
            }

            # Aquí puedes implementar tu sistema de historial preferido
            # Opción 1: Campo JSON en el modelo
            if hasattr(purchase_order, 'history_json'):
                if not purchase_order.history_json:
                    purchase_order.history_json = []
                purchase_order.history_json.insert(0, history_entry)
                purchase_order.save(update_fields=['history_json'])

            # Opción 2: Modelo separado de historial
            # PurchaseOrderHistory.objects.create(
            #     purchase_order=purchase_order,
            #     action=action,
            #     description=description,
            #     user=user
            # )

        except Exception as e:
            logger.error(f"Error adding to history: {str(e)}")

    def _get_order_history(self, purchase_order):
        """Obtener historial de la orden"""
        try:
            # Opción 1: Desde campo JSON
            if hasattr(purchase_order, 'history_json') and purchase_order.history_json:
                return purchase_order.history_json

            # Opción 2: Desde modelo de historial
            # history = PurchaseOrderHistory.objects.filter(
            #     purchase_order=purchase_order
            # ).order_by('-created_at').values(
            #     'action', 'description', 'user__username', 'created_at'
            # )
            # return list(history)

            # Historial por defecto basado en timestamps del modelo
            return [
                {
                    'action': 'created',
                    'description': 'Orden de compra creada',
                    'user': purchase_order.created_by.username if purchase_order.created_by else 'Sistema',
                    'timestamp': purchase_order.created_at.isoformat()
                }
            ]

        except Exception as e:
            logger.error(f"Error getting history: {str(e)}")
            return []

    def _build_duplicate_notes(self, original_po, copy_notes, additional_notes):
        """Construir notas para orden duplicada"""
        notes_parts = []

        notes_parts.append(f"Duplicado de la orden {original_po.po_number}")

        if copy_notes and original_po.notes:
            notes_parts.append("\n--- Notas originales ---")
            notes_parts.append(original_po.notes)

        if additional_notes:
            notes_parts.append("\n--- Notas adicionales ---")
            notes_parts.append(additional_notes)

        return "\n".join(notes_parts)

    def _send_reminder_email(self, purchase_order, reminder_type, message, include_details, user):
        """Enviar email de recordatorio al proveedor"""
        try:
            # Configurar asunto según tipo
            subject_map = {
                'delivery': f'Recordatorio de Entrega - Orden {purchase_order.po_number}',
                'confirmation': f'Solicitud de Confirmación - Orden {purchase_order.po_number}',
                'status_update': f'Actualización de Estado - Orden {purchase_order.po_number}',
                'custom': f'Recordatorio - Orden {purchase_order.po_number}'
            }

            subject = subject_map.get(reminder_type, subject_map['custom'])

            # Preparar contexto para el template
            context = {
                'purchase_order': purchase_order,
                'reminder_type': reminder_type,
                'message': message,
                'include_details': include_details,
                'user': user,
                'company_name': getattr(settings, 'COMPANY_NAME', 'Su Empresa')
            }

            # Renderizar template de email
            html_content = render_to_string(
                'emails/purchase_order_reminder.html',
                context
            )

            # Enviar email
            send_mail(
                subject=subject,
                message=f'Recordatorio para la orden {purchase_order.po_number}',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[purchase_order.supplier.email],
                html_message=html_content,
                fail_silently=False
            )

        except Exception as e:
            logger.error(f"Error sending reminder email: {str(e)}")
            raise

    def _notify_supplier_status_change(self, purchase_order, new_status):
        """Notificar al proveedor sobre cambio de estado"""
        try:
            if not purchase_order.supplier.email:
                return

            status_messages = {
                'sent': 'Su orden de compra ha sido enviada',
                'confirmed': 'Su orden de compra ha sido confirmada'
            }

            message = status_messages.get(new_status)
            if not message:
                return

            subject = f'Actualización de Estado - Orden {purchase_order.po_number}'

            context = {
                'purchase_order': purchase_order,
                'new_status': new_status,
                'message': message,
                'company_name': getattr(settings, 'COMPANY_NAME', 'Su Empresa')
            }

            html_content = render_to_string(
                'emails/purchase_order_status_change.html',
                context
            )

            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[purchase_order.supplier.email],
                html_message=html_content,
                fail_silently=True  # No fallar si no se puede enviar
            )

        except Exception as e:
            logger.error(f"Error notifying supplier: {str(e)}")

    def _notify_supplier_cancellation(self, purchase_order, reason):
        """Notificar al proveedor sobre cancelación"""
        try:
            if not purchase_order.supplier.email:
                return

            subject = f'Orden Cancelada - {purchase_order.po_number}'

            context = {
                'purchase_order': purchase_order,
                'reason': reason,
                'company_name': getattr(settings, 'COMPANY_NAME', 'Su Empresa')
            }

            html_content = render_to_string(
                'emails/purchase_order_cancellation.html',
                context
            )

            send_mail(
                subject=subject,
                message=f'La orden {purchase_order.po_number} ha sido cancelada. Razón: {reason}',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[purchase_order.supplier.email],
                html_message=html_content,
                fail_silently=True
            )

        except Exception as e:
            logger.error(f"Error notifying cancellation: {str(e)}")

    def create(self, request, *args, **kwargs):
        """Override create para devolver respuesta correcta"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Crear la orden
        purchase_order = serializer.save()

        # ✅ Usar serializer completo para respuesta
        response_serializer = PurchaseOrderSerializer(purchase_order)

        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PurchaseOrderCreateSerializer
        elif self.action == 'list':
            return PurchaseOrderListSerializer
        return PurchaseOrderSerializer

    @action(detail=True, methods=['post'])
    def receive_items(self, request, pk=None):
        """Acción para recibir items de la orden"""
        purchase_order = self.get_object()

        if purchase_order.status not in ['sent', 'partial']:
            return Response(
                {'error': 'No se pueden recibir items en el estado actual'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = ReceiveItemsSerializer(data=request.data)
        if serializer.is_valid():
            try:
                service = PurchaseOrderManagementService()
                service.receive_items(purchase_order, serializer.validated_data['received_items'])

                # Actualizar serializer
                updated_po = PurchaseOrder.objects.get(pk=pk)
                response_serializer = PurchaseOrderSerializer(updated_po)

                return Response(response_serializer.data)

            except Exception as e:
                return Response(
                    {'error': str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PurchaseOrderItemViewSet(viewsets.ModelViewSet):
    """ViewSet para items de órdenes de compra"""
    queryset = PurchaseOrderItem.objects.all().select_related('purchase_order', 'product')
    serializer_class = PurchaseOrderItemSerializer
    permission_classes = [IsAuthenticated]

class QuickPurchaseOrderAPIView(APIView):
    """API para crear órdenes de compra rápidas"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            data = request.data
            service = PurchaseOrderManagementService()

            # Validaciones básicas
            if not data.get('supplier_id'):
                return Response(
                    {'error': 'Proveedor es requerido'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not data.get('items'):
                return Response(
                    {'error': 'Items son requeridos'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Crear orden
            purchase_order = service.create_purchase_order(data, request.user)

            serializer = PurchaseOrderSerializer(purchase_order)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Error creating quick purchase order: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
class SupplierPurchaseHistoryAPIView(generics.RetrieveAPIView):
    """API para obtener historial de compras de un proveedor"""
    permission_classes = [IsAuthenticated]

    def retrieve(self, request, supplier_id):
        try:
            supplier = get_object_or_404(Supplier, id=supplier_id)
        except Supplier.DoesNotExist:
            return Response(
                {'error': 'Proveedor no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Obtener órdenes de compra
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

class PurchasingSuppliersAPIView(generics.ListAPIView):
    """API para listar suppliers en purchasing con paginación y búsqueda"""
    serializer_class = PurchasingSupplierSerializer

    def get_queryset(self):
        # Remover prefetch_related por ahora para evitar el error
        queryset = Supplier.objects.filter(is_active=True).select_related()

        # Filtro por búsqueda
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(company_name__icontains=search) |
                Q(contact_person__icontains=search) |
                Q(email__icontains=search) |
                Q(tax_id__icontains=search)
            )

        # Filtro por categoría
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)

        # Filtro por estado preferido
        preferred = self.request.query_params.get('preferred')
        if preferred and preferred.lower() == 'true':
            queryset = queryset.filter(is_preferred=True)

        # Ordenamiento
        ordering = self.request.query_params.get('ordering', 'company_name')
        if ordering in ['company_name', '-company_name', 'rating', '-rating', 'created_at', '-created_at']:
            queryset = queryset.order_by(ordering)

        return queryset

    def list(self, request, *args, **kwargs):
        """Override para implementar paginación manual compatible con Select2"""
        page = int(request.query_params.get('page', 1))
        page_size = 20  # Tamaño de página para Select2

        queryset = self.get_queryset()
        total_count = queryset.count()

        # Calcular offset
        offset = (page - 1) * page_size
        limit = offset + page_size

        # Obtener datos paginados
        paginated_queryset = queryset[offset:limit]
        serializer = self.get_serializer(paginated_queryset, many=True)

        # Formato compatible con Select2
        return Response({
            'results': serializer.data,
            'pagination': {
                'more': limit < total_count
            },
            'total_count': total_count
        })

class PurchasingSupplierDetailAPIView(generics.RetrieveAPIView):
    """API para obtener detalles de un supplier específico"""
    queryset = Supplier.objects.all()
    serializer_class = PurchasingSupplierSerializer

    def retrieve(self, request, *args, **kwargs):
        supplier = self.get_object()
        serializer = self.get_serializer(supplier)

        # Información adicional para purchasing
        additional_data = {
            'supplier': serializer.data,
            'recent_orders': self.get_recent_orders(supplier),
            'performance_stats': self.get_performance_stats(supplier)
        }

        return Response(additional_data)

    def get_recent_orders(self, supplier):
        """Obtener órdenes recientes del proveedor"""
        recent_orders = supplier.purchaseorder_set.order_by('-order_date')[:5]
        orders_data = []

        for order in recent_orders:
            orders_data.append({
                'id': order.id,
                'po_number': order.po_number,
                'order_date': order.order_date,
                'status': order.status,
                'total_amount': float(order.total_amount)
            })

        return orders_data

    def get_performance_stats(self, supplier):
        """Calcular estadísticas de rendimiento"""
        orders = supplier.purchaseorder_set.all()
        total_orders = orders.count()

        if total_orders == 0:
            return {
                'total_orders': 0,
                'on_time_delivery_rate': 0,
                'average_order_value': 0,
                'total_spent': 0
            }

        # Calcular métricas
        completed_orders = orders.filter(status='completed')
        on_time_orders = completed_orders.filter(
            delivery_date__lte=models.F('expected_delivery')
        ).count()

        total_spent = orders.aggregate(total=Sum('total_amount'))['total'] or 0
        avg_order_value = orders.aggregate(avg=Avg('total_amount'))['avg'] or 0

        return {
            'total_orders': total_orders,
            'on_time_delivery_rate': round((on_time_orders / completed_orders.count()) * 100, 2) if completed_orders.count() > 0 else 0,
            'average_order_value': float(avg_order_value),
            'total_spent': float(total_spent)
        }

class PurchasingProductSerializer(serializers.ModelSerializer):
    """Serializer específico para productos en purchasing"""

    # Campos principales
    name = serializers.CharField(read_only=True)
    code = serializers.CharField(read_only=True)
    description = serializers.CharField(read_only=True)

    # Información de stock
    current_stock = serializers.IntegerField(source='stock_current', read_only=True)
    minimum_stock = serializers.IntegerField(source='stock_minimum', read_only=True)
    stock_status = serializers.CharField(read_only=True)

    # Información de precios
    price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    last_purchase_price = serializers.SerializerMethodField()
    average_purchase_price = serializers.SerializerMethodField()

    # Información de categoría
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_id = serializers.IntegerField(source='category.id', read_only=True)

    # Información adicional
    unit_of_measure = serializers.CharField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    # Estadísticas de compras
    total_orders = serializers.SerializerMethodField()
    last_order_date = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'code', 'description', 'current_stock', 'minimum_stock',
            'stock_status', 'price', 'last_purchase_price', 'average_purchase_price',
            'category_name', 'category_id', 'unit_of_measure', 'is_active',
            'total_orders', 'last_order_date'
        ]

    def get_last_purchase_price(self, obj):
        """Último precio de compra"""
        last_item = obj.purchaseorderitem_set.order_by('-created_at').first()
        return float(last_item.unit_price) if last_item else 0.0

    def get_average_purchase_price(self, obj):
        """Precio promedio de compra"""
        from django.db.models import Avg
        avg_price = obj.purchaseorderitem_set.aggregate(
            avg=Avg('unit_price')
        )['avg']
        return float(avg_price) if avg_price else 0.0

    def get_total_orders(self, obj):
        """Total de órdenes donde aparece este producto"""
        return obj.purchaseorderitem_set.values('purchase_order').distinct().count()

    def get_last_order_date(self, obj):
        """Fecha de la última orden"""
        last_item = obj.purchaseorderitem_set.order_by('-created_at').first()
        return last_item.purchase_order.order_date if last_item else None


class PurchasingProductsAPIView(generics.ListAPIView):
    """API para listar productos en purchasing con filtros"""
    serializer_class = PurchasingProductSerializer

    def get_queryset(self):
        queryset = Product.objects.filter(is_active=True).select_related('category')

        # Filtro por búsqueda
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(code__icontains=search) |
                Q(description__icontains=search) |
                Q(tags__icontains=search)
            )

        # Filtro por categoría
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category_id=category)

        # Filtro por stock bajo
        low_stock = self.request.query_params.get('low_stock')
        if low_stock and low_stock.lower() == 'true':
            queryset = queryset.filter(
                stock_current__lte=models.F('stock_minimum')
            )

        # Ordenamiento
        ordering = self.request.query_params.get('ordering', 'name')
        if ordering in ['name', '-name', 'code', '-code', 'stock_current', '-stock_current']:
            queryset = queryset.order_by(ordering)

        return queryset

    def list(self, request, *args, **kwargs):
        page = int(request.query_params.get('page', 1))
        page_size = 20

        queryset = self.get_queryset()
        total_count = queryset.count()

        offset = (page - 1) * page_size
        limit = offset + page_size

        paginated_queryset = queryset[offset:limit]
        serializer = self.get_serializer(paginated_queryset, many=True)

        return Response({
            'results': serializer.data,
            'pagination': {
                'more': limit < total_count
            },
            'total_count': total_count
        })

class PurchasingProductDetailAPIView(generics.RetrieveAPIView):
    """API para obtener detalles de un producto específico"""
    queryset = Product.objects.all()
    serializer_class = PurchasingProductSerializer

    def retrieve(self, request, *args, **kwargs):
        product = self.get_object()
        serializer = self.get_serializer(product)

        # Información adicional para purchasing
        additional_data = {
            'product': serializer.data,
            'recent_purchases': self.get_recent_purchases(product),
            'supplier_prices': self.get_supplier_prices(product)
        }

        return Response(additional_data)

    def get_recent_purchases(self, product):
        """Obtener compras recientes del producto"""
        recent_items = product.purchaseorderitem_set.select_related(
            'purchase_order__supplier'
        ).order_by('-created_at')[:5]

        purchases_data = []
        for item in recent_items:
            purchases_data.append({
                'po_number': item.purchase_order.po_number,
                'supplier_name': item.purchase_order.supplier.company_name,
                'order_date': item.purchase_order.order_date,
                'quantity': item.quantity_ordered,
                'unit_price': float(item.unit_price),
                'total': float(item.line_total)
            })

        return purchases_data

    def get_supplier_prices(self, product):
        """Obtener precios por proveedor"""
        supplier_prices = product.purchaseorderitem_set.values(
            'purchase_order__supplier__id',
            'purchase_order__supplier__company_name'
        ).annotate(
            avg_price=Avg('unit_price'),
            last_price=models.Max('unit_price'),
            last_order=models.Max('purchase_order__order_date')
        ).order_by('-last_order')

        prices_data = []
        for sp in supplier_prices:
            prices_data.append({
                'supplier_id': sp['purchase_order__supplier__id'],
                'supplier_name': sp['purchase_order__supplier__company_name'],
                'average_price': float(sp['avg_price']),
                'last_price': float(sp['last_price']),
                'last_order_date': sp['last_order']
            })

        return prices_data
