

# apps/ecommerce/requirements/admin.py
from django.contrib import admin
from .models import Requirement, RequirementDetail

class RequirementDetailInline(admin.TabularInline):
    model = RequirementDetail
    extra = 0

@admin.register(Requirement)
class RequirementAdmin(admin.ModelAdmin):
    list_display = ('numero_requerimiento', 'usuario_solicitante', 'fecha_requerimiento', 'prioridad', 'estado')
    list_filter = ('estado', 'prioridad', 'created_at')
    search_fields = ('usuario_solicitante__username', 'notas')
    readonly_fields = ('numero_requerimiento',)
    inlines = [RequirementDetailInline]

@admin.register(RequirementDetail)
class RequirementDetailAdmin(admin.ModelAdmin):
    list_display = ('requerimiento', 'producto', 'cantidad_solicitada', 'unidad_medida')
