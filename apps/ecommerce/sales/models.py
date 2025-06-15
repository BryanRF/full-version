# apps/ecommerce/sales/models.py
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from decimal import Decimal
import uuid
from datetime import date
from apps.ecommerce.products.models import Product
from apps.ecommerce.customers.models import Customer

class Sale(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('efectivo', 'Efectivo'),
        ('tarjeta_credito', 'Tarjeta de Crédito'),
        ('tarjeta_debito', 'Tarjeta de Débito'),
        ('transferencia', 'Transferencia Bancaria'),
        ('yape', 'Yape'),
        ('plin', 'Plin'),
        ('credito', 'Crédito'),
        ('deposito', 'Depósito Bancario'),
    ]
    
    STATUS_CHOICES = [
        ('draft', 'Borrador'),
        ('pending', 'Pendiente'),
        ('confirmed', 'Confirmado'),
        ('invoiced', 'Facturado'),
        ('delivered', 'Entregado'),
        ('paid', 'Pagado'),
        ('completed', 'Completado'),
        ('cancelled', 'Cancelado'),
        ('returned', 'Devuelto'),
    ]
    
    SALE_TYPE_CHOICES = [
        ('venta', 'Venta'),
        ('cotizacion', 'Cotización'),
        ('orden', 'Orden de Trabajo'),
        ('servicio', 'Servicio'),
    ]
    
    # Identificación
    sale_number = models.CharField(max_length=20, unique=True, editable=False, verbose_name="Número de Venta")
    sale_type = models.CharField(
        max_length=20, 
        choices=SALE_TYPE_CHOICES, 
        default='venta',
        verbose_name="Tipo de Venta"
    )
    
    # Cliente (opcional)
    customer = models.ForeignKey(
        Customer, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='sales',
        verbose_name="Cliente"
    )
    
    # Datos de cliente cuando no se registra
    guest_customer_name = models.CharField(
        max_length=255, 
        blank=True, 
        null=True,
        verbose_name="Nombre del Cliente"
    )
    guest_customer_document = models.CharField(
        max_length=20, 
        blank=True, 
        null=True,
        verbose_name="Documento del Cliente"
    )
    guest_customer_phone = models.CharField(
        max_length=17, 
        blank=True, 
        null=True,
        verbose_name="Teléfono del Cliente"
    )
    guest_customer_email = models.EmailField(
        blank=True, 
        null=True,
        verbose_name="Email del Cliente"
    )
    
    # Información de la venta
    sale_date = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Venta")
    due_date = models.DateField(blank=True, null=True, verbose_name="Fecha de Vencimiento")
    
    # Montos
    subtotal = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=0.00,
        verbose_name="Subtotal"
    )
    tax_amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=0.00,
        verbose_name="Monto de IGV"
    )
    discount_amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=0.00,
        verbose_name="Descuento"
    )
    total_amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=0.00,
        verbose_name="Total"
    )
    
    # Configuración de impuestos
    tax_rate = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=18.00,
        verbose_name="Tasa de IGV (%)"
    )
    includes_tax = models.BooleanField(default=True, verbose_name="Incluye IGV")
    
    # Pago y estado
    payment_method = models.CharField(
        max_length=20, 
        choices=PAYMENT_METHOD_CHOICES,
        verbose_name="Método de Pago"
    )
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='draft',
        verbose_name="Estado"
    )
    
    # Información adicional
    notes = models.TextField(blank=True, null=True, verbose_name="Observaciones")
    internal_notes = models.TextField(blank=True, null=True, verbose_name="Notas Internas")
    
    # Referencias externas
    invoice_number = models.CharField(
        max_length=50, 
        blank=True, 
        null=True,
        verbose_name="Número de Factura"
    )
    reference_number = models.CharField(
        max_length=50, 
        blank=True, 
        null=True,
        verbose_name="Número de Referencia"
    )
    
    # Usuario y timestamps
    created_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True,
        related_name='sales_created',
        verbose_name="Creado por"
    )
    updated_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='sales_updated',
        verbose_name="Actualizado por"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Venta"
        verbose_name_plural = "Ventas"
        indexes = [
            models.Index(fields=['sale_number']),
            models.Index(fields=['status']),
            models.Index(fields=['sale_date']),
            models.Index(fields=['customer']),
        ]
    
    def __str__(self):
        return f"{self.sale_number} - {self.customer_display_name}"
    
    @property
    def customer_display_name(self):
        """Nombre del cliente para mostrar"""
        if self.customer:
            return self.customer.display_name
        elif self.guest_customer_name:
            return self.guest_customer_name
        else:
            return "Cliente no especificado"
    
    @property
    def customer_document_display(self):
        """Documento del cliente para mostrar"""
        if self.customer:
            return f"{self.customer.document_type_display}: {self.customer.document_number}"
        elif self.guest_customer_document:
            return self.guest_customer_document
        return "-"
    
    @property
    def total_items(self):
        """Total de items en la venta"""
        return self.items.aggregate(
            total=models.Sum('quantity')
        )['total'] or 0
    
    @property
    def total_products(self):
        """Total de productos únicos"""
        return self.items.count()
    
    @property
    def status_color(self):
        """Color del estado para UI"""
        color_map = {
            'draft': 'secondary',
            'pending': 'warning',
            'confirmed': 'info',
            'invoiced': 'primary',
            'delivered': 'success',
            'paid': 'success',
            'completed': 'success',
            'cancelled': 'danger',
            'returned': 'warning',
        }
        return color_map.get(self.status, 'secondary')
    
    @property
    def payment_method_display(self):
        """Método de pago para mostrar"""
        return dict(self.PAYMENT_METHOD_CHOICES).get(self.payment_method, self.payment_method)
    
    @property
    def status_display(self):
        """Estado para mostrar"""
        return dict(self.STATUS_CHOICES).get(self.status, self.status)
    
    @property
    def can_edit(self):
        """Determina si la venta puede ser editada"""
        return self.status in ['draft', 'pending']
    
    @property
    def can_confirm(self):
        """Determina si la venta puede ser confirmada"""
        return self.status in ['draft', 'pending']
    
    @property
    def can_cancel(self):
        """Determina si la venta puede ser cancelada"""
        return self.status not in ['completed', 'cancelled', 'returned']
    
    def save(self, *args, **kwargs):
        # Generar número de venta si no existe
        if not self.sale_number:
            self.sale_number = self.generate_sale_number()
        
        # NO calcular totales aquí si no hay items aún
        # Solo llamar super().save() primero
        super().save(*args, **kwargs)
        
        # Calcular totales DESPUÉS de guardar si hay items
        if self.pk and self.items.exists():
            self.calculate_totals()
            # Llamar super().save() nuevamente solo para actualizar totales
            super().save(update_fields=['subtotal', 'tax_amount', 'total_amount'])
        
    def generate_sale_number(self):
        """Generar número único de venta"""
        today = date.today()
        prefix = f"V{today.strftime('%Y%m%d')}"
        
        # Buscar el último número del día
        last_sale = Sale.objects.filter(
            sale_number__startswith=prefix
        ).order_by('-sale_number').first()
        
        if last_sale:
            try:
                last_number = int(last_sale.sale_number[-4:])
                new_number = last_number + 1
            except (ValueError, IndexError):
                new_number = 1
        else:
            new_number = 1
        
        return f"{prefix}{new_number:04d}"
    
    def calculate_totals(self):
        """Calcular totales de la venta"""
        from django.db.models import Sum, F
        from decimal import Decimal
        
        # Obtener items relacionados y calcular subtotal
        items_total = self.items.aggregate(
            total=Sum(
                F('quantity') * F('unit_price'),
                output_field=models.DecimalField(max_digits=12, decimal_places=2)
            )
        )['total']
        
        # Convertir a Decimal y manejar None
        items_subtotal = Decimal(str(items_total or 0))
        discount_amount = Decimal(str(self.discount_amount or 0))
        tax_rate = Decimal(str(self.tax_rate or 18))
        
        self.subtotal = items_subtotal - discount_amount
        
        if self.includes_tax:
            # El subtotal ya incluye IGV
            self.tax_amount = (self.subtotal * tax_rate / (Decimal('100') + tax_rate)).quantize(Decimal('0.01'))
            self.total_amount = self.subtotal
        else:
            # El subtotal no incluye IGV
            self.tax_amount = (self.subtotal * tax_rate / Decimal('100')).quantize(Decimal('0.01'))
            self.total_amount = self.subtotal + self.tax_amount
    
    def confirm_sale(self, user=None):
        """Confirmar la venta y actualizar stock"""
        if not self.can_confirm:
            raise ValueError("La venta no puede ser confirmada en su estado actual")
        
        # Verificar stock antes de confirmar
        for item in self.items.all():
            if item.product.stock_current < item.quantity:
                raise ValueError(f"Stock insuficiente para {item.product.name}")
        
        # Actualizar stock
        for item in self.items.all():
            item.product.stock_current -= item.quantity
            item.product.save()
        
        # Cambiar estado
        self.status = 'confirmed'
        if user:
            self.updated_by = user
        self.save()
    
    def cancel_sale(self, user=None, restore_stock=True):
        """Cancelar la venta y restaurar stock si es necesario"""
        if not self.can_cancel:
            raise ValueError("La venta no puede ser cancelada en su estado actual")
        
        # Restaurar stock si la venta estaba confirmada
        if restore_stock and self.status in ['confirmed', 'invoiced', 'delivered']:
            for item in self.items.all():
                item.product.stock_current += item.quantity
                item.product.save()
        
        # Cambiar estado
        self.status = 'cancelled'
        if user:
            self.updated_by = user
        self.save()


