# apps/ecommerce/categories/services.py
from apps.notification.services import notification_service
from apps.notification.models import TipoNotificacion
from auth.models import Role

class CategoryNotificationService:
    """Servicio para notificaciones de categorías"""
    
    @staticmethod
    def notify_category_created(category, user):
        """Notificar cuando se crea una nueva categoría"""
        mensaje = f"Nueva categoría '{category.name}' creada por {user.get_full_name() or user.username}"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Nueva Categoría Creada",
            tipo=TipoNotificacion.CATEGORIA_NUEVA,
            icono='ri-folder-add-line',
            color='success',
            url_accion=f'/app/ecommerce/product/category/',
            datos_adicionales={
                'categoria_id': category.id,
                'categoria_nombre': category.name,
                'creada_por': user.username
            },
            enviado_por=user
        )
    
    @staticmethod
    def notify_category_updated(category, user, changes=None):
        """Notificar cuando se actualiza una categoría"""
        mensaje = f"Categoría '{category.name}' actualizada por {user.get_full_name() or user.username}"
        
        datos_adicionales = {
            'categoria_id': category.id,
            'categoria_nombre': category.name,
            'actualizada_por': user.username
        }
        
        if changes:
            datos_adicionales['cambios'] = changes
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Categoría Actualizada",
            tipo=TipoNotificacion.CATEGORIA_NUEVA,
            icono='ri-edit-line',
            color='info',
            url_accion=f'/app/ecommerce/product/category/',
            datos_adicionales=datos_adicionales,
            enviado_por=user
        )
    
    @staticmethod
    def notify_category_status_changed(category, user, is_active):
        """Notificar cambio de estado de categoría"""
        estado = "activada" if is_active else "desactivada"
        mensaje = f"Categoría '{category.name}' {estado} por {user.get_full_name() or user.username}"
        color = 'success' if is_active else 'warning'
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_COMPRAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo=f"Categoría {estado.title()}",
            tipo=TipoNotificacion.CATEGORIA_NUEVA,
            icono='ri-toggle-line',
            color=color,
            url_accion=f'/app/ecommerce/product/category/',
            datos_adicionales={
                'categoria_id': category.id,
                'categoria_nombre': category.name,
                'nuevo_estado': is_active,
                'cambiado_por': user.username
            },
            enviado_por=user
        )