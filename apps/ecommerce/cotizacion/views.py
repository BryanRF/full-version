# apps/ecommerce/cotizacion/views.py
from rest_framework import generics, viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.http import HttpResponse, JsonResponse
from django.db import models, transaction
from django.utils import timezone
from datetime import date, timedelta
from django.views.generic import TemplateView
from web_project import TemplateLayout
from django.core.files.storage import default_storage
from apps.ecommerce.cotizacion.services_notifications import CotizacionNotificationService
from .models import EnvioCotizacion, RespuestaCotizacion, DetalleRespuestaCotizacion
from .serializers import (
    EnvioCotizacionSerializer,
    EnvioCotizacionListSerializer,
    EnvioCotizacionCreateSerializer,
    RespuestaCotizacionSerializer,
    DetalleRespuestaCotizacionSerializer,
    EnvioMasivoSerializer,
    ConfirmarEnvioManualSerializer
)
from apps.ecommerce.requirements.services import RequirementExcelGenerator
from .services import CotizacionManager
from apps.ecommerce.requirements.models import Requirement
from apps.ecommerce.suppliers.models import Supplier
import logging
logger = logging.getLogger(__name__)

class EnvioCotizacionListCreateAPIView(generics.ListCreateAPIView):
    """API para listar y crear envíos de cotización"""
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return EnvioCotizacionCreateSerializer
        return EnvioCotizacionListSerializer
    
    def get_queryset(self):
        queryset = EnvioCotizacion.objects.all().select_related(
            'requerimiento', 'proveedor', 'usuario_creacion', 'enviado_por'
        )
        
        # Filtros
        estado = self.request.query_params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado)
            
        metodo = self.request.query_params.get('metodo_envio')
        if metodo:
            queryset = queryset.filter(metodo_envio=metodo)
            
        requirement_id = self.request.query_params.get('requerimiento')
        if requirement_id:
            queryset = queryset.filter(requerimiento_id=requirement_id)
            
        supplier_id = self.request.query_params.get('proveedor')
        if supplier_id:
            queryset = queryset.filter(proveedor_id=supplier_id)
            
        return queryset.order_by('-created_at')
    
    def list(self, request):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"data": serializer.data})


class EnvioCotizacionViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión completa de envíos de cotización"""
    queryset = EnvioCotizacion.objects.all().select_related(
        'requerimiento', 'proveedor', 'usuario_creacion', 'enviado_por'
    )
    serializer_class = EnvioCotizacionSerializer

    @action(detail=True, methods=['get'])
    def processing_logs(self, request, pk=None):
        """Obtener logs de procesamiento del envío"""
        envio = get_object_or_404(EnvioCotizacion, pk=pk)
        
        from .models import ExcelProcessingLog
        logs = ExcelProcessingLog.objects.filter(envio=envio).order_by('-created_at')
        
        logs_data = []
        for log in logs:
            logs_data.append({
                'id': log.id,
                'archivo_nombre': log.archivo_nombre,
                'archivo_tamaño': log.archivo_tamaño,
                'validacion_exitosa': log.validacion_exitosa,
                'procesamiento_exitoso': log.procesamiento_exitoso,
                'productos_procesados': log.productos_procesados,
                'productos_fallidos': log.productos_fallidos,
                'total_filas': log.total_filas,
                'tasa_exito': log.tasa_exito_productos,
                'tiempo_procesamiento': str(log.tiempo_procesamiento) if log.tiempo_procesamiento else None,
                'created_at': log.created_at,
                'errores_validacion': log.errores_validacion,
                'advertencias_validacion': log.advertencias_validacion,
                'resumen_validacion': log.resumen_validacion
            })
        
        return Response({
            'logs': logs_data,
            'total_logs': len(logs_data)
        })

    @action(detail=True, methods=['get'])
    def processing_statistics(self, request, pk=None):
        """Estadísticas de procesamiento del envío"""
        envio = get_object_or_404(EnvioCotizacion, pk=pk)
        
        from .models import ExcelProcessingLog
        from django.db.models import Avg, Sum, Count
        
        logs = ExcelProcessingLog.objects.filter(envio=envio)
        
        if not logs.exists():
            return Response({
                'message': 'No hay logs de procesamiento disponibles'
            })
        
        stats = logs.aggregate(
            total_intentos=Count('id'),
            intentos_exitosos=Count('id', filter=models.Q(procesamiento_exitoso=True)),
            total_productos_procesados=Sum('productos_procesados'),
            total_productos_fallidos=Sum('productos_fallidos'),
            promedio_tiempo_procesamiento=Avg('tiempo_procesamiento')
        )
        
        # Último log
        ultimo_log = logs.first()
        
        return Response({
            'estadisticas': {
                'total_intentos': stats['total_intentos'],
                'intentos_exitosos': stats['intentos_exitosos'],
                'tasa_exito_intentos': round((stats['intentos_exitosos'] / stats['total_intentos']) * 100, 2) if stats['total_intentos'] > 0 else 0,
                'total_productos_procesados': stats['total_productos_procesados'] or 0,
                'total_productos_fallidos': stats['total_productos_fallidos'] or 0,
                'tiempo_promedio_procesamiento': str(stats['promedio_tiempo_procesamiento']) if stats['promedio_tiempo_procesamiento'] else None
            },
            'ultimo_procesamiento': {
                'fecha': ultimo_log.created_at,
                'exitoso': ultimo_log.procesamiento_exitoso,
                'archivo': ultimo_log.archivo_nombre,
                'productos_procesados': ultimo_log.productos_procesados,
                'tiempo_procesamiento': str(ultimo_log.tiempo_procesamiento) if ultimo_log.tiempo_procesamiento else None
            } if ultimo_log else None
        })
    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def validate_excel(self, request, pk=None):
        """Validar archivo Excel sin guardarlo"""
        envio = get_object_or_404(EnvioCotizacion, pk=pk)
        
        if 'excel_file' not in request.FILES:
            return Response(
                {"error": "No se proporcionó archivo Excel"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        excel_file = request.FILES['excel_file']
        
        if not excel_file.name.lower().endswith(('.xlsx', '.xls')):
            return Response(
                {"error": "Solo se permiten archivos Excel (.xlsx, .xls)"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .services import CotizacionResponseProcessor
            processor = CotizacionResponseProcessor(envio)
            
            # Validar archivo en memoria
            validation_result = processor._validate_excel_from_file(excel_file)
            
            response_data = {
                'valid': validation_result['valid'],
                'errors': validation_result['errors'],
                'warnings': validation_result['warnings']
            }
            
            # Análisis adicional si es válido
            if validation_result['valid'] and validation_result['dataframe'] is not None:
                df = validation_result['dataframe']
                requirement_codes = set(
                    envio.requerimiento.detalles.values_list('producto__code', flat=True)
                )
                
                codigo_col_pos = processor.OFFICIAL_COLUMNS['CÓDIGO']
                codes_in_excel = []
                
                for index, row in df.iterrows():
                    try:
                        codigo = str(row.iloc[codigo_col_pos]).strip() if pd.notna(row.iloc[codigo_col_pos]) else ""
                        if codigo and codigo.upper() != 'NAN':
                            codes_in_excel.append(codigo)
                    except:
                        continue
                
                codes_found = set(codes_in_excel) & requirement_codes
                codes_missing = requirement_codes - set(codes_in_excel)
                codes_extra = set(codes_in_excel) - requirement_codes
                
                response_data['analysis'] = {
                    'total_rows': len(df),
                    'total_requirement_products': len(requirement_codes),
                    'codes_found': len(codes_found),
                    'codes_missing': len(codes_missing),
                    'codes_extra': len(codes_extra),
                    'coverage_percentage': round((len(codes_found) / len(requirement_codes)) * 100, 1) if requirement_codes else 0,
                    'missing_products': list(codes_missing)[:10],
                    'extra_products': list(codes_extra)[:10]
                }
            
            return Response(response_data)
            
        except Exception as e:
            return Response(
                {"error": f"Error validando archivo: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    @action(detail=True, methods=['get'])
    def download_template(self, request, pk=None):
        """Descargar template Excel específico para este envío"""
        envio = get_object_or_404(EnvioCotizacion, pk=pk)
        
        try:
            from apps.ecommerce.requirements.services import RequirementExcelGenerator
            
            # Generar Excel template
            excel_generator = RequirementExcelGenerator(envio.requerimiento)
            excel_buffer = excel_generator.create_excel()
            
            # Nombre del archivo específico para el proveedor
            filename = f"Cotizacion_{envio.numero_envio}_{envio.proveedor.company_name.replace(' ', '_')}_{date.today().strftime('%Y%m%d')}.xlsx"
            
            response = HttpResponse(
                excel_buffer.getvalue(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            return response
            
        except Exception as e:
            return Response(
                {"error": f"Error generando template: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def get_requirement_products(self, request, pk=None):
        """Obtener códigos de productos del requerimiento para validación frontend"""
        envio = get_object_or_404(EnvioCotizacion, pk=pk)
        
        products = []
        for detalle in envio.requerimiento.detalles.all():
            products.append({
                'code': detalle.producto.code,
                'name': detalle.producto.name,
                'category': detalle.producto.category.name if detalle.producto.category else None,
                'cantidad_solicitada': detalle.cantidad_solicitada,
                'unidad_medida': detalle.unidad_medida
            })
        
        return Response({
            'requirement_id': envio.requerimiento.id,
            'requirement_number': envio.requerimiento.numero_requerimiento,
            'supplier': envio.proveedor.company_name,
            'products': products,
            'total_products': len(products)
        })


    @action(detail=False, methods=['get'])
    def product_codes(self, request):
        """Obtener todos los códigos de productos activos para validación"""
        from apps.ecommerce.products.models import Product
        
        # Filtrar solo productos activos
        products = Product.objects.filter(is_active=True).values('id', 'code', 'name')
        
        return Response({
            'codes': [p['code'] for p in products],
            'products': list(products),
            'total': len(products)
        })
    @action(detail=False, methods=['post'])
    def envio_masivo(self, request):
        serializer = EnvioMasivoSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        requirement_id = serializer.validated_data['requirement_id']
        supplier_ids = serializer.validated_data['supplier_ids']
        fecha_respuesta_esperada = serializer.validated_data.get('fecha_respuesta_esperada')
        notas = serializer.validated_data.get('notas_envio', '')
        
        try:
            requirement = Requirement.objects.get(id=requirement_id)
            
            if requirement.estado == 'aprobado':
                requirement.estado = 'en_proceso_cotizacion'
                requirement.save()
            
            result = CotizacionManager.create_envios_masivos(
                requirement=requirement,
                supplier_ids=supplier_ids,
                user=request.user,
                fecha_respuesta_esperada=fecha_respuesta_esperada,
                notas=notas
            )
            
            # Notificar envíos exitosos
            for envio_info in result.get('enviados', []):
                if envio_info.get('status') == 'sent':
                    # Buscar el envío creado para notificar
                    supplier = Supplier.objects.get(company_name=envio_info['supplier'])
                    envio = EnvioCotizacion.objects.get(requerimiento=requirement, proveedor=supplier)
                    CotizacionNotificationService.notify_cotizacion_sent(envio, request.user)
            
            return Response({
                'message': f'Proceso completado. {result["total_enviados"]} enviados, {result["total_errores"]} errores',
                'result': result
            })
            
        except Exception as e:
            return Response(
                {"error": f"Error en envío masivo: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def confirmar_envio_manual(self, request, pk=None):
        """Confirmar que se envió manualmente por teléfono/WhatsApp"""
        serializer = ConfirmarEnvioManualSerializer(data={
            'envio_id': pk,
            **request.data
        })
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        success, message = CotizacionManager.confirmar_envio_manual(
            envio_id=pk,
            metodo_envio=serializer.validated_data['metodo_envio'],
            user=request.user,
            notas=serializer.validated_data.get('notas')
        )
        
        if success:
            return Response({"message": message})
        else:
            return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def reenviar_email(self, request, pk=None):
        """Reenviar cotización por email"""
        envio = get_object_or_404(EnvioCotizacion, pk=pk)
        
        if not envio.proveedor.email:
            return Response(
                {"error": "El proveedor no tiene email configurado"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        success = CotizacionManager.send_email_cotizacion(envio)
        
        if success:
            envio.estado = 'enviado'
            envio.notas_envio = 'Email reenviado exitosamente'
            envio.fecha_envio = timezone.now()
            envio.enviado_por = request.user
            envio.email_enviado = True
            envio.fecha_email_enviado = timezone.now()
            envio.save()
            
            return Response({"message": "Email reenviado exitosamente"})
        else:
            return Response(
                {"error": "Error al reenviar email"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def generate_excel(self, request, pk=None):
        """Generar Excel para un envío específico"""
        envio = get_object_or_404(EnvioCotizacion, pk=pk)
        
        generator = RequirementExcelGenerator(envio.requerimiento)
        excel_buffer = generator.create_excel()
        
        filename = f"Cotizacion_{envio.numero_envio}_{date.today().strftime('%Y%m%d')}.xlsx"
        
        response = HttpResponse(
            excel_buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
    
    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """Obtener analíticas de cotizaciones"""
        requirement_id = request.query_params.get('requirement_id')
        analytics = CotizacionManager.get_cotizacion_analytics(requirement_id)
        return Response(analytics)
    
    @action(detail=False, methods=['get'])
    def by_requirement(self, request):
        """Obtener envíos por requerimiento"""
        requirement_id = request.query_params.get('requirement_id')
        if not requirement_id:
            return Response(
                {"error": "requirement_id es requerido"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        envios = self.get_queryset().filter(requerimiento_id=requirement_id)
        serializer = EnvioCotizacionListSerializer(envios, many=True)
        return Response({"data": serializer.data})
    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        """Obtener detalles completos del envío de cotización"""
        envio = get_object_or_404(EnvioCotizacion, pk=pk)
        
        # Serializar envío con información completa
        envio_data = EnvioCotizacionSerializer(envio).data
        
        # Agregar información del requerimiento con productos
        requirement_data = {
            'id': envio.requerimiento.id,
            'numero_requerimiento': envio.requerimiento.numero_requerimiento,
            'fecha_requerimiento': envio.requerimiento.fecha_requerimiento,
            'prioridad': envio.requerimiento.prioridad,
            'prioridad_display': envio.requerimiento.prioridad_display,
            'estado': envio.requerimiento.estado,
            'estado_display': envio.requerimiento.estado_display,
            'usuario_solicitante': envio.requerimiento.usuario_solicitante.username,
            'notas': envio.requerimiento.notas,
            'total_productos': envio.requerimiento.total_productos,
            'cantidad_total': envio.requerimiento.cantidad_total,
            'detalles': []
        }
        
        # Agregar detalles de productos
        for detalle in envio.requerimiento.detalles.all():
            requirement_data['detalles'].append({
                'id': detalle.id,
                'producto': {
                    'id': detalle.producto.id,
                    'code': detalle.producto.code,
                    'name': detalle.producto.name,
                    'category': detalle.producto.category.name if detalle.producto.category else None,
                    'image': detalle.producto.image.url if detalle.producto.image else None,
                    'stock_current': detalle.producto.stock_current,
                    'price': float(detalle.producto.price) if detalle.producto.price else None
                },
                'cantidad_solicitada': detalle.cantidad_solicitada,
                'unidad_medida': detalle.unidad_medida,
                'observaciones': detalle.observaciones
            })
        
        # Agregar respuesta si existe
        respuesta_data = None
        if hasattr(envio, 'respuesta') and envio.respuesta:
            respuesta = envio.respuesta
            respuesta_data = {
                'id': respuesta.id,
                'fecha_respuesta': respuesta.fecha_respuesta,
                'terminos_pago': respuesta.terminos_pago,
                'tiempo_entrega': respuesta.tiempo_entrega,
                'validez_cotizacion': respuesta.validez_cotizacion,
                'incluye_igv': respuesta.incluye_igv,
                'observaciones': respuesta.observaciones,
                'procesado_automaticamente': respuesta.procesado_automaticamente,
                'total_cotizado': float(respuesta.total_cotizado),
                'total_productos': respuesta.total_productos,
                'detalles': []
            }
            
            # Agregar detalles de la respuesta
            for detalle in respuesta.detalles.all():
                respuesta_data['detalles'].append({
                    'id': detalle.id,
                    'producto_code': detalle.producto_code,
                    'producto_name': detalle.producto.name if detalle.producto else detalle.nombre_producto_proveedor,
                    'precio_unitario': float(detalle.precio_unitario),
                    'cantidad_cotizada': detalle.cantidad_cotizada,
                    'cantidad_disponible': detalle.cantidad_disponible,
                    'subtotal': float(detalle.subtotal),
                    'tiempo_entrega_especifico': detalle.tiempo_entrega_especifico,
                    'observaciones': detalle.observaciones,
                    'nombre_producto_proveedor': detalle.nombre_producto_proveedor,
                    'marca': detalle.marca,
                    'modelo': detalle.modelo
                })
        
        return Response({
            'envio': envio_data,
            'requerimiento': requirement_data,
            'respuesta': respuesta_data,
            'archivos': {
                'tiene_respuesta_cliente': bool(envio.archivo_respuesta_cliente),
                'respuesta_procesada': envio.respuesta_procesada,
                'fecha_procesamiento': envio.fecha_procesamiento
            }
        })

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_response(self, request, pk=None):
        """Subir archivo de respuesta del cliente"""
        logger.debug(f"Inicio upload_response para envio_id={pk}")
        
        envio = get_object_or_404(EnvioCotizacion, pk=pk)
        
        if 'archivo' not in request.FILES:
            return Response(
                {"error": "No se proporcionó archivo"},
                status=status.HTTP_400_BAD_REQUEST
            )

        archivo = request.FILES['archivo']

        if not archivo.name.lower().endswith(('.xlsx', '.xls')):
            return Response(
                {"error": "Solo se permiten archivos Excel (.xlsx, .xls)"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from .services import CotizacionResponseProcessor
            from django.core.files.base import ContentFile
            
            # Leer archivo en memoria una sola vez
            archivo.seek(0)
            archivo_content = archivo.read()
            archivo.seek(0)  # Reset para validación
            
            # Validar archivo
            processor = CotizacionResponseProcessor(envio)
            validation_result = processor._validate_excel_from_file(archivo)
            
            if not validation_result['valid']:
                return Response({
                    "message": "El archivo Excel no es válido",
                    "validation_errors": validation_result['errors'],
                    "warnings": validation_result['warnings']
                }, status=status.HTTP_400_BAD_REQUEST)

            logger.debug("Validación exitosa. Eliminando respuesta anterior si existe...")
            
            # Eliminar respuesta anterior si existe
            from .models import RespuestaCotizacion
            existing_response = RespuestaCotizacion.objects.filter(envio=envio).first()
            if existing_response:
                existing_response.delete()
                logger.debug("Respuesta anterior eliminada")
            
            # Crear nuevo archivo desde el contenido en memoria
            nuevo_archivo = ContentFile(archivo_content, name=archivo.name)
            
            # Guardar archivo en el modelo con procesamiento automático deshabilitado
            envio.archivo_respuesta_cliente = nuevo_archivo
            envio.respuesta_procesada = False
            
            # Guardar sin activar procesamiento automático
            envio._skip_auto_processing = True
            envio.save()
            delattr(envio, '_skip_auto_processing')
            
            # Procesar manualmente con el contenido en memoria
            archivo_memory = ContentFile(archivo_content, name=archivo.name)
            result = processor.process_excel_from_memory(archivo_memory)
            
            if result['success']:
                envio.respuesta_procesada = True
                envio.fecha_procesamiento = timezone.now()
                envio._skip_auto_processing = True
                envio.save()
                delattr(envio, '_skip_auto_processing')
                
                # Notificar respuesta recibida
                CotizacionNotificationService.notify_cotizacion_received(envio)
                
                # Verificar si hay suficientes respuestas para comparar
                CotizacionNotificationService.notify_cotizacion_comparison_ready(envio.requerimiento)
                
                return Response({
                    "message": "Archivo subido y procesado exitosamente",
                    "estado": envio.estado,
                    "respuesta_id": result.get('respuesta_id')
                })
            else:
                # Notificar errores de procesamiento
                CotizacionNotificationService.notify_processing_errors(
                    envio, result.get('details', [])
                )
                return Response({
                    "message": f"Error procesando archivo: {result.get('error')}",
                    "details": result.get('details', [])
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.exception("Error procesando archivo")
            return Response({
                "message": f"Error procesando archivo: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
              
    @action(detail=True, methods=['post'])
    def reprocess_response(self, request, pk=None):
        """Reprocesar archivo de respuesta"""
        envio = get_object_or_404(EnvioCotizacion, pk=pk)
        
        if not envio.archivo_respuesta_cliente:
            return Response(
                {"error": "No hay archivo para reprocesar"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Eliminar respuesta anterior si existe
            if hasattr(envio, 'respuesta') and envio.respuesta:
                envio.respuesta.delete()
            
            # Reprocesar
            envio.respuesta_procesada = False
            success = envio.procesar_respuesta_automatica()
            envio.save()
            
            if success:
                return Response({
                    "message": "Archivo reprocesado exitosamente",
                    "respuesta_id": envio.respuesta.id if hasattr(envio, 'respuesta') else None
                })
            else:
                return Response(
                    {"error": "Error en el reprocesamiento"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except Exception as e:
            return Response(
                {"error": f"Error reprocesando: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RespuestaCotizacionViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de respuestas de cotización"""
    queryset = RespuestaCotizacion.objects.all().select_related('envio__proveedor')
    serializer_class = RespuestaCotizacionSerializer
    
    @action(detail=False, methods=['get'])
    def by_requirement(self, request):
        """Obtener respuestas por requerimiento"""
        requirement_id = request.query_params.get('requirement_id')
        if not requirement_id:
            return Response(
                {"error": "requirement_id es requerido"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        respuestas = self.get_queryset().filter(
            envio__requerimiento_id=requirement_id
        )
        serializer = self.get_serializer(respuestas, many=True)
        return Response({"data": serializer.data})
    
    @action(detail=False, methods=['get'])
    def comparar_cotizaciones(self, request):
        """Comparar cotizaciones de un requerimiento con datos detallados"""
        requirement_id = request.query_params.get('requirement_id')
        if not requirement_id:
            return Response(
                {"error": "requirement_id es requerido"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            requirement = Requirement.objects.get(id=requirement_id)
        except Requirement.DoesNotExist:
            return Response(
                {"error": "Requerimiento no encontrado"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Obtener respuestas de cotización
        respuestas = self.get_queryset().filter(
            envio__requerimiento_id=requirement_id
        ).prefetch_related('detalles__producto', 'envio__proveedor').order_by('-fecha_respuesta')
        
        # Estructurar datos para comparación
        comparison_data = []
        for respuesta in respuestas:
            proveedor_data = {
                'proveedor': respuesta.envio.proveedor.company_name,
                'proveedor_id': respuesta.envio.proveedor.id,
                'envio_id': respuesta.envio.id,
                'respuesta_id': respuesta.id,
                'total_cotizado': float(respuesta.total_cotizado),
                'terminos_pago': respuesta.terminos_pago,
                'tiempo_entrega': respuesta.tiempo_entrega,
                'validez_cotizacion': respuesta.validez_cotizacion,
                'incluye_igv': respuesta.incluye_igv,
                'observaciones': respuesta.observaciones,
                'fecha_respuesta': respuesta.fecha_respuesta,
                'procesado_automaticamente': respuesta.procesado_automaticamente,
                'calificacion_proveedor': respuesta.envio.proveedor.rating,
                'productos': []
            }
            
            # Agregar productos cotizados
            for detalle in respuesta.detalles.all():
                proveedor_data['productos'].append({
                    'codigo': detalle.producto_code,
                    'nombre': detalle.producto.name if detalle.producto else detalle.nombre_producto_proveedor,
                    'precio_unitario': float(detalle.precio_unitario),
                    'cantidad': detalle.cantidad_cotizada,
                    'cantidad_disponible': detalle.cantidad_disponible,
                    'subtotal': float(detalle.subtotal),
                    'tiempo_entrega_especifico': detalle.tiempo_entrega_especifico,
                    'marca': detalle.marca,
                    'modelo': detalle.modelo,
                    'observaciones': detalle.observaciones
                })
            
            comparison_data.append(proveedor_data)
        
        # Obtener productos del requerimiento para análisis completo
        productos_requerimiento = []
        for detalle_req in requirement.detalles.all():
            productos_requerimiento.append({
                'codigo': detalle_req.producto.code,
                'nombre': detalle_req.producto.name,
                'cantidad_solicitada': detalle_req.cantidad_solicitada,
                'unidad_medida': detalle_req.unidad_medida,
                'observaciones': detalle_req.observaciones
            })
        
        # Análisis estadístico
        if comparison_data:
            precios_totales = [c['total_cotizado'] for c in comparison_data]
            estadisticas = {
                'total_respuestas': len(comparison_data),
                'precio_menor': min(precios_totales),
                'precio_mayor': max(precios_totales),
                'precio_promedio': sum(precios_totales) / len(precios_totales),
                'ahorro_potencial': max(precios_totales) - min(precios_totales),
                'mejor_proveedor': min(comparison_data, key=lambda x: x['total_cotizado'])['proveedor'],
                'cobertura_promedio': sum(len(c['productos']) for c in comparison_data) / len(comparison_data) / len(productos_requerimiento) * 100 if productos_requerimiento else 0
            }
        else:
            estadisticas = {
                'total_respuestas': 0,
                'precio_menor': 0,
                'precio_mayor': 0,
                'precio_promedio': 0,
                'ahorro_potencial': 0,
                'mejor_proveedor': None,
                'cobertura_promedio': 0
            }
        
        return Response({
            "requirement_id": requirement_id,
            "requirement": {
                "numero_requerimiento": requirement.numero_requerimiento,
                "fecha_requerimiento": requirement.fecha_requerimiento,
                "prioridad": requirement.prioridad_display,
                "estado": requirement.estado_display,
                "total_productos": requirement.total_productos,
                "cantidad_total": requirement.cantidad_total
            },
            "productos_requerimiento": productos_requerimiento,
            "cotizaciones": comparison_data,
            "estadisticas": estadisticas
        })

class ImportCotizacionResponseView(APIView):
    """Vista para importar respuestas de cotización desde Excel"""
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    
    def post(self, request):
        envio_id = request.data.get('envio_id')
        excel_file = request.FILES.get('excel_file')
        
        if not envio_id or not excel_file:
            return Response(
                {"error": "envio_id y excel_file son requeridos"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            envio = EnvioCotizacion.objects.get(id=envio_id)
        except EnvioCotizacion.DoesNotExist:
            return Response(
                {"error": "Envío no encontrado"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            with transaction.atomic():
                result = self._process_excel_response(envio, excel_file)
                
                if result['success']:
                    # Actualizar estado del envío
                    envio.estado = 'respondido'
                    envio.archivo_respuesta = excel_file
                    envio.save()
                    
                    return Response({
                        'message': 'Respuesta importada exitosamente',
                        'details': result
                    })
                else:
                    return Response(
                        {"error": result['error']},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                    
        except Exception as e:
            return Response(
                {"error": f"Error procesando archivo: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _process_excel_response(self, envio, excel_file):
        """Procesar archivo Excel de respuesta"""
        import pandas as pd
        from apps.ecommerce.products.models import Product
        
        try:
            # Leer Excel
            df = pd.read_excel(excel_file, engine='openpyxl')
            
            # Buscar información general (términos, etc.)
            terminos_pago = ""
            tiempo_entrega = ""
            observaciones = ""
            
            # Buscar estas filas en el Excel
            for index, row in df.iterrows():
                if pd.notna(row.iloc[0]):
                    cell_value = str(row.iloc[0]).lower()
                    if 'términos de pago' in cell_value and pd.notna(row.iloc[1]):
                        terminos_pago = str(row.iloc[1])
                    elif 'tiempo de entrega' in cell_value and pd.notna(row.iloc[1]):
                        tiempo_entrega = str(row.iloc[1])
                    elif 'observaciones generales' in cell_value and pd.notna(row.iloc[1]):
                        observaciones = str(row.iloc[1])
            
            # Crear respuesta
            respuesta = RespuestaCotizacion.objects.create(
                envio=envio,
                terminos_pago=terminos_pago,
                tiempo_entrega=tiempo_entrega,
                observaciones=observaciones
            )
            
            # Procesar detalles de productos
            productos_procesados = 0
            errores = []
            
            # Buscar la tabla de productos (normalmente empieza después de las filas de información)
            start_row = None
            for index, row in df.iterrows():
                if pd.notna(row.iloc[0]) and 'código' in str(row.iloc[0]).lower():
                    start_row = index + 1
                    break
            
            if start_row is None:
                return {'success': False, 'error': 'No se encontró la tabla de productos en el Excel'}
            
            # Procesar productos desde start_row
            for index in range(start_row, len(df)):
                row = df.iloc[index]
                
                try:
                    codigo = row.iloc[0] if pd.notna(row.iloc[0]) else None
                    precio = row.iloc[4] if pd.notna(row.iloc[4]) else None  # Columna E (PRECIO UNITARIO)
                    
                    if not codigo or not precio:
                        continue
                    
                    # Buscar producto
                    try:
                        producto = Product.objects.get(code=str(codigo).strip())
                    except Product.DoesNotExist:
                        errores.append(f"Producto con código {codigo} no encontrado")
                        continue
                    
                    # Crear detalle
                    DetalleRespuestaCotizacion.objects.create(
                        respuesta=respuesta,
                        producto_code=str(codigo).strip(),
                        producto=producto,
                        precio_unitario=float(precio),
                        cantidad_cotizada=int(row.iloc[2]) if pd.notna(row.iloc[2]) else 1,  # Columna C
                        tiempo_entrega_especifico=str(row.iloc[6]) if pd.notna(row.iloc[6]) else '',  # Columna G
                        observaciones=str(row.iloc[7]) if pd.notna(row.iloc[7]) else ''  # Columna H
                    )
                    
                    productos_procesados += 1
                    
                except Exception as e:
                    errores.append(f"Error en fila {index + 1}: {str(e)}")
            
            return {
                'success': True,
                'productos_procesados': productos_procesados,
                'errores': errores
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Error leyendo Excel: {str(e)}"
            }


# Vistas de plantillas
class CotizacionTemplateView(TemplateView):
    """Vista base para plantillas de cotización"""
    
    def get_context_data(self, **kwargs):
        context = TemplateLayout.init(self, super().get_context_data(**kwargs))
        return context


class CotizacionListView(CotizacionTemplateView):
    """Vista para lista de cotizaciones"""
    template_name = "app_cotizacion_list.html"


class CotizacionCreateView(CotizacionTemplateView):
    """Vista para crear cotización desde requerimiento"""
    template_name = "app_cotizacion_create.html"
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        requirement_id = kwargs.get('requirement_id')
        
        if requirement_id:
            try:
                requirement = Requirement.objects.get(id=requirement_id)
                context['requirement'] = requirement
            except Requirement.DoesNotExist:
                context['error'] = 'Requerimiento no encontrado'
        
        return context


class CotizacionDetailsView(CotizacionTemplateView):
    """Vista para detalles de cotización"""
    template_name = "app_cotizacion_details.html"
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        envio_id = kwargs.get('envio_id')
        
        if envio_id:
            try:
                envio = EnvioCotizacion.objects.select_related(
                    'requerimiento', 'proveedor'
                ).get(id=envio_id)
                context['envio'] = envio
            except EnvioCotizacion.DoesNotExist:
                context['error'] = 'Envío no encontrado'
        
        return context


class CotizacionCompareView(CotizacionTemplateView):
    """Vista para comparar cotizaciones"""
    template_name = "app_cotizacion_compare.html"
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        requirement_id = kwargs.get('requirement_id')
        
        if requirement_id:
            try:
                requirement = Requirement.objects.get(id=requirement_id)
                context['requirement'] = requirement
                
                # Obtener envíos con respuestas
                envios_con_respuestas = EnvioCotizacion.objects.filter(
                    requerimiento=requirement,
                    estado='respondido'
                ).select_related('proveedor').prefetch_related('respuesta__detalles')
                
                context['envios_con_respuestas'] = envios_con_respuestas
                
            except Requirement.DoesNotExist:
                context['error'] = 'Requerimiento no encontrado'
        
        return context
    
    