class SaleItem(models.Model):
    """Items/productos de una venta"""
    sale = models.ForeignKey(
        Sale, 
        on_delete=models.CASCADE, 
        related_name='items',
        verbose_name="Venta"
    )
    product = models.ForeignKey(
        Product, 
        on_delete=models.CASCADE,
        verbose_name="Producto"
    )
    
    quantity = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        verbose_name="Cantidad"
    )
    unit_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        verbose_name="Precio Unitario"
    )
    discount_percentage = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0.00,
        verbose_name="Descuento (%)"
    )
    discount_amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0.00,
        verbose_name="Descuento Monto"
    )
    
    # Información adicional
    notes = models.TextField(blank=True, null=True, verbose_name="Observaciones")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['id']
        verbose_name = "Item de Venta"
        verbose_name_plural = "Items de Venta"
        unique_together = ['sale', 'product']  # Un producto por venta
    
    def __str__(self):
        return f"{self.product.name} x{self.quantity}"
    
    @property
    def subtotal(self):
        """Subtotal del item (precio * cantidad)"""
        from decimal import Decimal
        unit_price = Decimal(str(self.unit_price))
        quantity = Decimal(str(self.quantity))
        return (unit_price * quantity).quantize(Decimal('0.01'))
        
    @property
    def total_discount(self):
        """Descuento total aplicado"""
        from decimal import Decimal
        
        if self.discount_amount:
            return Decimal(str(self.discount_amount))
        elif self.discount_percentage:
            discount_pct = Decimal(str(self.discount_percentage))
            return (self.subtotal * discount_pct / Decimal('100')).quantize(Decimal('0.01'))
        return Decimal('0.00')
    
    @property
    def total(self):
        """Total del item después de descuento"""
        return (self.subtotal - self.total_discount).quantize(Decimal('0.01'))

    @property
    def stock_available(self):
        """Stock disponible del producto"""
        return self.product.stock_current
    
    @property
    def has_sufficient_stock(self):
        """Verifica si hay stock suficiente"""
        return self.stock_available >= self.quantity
    
    def save(self, *args, **kwargs):
        # Usar precio del producto si no se especifica
        if not self.unit_price:
            self.unit_price = self.product.price
        
        # Calcular descuento en monto si se especifica porcentaje
        if self.discount_percentage and not self.discount_amount:
            self.discount_amount = (self.subtotal * self.discount_percentage / Decimal('100')).quantize(Decimal('0.01'))
        
        super().save(*args, **kwargs)
        
        # Recalcular totales de la venta SOLO si la venta ya existe y tiene ID
        if self.sale_id and self.sale.pk:
            self.sale.calculate_totals()
            self.sale.save(update_fields=['subtotal', 'tax_amount', 'total_amount'])


