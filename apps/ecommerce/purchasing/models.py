# apps/ecommerce/purchasing/models.py
from django.db import models
from django.contrib.auth.models import User
from apps.ecommerce.suppliers.models import Supplier
from apps.ecommerce.products.models import Product
from decimal import Decimal

class PurchaseOrder(models.Model):
    """
    Orden de compra - Documento formal hacia proveedor
    Simple, sin complicaciones, enfocada en el flujo básico
    """
    STATUS_CHOICES = [
        ('draft', 'Borrador'),
        ('sent', 'Enviada'),
        ('confirmed', 'Confirmada'),
        ('partially_received', 'Parcialmente Recibida'),
        ('completed', 'Completada'),
        ('cancelled', 'Cancelada'),
    ]
    
    # Identificación
    po_number = models.CharField(max_length=20, unique=True, editable=False)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT)
    
    # Control
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    # Fechas críticas
    order_date = models.DateField(auto_now_add=True)
    expected_delivery = models.DateField()
    
    # Financiero básico
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    # Metadatos
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.po_number} - {self.supplier.company_name}"
    
    @property
    def can_edit(self):
        return self.status in ['draft']
    
    @property
    def can_send(self):
        return self.status == 'draft' and self.items.exists()
    
    def save(self, *args, **kwargs):
        if not self.po_number:
            self.po_number = self._generate_po_number()
        super().save(*args, **kwargs)
    
    def _generate_po_number(self):
        from datetime import date
        today = date.today()
        prefix = f"PO{today.strftime('%Y%m%d')}"
        
        last_po = PurchaseOrder.objects.filter(
            po_number__startswith=prefix
        ).order_by('-po_number').first()
        
        if last_po:
            try:
                last_number = int(last_po.po_number[-3:])
                new_number = last_number + 1
            except (ValueError, IndexError):
                new_number = 1
        else:
            new_number = 1
        
        return f"{prefix}{new_number:03d}"


class PurchaseOrderItem(models.Model):
    """
    Items de la orden de compra
    Relación directa producto-cantidad-precio
    """
    purchase_order = models.ForeignKey(
        PurchaseOrder, 
        on_delete=models.CASCADE, 
        related_name='items'
    )
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    
    # Cantidades
    quantity_ordered = models.PositiveIntegerField()
    quantity_received = models.PositiveIntegerField(default=0)
    
    # Precios
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Metadatos
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['purchase_order', 'product']
    
    def __str__(self):
        return f"{self.product.name} x{self.quantity_ordered}"
    
    @property
    def line_total(self):
        return self.quantity_ordered * self.unit_price
    
    @property
    def pending_quantity(self):
        return self.quantity_ordered - self.quantity_received
    
    @property
    def is_fully_received(self):
        return self.quantity_received >= self.quantity_ordered