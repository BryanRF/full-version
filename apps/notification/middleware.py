from django.utils.deprecation import MiddlewareMixin
from .services import notification_service

class NotificationContextMiddleware(MiddlewareMixin):
    '''Middleware para agregar contexto de notificaciones a las vistas'''
    
    def process_template_response(self, request, response):
        if hasattr(response, 'context_data') and request.user.is_authenticated:
            # Agregar conteo de notificaciones no leídas al contexto
            unread_count = notification_service.obtener_conteo_no_leidas(request.user)
            
            # Agregar notificaciones recientes
            recent_notifications = notification_service.obtener_notificaciones_usuario(
                request.user, no_leidas_solo=True
            )[:5]  # Últimas 5 no leídas
            
            if response.context_data:
                response.context_data['notifications_unread_count'] = unread_count
                response.context_data['recent_notifications'] = recent_notifications
        
        return response