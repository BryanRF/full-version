# apps/ecommerce/cotizacion/models.py
from django.db import models
from django.contrib.auth.models import User
from apps.ecommerce.suppliers.models import Supplier
from apps.ecommerce.products.models import Product
from apps.ecommerce.requirements.models import Requirement
from django.utils import timezone
from datetime import date

class EnvioCotizacion(models.Model):
    METODO_ENVIO_CHOICES = [
        ('email', 'Email Sistema'),
        ('whatsapp', 'WhatsApp Manual'),
        ('telefono', 'Teléfono Manual'),
        ('otro', 'Otro Manual'),
    ]
    
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('enviado', 'Enviado'),
        ('respondido', 'Respondido'),
        ('vencido', 'Vencido'),
        ('cancelado', 'Cancelado'),
    ]
    
    requerimiento = models.ForeignKey(
        Requirement, 
        on_delete=models.CASCADE, 
        related_name='envios_cotizacion',
        verbose_name="Requerimiento"
    )
    proveedor = models.ForeignKey(
        Supplier, 
        on_delete=models.CASCADE,
        verbose_name="Proveedor"
    )
    usuario_creacion = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='envios_creados',
        verbose_name="Usuario Creación"
    )
    
    fecha_creacion = models.DateTimeField(auto_now_add=True, verbose_name="Fecha Creación")
    fecha_envio = models.DateTimeField(null=True, blank=True, verbose_name="Fecha Envío")
    enviado_por = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='envios_realizados',
        null=True, blank=True,
        verbose_name="Enviado Por"
    )
    
    metodo_envio = models.CharField(
        max_length=50, 
        choices=METODO_ENVIO_CHOICES,
        verbose_name="Método Envío"
    )
    fecha_respuesta_esperada = models.DateField(verbose_name="Fecha Respuesta Esperada")
    
    # NUEVO CAMPO: Archivo de respuesta del cliente
    archivo_respuesta_cliente = models.FileField(
        upload_to='cotizaciones/respuestas_clientes/', 
        blank=True, 
        null=True,
        verbose_name="Archivo Respuesta Cliente",
        help_text="Excel completado por el proveedor con precios"
    )
    
    archivo_respuesta = models.FileField(
        upload_to='cotizaciones/respuestas/', 
        blank=True, 
        null=True,
        verbose_name="Archivo Respuesta"
    )
    estado = models.CharField(
        max_length=20, 
        choices=ESTADO_CHOICES, 
        default='pendiente',
        verbose_name="Estado"
    )
    
    # Campos adicionales para tracking
    email_enviado = models.BooleanField(default=False, verbose_name="Email Enviado")
    fecha_email_enviado = models.DateTimeField(blank=True, null=True)
    notas_envio = models.TextField(blank=True, null=True, verbose_name="Notas del Envío")
    
    # Confirmación manual para envíos por teléfono/otros
    enviado_manualmente = models.BooleanField(default=False, verbose_name="Enviado Manualmente")
    fecha_envio_manual = models.DateTimeField(null=True, blank=True, verbose_name="Fecha Envío Manual")
    
    # NUEVO CAMPO: Procesado automáticamente
    respuesta_procesada = models.BooleanField(
        default=False, 
        verbose_name="Respuesta Procesada",
        help_text="Indica si el archivo de respuesta ya fue procesado automáticamente"
    )
    fecha_procesamiento = models.DateTimeField(
        null=True, 
        blank=True, 
        verbose_name="Fecha de Procesamiento"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Envío de Cotización"
        verbose_name_plural = "Envíos de Cotizaciones"
        unique_together = ['requerimiento', 'proveedor']  # Un envío por proveedor por requerimiento
    
    def __str__(self):
        return f"{self.requerimiento.numero_requerimiento} - {self.proveedor.company_name}"
    
    @property
    def numero_envio(self):
        return f"ENV-{self.id:05d}"
    
    @property
    def dias_desde_envio(self):
        if self.fecha_envio:
            return (timezone.now().date() - self.fecha_envio.date()).days
        return None
    
    @property
    def dias_hasta_respuesta(self):
        return (self.fecha_respuesta_esperada - timezone.now().date()).days
    
    @property
    def estado_color(self):
        if self.estado == 'respondido':
            return 'success'
        elif self.estado == 'vencido' or self.dias_hasta_respuesta < 0:
            return 'danger'  # Vencido
        elif self.dias_hasta_respuesta <= 1:
            return 'warning'  # Por vencer
        elif self.estado == 'enviado':
            return 'info'  # Enviado
        elif self.estado == 'cancelado':
            return 'secondary'
        else:
            return 'warning'  # Pendiente
    
    @property
    def metodo_envio_display(self):
        return dict(self.METODO_ENVIO_CHOICES).get(self.metodo_envio, self.metodo_envio)
    
    @property
    def estado_display(self):
        return dict(self.ESTADO_CHOICES).get(self.estado, self.estado)
    
    def save(self, *args, **kwargs):
        import logging
        logger = logging.getLogger(__name__)
        logger.debug(f"[SAVE] Guardando EnvioCotizacion ID={self.id} - Estado inicial: {self.estado}")

        # Skip auto-processing si está marcado
        skip_auto_processing = getattr(self, '_skip_auto_processing', False)

        # Auto-actualizar estado si hay archivo respuesta cliente
        if self.archivo_respuesta_cliente:
            self.estado = 'respondido'
            logger.debug(f"[SAVE] Estado cambiado a 'respondido' por archivo_respuesta_cliente")
            
            if not self.respuesta_procesada and not skip_auto_processing:
                logger.debug(f"[SAVE] Ejecutando procesamiento automático de respuesta para ID={self.id}")
                success = self.procesar_respuesta_automatica()
                logger.debug(f"[SAVE] Resultado de procesamiento automático: {success}")

                # Se actualizan los campos aquí para que super().save los guarde
                if success:
                    self.respuesta_procesada = True
                    self.fecha_procesamiento = timezone.now()
                    logger.debug(f"[SAVE] respuesta_procesada=True, fecha_procesamiento={self.fecha_procesamiento}")
            elif skip_auto_processing:
                logger.debug(f"[SAVE] Saltando procesamiento automático (skip_auto_processing=True)")
        
        elif not self.archivo_respuesta_cliente and self.estado == 'respondido':
            self.estado = 'enviado' if self.fecha_envio else 'pendiente'
            logger.debug(f"[SAVE] archivo_respuesta_cliente eliminado. Estado cambiado a {self.estado}")

        # Revisar si ya venció
        if self.estado in ['pendiente', 'enviado'] and self.dias_hasta_respuesta < 0:
            self.estado = 'vencido'
            logger.debug(f"[SAVE] Estado cambiado a 'vencido' por fecha vencida")

        logger.debug(f"[SAVE] Guardando con estado final: {self.estado}")
        super().save(*args, **kwargs)
    
    def procesar_respuesta_automatica(self):
        import logging
        logger = logging.getLogger(__name__)
        logger.debug(f"[PROCESAR] Procesando archivo para EnvioCotizacion ID={self.id}")

        if not self.archivo_respuesta_cliente:
            logger.warning(f"[PROCESAR] No hay archivo de respuesta")
            return False

        if self.respuesta_procesada:
            logger.info(f"[PROCESAR] Ya fue procesado anteriormente")
            return False

        try:
            from .services import CotizacionResponseProcessor
            
            # Abrir archivo y procesar en memoria
            with self.archivo_respuesta_cliente.open('rb') as file_obj:
                processor = CotizacionResponseProcessor(self)
                result = processor.process_excel_from_memory(file_obj)

            if result['success']:
                logger.info(f"[PROCESAR] Archivo procesado exitosamente")
                return True
            else:
                logger.error(f"[PROCESAR] Error: {result.get('error')}")
                return False

        except Exception as e:
            logger.exception(f"[PROCESAR] Excepción: {e}")
            return False


class RespuestaCotizacion(models.Model):
    envio = models.OneToOneField(
        EnvioCotizacion, 
        on_delete=models.CASCADE, 
        related_name='respuesta',
        verbose_name="Envío"
    )
    fecha_respuesta = models.DateTimeField(auto_now_add=True, verbose_name="Fecha Respuesta")
    terminos_pago = models.CharField(
        max_length=100, 
        blank=True, 
        null=True,
        verbose_name="Términos de Pago"
    )
    observaciones = models.TextField(blank=True, null=True, verbose_name="Observaciones")
    
    # Campos adicionales
    tiempo_entrega = models.CharField(
        max_length=100, 
        blank=True, 
        null=True,
        verbose_name="Tiempo de Entrega"
    )
    validez_cotizacion = models.CharField(
        max_length=100, 
        blank=True, 
        null=True,
        verbose_name="Validez de la Cotización"
    )
    incluye_igv = models.BooleanField(default=True, verbose_name="Incluye IGV")
    
    # NUEVO CAMPO: Procesado automáticamente
    procesado_automaticamente = models.BooleanField(
        default=False,
        verbose_name="Procesado Automáticamente",
        help_text="Indica si fue creado automáticamente desde Excel"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Respuesta de Cotización"
        verbose_name_plural = "Respuestas de Cotizaciones"
    
    def __str__(self):
        return f"Respuesta {self.envio.numero_envio}"
    
    @property
    def total_cotizado(self):
        """Suma total de todos los productos cotizados"""
        return sum(
            detalle.precio_unitario * detalle.cantidad_cotizada 
            for detalle in self.detalles.all()
        )
    
    @property
    def total_productos(self):
        """Total de productos cotizados"""
        return self.detalles.count()


class DetalleRespuestaCotizacion(models.Model):
    respuesta = models.ForeignKey(
        RespuestaCotizacion, 
        on_delete=models.CASCADE, 
        related_name='detalles',
        verbose_name="Respuesta"
    )
    
    # Referencia al producto usando code en lugar de ID
    producto_code = models.CharField(
        max_length=20, 
        verbose_name="Código Producto",
        help_text="Código del producto del sistema"
    )
    producto = models.ForeignKey(
        Product, 
        on_delete=models.CASCADE, 
        blank=True, 
        null=True,
        verbose_name="Producto"
    )
    
    # Información de la cotización
    precio_unitario = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        verbose_name="Precio Unitario"
    )
    cantidad_cotizada = models.PositiveIntegerField(
        default=1,
        verbose_name="Cantidad Cotizada"
    )
    
    # NUEVOS CAMPOS: Información desde Excel
    cantidad_disponible = models.PositiveIntegerField(
        default=0,
        verbose_name="Cantidad Disponible",
        help_text="Cantidad disponible según el proveedor"
    )
    
    # Campos adicionales del proveedor
    nombre_producto_proveedor = models.CharField(
        max_length=255, 
        blank=True, 
        null=True,
        verbose_name="Nombre según Proveedor"
    )
    marca = models.CharField(
        max_length=100, 
        blank=True, 
        null=True,
        verbose_name="Marca"
    )
    modelo = models.CharField(
        max_length=100, 
        blank=True, 
        null=True,
        verbose_name="Modelo"
    )
    tiempo_entrega_especifico = models.CharField(
        max_length=100, 
        blank=True, 
        null=True,
        verbose_name="Tiempo Entrega Específico"
    )
    observaciones = models.TextField(
        blank=True, 
        null=True,
        verbose_name="Observaciones del Producto"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['id']
        verbose_name = "Detalle Respuesta Cotización"
        verbose_name_plural = "Detalles Respuestas Cotizaciones"
    
    def __str__(self):
        producto_nombre = self.producto.name if self.producto else self.producto_code
        return f"{producto_nombre} - S/.{self.precio_unitario}"
    
    @property
    def subtotal(self):
        """Precio unitario * cantidad"""
        return self.precio_unitario * self.cantidad_cotizada
    
    def save(self, *args, **kwargs):
        # Auto-vincular producto por código si no está vinculado
        if self.producto_code and not self.producto:
            try:
                self.producto = Product.objects.get(code=self.producto_code)
            except Product.DoesNotExist:
                pass  # Producto no encontrado, mantener solo el código
        
        # Si se vincula producto, actualizar código
        if self.producto and not self.producto_code:
            self.producto_code = self.producto.code
            
        super().save(*args, **kwargs)
        
        
        
class ExcelProcessingLog(models.Model):
    """Log de procesamiento de archivos Excel"""
    
    envio = models.ForeignKey(
        EnvioCotizacion, 
        on_delete=models.CASCADE, 
        related_name='processing_logs',
        verbose_name="Envío"
    )
    archivo_nombre = models.CharField(max_length=255, verbose_name="Nombre del Archivo")
    archivo_tamaño = models.PositiveIntegerField(verbose_name="Tamaño del Archivo (bytes)")
    
    # Resultados de validación
    validacion_exitosa = models.BooleanField(default=False, verbose_name="Validación Exitosa")
    errores_validacion = models.JSONField(default=list, verbose_name="Errores de Validación")
    advertencias_validacion = models.JSONField(default=list, verbose_name="Advertencias de Validación")
    
    # Resultados de procesamiento
    procesamiento_exitoso = models.BooleanField(default=False, verbose_name="Procesamiento Exitoso")
    productos_procesados = models.PositiveIntegerField(default=0, verbose_name="Productos Procesados")
    productos_fallidos = models.PositiveIntegerField(default=0, verbose_name="Productos Fallidos")
    
    # Información de estructura
    total_filas = models.PositiveIntegerField(default=0, verbose_name="Total de Filas")
    columnas_encontradas = models.JSONField(default=list, verbose_name="Columnas Encontradas")
    estructura_valida = models.BooleanField(default=False, verbose_name="Estructura Válida")
    
    # Análisis de contenido
    codigos_validos = models.PositiveIntegerField(default=0, verbose_name="Códigos Válidos")
    codigos_invalidos = models.PositiveIntegerField(default=0, verbose_name="Códigos Inválidos")
    precios_validos = models.PositiveIntegerField(default=0, verbose_name="Precios Válidos")
    precios_invalidos = models.PositiveIntegerField(default=0, verbose_name="Precios Inválidos")
    
    # Metadatos
    procesado_por = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        verbose_name="Procesado Por"
    )
    tiempo_procesamiento = models.DurationField(null=True, blank=True, verbose_name="Tiempo de Procesamiento")
    errores_detallados = models.TextField(blank=True, null=True, verbose_name="Errores Detallados")
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Procesamiento")
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Log de Procesamiento Excel"
        verbose_name_plural = "Logs de Procesamiento Excel"
    
    def __str__(self):
        status = "✅ Exitoso" if self.procesamiento_exitoso else "❌ Fallido"
        return f"{self.envio.numero_envio} - {self.archivo_nombre} - {status}"
    
    @property
    def tasa_exito_productos(self):
        """Tasa de éxito en procesamiento de productos"""
        total = self.productos_procesados + self.productos_fallidos
        if total == 0:
            return 0
        return round((self.productos_procesados / total) * 100, 2)
    
    @property
    def resumen_validacion(self):
        """Resumen de validación"""
        return {
            'estructura_valida': self.estructura_valida,
            'total_errores': len(self.errores_validacion),
            'total_advertencias': len(self.advertencias_validacion),
            'codigos_validos': self.codigos_validos,
            'precios_validos': self.precios_validos
        }