# apps/ecommerce/requirements/services_notifications.py
from apps.notification.services import notification_service
from apps.notification.models import TipoNotificacion
from auth.models import Role

class RequirementNotificationService:
    """Servicio para notificaciones de requerimientos"""
    
    @staticmethod
    def notify_requirement_created(requirement):
        """Notificar cuando se crea un nuevo requerimiento"""
        usuario = requirement.usuario_solicitante
        mensaje = f"Nuevo requerimiento {requirement.numero_requerimiento} creado por {usuario.get_full_name() or usuario.username}"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.PLANIFICADOR_COMPRAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Nuevo Requerimiento",
            tipo=TipoNotificacion.APROBACION_PENDIENTE,
            icono='ri-file-add-line',
            color='info',
            url_accion=f'/app/requirements/details/{requirement.id}/',
            datos_adicionales={
                'requerimiento_id': requirement.id,
                'numero_requerimiento': requirement.numero_requerimiento,
                'prioridad': requirement.prioridad,
                'total_productos': requirement.total_productos,
                'solicitante': usuario.username
            },
            enviado_por=usuario
        )
    
    @staticmethod
    def notify_requirement_approved(requirement, approved_by):
        """Notificar cuando se aprueba un requerimiento"""
        mensaje = f"Requerimiento {requirement.numero_requerimiento} aprobado por {approved_by.get_full_name() or approved_by.username}"
        
        # Notificar al solicitante
        notification_service.enviar_notificacion_usuario(
            usuario=requirement.usuario_solicitante,
            mensaje=mensaje,
            titulo="Requerimiento Aprobado",
            tipo=TipoNotificacion.APROBACION_PENDIENTE,
            icono='ri-check-line',
            color='success',
            url_accion=f'/app/requirements/details/{requirement.id}/',
            datos_adicionales={
                'requerimiento_id': requirement.id,
                'numero_requerimiento': requirement.numero_requerimiento,
                'aprobado_por': approved_by.username
            }
        )
        
        # Notificar a planificadores para iniciar cotización
        return notification_service.enviar_notificacion_roles(
            roles=[Role.PLANIFICADOR_COMPRAS, Role.GERENTE_COMPRAS],
            mensaje=f"Requerimiento {requirement.numero_requerimiento} listo para cotización",
            titulo="Requerimiento Listo para Cotización",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-shopping-cart-line',
            color='primary',
            url_accion=f'/app/cotizacion/create/{requirement.id}/',
            datos_adicionales={
                'requerimiento_id': requirement.id,
                'numero_requerimiento': requirement.numero_requerimiento,
                'puede_cotizar': True
            },
            enviado_por=approved_by
        )
    
    @staticmethod
    def notify_requirement_rejected(requirement, rejected_by, reason=None):
        """Notificar cuando se rechaza un requerimiento"""
        mensaje = f"Requerimiento {requirement.numero_requerimiento} rechazado"
        if reason:
            mensaje += f": {reason}"
        
        datos_adicionales = {
            'requerimiento_id': requirement.id,
            'numero_requerimiento': requirement.numero_requerimiento,
            'rechazado_por': rejected_by.username
        }
        
        if reason:
            datos_adicionales['motivo'] = reason
        
        return notification_service.enviar_notificacion_usuario(
            usuario=requirement.usuario_solicitante,
            mensaje=mensaje,
            titulo="Requerimiento Rechazado",
            tipo=TipoNotificacion.APROBACION_PENDIENTE,
            icono='ri-close-line',
            color='danger',
            url_accion=f'/app/requirements/edit/{requirement.id}/',
            datos_adicionales=datos_adicionales
        )
    
    @staticmethod
    def notify_requirement_status_changed(requirement, user, old_status, new_status):
        """Notificar cambio de estado de requerimiento"""
        status_display = {
            'pendiente': 'Pendiente',
            'aprobado': 'Aprobado',
            'rechazado': 'Rechazado',
            'en_proceso_cotizacion': 'En Proceso de Cotización',
            'cotizado': 'Cotizado',
            'orden_generada': 'Orden Generada',
            'completado': 'Completado',
            'cancelado': 'Cancelado'
        }
        
        mensaje = f"Requerimiento {requirement.numero_requerimiento} cambió de {status_display.get(old_status, old_status)} a {status_display.get(new_status, new_status)}"
        
        color_map = {
            'aprobado': 'success',
            'rechazado': 'danger',
            'completado': 'success',
            'cancelado': 'secondary',
            'en_proceso_cotizacion': 'info',
            'cotizado': 'primary'
        }
        
        # Notificar al solicitante
        notification_service.enviar_notificacion_usuario(
            usuario=requirement.usuario_solicitante,
            mensaje=mensaje,
            titulo="Estado de Requerimiento Actualizado",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-refresh-line',
            color=color_map.get(new_status, 'info'),
            url_accion=f'/app/requirements/details/{requirement.id}/',
            datos_adicionales={
                'requerimiento_id': requirement.id,
                'numero_requerimiento': requirement.numero_requerimiento,
                'estado_anterior': old_status,
                'estado_nuevo': new_status,
                'actualizado_por': user.username
            }
        )
        
        # Notificar a gestores según el nuevo estado
        if new_status in ['cotizado', 'orden_generada']:
            return notification_service.enviar_notificacion_roles(
                roles=[Role.GERENTE_COMPRAS, Role.ADMINISTRADOR_SISTEMA],
                mensaje=mensaje,
                titulo="Estado de Requerimiento Actualizado",
                tipo=TipoNotificacion.ESTADO_PEDIDO,
                icono='ri-refresh-line',
                color=color_map.get(new_status, 'info'),
                url_accion=f'/app/requirements/details/{requirement.id}/',
                datos_adicionales={
                    'requerimiento_id': requirement.id,
                    'numero_requerimiento': requirement.numero_requerimiento,
                    'estado_nuevo': new_status
                },
                enviado_por=user
            )
    
    @staticmethod
    def notify_requirement_updated(requirement, user, changes=None):
        """Notificar cuando se actualiza un requerimiento"""
        mensaje = f"Requerimiento {requirement.numero_requerimiento} actualizado por {user.get_full_name() or user.username}"
        
        datos_adicionales = {
            'requerimiento_id': requirement.id,
            'numero_requerimiento': requirement.numero_requerimiento,
            'actualizado_por': user.username
        }
        
        if changes:
            datos_adicionales['cambios'] = changes
        
        # Notificar a gestores
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.PLANIFICADOR_COMPRAS],
            mensaje=mensaje,
            titulo="Requerimiento Actualizado",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-edit-line',
            color='info',
            url_accion=f'/app/requirements/details/{requirement.id}/',
            datos_adicionales=datos_adicionales,
            enviado_por=user
        )
    
    @staticmethod
    def notify_requirement_urgent(requirement):
        """Notificar requerimiento urgente"""
        if requirement.prioridad != 'alta':
            return
        
        mensaje = f"Requerimiento URGENTE {requirement.numero_requerimiento} requiere atención inmediata"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.PLANIFICADOR_COMPRAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Requerimiento Urgente",
            tipo=TipoNotificacion.APROBACION_PENDIENTE,
            icono='ri-alarm-warning-line',
            color='danger',
            url_accion=f'/app/requirements/details/{requirement.id}/',
            datos_adicionales={
                'requerimiento_id': requirement.id,
                'numero_requerimiento': requirement.numero_requerimiento,
                'prioridad': 'alta',
                'fecha_limite': requirement.fecha_requerimiento.isoformat() if requirement.fecha_requerimiento else None
            }
        )