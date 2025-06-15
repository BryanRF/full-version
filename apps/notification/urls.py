# apps/notifications/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *
# Router para API REST
router = DefaultRouter()
router.register(r'notificaciones', NotificacionViewSet, basename='notificacion')
router.register(r'notificaciones-grupales', NotificacionGrupalViewSet, basename='notificacion-grupal')


urlpatterns = [
    # API endpoints
    path('api/notifications/list/', NotificacionListView.as_view(), name='notifications-list'),
    path('api/notifications/json/', login_required(notificaciones_json), name='notifications-json'),
    path('api/notifications/<int:notification_id>/mark-read/', 
         login_required(marcar_notificacion_leida), name='mark-notification-read'),
    

    
    # Vistas de plantillas
    path('notifications/', 
         login_required(NotificationsTemplateView.as_view(template_name="notifications_list.html")), 
         name='notifications-list-page'),
    path('notifications/send/', 
         login_required(EnviarNotificacionView.as_view(template_name="notifications_send.html")), 
         name='notifications-send'),
] + router.urls