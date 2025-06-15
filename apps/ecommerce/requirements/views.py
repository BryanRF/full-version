# apps/requirements/views.py
from django.views.decorators.clickjacking import xframe_options_exempt
from rest_framework import generics, viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.db import models
from django.db.models import Q, Count, Sum
from django.contrib.auth.models import User
from datetime import date, timedelta
from .models import *
from django.http import HttpResponse, FileResponse
from django.template.loader import get_template
from rest_framework.decorators import action
from io import BytesIO
import os
from datetime import date
from .services import *
from .serializers import *
from apps.ecommerce.requirements.services_notifications import RequirementNotificationService
class RequirementListCreateAPIView(generics.ListCreateAPIView):
    """Lista todos los requerimientos con filtros y crea nuevos requerimientos"""
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return RequirementCreateSerializer
        return RequirementListSerializer
    
    def get_queryset(self):
        queryset = Requirement.objects.all().select_related('usuario_solicitante').prefetch_related('detalles')
        
        # Filtro por estado
        estado = self.request.query_params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado)
        
        # Filtro por prioridad
        prioridad = self.request.query_params.get('prioridad')
        if prioridad:
            queryset = queryset.filter(prioridad=prioridad)
        
        # Filtro por usuario solicitante
        usuario = self.request.query_params.get('usuario')
        if usuario:
            queryset = queryset.filter(usuario_solicitante_id=usuario)
        
        # Filtro por fecha
        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if fecha_desde:
            queryset = queryset.filter(fecha_requerimiento__gte=fecha_desde)
        if fecha_hasta:
            queryset = queryset.filter(fecha_requerimiento__lte=fecha_hasta)
        
        # Filtro por búsqueda de texto
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(id__icontains=search) |
                Q(usuario_solicitante__first_name__icontains=search) |
                Q(usuario_solicitante__last_name__icontains=search) |
                Q(usuario_solicitante__username__icontains=search) |
                Q(notas__icontains=search)
            )
        
        return queryset
    
    def list(self, request):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"data": serializer.data})

