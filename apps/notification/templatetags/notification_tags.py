from django import template
from ..services import notification_service
from ..models import TipoNotificacion

register = template.Library()

@register.simple_tag(takes_context=True)
def unread_notifications_count(context):
    '''Obtiene el conteo de notificaciones no leídas'''
    user = context['request'].user
    if user.is_authenticated:
        return notification_service.obtener_conteo_no_leidas(user)
    return 0

@register.simple_tag(takes_context=True)
def recent_notifications(context, limit=5):
    '''Obtiene las notificaciones recientes'''
    user = context['request'].user
    if user.is_authenticated:
        return notification_service.obtener_notificaciones_usuario(user)[:limit]
    return []

@register.simple_tag
def notification_icon(tipo):
    '''Obtiene el icono según el tipo de notificación'''
    icons = {
        TipoNotificacion.ALERTA_STOCK: 'ri-alert-line',
        TipoNotificacion.APROBACION_PENDIENTE: 'ri-time-line',
        TipoNotificacion.ESTADO_PEDIDO: 'ri-shopping-cart-line',
        TipoNotificacion.PRODUCTO_ACTUALIZADO: 'ri-edit-box-line',
        TipoNotificacion.CATEGORIA_NUEVA: 'ri-folder-add-line',
        TipoNotificacion.SISTEMA: 'ri-notification-line'
    }
    return icons.get(tipo, 'ri-notification-line')

@register.simple_tag
def notification_color(tipo):
    '''Obtiene el color según el tipo de notificación'''
    colors = {
        TipoNotificacion.ALERTA_STOCK: 'warning',
        TipoNotificacion.APROBACION_PENDIENTE: 'info',
        TipoNotificacion.ESTADO_PEDIDO: 'primary',
        TipoNotificacion.PRODUCTO_ACTUALIZADO: 'success',
        TipoNotificacion.CATEGORIA_NUEVA: 'info',
        TipoNotificacion.SISTEMA: 'secondary'
    }
    return colors.get(tipo, 'info')

@register.filter
def notification_time_since(notification):
    '''Tiempo transcurrido desde la notificación'''
    return notification.tiempo_transcurrido
