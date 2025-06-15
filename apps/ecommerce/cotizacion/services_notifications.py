# apps/ecommerce/cotizacion/services_notifications.py
from apps.notification.services import notification_service
from apps.notification.models import TipoNotificacion
from auth.models import Role
from datetime import date, timedelta

class CotizacionNotificationService:
    """Servicio para notificaciones de cotizaciones"""
    
    @staticmethod
    def notify_cotizacion_sent(envio, sent_by):
        """Notificar cuando se envía una cotización"""
        mensaje = f"Cotización enviada a {envio.proveedor.company_name} para requerimiento {envio.requerimiento.numero_requerimiento}"
        
        # Notificar al solicitante del requerimiento
        notification_service.enviar_notificacion_usuario(
            usuario=envio.requerimiento.usuario_solicitante,
            mensaje=mensaje,
            titulo="Cotización Enviada",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-send-plane-line',
            color='info',
            url_accion=f'/app/cotizacion/details/{envio.id}/',
            datos_adicionales={
                'envio_id': envio.id,
                'requerimiento_id': envio.requerimiento.id,
                'proveedor': envio.proveedor.company_name,
                'metodo_envio': envio.metodo_envio
            }
        )
        
        # Notificar a gestores
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.PLANIFICADOR_COMPRAS],
            mensaje=mensaje,
            titulo="Cotización Enviada",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-send-plane-line',
            color='info',
            url_accion=f'/app/cotizacion/details/{envio.id}/',
            datos_adicionales={
                'envio_id': envio.id,
                'requerimiento_numero': envio.requerimiento.numero_requerimiento,
                'proveedor': envio.proveedor.company_name
            },
            enviado_por=sent_by
        )
    
    @staticmethod
    def notify_cotizacion_received(envio):
        """Notificar cuando se recibe una respuesta de cotización"""
        mensaje = f"Respuesta de cotización recibida de {envio.proveedor.company_name} para {envio.requerimiento.numero_requerimiento}"
        
        # Notificar al solicitante
        notification_service.enviar_notificacion_usuario(
            usuario=envio.requerimiento.usuario_solicitante,
            mensaje=mensaje,
            titulo="Respuesta de Cotización Recibida",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-mail-check-line',
            color='success',
            url_accion=f'/app/cotizacion/details/{envio.id}/',
            datos_adicionales={
                'envio_id': envio.id,
                'requerimiento_id': envio.requerimiento.id,
                'proveedor': envio.proveedor.company_name,
                'tiene_respuesta': True
            }
        )
        
        # Notificar a gestores
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.PLANIFICADOR_COMPRAS],
            mensaje=mensaje,
            titulo="Respuesta de Cotización Recibida",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-mail-check-line',
            color='success',
            url_accion=f'/app/cotizacion/compare/{envio.requerimiento.id}/',
            datos_adicionales={
                'envio_id': envio.id,
                'requerimiento_numero': envio.requerimiento.numero_requerimiento,
                'proveedor': envio.proveedor.company_name,
                'puede_comparar': True
            }
        )
    
    @staticmethod
    def notify_cotizacion_deadline_approaching(envio):
        """Notificar cuando se acerca la fecha límite de respuesta"""
        dias_restantes = (envio.fecha_respuesta_esperada - date.today()).days
        
        if dias_restantes <= 1:  # Último día o vencida
            mensaje = f"URGENTE: Cotización de {envio.proveedor.company_name} vence {'hoy' if dias_restantes == 0 else 'mañana'}"
            color = 'danger'
            icono = 'ri-alarm-warning-line'
        else:  # 2-3 días restantes
            mensaje = f"Cotización de {envio.proveedor.company_name} vence en {dias_restantes} días"
            color = 'warning'
            icono = 'ri-time-line'
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.PLANIFICADOR_COMPRAS],
            mensaje=mensaje,
            titulo="Fecha Límite de Cotización",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono=icono,
            color=color,
            url_accion=f'/app/cotizacion/details/{envio.id}/',
            datos_adicionales={
                'envio_id': envio.id,
                'requerimiento_numero': envio.requerimiento.numero_requerimiento,
                'proveedor': envio.proveedor.company_name,
                'dias_restantes': dias_restantes,
                'fecha_limite': envio.fecha_respuesta_esperada.isoformat()
            }
        )
    
    @staticmethod
    def notify_cotizacion_overdue(envio):
        """Notificar cotización vencida"""
        dias_vencida = (date.today() - envio.fecha_respuesta_esperada).days
        mensaje = f"Cotización de {envio.proveedor.company_name} vencida hace {dias_vencida} día{'s' if dias_vencida > 1 else ''}"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.PLANIFICADOR_COMPRAS],
            mensaje=mensaje,
            titulo="Cotización Vencida",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-error-warning-line',
            color='danger',
            url_accion=f'/app/cotizacion/details/{envio.id}/',
            datos_adicionales={
                'envio_id': envio.id,
                'requerimiento_numero': envio.requerimiento.numero_requerimiento,
                'proveedor': envio.proveedor.company_name,
                'dias_vencida': dias_vencida,
                'necesita_seguimiento': True
            }
        )
    
    @staticmethod
    def notify_cotizacion_processed_automatically(envio, processed_items):
        """Notificar procesamiento automático de respuesta"""
        mensaje = f"Respuesta de {envio.proveedor.company_name} procesada automáticamente. {processed_items} productos procesados"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.PLANIFICADOR_COMPRAS],
            mensaje=mensaje,
            titulo="Respuesta Procesada Automáticamente",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-robot-line',
            color='info',
            url_accion=f'/app/cotizacion/details/{envio.id}/',
            datos_adicionales={
                'envio_id': envio.id,
                'requerimiento_numero': envio.requerimiento.numero_requerimiento,
                'proveedor': envio.proveedor.company_name,
                'productos_procesados': processed_items,
                'procesamiento_automatico': True
            }
        )
    
    @staticmethod
    def notify_supplier_selected(envio, selected_by, reason=None):
        """Notificar cuando se selecciona un proveedor ganador"""
        mensaje = f"Proveedor {envio.proveedor.company_name} seleccionado para {envio.requerimiento.numero_requerimiento}"
        
        datos_adicionales = {
            'envio_id': envio.id,
            'requerimiento_numero': envio.requerimiento.numero_requerimiento,
            'proveedor_ganador': envio.proveedor.company_name,
            'seleccionado_por': selected_by.username
        }
        
        if reason:
            datos_adicionales['motivo_seleccion'] = reason
        
        # Notificar al solicitante
        notification_service.enviar_notificacion_usuario(
            usuario=envio.requerimiento.usuario_solicitante,
            mensaje=mensaje,
            titulo="Proveedor Seleccionado",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-check-double-line',
            color='success',
            url_accion=f'/app/requirements/details/{envio.requerimiento.id}/',
            datos_adicionales=datos_adicionales
        )
        
        # Notificar a gestores
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Proveedor Seleccionado",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-check-double-line',
            color='success',
            url_accion=f'/app/cotizacion/details/{envio.id}/',
            datos_adicionales=datos_adicionales,
            enviado_por=selected_by
        )
    
    @staticmethod
    def notify_cotizacion_comparison_ready(requirement):
        """Notificar cuando hay suficientes cotizaciones para comparar"""
        from .models import EnvioCotizacion
        
        respuestas_count = EnvioCotizacion.objects.filter(
            requerimiento=requirement,
            estado='respondido'
        ).count()
        
        if respuestas_count < 2:
            return
        
        mensaje = f"Requerimiento {requirement.numero_requerimiento} tiene {respuestas_count} cotizaciones listas para comparar"
        
        # Notificar al solicitante
        notification_service.enviar_notificacion_usuario(
            usuario=requirement.usuario_solicitante,
            mensaje=mensaje,
            titulo="Cotizaciones Listas para Comparar",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-scales-line',
            color='primary',
            url_accion=f'/app/cotizacion/compare/{requirement.id}/',
            datos_adicionales={
                'requerimiento_id': requirement.id,
                'numero_requerimiento': requirement.numero_requerimiento,
                'total_respuestas': respuestas_count,
                'puede_comparar': True
            }
        )
        
        # Notificar a gestores
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.PLANIFICADOR_COMPRAS],
            mensaje=mensaje,
            titulo="Cotizaciones Listas para Comparar",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-scales-line',
            color='primary',
            url_accion=f'/app/cotizacion/compare/{requirement.id}/',
            datos_adicionales={
                'requerimiento_numero': requirement.numero_requerimiento,
                'total_respuestas': respuestas_count,
                'puede_decidir': True
            }
        )
    
    @staticmethod
    def notify_processing_errors(envio, errors):
        """Notificar errores en procesamiento de archivos"""
        mensaje = f"Errores al procesar respuesta de {envio.proveedor.company_name}: {len(errors)} errores encontrados"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.PLANIFICADOR_COMPRAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Errores en Procesamiento",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-error-warning-line',
            color='warning',
            url_accion=f'/app/cotizacion/details/{envio.id}/',
            datos_adicionales={
                'envio_id': envio.id,
                'proveedor': envio.proveedor.company_name,
                'errores': errors[:5],  # Solo primeros 5 errores
                'total_errores': len(errors),
                'necesita_revision': True
            }
        )