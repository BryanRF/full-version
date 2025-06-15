# auth/services.py
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.core.exceptions import ValidationError
from django.db import transaction
from django.conf import settings
from django.utils import timezone
from .models import Profile, Role
import string
import secrets
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class UserService:
    """Servicio para gestión de usuarios"""

    @staticmethod
    def generate_random_password(length=12):
        """Generar contraseña aleatoria segura"""
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        password = ''.join(secrets.choice(alphabet) for i in range(length))
        return password

    @staticmethod
    def generate_username_from_email(email):
        """Generar username único desde email"""
        base_username = email.split('@')[0]
        username = base_username
        counter = 1

        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        return username

    @staticmethod
    def validate_user_data(email, dni, nombre, apellidos, fecha_nacimiento, genero):
        """Validar datos del usuario"""
        errors = {}

        # Validar email único
        if User.objects.filter(email=email).exists():
            errors['email'] = ['Este email ya está registrado']

        # Validar DNI único
        if Profile.objects.filter(dni=dni).exists():
            errors['dni'] = ['Este DNI ya está registrado']

        # Validar campos requeridos
        if not nombre or not nombre.strip():
            errors['nombre'] = ['El nombre es requerido']

        if not apellidos or not apellidos.strip():
            errors['apellidos'] = ['Los apellidos son requeridos']

        if not email or not email.strip():
            errors['email'] = errors.get('email', []) + ['El email es requerido']

        if not dni or not dni.strip():
            errors['dni'] = errors.get('dni', []) + ['El DNI es requerido']

        if not fecha_nacimiento:
            errors['fecha_nacimiento'] = ['La fecha de nacimiento es requerida']

        if not genero:
            errors['genero'] = ['El género es requerido']

        # Validar formato de fecha
        if fecha_nacimiento:
            try:
                if isinstance(fecha_nacimiento, str):
                    datetime.strptime(fecha_nacimiento, '%Y-%m-%d')
            except ValueError:
                errors['fecha_nacimiento'] = ['Formato de fecha inválido (YYYY-MM-DD)']

        # Validar género
        if genero and genero not in ['M', 'F', 'O']:
            errors['genero'] = ['Género inválido. Use M, F o O']

        if errors:
            raise ValidationError(errors)

    @staticmethod
    def send_password_email(user, password):
        """Enviar contraseña por email"""
        try:
            subject = 'Credenciales de Acceso - Sistema de Gestión'
            message = f"""
Hola {user.get_full_name() or user.username},

Se ha creado tu cuenta en el sistema de gestión.

Tus credenciales de acceso son:
- Usuario: {user.username}
- Email: {user.email}
- Contraseña temporal: {password}

Por motivos de seguridad, te recomendamos cambiar tu contraseña al realizar el primer inicio de sesión.

Puedes acceder al sistema en: {settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else 'http://localhost:8000'}

Saludos,
Equipo de Administración
            """

            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )

            logger.info(f"Password email sent to {user.email}")
            return True

        except Exception as e:
            logger.error(f"Error sending password email to {user.email}: {str(e)}")
            return False

    @staticmethod
    @transaction.atomic
    def create_user(email, nombre, apellidos, dni, fecha_nacimiento, genero,role=None, created_by=None):
        """Crear nuevo usuario con perfil"""
        try:
            # Validar datos
            UserService.validate_user_data(email, dni, nombre, apellidos, fecha_nacimiento, genero)

            # Generar username y contraseña
            username = UserService.generate_username_from_email(email)
            password = UserService.generate_random_password()

            # Crear usuario
            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=nombre.strip(),
                last_name=apellidos.strip(),
                password=password,
                is_active=False  # Inicialmente inactivo hasta activar
            )

            # Crear perfil
            profile = Profile.objects.create(
                user=user,
                dni=dni.strip(),
                fecha_nacimiento=fecha_nacimiento,
                genero=genero,
                status='PENDIENTE',
                role=role ,  # Rol por defecto
                created_by=created_by
            )

            # Enviar credenciales por email
            UserService.send_password_email(user, password)

            # Notificar creación
            UserService.notify_user_created(user, created_by)

            logger.info(f"User created successfully: {user.username} by {created_by.username if created_by else 'System'}")

            return user

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error creating user: {str(e)}")
            raise ValidationError({'general': [f'Error al crear usuario: {str(e)}']})

    @staticmethod
    @transaction.atomic
    def update_user(user, nombre=None, apellidos=None, dni=None, fecha_nacimiento=None, genero=None,role=None, updated_by=None):
        """Actualizar datos del usuario"""
        try:
            # Validar DNI único si se está cambiando
            if dni and dni != user.profile.dni:
                if Profile.objects.filter(dni=dni).exclude(user=user).exists():
                    raise ValidationError({'dni': ['Este DNI ya está registrado']})

            # Actualizar datos del usuario
            if nombre:
                user.first_name = nombre.strip()
            if apellidos:
                user.last_name = apellidos.strip()

            user.save()

            # Actualizar perfil
            profile = user.profile
            if dni:
                profile.dni = dni.strip()
            if fecha_nacimiento:
                profile.fecha_nacimiento = fecha_nacimiento
            if genero:
                profile.genero = genero
            if role:
                profile.role = role

            profile.save()

            # Notificar actualización
            UserService.notify_user_updated(user, updated_by)

            logger.info(f"User updated successfully: {user.username} by {updated_by.username if updated_by else 'System'}")

            return user

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error updating user: {str(e)}")
            raise ValidationError({'general': [f'Error al actualizar usuario: {str(e)}']})

    @staticmethod
    @transaction.atomic
    def change_user_status(user, new_status, changed_by=None):
        """Cambiar estado del usuario"""
        try:
            old_status = user.profile.status

            # Validar estado
            valid_statuses = ['PENDIENTE', 'ACTIVO', 'INACTIVO']
            if new_status not in valid_statuses:
                raise ValidationError({'status': ['Estado inválido']})

            # Actualizar estado del perfil
            user.profile.status = new_status
            user.profile.save()

            # Actualizar is_active del usuario
            user.is_active = (new_status == 'ACTIVO')
            user.save()

            # Notificar cambio
            UserService.notify_user_status_changed(user, old_status, new_status, changed_by)

            logger.info(f"User status changed: {user.username} from {old_status} to {new_status} by {changed_by.username if changed_by else 'System'}")

            return user

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error changing user status: {str(e)}")
            raise ValidationError({'general': [f'Error al cambiar estado: {str(e)}']})

    @staticmethod
    @transaction.atomic
    def reset_user_password(user, reset_by=None):
        """Resetear contraseña del usuario"""
        try:
            # Generar nueva contraseña
            new_password = UserService.generate_random_password()
            user.set_password(new_password)
            user.save()

            # Enviar por email
            email_sent = UserService.send_password_email(user, new_password)

            if not email_sent:
                logger.warning(f"Failed to send password email to {user.email}")

            # Notificar reset
            UserService.notify_password_reset(user, reset_by)

            logger.info(f"Password reset for user: {user.username} by {reset_by.username if reset_by else 'System'}")

            return new_password

        except Exception as e:
            logger.error(f"Error resetting password: {str(e)}")
            raise ValidationError({'general': [f'Error al resetear contraseña: {str(e)}']})

    @staticmethod
    def get_user_stats():
        """Obtener estadísticas de usuarios"""
        try:
            total_users = User.objects.count()
            active_users = User.objects.filter(is_active=True).count()
            pending_users = Profile.objects.filter(status='PENDIENTE').count()
            inactive_users = Profile.objects.filter(status='INACTIVO').count()

            return {
                'total': total_users,
                'active': active_users,
                'pending': pending_users,
                'inactive': inactive_users,
                'activation_rate': round((active_users / total_users * 100) if total_users > 0 else 0, 2)
            }

        except Exception as e:
            logger.error(f"Error getting user stats: {str(e)}")
            return {
                'total': 0,
                'active': 0,
                'pending': 0,
                'inactive': 0,
                'activation_rate': 0
            }

    # ========== MÉTODOS DE NOTIFICACIÓN ==========

    @staticmethod
    def notify_user_created(user, created_by=None):
        """Notificar creación de nuevo usuario"""
        try:
            from apps.notification.services import notification_service
            from apps.notification.models import TipoNotificacion

            mensaje = f"Nuevo usuario creado: {user.get_full_name() or user.username}"

            return notification_service.enviar_notificacion_roles(
                roles=[Role.ADMINISTRADOR_SISTEMA, Role.GERENTE_COMPRAS],
                mensaje=mensaje,
                titulo="Nuevo Usuario Registrado",
                tipo=TipoNotificacion.USUARIO_CREADO,
                icono='ri-user-add-line',
                color='info',
                url_accion=f'/admin/users/{user.id}/',
                datos_adicionales={
                    'user_id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'full_name': user.get_full_name(),
                    'created_by': created_by.username if created_by else 'Sistema'
                },
                enviado_por=created_by
            )
        except Exception as e:
            logger.error(f"Error sending user creation notification: {str(e)}")

    @staticmethod
    def notify_user_status_changed(user, old_status, new_status, changed_by):
        """Notificar cambio de estado de usuario"""
        try:
            from apps.notification.services import notification_service
            from apps.notification.models import TipoNotificacion

            status_messages = {
                'PENDIENTE': 'pendiente de activación',
                'ACTIVO': 'activo',
                'INACTIVO': 'inactivo'
            }

            mensaje = f"Usuario {user.get_full_name() or user.username} cambió de {status_messages.get(old_status, old_status)} a {status_messages.get(new_status, new_status)}"

            # Determinar color según el nuevo estado
            color_map = {
                'ACTIVO': 'success',
                'INACTIVO': 'warning',
                'PENDIENTE': 'info'
            }

            return notification_service.enviar_notificacion_roles(
                roles=[Role.ADMINISTRADOR_SISTEMA, Role.GERENTE_COMPRAS],
                mensaje=mensaje,
                titulo="Estado de Usuario Actualizado",
                tipo=TipoNotificacion.USUARIO_ESTADO_CAMBIADO,
                icono='ri-user-settings-line',
                color=color_map.get(new_status, 'info'),
                url_accion=f'/admin/users/{user.id}/',
                datos_adicionales={
                    'user_id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'full_name': user.get_full_name(),
                    'old_status': old_status,
                    'new_status': new_status,
                    'changed_by': changed_by.username if changed_by else 'Sistema'
                },
                enviado_por=changed_by
            )
        except Exception as e:
            logger.error(f"Error sending status change notification: {str(e)}")

    @staticmethod
    def notify_user_updated(user, updated_by):
        """Notificar actualización de usuario"""
        try:
            from apps.notification.services import notification_service
            from apps.notification.models import TipoNotificacion

            mensaje = f"Usuario {user.get_full_name() or user.username} ha sido actualizado"

            return notification_service.enviar_notificacion_roles(
                roles=[Role.ADMINISTRADOR_SISTEMA],
                mensaje=mensaje,
                titulo="Usuario Actualizado",
                tipo=TipoNotificacion.SISTEMA,
                icono='ri-user-settings-line',
                color='info',
                url_accion=f'/admin/users/{user.id}/',
                datos_adicionales={
                    'user_id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'full_name': user.get_full_name(),
                    'updated_by': updated_by.username if updated_by else 'Sistema'
                },
                enviado_por=updated_by
            )
        except Exception as e:
            logger.error(f"Error sending user update notification: {str(e)}")

    @staticmethod
    def notify_password_reset(user, reset_by):
        """Notificar reset de contraseña"""
        try:
            from apps.notification.services import notification_service
            from apps.notification.models import TipoNotificacion

            mensaje = f"Contraseña reseteada para usuario {user.get_full_name() or user.username}"

            return notification_service.enviar_notificacion_roles(
                roles=[Role.ADMINISTRADOR_SISTEMA],
                mensaje=mensaje,
                titulo="Contraseña Reseteada",
                tipo=TipoNotificacion.SISTEMA,
                icono='ri-lock-password-line',
                color='warning',
                url_accion=f'/admin/users/{user.id}/',
                datos_adicionales={
                    'user_id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'full_name': user.get_full_name(),
                    'reset_by': reset_by.username if reset_by else 'Sistema'
                },
                enviado_por=reset_by
            )
        except Exception as e:
            logger.error(f"Error sending password reset notification: {str(e)}")

    @staticmethod
    def notify_user_login(user, login_info=None):
        """Notificar inicio de sesión (opcional, para auditoría)"""
        try:
            from apps.notification.services import notification_service
            from apps.notification.models import TipoNotificacion

            # Solo notificar para roles administrativos o si es el primer login
            if user.profile.role in [Role.ADMINISTRADOR_SISTEMA, Role.GERENTE_COMPRAS] or user.last_login is None:
                mensaje = f"Inicio de sesión: {user.get_full_name() or user.username}"

                datos_adicionales = {
                    'user_id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'full_name': user.get_full_name(),
                    'login_time': timezone.now().isoformat()
                }

                if login_info:
                    datos_adicionales.update(login_info)

                return notification_service.enviar_notificacion_roles(
                    roles=[Role.ADMINISTRADOR_SISTEMA],
                    mensaje=mensaje,
                    titulo="Inicio de Sesión" + (" - Primer acceso" if user.last_login is None else ""),
                    tipo=TipoNotificacion.SISTEMA,
                    icono='ri-login-circle-line',
                    color='success' if user.last_login is None else 'info',
                    url_accion=f'/admin/users/{user.id}/',
                    datos_adicionales=datos_adicionales
                )
        except Exception as e:
            logger.error(f"Error sending login notification: {str(e)}")

    # ========== MÉTODOS DE UTILIDAD ==========

    @staticmethod
    def bulk_create_users(users_data, created_by=None):
        """Crear múltiples usuarios en lote"""
        created_users = []
        errors = []

        for index, user_data in enumerate(users_data):
            try:
                user = UserService.create_user(
                    email=user_data.get('email'),
                    nombre=user_data.get('nombre'),
                    apellidos=user_data.get('apellidos'),
                    dni=user_data.get('dni'),
                    fecha_nacimiento=user_data.get('fecha_nacimiento'),
                    genero=user_data.get('genero'),
                    created_by=created_by
                )
                created_users.append(user)
            except ValidationError as e:
                errors.append({
                    'index': index,
                    'data': user_data,
                    'errors': e.message_dict
                })
            except Exception as e:
                errors.append({
                    'index': index,
                    'data': user_data,
                    'errors': {'general': [str(e)]}
                })

        return {
            'created_users': created_users,
            'errors': errors,
            'success_count': len(created_users),
            'error_count': len(errors)
        }

    @staticmethod
    def export_users_data(format='csv'):
        """Exportar datos de usuarios"""
        try:
            users = User.objects.select_related('profile').all()

            data = []
            for user in users:
                profile = user.profile
                data.append({
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'nombre': user.first_name,
                    'apellidos': user.last_name,
                    'dni': profile.dni if profile else '',
                    'fecha_nacimiento': profile.fecha_nacimiento.isoformat() if profile and profile.fecha_nacimiento else '',
                    'genero': profile.genero if profile else '',
                    'status': profile.status if profile else 'PENDIENTE',
                    'role': profile.role if profile else '',
                    'fecha_creacion': user.date_joined.isoformat(),
                    'ultimo_login': user.last_login.isoformat() if user.last_login else '',
                    'activo': user.is_active
                })

            return data

        except Exception as e:
            logger.error(f"Error exporting users data: {str(e)}")
            return []
