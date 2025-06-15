# apps/ecommerce/suppliers/services_notifications.py
from apps.notification.services import notification_service
from apps.notification.models import TipoNotificacion
from auth.models import Role

class SupplierNotificationService:
    """Servicio para notificaciones de proveedores"""
    
    @staticmethod
    def notify_supplier_created(supplier, created_by):
        """Notificar cuando se crea un nuevo proveedor"""
        mensaje = f"Nuevo proveedor registrado: {supplier.company_name}"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.PLANIFICADOR_COMPRAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Nuevo Proveedor Registrado",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-building-line',
            color='success',
            url_accion=f'/app/suppliers/details/{supplier.id}/',
            datos_adicionales={
                'proveedor_id': supplier.id,
                'proveedor_nombre': supplier.company_name,
                'ruc': supplier.tax_id,
                'categoria': supplier.category,
                'tiene_email': bool(supplier.email),
                'creado_por': created_by.username if created_by else 'Sistema'
            },
            enviado_por=created_by
        )
    
    @staticmethod
    def notify_supplier_rating_updated(supplier, old_rating, new_rating, updated_by):
        """Notificar cambio de calificación de proveedor"""
        if old_rating == new_rating:
            return
        
        if new_rating > old_rating:
            mensaje = f"Calificación mejorada para {supplier.company_name}: {old_rating}⭐ → {new_rating}⭐"
            color = 'success'
            icono = 'ri-arrow-up-line'
        else:
            mensaje = f"Calificación reducida para {supplier.company_name}: {old_rating}⭐ → {new_rating}⭐"
            color = 'warning'
            icono = 'ri-arrow-down-line'
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.PLANIFICADOR_COMPRAS],
            mensaje=mensaje,
            titulo="Calificación de Proveedor Actualizada",
            tipo=TipoNotificacion.SISTEMA,
            icono=icono,
            color=color,
            url_accion=f'/app/suppliers/details/{supplier.id}/',
            datos_adicionales={
                'proveedor_id': supplier.id,
                'proveedor_nombre': supplier.company_name,
                'calificacion_anterior': old_rating,
                'calificacion_nueva': new_rating,
                'actualizado_por': updated_by.username
            },
            enviado_por=updated_by
        )
    
    @staticmethod
    def notify_supplier_promoted_to_preferred(supplier, promoted_by):
        """Notificar cuando un proveedor es marcado como preferido"""
        mensaje = f"Proveedor {supplier.company_name} marcado como PREFERIDO"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.PLANIFICADOR_COMPRAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Proveedor Preferido",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-star-line',
            color='success',
            url_accion=f'/app/suppliers/details/{supplier.id}/',
            datos_adicionales={
                'proveedor_id': supplier.id,
                'proveedor_nombre': supplier.company_name,
                'es_preferido': True,
                'calificacion': supplier.rating,
                'promovido_por': promoted_by.username
            },
            enviado_por=promoted_by
        )
    
    @staticmethod
    def notify_supplier_status_changed(supplier, user, is_active):
        """Notificar cambio de estado del proveedor"""
        estado = "activado" if is_active else "desactivado"
        mensaje = f"Proveedor {supplier.company_name} {estado}"
        color = 'success' if is_active else 'warning'
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.PLANIFICADOR_COMPRAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo=f"Proveedor {estado.title()}",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-toggle-line',
            color=color,
            url_accion=f'/app/suppliers/details/{supplier.id}/',
            datos_adicionales={
                'proveedor_id': supplier.id,
                'proveedor_nombre': supplier.company_name,
                'nuevo_estado': is_active,
                'cambiado_por': user.username
            },
            enviado_por=user
        )
    
    @staticmethod
    def notify_poor_performance_supplier(supplier, issues):
        """Notificar proveedor con mal desempeño"""
        mensaje = f"Proveedor {supplier.company_name} presenta problemas de desempeño"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Proveedor con Mal Desempeño",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-error-warning-line',
            color='danger',
            url_accion=f'/app/suppliers/details/{supplier.id}/',
            datos_adicionales={
                'proveedor_id': supplier.id,
                'proveedor_nombre': supplier.company_name,
                'problemas': issues,
                'calificacion_actual': supplier.rating,
                'necesita_revision': True
            }
        )
    
    @staticmethod
    def notify_supplier_credit_limit_updated(supplier, old_limit, new_limit, updated_by):
        """Notificar cambio de límite de crédito del proveedor"""
        if old_limit == new_limit:
            return
        
        if new_limit > old_limit:
            mensaje = f"Límite de crédito aumentado para {supplier.company_name}: S/.{old_limit:,.2f} → S/.{new_limit:,.2f}"
            color = 'success'
            icono = 'ri-arrow-up-line'
        else:
            mensaje = f"Límite de crédito reducido para {supplier.company_name}: S/.{old_limit:,.2f} → S/.{new_limit:,.2f}"
            color = 'warning'
            icono = 'ri-arrow-down-line'
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Límite de Crédito de Proveedor Actualizado",
            tipo=TipoNotificacion.SISTEMA,
            icono=icono,
            color=color,
            url_accion=f'/app/suppliers/details/{supplier.id}/',
            datos_adicionales={
                'proveedor_id': supplier.id,
                'proveedor_nombre': supplier.company_name,
                'limite_anterior': float(old_limit),
                'limite_nuevo': float(new_limit),
                'actualizado_por': updated_by.username
            },
            enviado_por=updated_by
        )
    
    @staticmethod
    def notify_supplier_contact_added(supplier, contact, added_by):
        """Notificar nuevo contacto agregado al proveedor"""
        mensaje = f"Nuevo contacto agregado a {supplier.company_name}: {contact.name}"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.PLANIFICADOR_COMPRAS],
            mensaje=mensaje,
            titulo="Nuevo Contacto de Proveedor",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-contacts-line',
            color='info',
            url_accion=f'/app/suppliers/details/{supplier.id}/',
            datos_adicionales={
                'proveedor_id': supplier.id,
                'proveedor_nombre': supplier.company_name,
                'contacto_nombre': contact.name,
                'contacto_cargo': contact.position,
                'contacto_email': contact.email,
                'es_principal': contact.is_primary,
                'agregado_por': added_by.username if added_by else 'Sistema'
            },
            enviado_por=added_by
        )
    
    @staticmethod
    def notify_supplier_without_email(supplier):
        """Notificar proveedor sin email configurado"""
        mensaje = f"Proveedor {supplier.company_name} no tiene email configurado - Solo envío manual disponible"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.PLANIFICADOR_COMPRAS],
            mensaje=mensaje,
            titulo="Proveedor Sin Email",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-mail-forbid-line',
            color='warning',
            url_accion=f'/app/suppliers/details/{supplier.id}/',
            datos_adicionales={
                'proveedor_id': supplier.id,
                'proveedor_nombre': supplier.company_name,
                'sin_email': True,
                'telefono': supplier.phone_primary,
                'necesita_actualizacion': True
            }
        )
    
    @staticmethod
    def notify_supplier_performance_report(supplier, performance_data):
        """Notificar reporte de desempeño del proveedor"""
        mensaje = f"Reporte de desempeño generado para {supplier.company_name}"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Reporte de Desempeño de Proveedor",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-bar-chart-line',
            color='info',
            url_accion=f'/app/suppliers/details/{supplier.id}/',
            datos_adicionales={
                'proveedor_id': supplier.id,
                'proveedor_nombre': supplier.company_name,
                'desempeno': performance_data,
                'fecha_reporte': date.today().isoformat()
            }
        )
    
    @staticmethod
    def notify_supplier_duplicate_tax_id(tax_id, existing_supplier, attempted_by):
        """Notificar intento de crear proveedor con RUC duplicado"""
        mensaje = f"Intento de registro duplicado: RUC {tax_id} ya pertenece a {existing_supplier.company_name}"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Intento de Proveedor Duplicado",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-error-warning-line',
            color='warning',
            url_accion=f'/app/suppliers/details/{existing_supplier.id}/',
            datos_adicionales={
                'ruc_duplicado': tax_id,
                'proveedor_existente_id': existing_supplier.id,
                'proveedor_existente_nombre': existing_supplier.company_name,
                'intentado_por': attempted_by.username if attempted_by else 'Sistema'
            },
            enviado_por=attempted_by
        )