import os
import django

# 1. Seteas settings y haces setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()  # ⚠️ IMPORTANTE: Esto debe ir antes de importar modelos o consumers
from django.core.asgi import get_asgi_application 
# 2. Ahora sí puedes importar cualquier consumer o modelo
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import path
from apps.ecommerce.consumers import StockConsumer
from apps.notification.consumers import NotificationConsumer, RoleNotificationConsumer

# 3. Defines el application
application = ProtocolTypeRouter({
    "http": django.core.asgi.get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter([
            path('ws/stock/', StockConsumer.as_asgi()),
            path('ws/notifications/', NotificationConsumer.as_asgi()),
            path('ws/notifications/role/', RoleNotificationConsumer.as_asgi()),
        ])
    ),
})
