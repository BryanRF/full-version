# apps/ecommerce/customers/services_notifications.py
from apps.notification.services import notification_service
from apps.notification.models import TipoNotificacion
from auth.models import Role

class CustomerNotificationService:
    """Servicio para notificaciones de clientes"""
    
    @staticmethod
    def notify_customer_created(customer, created_by):
        """Notificar cuando se crea un nuevo cliente"""
        mensaje = f"Nuevo cliente registrado: {customer.display_name} ({customer.document_number})"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_VENTAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Nuevo Cliente Registrado",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-user-add-line',
            color='success',
            url_accion=f'/app/customers/details/{customer.id}/',
            datos_adicionales={
                'cliente_id': customer.id,
                'cliente_nombre': customer.display_name,
                'documento': customer.document_number,
                'tipo_documento': customer.document_type_display,
                'tipo_cliente': customer.customer_type,
                'creado_por': created_by.username if created_by else 'Sistema'
            },
            enviado_por=created_by
        )
    
    @staticmethod
    def notify_customer_from_api(customer, created_by):
        """Notificar cliente creado desde API externa"""
        mensaje = f"Cliente verificado en SUNAT/RENIEC: {customer.display_name}"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_VENTAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Cliente Verificado API",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-verified-badge-line',
            color='primary',
            url_accion=f'/app/customers/details/{customer.id}/',
            datos_adicionales={
                'cliente_id': customer.id,
                'cliente_nombre': customer.display_name,
                'documento': customer.document_number,
                'verificado_api': True,
                'sunat_status': customer.sunat_status,
                'creado_por': created_by.username if created_by else 'Sistema'
            },
            enviado_por=created_by
        )
    
    @staticmethod
    def notify_customer_promoted_to_frequent(customer, promoted_by):
        """Notificar cuando un cliente es promovido a frecuente"""
        mensaje = f"Cliente {customer.display_name} promovido a Cliente Frecuente"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_VENTAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Cliente Frecuente",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-vip-crown-line',
            color='success',
            url_accion=f'/app/customers/details/{customer.id}/',
            datos_adicionales={
                'cliente_id': customer.id,
                'cliente_nombre': customer.display_name,
                'documento': customer.document_number,
                'es_frecuente': True,
                'promovido_por': promoted_by.username
            },
            enviado_por=promoted_by
        )
    
    @staticmethod
    def notify_customer_credit_limit_updated(customer, old_limit, new_limit, updated_by):
        """Notificar cambio de límite de crédito"""
        if old_limit == new_limit:
            return
        
        if new_limit > old_limit:
            mensaje = f"Límite de crédito aumentado para {customer.display_name}: S/.{old_limit:,.2f} → S/.{new_limit:,.2f}"
            color = 'success'
            icono = 'ri-arrow-up-line'
        else:
            mensaje = f"Límite de crédito reducido para {customer.display_name}: S/.{old_limit:,.2f} → S/.{new_limit:,.2f}"
            color = 'warning'
            icono = 'ri-arrow-down-line'
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_VENTAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Límite de Crédito Actualizado",
            tipo=TipoNotificacion.SISTEMA,
            icono=icono,
            color=color,
            url_accion=f'/app/customers/details/{customer.id}/',
            datos_adicionales={
                'cliente_id': customer.id,
                'cliente_nombre': customer.display_name,
                'documento': customer.document_number,
                'limite_anterior': float(old_limit),
                'limite_nuevo': float(new_limit),
                'actualizado_por': updated_by.username
            },
            enviado_por=updated_by
        )
    
    @staticmethod
    def notify_customer_updated_from_api(customer, updated_by):
        """Notificar actualización de datos desde API"""
        mensaje = f"Datos de {customer.display_name} actualizados desde SUNAT/RENIEC"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_VENTAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Datos Actualizados desde API",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-refresh-line',
            color='info',
            url_accion=f'/app/customers/details/{customer.id}/',
            datos_adicionales={
                'cliente_id': customer.id,
                'cliente_nombre': customer.display_name,
                'documento': customer.document_number,
                'actualizado_api': True,
                'actualizado_por': updated_by.username
            },
            enviado_por=updated_by
        )
    
    @staticmethod
    def notify_customer_status_changed(customer, user, is_active):
        """Notificar cambio de estado del cliente"""
        estado = "activado" if is_active else "desactivado"
        mensaje = f"Cliente {customer.display_name} {estado}"
        color = 'success' if is_active else 'warning'
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_VENTAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo=f"Cliente {estado.title()}",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-toggle-line',
            color=color,
            url_accion=f'/app/customers/details/{customer.id}/',
            datos_adicionales={
                'cliente_id': customer.id,
                'cliente_nombre': customer.display_name,
                'documento': customer.document_number,
                'nuevo_estado': is_active,
                'cambiado_por': user.username
            },
            enviado_por=user
        )
    
    @staticmethod
    def notify_high_value_customer(customer, total_purchases):
        """Notificar cliente de alto valor"""
        threshold = 10000  # S/.10,000
        
        if total_purchases < threshold:
            return
        
        mensaje = f"Cliente de alto valor: {customer.display_name} - Total compras: S/.{total_purchases:,.2f}"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_VENTAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Cliente de Alto Valor",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-vip-diamond-line',
            color='primary',
            url_accion=f'/app/customers/details/{customer.id}/',
            datos_adicionales={
                'cliente_id': customer.id,
                'cliente_nombre': customer.display_name,
                'documento': customer.document_number,
                'total_compras': float(total_purchases),
                'es_alto_valor': True,
                'umbral': threshold
            }
        )
    
    @staticmethod
    def notify_customer_birthday(customer):
        """Notificar cumpleaños de cliente (si tienes fecha de nacimiento)"""
        # Esto requeriría agregar campo birthday al modelo Customer
        mensaje = f"Hoy es el cumpleaños de {customer.display_name}"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_VENTAS],
            mensaje=mensaje,
            titulo="Cumpleaños de Cliente",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-cake-2-line',
            color='success',
            url_accion=f'/app/customers/details/{customer.id}/',
            datos_adicionales={
                'cliente_id': customer.id,
                'cliente_nombre': customer.display_name,
                'es_cumpleanos': True,
                'sugerir_promocion': True
            }
        )
    
    @staticmethod
    def notify_customer_inactive_period(customer, days_inactive):
        """Notificar cliente inactivo por mucho tiempo"""
        if days_inactive < 90:  # Solo si es más de 90 días
            return
        
        mensaje = f"Cliente inactivo: {customer.display_name} sin compras hace {days_inactive} días"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_VENTAS],
            mensaje=mensaje,
            titulo="Cliente Inactivo",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-user-unfollow-line',
            color='warning',
            url_accion=f'/app/customers/details/{customer.id}/',
            datos_adicionales={
                'cliente_id': customer.id,
                'cliente_nombre': customer.display_name,
                'dias_inactivo': days_inactive,
                'necesita_seguimiento': True,
                'sugerir_reactivacion': True
            }
        )
    
    @staticmethod
    def notify_duplicate_customer_attempt(document_number, existing_customer, attempted_by):
        """Notificar intento de crear cliente duplicado"""
        mensaje = f"Intento de registro duplicado: documento {document_number} ya pertenece a {existing_customer.display_name}"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_VENTAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Intento de Cliente Duplicado",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-error-warning-line',
            color='warning',
            url_accion=f'/app/customers/details/{existing_customer.id}/',
            datos_adicionales={
                'documento_duplicado': document_number,
                'cliente_existente_id': existing_customer.id,
                'cliente_existente_nombre': existing_customer.display_name,
                'intentado_por': attempted_by.username if attempted_by else 'Sistema'
            },
            enviado_por=attempted_by
        )