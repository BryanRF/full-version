from channels.generic.websocket import AsyncWebsocketConsumer
import json

class StockConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add("stock_group", self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard("stock_group", self.channel_name)

    async def receive(self, text_data):
        pass  # No necesitamos recibir nada del cliente por ahora

    async def send_stock_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'stock_update',
            'data': event['data'],
        }))
