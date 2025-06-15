from django.urls import re_path
from apps.ecommerce.consumers import StockConsumer
from apps.notification.consumers import NotificationConsumer, RoleNotificationConsumer

websocket_urlpatterns = [
    re_path(r"ws/stock/$", StockConsumer.as_asgi()),
    re_path(r"ws/notifications/$", NotificationConsumer.as_asgi()),
    re_path(r"ws/notifications/role/$", RoleNotificationConsumer.as_asgi()),
]