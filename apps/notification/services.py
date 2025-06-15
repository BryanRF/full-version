# apps/notifications/services.py
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.contrib.auth.models import User
from .models import Notificacion, NotificacionGrupal, TipoNotificacion
from auth.models import Role
from typing import List, Optional, Dict, Any
import json

class NotificationService:
    """Servicio para gestionar notificaciones"""
    
    def __init__(self):
        self.channel_layer = get_channel_layer()
    
    def enviar_notificacion_usuario(
        self,
        usuario: User,
        mensaje: str,
        titulo: str = None,
        tipo: str = TipoNotificacion.SISTEMA,
        icono: str = None,
        color: str = 'info',
        url_accion: str = None,
        datos_adicionales: Dict[str, Any] = None
    ) -> Notificacion:
        """
        Envía una notificación a un usuario específico
        """
        # Crear la notificación en la base de datos
        notificacion = Notificacion.objects.create(
            usuario=usuario,
            mensaje=mensaje,
            titulo=titulo,
            tipo_notificacion=tipo,
            icono=icono or self._get_default_icon(tipo),
            color=color,
            url_accion=url_accion,
            datos_adicionales=datos_adicionales
        )
        
        # Enviar por WebSocket
        self._send_websocket_notification(usuario.id, notificacion)
        
        return notificacion
    
    def enviar_notificacion_roles(
        self,
        roles: List[str],
        mensaje: str,
        titulo: str = None,
        tipo: str = TipoNotificacion.SISTEMA,
        icono: str = None,
        color: str = 'info',
        url_accion: str = None,
        datos_adicionales: Dict[str, Any] = None,
        enviado_por: User = None
    ) -> NotificacionGrupal:
        """
        Envía notificaciones a usuarios con roles específicos
        """
        # Crear notificación grupal
        notificacion_grupal = NotificacionGrupal.objects.create(
            roles_destinatarios=roles,
            mensaje=mensaje,
            titulo=titulo,
            tipo_notificacion=tipo,
            icono=icono or self._get_default_icon(tipo),
            color=color,
            url_accion=url_accion,
            datos_adicionales=datos_adicionales,
            enviado_por=enviado_por
        )
        
        # Crear notificaciones individuales y enviar por WebSocket
        notificaciones_individuales = notificacion_grupal.crear_notificaciones_individuales()
        
        for notificacion in notificaciones_individuales:
            self._send_websocket_notification(notificacion.usuario.id, notificacion)
        
        # También enviar notificación por canales de rol
        for rol in roles:
            self._send_role_notification(rol, notificacion_grupal)
        
        return notificacion_grupal
    
    def notificar_stock_bajo(self, producto):
        """Notificación específica para stock bajo"""
        mensaje = f"El producto '{producto.name}' tiene stock bajo. Stock actual: {producto.stock_current}, mínimo: {producto.stock_minimum}"
        titulo = "Alerta de Stock Bajo"
        
        # Enviar a roles específicos que manejan inventario
        roles_objetivo = [
            Role.PLANIFICADOR_COMPRAS,
            Role.GERENTE_COMPRAS,
            Role.ADMINISTRADOR_SISTEMA
        ]
        
        datos_adicionales = {
            'producto_id': producto.id,
            'producto_nombre': producto.name,
            'stock_actual': producto.stock_current,
            'stock_minimo': producto.stock_minimum,
            'categoria': producto.category.name if producto.category else None
        }
        
        return self.enviar_notificacion_roles(
            roles=roles_objetivo,
            mensaje=mensaje,
            titulo=titulo,
            tipo=TipoNotificacion.ALERTA_STOCK,
            icono='ri-alert-line',
            color='warning',
            url_accion=f'/app/ecommerce/product/add/?edit={producto.id}',
            datos_adicionales=datos_adicionales
        )
    
    def notificar_producto_agotado(self, producto):
        """Notificación específica para producto agotado"""
        mensaje = f"El producto '{producto.name}' está agotado. Es necesario realizar reposición inmediata."
        titulo = "Producto Agotado"
        
        roles_objetivo = [
            Role.PLANIFICADOR_COMPRAS,
            Role.GERENTE_COMPRAS,
            Role.ADMINISTRADOR_SISTEMA
        ]
        
        datos_adicionales = {
            'producto_id': producto.id,
            'producto_nombre': producto.name,
            'stock_actual': 0,
            'categoria': producto.category.name if producto.category else None,
            'prioridad': 'alta'
        }
        
        return self.enviar_notificacion_roles(
            roles=roles_objetivo,
            mensaje=mensaje,
            titulo=titulo,
            tipo=TipoNotificacion.ALERTA_STOCK,
            icono='ri-error-warning-line',
            color='danger',
            url_accion=f'/app/ecommerce/product/add/?edit={producto.id}',
            datos_adicionales=datos_adicionales
        )
    
    def notificar_producto_actualizado(self, producto, usuario_actualizador):
        """Notificación cuando un producto es actualizado"""
        mensaje = f"El producto '{producto.name}' ha sido actualizado por {usuario_actualizador.get_full_name() or usuario_actualizador.username}"
        titulo = "Producto Actualizado"
        
        # Notificar a otros usuarios con permisos de gestión
        roles_objetivo = [
            Role.GERENTE_COMPRAS,
            Role.ADMINISTRADOR_SISTEMA
        ]
        
        datos_adicionales = {
            'producto_id': producto.id,
            'producto_nombre': producto.name,
            'actualizado_por': usuario_actualizador.username,
            'fecha_actualizacion': producto.updated_at.isoformat() if hasattr(producto, 'updated_at') else None
        }
        
        return self.enviar_notificacion_roles(
            roles=roles_objetivo,
            mensaje=mensaje,
            titulo=titulo,
            tipo=TipoNotificacion.PRODUCTO_ACTUALIZADO,
            icono='ri-edit-box-line',
            color='info',
            url_accion=f'/app/ecommerce/product/add/?edit={producto.id}',
            datos_adicionales=datos_adicionales,
            enviado_por=usuario_actualizador
        )
    
    def obtener_notificaciones_usuario(self, usuario: User, no_leidas_solo: bool = False) -> List[Notificacion]:
        """Obtiene las notificaciones de un usuario"""
        queryset = Notificacion.objects.filter(usuario=usuario)
        
        if no_leidas_solo:
            queryset = queryset.filter(leida=False)
        
        return queryset.order_by('-fecha_hora')[:50]  # Últimas 50
    
    def marcar_todas_como_leidas(self, usuario: User) -> int:
        """Marca todas las notificaciones de un usuario como leídas"""
        return Notificacion.objects.filter(
            usuario=usuario,
            leida=False
        ).update(leida=True)
    
    def obtener_conteo_no_leidas(self, usuario: User) -> int:
        """Obtiene el conteo de notificaciones no leídas"""
        return Notificacion.objects.filter(
            usuario=usuario,
            leida=False
        ).count()
    
    def _send_websocket_notification(self, user_id: int, notificacion: Notificacion):
        """Envía notificación por WebSocket a un usuario específico"""
        if not self.channel_layer:
            return
        
        notification_data = {
            'id': notificacion.id,
            'titulo': notificacion.titulo,
            'mensaje': notificacion.mensaje,
            'tipo': notificacion.tipo_notificacion,
            'icono': notificacion.icono,
            'color': notificacion.color,
            'url_accion': notificacion.url_accion,
            'fecha_hora': notificacion.fecha_hora.isoformat(),
            'tiempo_transcurrido': notificacion.tiempo_transcurrido,
            'datos_adicionales': notificacion.datos_adicionales
        }
        
        async_to_sync(self.channel_layer.group_send)(
            f"notifications_{user_id}",
            {
                "type": "send_notification",
                "data": notification_data
            }
        )
    
    def _send_role_notification(self, rol: str, notificacion_grupal: NotificacionGrupal):
        """Envía notificación por WebSocket a un canal de rol"""
        if not self.channel_layer:
            return
        
        notification_data = {
            'id': notificacion_grupal.id,
            'titulo': notificacion_grupal.titulo,
            'mensaje': notificacion_grupal.mensaje,
            'tipo': notificacion_grupal.tipo_notificacion,
            'icono': notificacion_grupal.icono,
            'color': notificacion_grupal.color,
            'url_accion': notificacion_grupal.url_accion,
            'fecha_hora': notificacion_grupal.fecha_hora.isoformat(),
            'roles_destinatarios': notificacion_grupal.roles_destinatarios,
            'datos_adicionales': notificacion_grupal.datos_adicionales
        }
        
        async_to_sync(self.channel_layer.group_send)(
            f"role_notifications_{rol}",
            {
                "type": "send_role_notification",
                "data": notification_data
            }
        )
    
    def _get_default_icon(self, tipo: str) -> str:
        """Obtiene el icono por defecto según el tipo de notificación"""
        icons = {
            TipoNotificacion.ALERTA_STOCK: 'ri-alert-line',
            TipoNotificacion.APROBACION_PENDIENTE: 'ri-time-line',
            TipoNotificacion.ESTADO_PEDIDO: 'ri-shopping-cart-line',
            TipoNotificacion.PRODUCTO_ACTUALIZADO: 'ri-edit-box-line',
            TipoNotificacion.CATEGORIA_NUEVA: 'ri-folder-add-line',
            TipoNotificacion.SISTEMA: 'ri-notification-line'
        }
        return icons.get(tipo, 'ri-notification-line')


# Instancia global del servicio
notification_service = NotificationService()