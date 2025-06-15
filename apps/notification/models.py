# apps/notifications/models.py
from django.db import models
from django.contrib.auth.models import User
from auth.models import Profile, Role
from django.utils import timezone

class TipoNotificacion(models.TextChoices):
    ALERTA_STOCK = 'ALERTA_STOCK', 'Alerta de Stock'
    APROBACION_PENDIENTE = 'APROBACION_PENDIENTE', 'Aprobación Pendiente'
    ESTADO_PEDIDO = 'ESTADO_PEDIDO', 'Estado de Pedido'
    PRODUCTO_ACTUALIZADO = 'PRODUCTO_ACTUALIZADO', 'Producto Actualizado'
    CATEGORIA_NUEVA = 'CATEGORIA_NUEVA', 'Nueva Categoría'
    SISTEMA = 'SISTEMA', 'Sistema'
    USUARIO_ESTADO_CAMBIADO = 'USUARIO_ESTADO_CAMBIADO', 'Estado de Usuario Cambiado'  # ← AGREGADO
    USUARIO_CREADO = 'USUARIO_CREADO', 'Usuario Creado'

class Notificacion(models.Model):
    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notificaciones',
        help_text="Usuario destinatario de la notificación"
    )
    mensaje = models.TextField(help_text="Contenido del mensaje de notificación")
    fecha_hora = models.DateTimeField(
        default=timezone.now,
        help_text="Fecha y hora de creación de la notificación"
    )
    leida = models.BooleanField(
        default=False,
        help_text="Indica si la notificación ha sido leída"
    )
    tipo_notificacion = models.CharField(
        max_length=50,
        choices=TipoNotificacion.choices,
        default=TipoNotificacion.SISTEMA,
        help_text="Tipo de notificación"
    )

    # Campos adicionales para más funcionalidad
    titulo = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Título breve de la notificación"
    )
    icono = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Clase CSS del icono (ej: ri-alert-line)"
    )
    color = models.CharField(
        max_length=20,
        default='info',
        help_text="Color de la notificación (success, warning, danger, info)"
    )
    url_accion = models.URLField(
        blank=True,
        null=True,
        help_text="URL a la que redirige al hacer clic en la notificación"
    )

    # Metadatos adicionales
    datos_adicionales = models.JSONField(
        blank=True,
        null=True,
        help_text="Datos adicionales en formato JSON"
    )

    class Meta:
        ordering = ['-fecha_hora']
        verbose_name = "Notificación"
        verbose_name_plural = "Notificaciones"
        indexes = [
            models.Index(fields=['usuario', 'leida']),
            models.Index(fields=['fecha_hora']),
            models.Index(fields=['tipo_notificacion']),
        ]

    def __str__(self):
        return f"{self.titulo or self.tipo_notificacion} - {self.usuario.username}"

    def marcar_como_leida(self):
        """Marca la notificación como leída"""
        self.leida = True
        self.save(update_fields=['leida'])

    @property
    def tiempo_transcurrido(self):
        """Retorna el tiempo transcurrido desde la creación"""
        now = timezone.now()
        diff = now - self.fecha_hora

        if diff.days > 0:
            return f"hace {diff.days} día{'s' if diff.days > 1 else ''}"
        elif diff.seconds > 3600:
            hours = diff.seconds // 3600
            return f"hace {hours} hora{'s' if hours > 1 else ''}"
        elif diff.seconds > 60:
            minutes = diff.seconds // 60
            return f"hace {minutes} minuto{'s' if minutes > 1 else ''}"
        else:
            return "hace unos segundos"

class NotificacionGrupal(models.Model):
    """Modelo para notificaciones enviadas a grupos de usuarios por rol"""
    roles_destinatarios = models.JSONField(
        help_text="Lista de roles que recibirán esta notificación"
    )
    mensaje = models.TextField()
    titulo = models.CharField(max_length=200)
    tipo_notificacion = models.CharField(
        max_length=50,
        choices=TipoNotificacion.choices,
        default=TipoNotificacion.SISTEMA
    )
    fecha_hora = models.DateTimeField(default=timezone.now)
    icono = models.CharField(max_length=50, blank=True, null=True)
    color = models.CharField(max_length=20, default='info')
    url_accion = models.URLField(blank=True, null=True)
    datos_adicionales = models.JSONField(blank=True, null=True)

    # Usuario que envió la notificación
    enviado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notificaciones_enviadas'
    )

    # Control de entrega
    usuarios_notificados = models.ManyToManyField(
        User,
        through='EntregaNotificacion',
        related_name='notificaciones_grupales_recibidas'
    )

    class Meta:
        ordering = ['-fecha_hora']
        verbose_name = "Notificación Grupal"
        verbose_name_plural = "Notificaciones Grupales"

    def __str__(self):
        roles = ', '.join(self.roles_destinatarios) if self.roles_destinatarios else 'Sin roles'
        return f"{self.titulo} - Roles: {roles}"

    def crear_notificaciones_individuales(self):
        """Crea notificaciones individuales para usuarios con los roles especificados"""
        from django.contrib.auth.models import User

        # Obtener usuarios con los roles especificados
        usuarios_objetivo = User.objects.filter(
            profile__role__in=self.roles_destinatarios,
            is_active=True
        ).distinct()

        notificaciones_creadas = []

        for usuario in usuarios_objetivo:
            # Verificar si ya se le envió esta notificación grupal
            entrega, created = EntregaNotificacion.objects.get_or_create(
                notificacion_grupal=self,
                usuario=usuario,
                defaults={'fecha_entrega': timezone.now()}
            )

            if created:
                # Crear notificación individual
                notificacion = Notificacion.objects.create(
                    usuario=usuario,
                    mensaje=self.mensaje,
                    titulo=self.titulo,
                    tipo_notificacion=self.tipo_notificacion,
                    icono=self.icono,
                    color=self.color,
                    url_accion=self.url_accion,
                    datos_adicionales=self.datos_adicionales
                )
                notificaciones_creadas.append(notificacion)

        return notificaciones_creadas

class EntregaNotificacion(models.Model):
    """Modelo intermedio para tracking de entrega de notificaciones grupales"""
    notificacion_grupal = models.ForeignKey(NotificacionGrupal, on_delete=models.CASCADE)
    usuario = models.ForeignKey(User, on_delete=models.CASCADE)
    fecha_entrega = models.DateTimeField(default=timezone.now)
    leida = models.BooleanField(default=False)
    fecha_lectura = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['notificacion_grupal', 'usuario']
        verbose_name = "Entrega de Notificación"
        verbose_name_plural = "Entregas de Notificaciones"