class SalePayment(models.Model):
    """Pagos asociados a una venta"""
    PAYMENT_STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('completed', 'Completado'),
        ('failed', 'Fallido'),
        ('refunded', 'Reembolsado'),
    ]
    
    sale = models.ForeignKey(
        Sale, 
        on_delete=models.CASCADE, 
        related_name='payments',
        verbose_name="Venta"
    )
    
    amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        verbose_name="Monto"
    )
    payment_method = models.CharField(
        max_length=20, 
        choices=Sale.PAYMENT_METHOD_CHOICES,
        verbose_name="Método de Pago"
    )
    status = models.CharField(
        max_length=20, 
        choices=PAYMENT_STATUS_CHOICES, 
        default='pending',
        verbose_name="Estado"
    )
    
    # Información del pago
    reference_number = models.CharField(
        max_length=100, 
        blank=True, 
        null=True,
        verbose_name="Número de Referencia"
    )
    payment_date = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Pago")
    notes = models.TextField(blank=True, null=True, verbose_name="Observaciones")
    
    # Usuario
    created_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True,
        verbose_name="Registrado por"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-payment_date']
        verbose_name = "Pago de Venta"
        verbose_name_plural = "Pagos de Ventas"
    
    def __str__(self):
        return f"Pago {self.sale.sale_number} - S/.{self.amount}"