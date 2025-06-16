from django.db import models
from apps.ecommerce.categories.models import Category
import uuid
from django.db.models.signals import pre_save
from django.dispatch import receiver

class Product(models.Model):
    # Código único autogenerado
    code = models.CharField(max_length=20, unique=True, editable=False, blank=True)

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='products')

    # Pricing
    price = models.DecimalField(max_digits=10, decimal_places=2)
    discounted_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    charge_tax = models.BooleanField(default=True)

    # Inventory
    stock_current = models.PositiveIntegerField(default=0)
    stock_minimum = models.PositiveIntegerField(default=0)
    stock_maximum = models.PositiveIntegerField(default=100)

    # Product Details
    weight = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True)
    dimensions = models.CharField(max_length=100, blank=True, null=True)  # "20x30x10 cm"

    # Media
    image = models.ImageField(upload_to='products/', blank=True, null=True)

    # Organization
    tags = models.CharField(max_length=500, blank=True, null=True)  # Comma separated

    # Status
    is_active = models.BooleanField(default=True) #en stock

    # Attributes
    is_fragile = models.BooleanField(default=False , blank=True,)
    is_biodegradable = models.BooleanField(default=False , blank=True,)
    is_frozen = models.BooleanField(default=False , blank=True,)
    max_temperature = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    expiry_date = models.DateField(blank=True, null=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Producto"
        verbose_name_plural = "Productos"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.code} - {self.name}"

    @property
    def in_stock(self):
        return self.stock_current > 0

    @property
    def stock_status(self):
        if self.stock_current <= 0:
            return 'out_of_stock'
        elif self.stock_current <= self.stock_minimum:
            return 'low_stock'
        elif self.stock_current >= self.stock_maximum:
            return 'overstock'
        else:
            return 'in_stock'

    @staticmethod
    def generate_product_code():
        """Genera un código único para el producto"""
        # Obtener el último producto creado
        number = str(uuid.uuid4())[:8].upper()
        # Formato: PROD-s59d2sd2
        return f"PROD-{number}"

    def save(self, *args, **kwargs):
        # Generar código si no existe
        if not self.code:
            self.code = self.generate_product_code()

            # Verificar que el código sea único
            while Product.objects.filter(code=self.code).exists():
                # Si ya existe, generar uno nuevo incrementando
                number = str(uuid.uuid4())[:8].upper()
                self.code = f"PROD-{number}"

        super().save(*args, **kwargs)


# Alternativa con UUID (descomenta si prefieres códigos UUID)
"""
@receiver(pre_save, sender=Product)
def generate_product_code_uuid(sender, instance, **kwargs):
    if not instance.code:
        # Generar código con UUID corto
        instance.code = f"PROD-{str(uuid.uuid4())[:8].upper()}"
"""
