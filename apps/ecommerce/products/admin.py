
# apps/ecommerce/products/admin.py
from django.contrib import admin
from .models import Product

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'category', 'price', 'stock_current', 'is_active')
    list_filter = ('is_active', 'category', 'stock_status')
    search_fields = ('code', 'name')
    readonly_fields = ('code',)
