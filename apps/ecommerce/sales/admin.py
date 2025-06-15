
# apps/ecommerce/sales/admin.py
from django.contrib import admin
from .models import Sale, SaleItem, SalePayment

class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    readonly_fields = ('subtotal', 'total_discount', 'total')

class SalePaymentInline(admin.TabularInline):
    model = SalePayment
    extra = 0

@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = (
        'sale_number',
        'customer_display_name',
        'sale_date',
        'total_amount',
        'payment_method',
        'status',
        'created_by'
    )
    list_filter = (
        'status',
        'sale_type',
        'payment_method',
        'sale_date',
        'created_at'
    )
    search_fields = (
        'sale_number',
        'customer__first_name',
        'customer__last_name',
        'customer__business_name',
        'guest_customer_name',
        'guest_customer_document'
    )
    readonly_fields = (
        'sale_number',
        'subtotal',
        'tax_amount',
        'total_amount',
        'total_items',
        'total_products',
        'created_at',
        'updated_at'
    )
    inlines = [SaleItemInline, SalePaymentInline]
    
    fieldsets = (
        ('Información Básica', {
            'fields': ('sale_number', 'sale_type', 'customer')
        }),
        ('Cliente Invitado', {
            'fields': ('guest_customer_name', 'guest_customer_document', 
                      'guest_customer_phone', 'guest_customer_email'),
            'classes': ('collapse',)
        }),
        ('Fechas', {
            'fields': ('sale_date', 'due_date')
        }),
        ('Montos', {
            'fields': ('subtotal', 'tax_amount', 'discount_amount', 'total_amount', 
                      'tax_rate', 'includes_tax')
        }),
        ('Pago y Estado', {
            'fields': ('payment_method', 'status')
        }),
        ('Información Adicional', {
            'fields': ('notes', 'internal_notes', 'invoice_number', 'reference_number')
        }),
        ('Metadatos', {
            'fields': ('created_by', 'updated_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

@admin.register(SaleItem)
class SaleItemAdmin(admin.ModelAdmin):
    list_display = (
        'sale',
        'product',
        'quantity',
        'unit_price',
        'total'
    )
    list_filter = ('created_at',)
    search_fields = ('sale__sale_number', 'product__name')

@admin.register(SalePayment)
class SalePaymentAdmin(admin.ModelAdmin):
    list_display = (
        'sale',
        'amount',
        'payment_method',
        'status',
        'payment_date',
        'created_by'
    )
    list_filter = ('payment_method', 'status', 'payment_date')
    search_fields = ('sale__sale_number', 'reference_number')