class RequirementViewSet(viewsets.ModelViewSet):
    """ViewSet completo para operaciones CRUD de requerimientos"""
    queryset = Requirement.objects.all().select_related('usuario_solicitante').prefetch_related('detalles__producto')
    serializer_class = RequirementSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    def get_serializer_class(self):
        if self.action == 'create':
            return RequirementCreateSerializer
        elif self.action == 'list':
            return RequirementListSerializer
        elif self.action in ['update', 'partial_update']:
            return RequirementUpdateSerializer
        elif self.action in ['update_status']:
            return RequirementUpdateStatusSerializer
        elif self.action in ['retrieve', 'details_with_stock']:
            return RequirementSerializerExtended
        return RequirementSerializer
    
    @action(detail=True, methods=['post'])
    def select_supplier(self, request, pk=None):
        """Seleccionar proveedor ganador para el requerimiento"""
        requirement = get_object_or_404(Requirement, pk=pk)
        
        proveedor_nombre = request.data.get('proveedor')
        motivo = request.data.get('motivo')
        observaciones = request.data.get('observaciones', '')
        
        if not proveedor_nombre or not motivo:
            return Response(
                {"error": "Proveedor y motivo son requeridos"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Buscar el envío de cotización correspondiente
            from apps.ecommerce.cotizacion.models import EnvioCotizacion
            from apps.ecommerce.suppliers.models import Supplier
            
            proveedor = Supplier.objects.get(company_name=proveedor_nombre)
            envio = EnvioCotizacion.objects.get(
                requerimiento=requirement,
                proveedor=proveedor,
                estado='respondido'
            )
            
            # Actualizar estado del requerimiento
            requirement.estado = 'orden_generada'
            
            # Agregar información de selección en notas
            nota_seleccion = f"\n\nPROVEEDOR SELECCIONADO: {proveedor_nombre}\n"
            nota_seleccion += f"Motivo: {motivo}\n"
            nota_seleccion += f"Fecha selección: {timezone.now().strftime('%d/%m/%Y %H:%M')}\n"
            nota_seleccion += f"Seleccionado por: {request.user.username}\n"
            if observaciones:
                nota_seleccion += f"Observaciones: {observaciones}\n"
            
            requirement.notas = (requirement.notas or '') + nota_seleccion
            requirement.save()
            
            # Opcional: Crear registro de selección en modelo separado
            # (Puedes crear un modelo SupplierSelection para tracking detallado)
            
            return Response({
                "message": f"Proveedor {proveedor_nombre} seleccionado exitosamente",
                "nuevo_estado": requirement.estado_display,
                "proveedor_seleccionado": proveedor_nombre,
                "envio_id": envio.id
            })
            
        except Supplier.DoesNotExist:
            return Response(
                {"error": "Proveedor no encontrado"},
                status=status.HTTP_404_NOT_FOUND
            )
        except EnvioCotizacion.DoesNotExist:
            return Response(
                {"error": "No se encontró cotización respondida para este proveedor"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": f"Error al seleccionar proveedor: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def export_comparison_excel(self, request, pk=None):
        """Exportar comparación de cotizaciones a Excel"""
        requirement = get_object_or_404(Requirement, pk=pk)
        
        try:
            from .services import ComparisonExcelGenerator
            
            generator = ComparisonExcelGenerator(requirement)
            excel_buffer = generator.create_comparison_excel()
            
            filename = f"Comparacion_Cotizaciones_{requirement.numero_requerimiento}_{date.today().strftime('%Y%m%d')}.xlsx"
            
            response = HttpResponse(
                excel_buffer.getvalue(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            return response
            
        except Exception as e:
            return Response(
                {"error": f"Error generando Excel: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def export_comparison_pdf(self, request, pk=None):
        """Exportar comparación de cotizaciones a PDF"""
        requirement = get_object_or_404(Requirement, pk=pk)
        
        try:
            from .services import ComparisonPDFGenerator
            
            generator = ComparisonPDFGenerator(requirement)
            pdf_buffer = generator.create_comparison_pdf()
            
            filename = f"Comparacion_Cotizaciones_{requirement.numero_requerimiento}_{date.today().strftime('%Y%m%d')}.pdf"
            
            response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            return response
            
        except Exception as e:
            return Response(
                {"error": f"Error generando PDF: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def export_excel(self, request, pk=None):
        """Exportar requerimiento como Excel"""
        requirement = get_object_or_404(Requirement, pk=pk)
        
        # Generar Excel
        excel_generator = RequirementExcelGenerator(requirement)
        excel_buffer = excel_generator.create_excel()
        
        # Nombre del archivo
        filename = f"Requerimiento_{requirement.numero_requerimiento}_{date.today().strftime('%Y%m%d')}.xlsx"
        
        # Crear respuesta HTTP
        response = HttpResponse(
            excel_buffer.getvalue(), 
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Content-Length'] = len(excel_buffer.getvalue())
        
        return response

    @action(detail=True, methods=['get'])
    def export_cotizacion_excel(self, request, pk=None):
        """Exportar Excel template para cotización"""
        requirement = get_object_or_404(Requirement, pk=pk)
        
        # Generar Excel para cotización
        excel_generator = RequirementExcelGenerator(requirement)
        excel_buffer = excel_generator.create_excel()
        
        # Nombre del archivo
        filename = f"Cotizacion_Template_{requirement.numero_requerimiento}_{date.today().strftime('%Y%m%d')}.xlsx"
        
        # Crear respuesta HTTP
        response = HttpResponse(
            excel_buffer.getvalue(), 
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Content-Length'] = len(excel_buffer.getvalue())
        
        return response
    
    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        requirement = get_object_or_404(Requirement, pk=pk)
        old_status = requirement.estado
        
        serializer = RequirementUpdateStatusSerializer(requirement, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            
            # Notificar cambio de estado
            if old_status != requirement.estado:
                RequirementNotificationService.notify_requirement_status_changed(
                    requirement, request.user, old_status, requirement.estado
                )
            
            return Response({
                "message": f"Estado actualizado a {requirement.estado_display}",
                "estado": requirement.estado,
                "estado_display": requirement.estado_display,
                "estado_color": requirement.estado_color
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['patch'])
    def approve(self, request, pk=None):
        """Aprobar requerimiento"""
        requirement = get_object_or_404(Requirement, pk=pk)
        
        if requirement.estado != 'pendiente':
            return Response({
                "error": "Solo se pueden aprobar requerimientos pendientes"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        requirement.estado = 'aprobado'
        requirement.save()
        RequirementNotificationService.notify_requirement_approved(requirement, request.user)
        return Response({
            "message": "Requerimiento aprobado exitosamente",
            "estado": requirement.estado,
            "estado_display": requirement.estado_display
        })
    
    @action(detail=True, methods=['patch'])
    def reject(self, request, pk=None):
        """Rechazar requerimiento"""
        requirement = get_object_or_404(Requirement, pk=pk)
        
        if requirement.estado != 'pendiente':
            return Response({
                "error": "Solo se pueden rechazar requerimientos pendientes"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Agregar motivo de rechazo a las notas
        motivo = request.data.get('motivo', '')
        if motivo:
            requirement.notas = f"{requirement.notas}\n\nMotivo de rechazo: {motivo}" if requirement.notas else f"Motivo de rechazo: {motivo}"
        
        requirement.estado = 'rechazado'
        requirement.save()
        RequirementNotificationService.notify_requirement_rejected(requirement, request.user, motivo)
        return Response({
            "message": "Requerimiento rechazado",
            "estado": requirement.estado,
            "estado_display": requirement.estado_display
        })
    
    @action(detail=False, methods=['get'])
    def dashboard_analytics(self, request):
        """Analíticas para el dashboard"""
        queryset = self.get_queryset()
        
        # Estadísticas básicas
        total_requirements = queryset.count()
        pending_requirements = queryset.filter(estado='pendiente').count()
        approved_requirements = queryset.filter(estado='aprobado').count()
        completed_requirements = queryset.filter(estado='completado').count()
        
        # Estadísticas por prioridad
        priority_stats = queryset.values('prioridad').annotate(
            count=Count('id')
        ).order_by('prioridad')
        
        # Estadísticas por estado
        status_stats = queryset.values('estado').annotate(
            count=Count('id')
        ).order_by('estado')
        
        # Requerimientos por fecha (últimos 7 días)
        last_week = date.today() - timedelta(days=7)
        recent_requirements = queryset.filter(
            created_at__date__gte=last_week
        ).values('created_at__date').annotate(
            count=Count('id')
        ).order_by('created_at__date')
        
        # Productos más solicitados
        popular_products = RequirementDetail.objects.select_related('producto').values(
            'producto__id', 'producto__name'
        ).annotate(
            total_solicitado=Sum('cantidad_solicitada'),
            veces_solicitado=Count('requerimiento')
        ).order_by('-total_solicitado')[:10]
        
        return Response({
            'total_requirements': total_requirements,
            'pending_requirements': pending_requirements,
            'approved_requirements': approved_requirements,
            'completed_requirements': completed_requirements,
            'priority_statistics': priority_stats,
            'status_statistics': status_stats,
            'recent_requirements': recent_requirements,
            'popular_products': popular_products,
        })
    
    @action(detail=False, methods=['get'])
    def by_status(self, request):
        """Obtener requerimientos agrupados por estado"""
        status_choices = dict(Requirement.STATUS_CHOICES)
        data = []
        
        for status_code, status_name in status_choices.items():
            requirements = self.get_queryset().filter(estado=status_code)
            data.append({
                'status_code': status_code,
                'status_name': status_name,
                'count': requirements.count(),
                'requirements': RequirementListSerializer(requirements, many=True).data
            })
        
        return Response({"data": data})
    
    @action(detail=False, methods=['get'])
    def my_requirements(self, request):
        """Obtener requerimientos del usuario autenticado"""
        if not request.user.is_authenticated:
            return Response({
                "error": "Usuario no autenticado"
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        queryset = self.get_queryset().filter(usuario_solicitante=request.user)
        serializer = RequirementListSerializer(queryset, many=True)
        return Response({"data": serializer.data})
    
    @action(detail=True, methods=['get'])
    def details_with_stock(self, request, pk=None):
        """Obtener detalles del requerimiento con información de stock"""
        requirement = get_object_or_404(Requirement, pk=pk)
        
        # Serializar el requerimiento completo
        requirement_data = RequirementSerializer(requirement).data
        
        # Agregar información adicional de stock para cada detalle
        for detalle in requirement_data['detalles']:
            producto_id = detalle['producto']
            try:
                from apps.ecommerce.products.models import Product
                producto = Product.objects.get(id=producto_id)
                detalle['stock_status'] = producto.stock_status
                detalle['stock_disponible'] = producto.stock_current
                detalle['stock_minimo'] = producto.stock_minimum
                detalle['stock_maximo'] = producto.stock_maximum
            except Product.DoesNotExist:
                detalle['stock_status'] = 'unknown'
                detalle['stock_disponible'] = 0
        
        return Response(requirement_data)
    
    @action(detail=True, methods=['get'])
    def export_pdf(self, request, pk=None):
        """Exportar requerimiento como PDF para proveedores"""
        requirement = get_object_or_404(Requirement, pk=pk)
        
        # Generar PDF
        pdf_generator = RequirementPDFGenerator(requirement)
        pdf_buffer = pdf_generator.generate_pdf()
        
        # Nombre del archivo
        filename = f"Requerimiento_{requirement.numero_requerimiento}_{date.today().strftime('%Y%m%d')}.pdf"
        
        # Crear respuesta HTTP
        response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Content-Length'] = len(pdf_buffer.getvalue())
        
        return response
    
    @xframe_options_exempt    
    @action(detail=True, methods=['get'])
    def view_pdf(self, request, pk=None):
        """Ver PDF en el navegador (opcional)"""
        requirement = get_object_or_404(Requirement, pk=pk)
        
        # Generar PDF
        pdf_generator = RequirementPDFGenerator(requirement)
        pdf_buffer = pdf_generator.generate_pdf()
        
        # Nombre del archivo
        filename = f"Requerimiento_{requirement.numero_requerimiento}_{date.today().strftime('%Y%m%d')}.pdf"
        
        # Crear respuesta HTTP para visualizar
        response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        
        return response
    
    def update(self, request, *args, **kwargs):
        """Actualizar requerimiento completo"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Verificar permisos de edición
        if not instance.can_edit:
            return Response({
                "error": "Este requerimiento no puede ser editado en su estado actual"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        # Guardar instancia anterior para auditoría
        previous_data = RequirementSerializer(instance).data
        
        # Actualizar
        updated_instance = serializer.save()
        
        # Log de cambios (opcional)
        self._log_requirement_changes(instance, previous_data, serializer.data, request.user)
        
        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)
    
    def partial_update(self, request, *args, **kwargs):
        """Actualización parcial del requerimiento"""
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)
    
    @action(detail=True, methods=['post'])
    def add_product(self, request, pk=None):
        """Agregar un producto al requerimiento"""
        requirement = get_object_or_404(Requirement, pk=pk)
        serializer = RequirementProductActionSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                service = RequirementUpdateService(requirement)
                detalle = service.add_product(
                    producto_id=serializer.validated_data['producto_id'],
                    cantidad_solicitada=serializer.validated_data['cantidad_solicitada'],
                    unidad_medida=serializer.validated_data['unidad_medida'],
                    observaciones=serializer.validated_data.get('observaciones', '')
                )
                
                return Response({
                    "message": "Producto agregado exitosamente",
                    "detalle": RequirementDetailSerializer(detalle).data
                }, status=status.HTTP_201_CREATED)
                
            except ValidationError as e:
                return Response({
                    "error": str(e)
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['delete'])
    def remove_product(self, request, pk=None):
        """Remover un producto del requerimiento"""
        requirement = get_object_or_404(Requirement, pk=pk)
        producto_id = request.data.get('producto_id')
        
        if not producto_id:
            return Response({
                "error": "producto_id es requerido"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            service = RequirementUpdateService(requirement)
            service.remove_product(producto_id)
            
            return Response({
                "message": "Producto removido exitosamente"
            }, status=status.HTTP_200_OK)
            
        except ValidationError as e:
            return Response({
                "error": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['patch'])
    def update_product_quantity(self, request, pk=None):
        """Actualizar cantidad de un producto específico"""
        requirement = get_object_or_404(Requirement, pk=pk)
        producto_id = request.data.get('producto_id')
        nueva_cantidad = request.data.get('cantidad_solicitada')
        
        if not producto_id or not nueva_cantidad:
            return Response({
                "error": "producto_id y cantidad_solicitada son requeridos"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            service = RequirementUpdateService(requirement)
            detalle = service.update_product_quantity(producto_id, nueva_cantidad)
            
            return Response({
                "message": "Cantidad actualizada exitosamente",
                "detalle": RequirementDetailSerializer(detalle).data
            }, status=status.HTTP_200_OK)
            
        except ValidationError as e:
            return Response({
                "error": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def can_edit(self, request, pk=None):
        """Verificar si el requerimiento puede ser editado"""
        requirement = get_object_or_404(Requirement, pk=pk)
        
        return Response({
            "can_edit": requirement.can_edit,
            "estado": requirement.estado,
            "estado_display": requirement.estado_display,
            "reason": "Solo se pueden editar requerimientos en estado 'pendiente' o 'rechazado'" if not requirement.can_edit else None
        })
    
    @action(detail=False, methods=['post'])
    def compare(self, request):
        """Comparar dos requerimientos"""
        serializer = RequirementComparisonSerializer(data=request.data)
        
        if serializer.is_valid():
            req1_id = serializer.validated_data['requirement_id_1']
            req2_id = serializer.validated_data['requirement_id_2']
            
            req1 = get_object_or_404(Requirement, pk=req1_id)
            req2 = get_object_or_404(Requirement, pk=req2_id)
            
            differences = RequirementComparisonService.compare_requirements(req1, req2)
            
            return Response({
                "requirement_1": {
                    "id": req1.id,
                    "numero": req1.numero_requerimiento,
                    "fecha_creacion": req1.created_at
                },
                "requirement_2": {
                    "id": req2.id,
                    "numero": req2.numero_requerimiento,
                    "fecha_creacion": req2.created_at
                },
                "differences": differences,
                "has_significant_changes": RequirementComparisonService.has_significant_changes(differences)
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Duplicar un requerimiento"""
        original_requirement = get_object_or_404(Requirement, pk=pk)
        
        try:
            with transaction.atomic():
                # Crear nueva instancia
                new_requirement = Requirement.objects.create(
                    usuario_solicitante=request.user,  # Usuario actual como solicitante
                    fecha_requerimiento=original_requirement.fecha_requerimiento,
                    notas=f"Duplicado de {original_requirement.numero_requerimiento}\n\n{original_requirement.notas or ''}",
                    prioridad=original_requirement.prioridad,
                    # archivo_adjunto no se copia por seguridad
                )
                
                # Copiar detalles
                for detalle_original in original_requirement.detalles.all():
                    RequirementDetail.objects.create(
                        requerimiento=new_requirement,
                        producto=detalle_original.producto,
                        cantidad_solicitada=detalle_original.cantidad_solicitada,
                        unidad_medida=detalle_original.unidad_medida,
                        observaciones=detalle_original.observaciones
                    )
                
                return Response({
                    "message": f"Requerimiento duplicado exitosamente",
                    "original_id": original_requirement.id,
                    "new_id": new_requirement.id,
                    "numero_requerimiento": new_requirement.numero_requerimiento
                }, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            return Response({
                "error": f"Error al duplicar requerimiento: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'])
    def edit_form_data(self, request, pk=None):
        """Obtener datos del requerimiento para formulario de edición"""
        requirement = get_object_or_404(Requirement, pk=pk)
        
        if not requirement.can_edit:
            return Response({
                "error": "Este requerimiento no puede ser editado"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Serializar datos completos para edición
        serializer = RequirementSerializerExtended(requirement)
        
        # Agregar información adicional para el formulario
        data = serializer.data
        data['form_data'] = {
            'available_priorities': [
                {'value': 'baja', 'label': '🟢 Baja'},
                {'value': 'media', 'label': '🟡 Media'},
                {'value': 'alta', 'label': '🔴 Alta'}
            ],
            'editable_fields': [
                'fecha_requerimiento', 'prioridad', 'notas', 'archivo_adjunto'
            ],
            'product_actions': {
                'can_add': True,
                'can_remove': True,
                'can_modify_quantity': True,
                'can_modify_unit': True,
                'can_modify_observations': True
            }
        }
        
        return Response(data)
    
    def _log_requirement_changes(self, instance, previous_data, new_data, user):
        """Log de cambios para auditoría (implementar según necesidades)"""
        # Aquí puedes implementar logging de cambios
        # Por ejemplo, guardar en un modelo de auditoría
        
        from django.utils import timezone
        
        changes = []
        
        # Comparar campos básicos
        for field in ['fecha_requerimiento', 'prioridad', 'notas']:
            old_value = previous_data.get(field)
            new_value = new_data.get(field)
            
            if old_value != new_value:
                changes.append({
                    'field': field,
                    'old_value': old_value,
                    'new_value': new_value
                })
        
        if changes:
            # Aquí puedes guardar los cambios en un modelo de auditoría
            # o enviar a un sistema de logging
            print(f"Requirement {instance.id} updated by {user.username} at {timezone.now()}")
            print(f"Changes: {changes}")
class RequirementDetailViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar detalles de requerimientos"""
    queryset = RequirementDetail.objects.all().select_related('requerimiento', 'producto')
    serializer_class = RequirementDetailSerializer
    
    def get_queryset(self):
        requirement_id = self.request.query_params.get('requirement', None)
        if requirement_id:
            return self.queryset.filter(requerimiento_id=requirement_id)
        return self.queryset
    
    def perform_create(self, serializer):
        # Verificar que el requerimiento pueda ser editado
        requirement = serializer.validated_data['requerimiento']
        if not requirement.can_edit:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("No se pueden agregar productos a este requerimiento en su estado actual")
        
        serializer.save()
        RequirementNotificationService.notify_requirement_created(requirement)
    
    def perform_update(self, serializer):
        # Verificar que el requerimiento pueda ser editado
        requirement = serializer.instance.requerimiento
        if not requirement.can_edit:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("No se pueden modificar productos de este requerimiento en su estado actual")
        
        serializer.save()
    
    def perform_destroy(self, instance):
        # Verificar que el requerimiento pueda ser editado
        if not instance.requerimiento.can_edit:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("No se pueden eliminar productos de este requerimiento en su estado actual")
        
        instance.delete()
class RequirementDetailUpdateViewSet(viewsets.ModelViewSet):
    """ViewSet para actualizar detalles de requerimientos individualmente"""
    queryset = RequirementDetail.objects.all().select_related('requerimiento', 'producto')
    serializer_class = RequirementDetailUpdateSerializer
    
    def get_queryset(self):
        requirement_id = self.request.query_params.get('requirement', None)
        if requirement_id:
            return self.queryset.filter(requerimiento_id=requirement_id)
        return self.queryset
    
    def update(self, request, *args, **kwargs):
        """Actualizar detalle individual"""
        instance = self.get_object()
        
        if not instance.requerimiento.can_edit:
            return Response({
                "error": "Este requerimiento no puede ser editado en su estado actual"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return super().update(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        """Actualización parcial de detalle"""
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """Eliminar detalle individual"""
        instance = self.get_object()
        
        if not instance.requerimiento.can_edit:
            return Response({
                "error": "Este requerimiento no puede ser editado en su estado actual"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verificar que no sea el último producto
        if instance.requerimiento.detalles.count() <= 1:
            return Response({
                "error": "No se puede eliminar el último producto del requerimiento"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return super().destroy(request, *args, **kwargs)

class RequirementFileUploadView(APIView):
    """Vista para subir/actualizar archivos adjuntos"""
    parser_classes = [MultiPartParser, FormParser]
    
    def patch(self, request, requirement_id):
        """Actualizar archivo adjunto de un requerimiento"""
        try:
            requirement = Requirement.objects.get(id=requirement_id)
        except Requirement.DoesNotExist:
            return Response({
                "error": "Requerimiento no encontrado"
            }, status=status.HTTP_404_NOT_FOUND)
        
        if not requirement.can_edit:
            return Response({
                "error": "Este requerimiento no puede ser editado"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        archivo = request.FILES.get('archivo_adjunto')
        if not archivo:
            return Response({
                "error": "No se proporcionó archivo"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validar archivo
        max_size = 10 * 1024 * 1024  # 10MB
        if archivo.size > max_size:
            return Response({
                "error": "El archivo no puede ser mayor a 10MB"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Eliminar archivo anterior si existe
        if requirement.archivo_adjunto:
            requirement.archivo_adjunto.delete(save=False)
        
        # Guardar nuevo archivo
        requirement.archivo_adjunto = archivo
        requirement.save()
        
        return Response({
            "message": "Archivo actualizado exitosamente",
            "archivo_url": requirement.archivo_adjunto.url if requirement.archivo_adjunto else None,
            "archivo_name": requirement.archivo_adjunto.name.split('/')[-1] if requirement.archivo_adjunto else None
        })
    
    def delete(self, request, requirement_id):
        """Eliminar archivo adjunto"""
        try:
            requirement = Requirement.objects.get(id=requirement_id)
        except Requirement.DoesNotExist:
            return Response({
                "error": "Requerimiento no encontrado"
            }, status=status.HTTP_404_NOT_FOUND)
        
        if not requirement.can_edit:
            return Response({
                "error": "Este requerimiento no puede ser editado"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if requirement.archivo_adjunto:
            requirement.archivo_adjunto.delete(save=False)
            requirement.archivo_adjunto = None
            requirement.save()
        
        return Response({
            "message": "Archivo eliminado exitosamente"
        })
# Vistas adicionales para plantillas
from django.views.generic import TemplateView
from web_project import TemplateLayout

class RequirementTemplateView(TemplateView):
    """Vista base para plantillas de requerimientos"""
    
    def get_context_data(self, **kwargs):
        context = TemplateLayout.init(self, super().get_context_data(**kwargs))
        return context