# # apps/notification/admin.py
# from django.contrib import admin
# from .models import Notificacion, NotificacionGrupal

# @admin.register(Notificacion)
# class NotificacionAdmin(admin.ModelAdmin):
#     list_display = ('titulo', 'usuario', 'tipo_notificacion', 'leida', 'fecha_hora')
#     list_filter = ('leida', 'tipo_notificacion', 'fecha_hora')
#     search_fields = ('titulo', 'mensaje', 'usuario__username')

# @admin.register(NotificacionGrupal)
# class NotificacionGrupalAdmin(admin.ModelAdmin):
#     list_display = ('titulo', 'enviado_por', 'fecha_hora', 'usuarios_notificados_count')
#     list_filter = ('tipo_notificacion', 'fecha_hora')
#     search_fields = ('titulo', 'mensaje')