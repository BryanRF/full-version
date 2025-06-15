# apps/notifications/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from django.contrib.auth import get_user_model
from .models import Notificacion

User = get_user_model()

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Verificar que el usuario esté autenticado
        if self.scope["user"].is_anonymous:
            await self.close()
            return
        
        self.user = self.scope["user"]
        self.user_group_name = f"notifications_{self.user.id}"
        
        # Unirse al grupo de notificaciones del usuario
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Enviar notificaciones no leídas al conectarse
        await self.send_unread_notifications()

    async def disconnect(self, close_code):
        # Salir del grupo de notificaciones
        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        """Manejar mensajes recibidos del cliente"""
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type')
            
            if message_type == 'mark_as_read':
                notification_id = text_data_json.get('notification_id')
                await self.mark_notification_as_read(notification_id)
            
            elif message_type == 'mark_all_as_read':
                await self.mark_all_notifications_as_read()
                
            elif message_type == 'get_unread_count':
                await self.send_unread_count()
                
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Formato JSON inválido'
            }))

    async def send_notification(self, event):
        """Enviar notificación al cliente"""
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'data': event['data']
        }))

    async def send_unread_count(self):
        """Enviar conteo de notificaciones no leídas"""
        count = await self.get_unread_notifications_count()
        await self.send(text_data=json.dumps({
            'type': 'unread_count',
            'count': count
        }))

    async def send_unread_notifications(self):
        """Enviar todas las notificaciones no leídas"""
        notifications = await self.get_unread_notifications()
        await self.send(text_data=json.dumps({
            'type': 'unread_notifications',
            'notifications': notifications
        }))

    @database_sync_to_async
    def get_unread_notifications_count(self):
        """Obtener el conteo de notificaciones no leídas"""
        return Notificacion.objects.filter(
            usuario=self.user,
            leida=False
        ).count()

    @database_sync_to_async
    def get_unread_notifications(self):
        """Obtener notificaciones no leídas"""
        notifications = Notificacion.objects.filter(
            usuario=self.user,
            leida=False
        ).order_by('-fecha_hora')[:10]  # Últimas 10
        
        return [
            {
                'id': notif.id,
                'titulo': notif.titulo,
                'mensaje': notif.mensaje,
                'tipo': notif.tipo_notificacion,
                'icono': notif.icono,
                'color': notif.color,
                'url_accion': notif.url_accion,
                'fecha_hora': notif.fecha_hora.isoformat(),
                'tiempo_transcurrido': notif.tiempo_transcurrido,
                'datos_adicionales': notif.datos_adicionales
            }
            for notif in notifications
        ]

    @database_sync_to_async
    def mark_notification_as_read(self, notification_id):
        """Marcar una notificación como leída"""
        try:
            notification = Notificacion.objects.get(
                id=notification_id,
                usuario=self.user
            )
            notification.marcar_como_leida()
            return True
        except Notificacion.DoesNotExist:
            return False

    @database_sync_to_async
    def mark_all_notifications_as_read(self):
        """Marcar todas las notificaciones como leídas"""
        Notificacion.objects.filter(
            usuario=self.user,
            leida=False
        ).update(leida=True)


class RoleNotificationConsumer(AsyncWebsocketConsumer):
    """Consumer para notificaciones por rol"""
    
    async def connect(self):
        if self.scope["user"].is_anonymous:
            await self.close()
            return
        
        self.user = self.scope["user"]
        
        # Obtener el rol del usuario
        user_role = await self.get_user_role()
        
        if user_role:
            self.role_group_name = f"role_notifications_{user_role}"
            
            # Unirse al grupo de notificaciones por rol
            await self.channel_layer.group_add(
                self.role_group_name,
                self.channel_name
            )
            
        await self.accept()

    async def disconnect(self, close_code):
        # Salir del grupo de notificaciones por rol
        if hasattr(self, 'role_group_name'):
            await self.channel_layer.group_discard(
                self.role_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        """Manejar mensajes del cliente"""
        pass

    async def send_role_notification(self, event):
        """Enviar notificación por rol al cliente"""
        await self.send(text_data=json.dumps({
            'type': 'role_notification',
            'data': event['data']
        }))

    @database_sync_to_async
    def get_user_role(self):
        """Obtener el rol del usuario"""
        try:
            return self.user.profile.role
        except:
            return None