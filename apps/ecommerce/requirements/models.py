# apps/requirements/models.py
from django.db import models
from django.contrib.auth.models import User
from apps.ecommerce.products.models import Product

class Requirement(models.Model):
    PRIORITY_CHOICES = [
        ('alta', 'Alta'),
        ('media', 'Media'),
        ('baja', 'Baja'),
    ]
    
    STATUS_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('aprobado', 'Aprobado'),
        ('rechazado', 'Rechazado'),
        ('en_proceso_cotizacion', 'En Proceso Cotización'),
        ('cotizado', 'Cotizado'),
        ('orden_generada', 'Orden Generada'),
        ('completado', 'Completado'),
        ('cancelado', 'Cancelado'),
    ]
    
    # Información básica
    usuario_solicitante = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='requerimientos',
        verbose_name="Usuario Solicitante"
    )
    fecha_requerimiento = models.DateField(
        verbose_name="Fecha Requerida",
        help_text="Fecha para cuando se necesita el requerimiento"
    )
    
    # Archivos y notas
    archivo_adjunto = models.FileField(
        upload_to='requerimientos/adjuntos/', 
        blank=True, 
        null=True,
        verbose_name="Archivo Adjunto"
    )
    notas = models.TextField(
        blank=True, 
        null=True,
        verbose_name="Notas y Observaciones"
    )
    
    # Estado y prioridad
    prioridad = models.CharField(
        max_length=10, 
        choices=PRIORITY_CHOICES, 
        default='media',
        verbose_name="Prioridad"
    )
    estado = models.CharField(
        max_length=25, 
        choices=STATUS_CHOICES, 
        default='pendiente',
        verbose_name="Estado"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Creación")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Última Actualización")
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Requerimiento"
        verbose_name_plural = "Requerimientos"
    
    def __str__(self):
        return f"REQ-{self.id:05d} - {self.usuario_solicitante.get_full_name() or self.usuario_solicitante.username}"
    
    @property
    def numero_requerimiento(self):
        """Genera un número de requerimiento formateado"""
        return f"REQ-{self.id:05d}"
    
    @property
    def total_productos(self):
        """Retorna el total de productos únicos en el requerimiento"""
        return self.detalles.count()
    
    @property
    def cantidad_total(self):
        """Retorna la cantidad total de todos los productos"""
        return sum(detalle.cantidad_solicitada for detalle in self.detalles.all())
    
    @property
    def estado_display(self):
        """Retorna el estado con formato para mostrar"""
        return dict(self.STATUS_CHOICES).get(self.estado, self.estado)
    
    @property
    def prioridad_display(self):
        """Retorna la prioridad con formato para mostrar"""
        return dict(self.PRIORITY_CHOICES).get(self.prioridad, self.prioridad)
    
    @property
    def estado_color(self):
        """Retorna una clase CSS basada en el estado"""
        color_map = {
            'pendiente': 'warning',
            'aprobado': 'success',
            'rechazado': 'danger',
            'en_proceso_cotizacion': 'info',
            'cotizado': 'primary',
            'orden_generada': 'success',
            'completado': 'success',
            'cancelado': 'secondary',
        }
        return color_map.get(self.estado, 'secondary')
    
    @property
    def prioridad_color(self):
        """Retorna una clase CSS basada en la prioridad"""
        color_map = {
            'alta': 'danger',
            'media': 'warning',
            'baja': 'info',
        }
        return color_map.get(self.prioridad, 'secondary')
    
    @property
    def can_edit(self):
        """Determina si el requerimiento puede ser editado"""
        return self.estado in ['pendiente', 'rechazado']
    
    @property
    def can_approve(self):
        """Determina si el requerimiento puede ser aprobado"""
        return self.estado == 'pendiente'
    
    @property
    def can_reject(self):
        """Determina si el requerimiento puede ser rechazado"""
        return self.estado == 'pendiente'


class RequirementDetail(models.Model):
    # Relaciones
    requerimiento = models.ForeignKey(
        Requirement, 
        on_delete=models.CASCADE, 
        related_name='detalles',
        verbose_name="Requerimiento"
    )
    producto = models.ForeignKey(
        Product, 
        on_delete=models.CASCADE,
        verbose_name="Producto"
    )
    
    # Detalles del producto solicitado
    cantidad_solicitada = models.PositiveIntegerField(
        verbose_name="Cantidad Solicitada",
        help_text="Cantidad del producto solicitada"
    )
    unidad_medida = models.CharField(
        max_length=50, 
        default='unidad',
        verbose_name="Unidad de Medida",
        help_text="Ej: unidad, kg, metros, litros, etc."
    )
    observaciones = models.TextField(
        blank=True, 
        null=True,
        verbose_name="Observaciones",
        help_text="Observaciones específicas para este producto"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['id']
        verbose_name = "Detalle de Requerimiento"
        verbose_name_plural = "Detalles de Requerimiento"
        unique_together = ['requerimiento', 'producto']  # Un producto por requerimiento
    
    def __str__(self):
        return f"{self.producto.name} - {self.cantidad_solicitada} {self.unidad_medida}"
    
    @property
    def producto_name(self):
        """Nombre del producto"""
        return self.producto.name
    
    @property
    def producto_category(self):
        """Categoría del producto"""
        return self.producto.category.name if self.producto.category else "Sin categoría"
    
    @property
    def stock_disponible(self):
        """Stock disponible del producto"""
        return self.producto.stock_current
    
    @property
    def tiene_stock_suficiente(self):
        """Verifica si hay stock suficiente"""
        return self.stock_disponible >= self.cantidad_solicitada