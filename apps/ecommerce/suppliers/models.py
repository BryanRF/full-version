# apps/suppliers/models.py
from django.db import models
from django.core.validators import RegexValidator

class Supplier(models.Model):
    # Información básica
    company_name = models.CharField(max_length=255, verbose_name="Nombre de la Empresa")
    legal_name = models.CharField(max_length=255, blank=True, null=True, verbose_name="Razón Social")
    tax_id = models.CharField(
        max_length=20, 
        unique=True, 
        verbose_name="RUC/NIT",
        help_text="Número de identificación tributaria"
    )
    
    # Información de contacto
    contact_person = models.CharField(max_length=255, verbose_name="Persona de Contacto")
    email = models.EmailField(verbose_name="Email Principal", blank=True)
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="El número de teléfono debe estar en formato: '+999999999'. Hasta 15 dígitos permitidos."
    )
    phone_primary = models.CharField(
        validators=[phone_regex], 
        max_length=17, 
        verbose_name="Teléfono Principal"
    )
    phone_secondary = models.CharField(
        validators=[phone_regex], 
        max_length=17, 
        blank=True, 
        null=True,
        verbose_name="Teléfono Secundario"
    )
    website = models.URLField(blank=True, null=True, verbose_name="Sitio Web")
    
    # Dirección
    address_line1 = models.CharField(max_length=255, verbose_name="Dirección Línea 1")
    address_line2 = models.CharField(max_length=255, blank=True, null=True, verbose_name="Dirección Línea 2")
    city = models.CharField(max_length=100, verbose_name="Ciudad")
    state = models.CharField(max_length=100, verbose_name="Departamento/Estado")
    country = models.CharField(max_length=100, default="Perú", verbose_name="País")
    
    # Información comercial
    payment_terms = models.CharField(
        max_length=100,
        default="30 días",
        verbose_name="Términos de Pago",
        help_text="Ej: 30 días, 60 días, contado"
    )

    credit_limit = models.DecimalField(
        blank=True,
        max_digits=12, 
        decimal_places=2, 
        default=0.00,
        verbose_name="Límite de Crédito"
    )
    
    # Categorización
    SUPPLIER_CATEGORIES = [
        ("products", "Productos"),
        ("services", "Servicios"),
        ("materials", "Materiales"),
        ("equipment", "Equipos"),
        ("logistics", "Logística"),
        ("other", "Otros")
    ]
    category = models.CharField(
        max_length=20,
        choices=SUPPLIER_CATEGORIES,
        default="products",
        verbose_name="Categoría"
    )
    
    # Estado y evaluación
    is_active = models.BooleanField(default=True, verbose_name="Activo")
    is_preferred = models.BooleanField(default=False, verbose_name="Proveedor Preferido")
    
    RATING_CHOICES = [
        (1, "⭐ - Muy Malo"),
        (2, "⭐⭐ - Malo"),
        (3, "⭐⭐⭐ - Regular"),
        (4, "⭐⭐⭐⭐ - Bueno"),
        (5, "⭐⭐⭐⭐⭐ - Excelente")
    ]
    rating = models.IntegerField(
        choices=RATING_CHOICES,
        default=3,
        verbose_name="Calificación"
    )
    
    # Información adicional
    notes = models.TextField(blank=True, null=True, verbose_name="Notas")
    logo = models.ImageField(upload_to='suppliers/logos/', blank=True, null=True, verbose_name="Logo")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Creación")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Última Actualización")
    
    class Meta:
        ordering = ['company_name']
        verbose_name = "Proveedor"
        verbose_name_plural = "Proveedores"
    
    def __str__(self):
        return self.company_name
    
    @property
    def full_address(self):
        """Retorna la dirección completa formateada"""
        address_parts = [self.address_line1]
        if self.address_line2:
            address_parts.append(self.address_line2)
        address_parts.extend([self.city, self.state])
        if self.postal_code:
            address_parts.append(self.postal_code)
        address_parts.append(self.country)
        return ", ".join(address_parts)
    
    @property
    def contact_info(self):
        """Retorna información de contacto resumida"""
        return f"{self.contact_person} - {self.email} - {self.phone_primary}"
    
    @property
    def rating_display(self):
        """Retorna la calificación con estrellas"""
        return "⭐" * self.rating + "☆" * (5 - self.rating)


# Modelo adicional para contactos múltiples (opcional)
class SupplierContact(models.Model):
    supplier = models.ForeignKey(
        Supplier, 
        on_delete=models.CASCADE, 
        related_name='contacts',
        verbose_name="Proveedor"
    )
    name = models.CharField(max_length=255, verbose_name="Nombre")
    position = models.CharField(max_length=100, verbose_name="Cargo")
    email = models.EmailField(verbose_name="Email")
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="El número de teléfono debe estar en formato: '+999999999'. Hasta 15 dígitos permitidos."
    )
    phone = models.CharField(
        validators=[phone_regex], 
        max_length=17, 
        verbose_name="Teléfono"
    )
    is_primary = models.BooleanField(default=False, verbose_name="Contacto Principal")
    notes = models.TextField(blank=True, null=True, verbose_name="Notas")
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-is_primary', 'name']
        verbose_name = "Contacto del Proveedor"
        verbose_name_plural = "Contactos del Proveedor"
    
    def __str__(self):
        return f"{self.name} - {self.supplier.company_name}"