# apps/ecommerce/customers/admin.py
from django.contrib import admin
from .models import Customer, CustomerContact

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        'document_number', 
        'full_name', 
        'customer_type', 
        'email', 
        'phone',
        'is_active', 
        'is_frequent',
        'created_at'
    )
    list_filter = (
        'customer_type', 
        'document_type', 
        'is_active', 
        'is_frequent',
        'created_at'
    )
    search_fields = (
        'document_number', 
        'first_name', 
        'last_name', 
        'business_name',
        'email'
    )
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Información Básica', {
            'fields': ('document_type', 'document_number', 'customer_type')
        }),
        ('Información Personal/Empresarial', {
            'fields': ('first_name', 'last_name', 'business_name', 'commercial_name')
        }),
        ('Contacto', {
            'fields': ('email', 'phone', 'mobile_phone')
        }),
        ('Dirección', {
            'fields': ('address', 'district', 'province', 'department', 'ubigeo')
        }),
        ('Información SUNAT/RENIEC', {
            'fields': ('sunat_status', 'sunat_condition'),
            'classes': ('collapse',)
        }),
        ('Configuración', {
            'fields': ('is_active', 'is_frequent', 'credit_limit', 'notes')
        }),
        ('Metadatos', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

@admin.register(CustomerContact)
class CustomerContactAdmin(admin.ModelAdmin):
    list_display = ('name', 'customer', 'position', 'email', 'phone', 'is_primary')
    list_filter = ('is_primary', 'created_at')
    search_fields = ('name', 'customer__business_name', 'email')
