# auth/models.py - Actualizado con sistema de roles
from django.db import models
from django.contrib.auth.models import User, Permission, Group
from django.db.models.signals import post_save
from django.dispatch import receiver

class Role(models.TextChoices):
    PLANIFICADOR_COMPRAS = 'PLANIFICADOR_COMPRAS', 'Planificador de Compras'
    GERENTE_COMPRAS = 'GERENTE_COMPRAS', 'Gerente de Compras'
    ADMINISTRADOR_SISTEMA = 'ADMINISTRADOR_SISTEMA', 'Administrador del Sistema'

class UserStatus(models.TextChoices):
    PENDIENTE = 'PENDIENTE', 'Pendiente'
    ACTIVO = 'ACTIVO', 'Activo'
    INACTIVO = 'INACTIVO', 'Inactivo'

class Gender(models.TextChoices):
    MASCULINO = 'M', 'Masculino'
    FEMENINO = 'F', 'Femenino'
    OTRO = 'O', 'Otro'

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    email = models.EmailField(max_length=100, unique=True)
    email_token = models.CharField(max_length=100, blank=True, null=True)
    forget_password_token = models.CharField(max_length=100, blank=True, null=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Campos adicionales existentes
    role = models.CharField(
        max_length=50,
        choices=Role.choices,
        default=Role.ADMINISTRADOR_SISTEMA,
    )
    status = models.CharField(
        max_length=20,
        choices=UserStatus.choices,
        default=UserStatus.PENDIENTE,
        verbose_name="Estado"
    )
    contact = models.CharField(max_length=20, blank=True, null=True, verbose_name="Teléfono")
    company = models.CharField(max_length=100, blank=True, null=True, verbose_name="Empresa")
    country = models.CharField(max_length=50, blank=True, null=True, verbose_name="País")
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True, verbose_name="Avatar")

    # Campos adicionales
    dni = models.CharField(max_length=20, unique=True, blank=True, null=True, verbose_name="DNI")
    fecha_nacimiento = models.DateField(blank=True, null=True, verbose_name="Fecha de Nacimiento")
    genero = models.CharField(
        max_length=1,
        choices=Gender.choices,
        blank=True,
        null=True,
        verbose_name="Género"
    )

    def __str__(self):
        return self.user.username

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"
        ordering = ['-created_at']

    @property
    def full_name(self):
        """Obtener nombre completo del usuario"""
        if self.user.first_name and self.user.last_name:
            return f"{self.user.first_name} {self.user.last_name}"
        return self.user.username

    @property
    def is_active_status(self):
        """Propiedad para compatibilidad con frontend"""
        return self.status == UserStatus.ACTIVO

    def toggle_status(self):
        """Cambiar estado: Pendiente -> Activo, Activo -> Inactivo, Inactivo -> Activo"""
        if self.status == UserStatus.PENDIENTE:
            self.status = UserStatus.ACTIVO
        elif self.status == UserStatus.ACTIVO:
            self.status = UserStatus.INACTIVO
        elif self.status == UserStatus.INACTIVO:
            self.status = UserStatus.ACTIVO
        self.save()
        return self.status

class RolePermissionConfig(models.Model):
    """Configuración de permisos por rol"""
    role = models.CharField(
        max_length=50,
        choices=Role.choices,
        unique=True,
        verbose_name="Rol"
    )
    group = models.OneToOneField(
        Group,
        on_delete=models.CASCADE,
        verbose_name="Grupo de Django"
    )
    description = models.TextField(blank=True, verbose_name="Descripción")
    is_active = models.BooleanField(default=True, verbose_name="Activo")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuración de Rol"
        verbose_name_plural = "Configuraciones de Roles"
        ordering = ['role']

    def __str__(self):
        return f"Permisos para {self.get_role_display()}"

    def get_permissions(self):
        """Obtener todos los permisos del rol"""
        return self.group.permissions.all()

    def add_permission(self, permission):
        """Agregar permiso al rol"""
        self.group.permissions.add(permission)

    def remove_permission(self, permission):
        """Remover permiso del rol"""
        self.group.permissions.remove(permission)

    def set_permissions(self, permissions):
        """Establecer permisos del rol"""
        self.group.permissions.set(permissions)

# Signals para automatizar la asignación de grupos según roles
@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance, email=instance.email)

@receiver(post_save, sender=Profile)
def assign_user_to_role_group(sender, instance, **kwargs):
    """Asignar usuario al grupo correspondiente según su rol"""
    try:
        # Remover usuario de todos los grupos de roles
        role_configs = RolePermissionConfig.objects.all()
        for config in role_configs:
            instance.user.groups.remove(config.group)

        # Asignar al grupo del rol actual
        role_config = RolePermissionConfig.objects.get(role=instance.role)
        instance.user.groups.add(role_config.group)

    except RolePermissionConfig.DoesNotExist:
        # Si no existe la configuración del rol, crear el grupo automáticamente
        create_role_group(instance.role)

def create_role_group(role):
    """Crear grupo automáticamente para un rol"""
    group_name = f"Grupo_{role}"
    group, created = Group.objects.get_or_create(name=group_name)

    if created:
        # Crear configuración del rol
        RolePermissionConfig.objects.create(
            role=role,
            group=group,
            description=f"Grupo automático para {dict(Role.choices)[role]}"
        )

    return group
