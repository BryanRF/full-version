
# apps/ecommerce/cotizacion/admin.py
from django.contrib import admin
from .models import EnvioCotizacion, RespuestaCotizacion, DetalleRespuestaCotizacion

class DetalleRespuestaInline(admin.TabularInline):
    model = DetalleRespuestaCotizacion
    extra = 0

@admin.register(EnvioCotizacion)
class EnvioCotizacionAdmin(admin.ModelAdmin):
    list_display = ('numero_envio', 'requerimiento', 'proveedor', 'metodo_envio', 'estado', 'fecha_envio')
    list_filter = ('estado', 'metodo_envio', 'fecha_creacion')
    search_fields = ('requerimiento__numero_requerimiento', 'proveedor__company_name')
    readonly_fields = ('numero_envio',)

@admin.register(RespuestaCotizacion)
class RespuestaCotizacionAdmin(admin.ModelAdmin):
    list_display = ('envio', 'fecha_respuesta', 'terminos_pago', 'incluye_igv', 'total_cotizado')
    list_filter = ('incluye_igv', 'procesado_automaticamente')
    inlines = [DetalleRespuestaInline]

@admin.register(DetalleRespuestaCotizacion)
class DetalleRespuestaCotizacionAdmin(admin.ModelAdmin):
    list_display = ('respuesta', 'producto_code', 'precio_unitario', 'cantidad_cotizada', 'subtotal')
