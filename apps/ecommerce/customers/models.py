# apps/ecommerce/customers/models.py
from django.db import models
from django.core.validators import RegexValidator
from django.contrib.auth.models import User

class Customer(models.Model):
    DOCUMENT_TYPE_CHOICES = [
        ('1', 'DNI'),
        ('6', 'RUC'),
        ('4', 'Carnet de Extranjería'),
        ('7', 'Pasaporte'),
    ]
    
    CUSTOMER_TYPE_CHOICES = [
        ('persona_natural', 'Persona Natural'),
        ('persona_juridica', 'Persona Jurídica'),
    ]
    
    # Información básica
    document_type = models.CharField(
        max_length=2, 
        choices=DOCUMENT_TYPE_CHOICES, 
        default='1',
        verbose_name="Tipo de Documento"
    )
    document_number = models.CharField(
        max_length=20, 
        unique=True,
        verbose_name="Número de Documento"
    )
    customer_type = models.CharField(
        max_length=20,
        choices=CUSTOMER_TYPE_CHOICES,
        default='persona_natural',
        verbose_name="Tipo de Cliente"
    )
    
    # Información personal/empresarial
    first_name = models.CharField(max_length=100, verbose_name="Nombres")
    last_name = models.CharField(max_length=100, blank=True, null=True, verbose_name="Apellidos")
    business_name = models.CharField(max_length=255, blank=True, null=True, verbose_name="Razón Social")
    commercial_name = models.CharField(max_length=255, blank=True, null=True, verbose_name="Nombre Comercial")
    
    # Información de contacto
    email = models.EmailField(blank=True, null=True, verbose_name="Email")
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Formato: '+999999999'. Hasta 15 dígitos."
    )
    phone = models.CharField(
        validators=[phone_regex], 
        max_length=17, 
        blank=True, 
        null=True,
        verbose_name="Teléfono"
    )
    mobile_phone = models.CharField(
        validators=[phone_regex], 
        max_length=17, 
        blank=True, 
        null=True,
        verbose_name="Celular"
    )
    
    # Dirección
    address = models.TextField(blank=True, null=True, verbose_name="Dirección")
    district = models.CharField(max_length=100, blank=True, null=True, verbose_name="Distrito")
    province = models.CharField(max_length=100, blank=True, null=True, verbose_name="Provincia")
    department = models.CharField(max_length=100, blank=True, null=True, verbose_name="Departamento")
    
    # Información SUNAT/RENIEC
    sunat_status = models.CharField(max_length=50, blank=True, null=True, verbose_name="Estado SUNAT")
    sunat_condition = models.CharField(max_length=50, blank=True, null=True, verbose_name="Condición SUNAT")
    ubigeo = models.CharField(max_length=10, blank=True, null=True, verbose_name="Ubigeo")
    
    # Estado y configuraciones
    is_active = models.BooleanField(default=True, verbose_name="Activo")
    is_frequent = models.BooleanField(default=False, verbose_name="Cliente Frecuente")
    credit_limit = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=0.00,
        verbose_name="Límite de Crédito"
    )
    
    # Observaciones
    notes = models.TextField(blank=True, null=True, verbose_name="Observaciones")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        verbose_name="Creado por"
    )
    
    class Meta:
        ordering = ['first_name', 'business_name']
        verbose_name = "Cliente"
        verbose_name_plural = "Clientes"
        indexes = [
            models.Index(fields=['document_number']),
            models.Index(fields=['customer_type']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        if self.customer_type == 'persona_juridica' and self.business_name:
            return f"{self.business_name} ({self.document_number})"
        else:
            full_name = f"{self.first_name} {self.last_name}".strip()
            return f"{full_name} ({self.document_number})"
    
    @property
    def full_name(self):
        """Retorna el nombre completo"""
        if self.customer_type == 'persona_juridica':
            return self.business_name or self.commercial_name or f"{self.first_name} {self.last_name}".strip()
        return f"{self.first_name} {self.last_name}".strip()
    
    @property
    def display_name(self):
        """Nombre para mostrar en interfaces"""
        name = self.full_name
        if self.commercial_name and self.commercial_name != self.business_name:
            name = f"{name} ({self.commercial_name})"
        return name
    
    @property
    def full_address(self):
        """Dirección completa formateada"""
        address_parts = []
        if self.address:
            address_parts.append(self.address)
        if self.district:
            address_parts.append(self.district)
        if self.province:
            address_parts.append(self.province)
        if self.department:
            address_parts.append(self.department)
        return ", ".join(address_parts) if address_parts else ""
    
    @property
    def document_type_display(self):
        """Tipo de documento para mostrar"""
        return dict(self.DOCUMENT_TYPE_CHOICES).get(self.document_type, self.document_type)
    
    @property
    def contact_info(self):
        """Información de contacto resumida"""
        contact = []
        if self.email:
            contact.append(self.email)
        if self.mobile_phone:
            contact.append(self.mobile_phone)
        elif self.phone:
            contact.append(self.phone)
        return " | ".join(contact)
    
    def save(self, *args, **kwargs):
        # Auto-determinar tipo de cliente basado en tipo de documento
        if self.document_type == '6':  # RUC
            self.customer_type = 'persona_juridica'
        elif self.document_type in ['1', '4', '7']:  # DNI, CE, Pasaporte
            self.customer_type = 'persona_natural'
        
        super().save(*args, **kwargs)


class CustomerContact(models.Model):
    """Contactos adicionales para clientes empresariales"""
    customer = models.ForeignKey(
        Customer, 
        on_delete=models.CASCADE, 
        related_name='contacts',
        verbose_name="Cliente"
    )
    name = models.CharField(max_length=255, verbose_name="Nombre")
    position = models.CharField(max_length=100, blank=True, null=True, verbose_name="Cargo")
    email = models.EmailField(blank=True, null=True, verbose_name="Email")
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Formato: '+999999999'. Hasta 15 dígitos."
    )
    phone = models.CharField(
        validators=[phone_regex], 
        max_length=17, 
        blank=True, 
        null=True,
        verbose_name="Teléfono"
    )
    is_primary = models.BooleanField(default=False, verbose_name="Contacto Principal")
    notes = models.TextField(blank=True, null=True, verbose_name="Notas")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-is_primary', 'name']
        verbose_name = "Contacto del Cliente"
        verbose_name_plural = "Contactos del Cliente"
    
    def __str__(self):
        return f"{self.name} - {self.customer.display_name}"
    
    def save(self, *args, **kwargs):
        # Si se marca como principal, desmarcar otros contactos del mismo cliente
        if self.is_primary:
            CustomerContact.objects.filter(
                customer=self.customer, is_primary=True
            ).exclude(pk=self.pk).update(is_primary=False)
        
        super().save(*args, **kwargs)