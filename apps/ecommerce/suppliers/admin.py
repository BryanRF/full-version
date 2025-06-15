

# apps/ecommerce/suppliers/admin.py
from django.contrib import admin
from .models import Supplier, SupplierContact

@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ('company_name', 'contact_person', 'email', 'phone_primary', 'is_active')
    list_filter = ('is_active', 'category', 'rating')
    search_fields = ('company_name', 'tax_id', 'email')

@admin.register(SupplierContact)
class SupplierContactAdmin(admin.ModelAdmin):
    list_display = ('name', 'supplier', 'email', 'phone', 'is_primary')
    list_filter = ('is_primary',)
