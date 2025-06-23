# auth/permissions/views.py
from django.views.generic import TemplateView
from django.contrib.auth.mixins import PermissionRequiredMixin
from django.contrib.auth.models import User, Permission, Group
from django.contrib.contenttypes.models import ContentType
from django.http import JsonResponse
from django.db import transaction, IntegrityError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from web_project import TemplateLayout
from auth.models import Role, RolePermissionConfig
import json
import logging

logger = logging.getLogger(__name__)

class RolePermissionsView(PermissionRequiredMixin, TemplateView):
    """Vista principal para gestión de permisos por roles"""

    template_name = "auth/role_permissions.html"
    permission_required = (
        "auth.view_user",
        "auth.change_user",
    )

    def get_context_data(self, **kwargs):
        context = TemplateLayout.init(self, super().get_context_data(**kwargs))

        # Obtener configuraciones de roles existentes
        context['role_configs'] = RolePermissionConfig.objects.select_related('group').all()

        # Obtener módulos de permisos organizados
        context['permission_modules'] = self.get_permission_modules()

        # Roles disponibles
        context['available_roles'] = Role.choices

        return context

    def get_permission_modules(self):
        """Organizar permisos por módulos - filtrar los innecesarios"""
        modules = {}

        # Apps que NO queremos mostrar
        excluded_apps = ['admin', 'sessions', 'contenttypes', 'auth', 'authtoken']

        # Permisos específicos que NO queremos mostrar
        excluded_permissions = [
            'add_permission', 'change_permission', 'delete_permission', 'view_permission',
            'add_contenttype', 'change_contenttype', 'delete_contenttype', 'view_contenttype',
            'add_session', 'change_session', 'delete_session', 'view_session',
            'add_logentry', 'change_logentry', 'delete_logentry', 'view_logentry',
            'add_group', 'change_group', 'delete_group', 'view_group',
        ]

        # Mapeo de nombres de apps a nombres más amigables
        app_name_mapping = {
            'ecommerce': 'E-Commerce',
            'notification': 'Notificaciones',
            'my_calendar': 'Calendario',
            'invoice': 'Facturación',
            'logistics': 'Logística',
            'academy': 'Academia',
        }

        # Obtener content types filtrados
        content_types = ContentType.objects.exclude(
            app_label__in=excluded_apps
        ).order_by('app_label', 'model')

        for ct in content_types:
            app_name = ct.app_label
            if app_name not in modules:
                modules[app_name] = {
                    'name': app_name_mapping.get(app_name, app_name.title().replace('_', ' ')),
                    'permissions': [],
                    'icon': self.get_module_icon(app_name),
                    'color': self.get_module_color(app_name)
                }

            # Obtener permisos filtrados para este content type
            permissions = Permission.objects.filter(
                content_type=ct
            ).exclude(
                codename__in=excluded_permissions
            ).order_by('codename')

            for perm in permissions:
                # El nombre del permiso ya debería venir en español desde la BD
                # Solo usamos el nombre tal como está almacenado
                modules[app_name]['permissions'].append({
                    'id': perm.id,
                    'codename': perm.codename,
                    'name': perm.name,  # Usar directamente el nombre del permiso
                    'content_type': ct.model,
                    'module': app_name
                })

        # Remover módulos vacíos
        modules = {k: v for k, v in modules.items() if v['permissions']}

        return modules

    def get_model_verbose_name(self, content_type):
        """Obtener el nombre verbose del modelo si está disponible"""
        try:
            model_class = content_type.model_class()
            if model_class and hasattr(model_class, '_meta'):
                return model_class._meta.verbose_name
        except:
            pass
        return content_type.model.replace('_', ' ').title()

    def get_module_icon(self, app_name):
        """Obtener icono según el módulo"""
        icons = {
            'ecommerce': 'ri-shopping-cart-line',
            'products': 'ri-shopping-bag-line',
            'suppliers': 'ri-building-line',
            'purchasing': 'ri-shopping-cart-2-line',
            'requirements': 'ri-file-list-line',
            'cotizacion': 'ri-file-text-line',
            'customers': 'ri-user-line',
            'sales': 'ri-money-dollar-circle-line',
            'notification': 'ri-notification-3-line',
            'invoice': 'ri-file-text-line',
            'logistics': 'ri-truck-line',
            'academy': 'ri-graduation-cap-line',
            'my_calendar': 'ri-calendar-line',
        }
        return icons.get(app_name, 'ri-settings-3-line')

    def get_module_color(self, app_name):
        """Obtener color según el módulo"""
        colors = {
            'ecommerce': 'primary',
            'products': 'success',
            'suppliers': 'warning',
            'purchasing': 'info',
            'requirements': 'secondary',
            'notification': 'danger',
            'invoice': 'dark',
            'logistics': 'primary',
            'academy': 'success',
            'my_calendar': 'info',
        }
        return colors.get(app_name, 'secondary')

class RolePermissionsAPIView(APIView):
    """API para obtener permisos de un rol específico"""

    def get(self, request, *args, **kwargs):
        try:
            # Obtener el role_code de los kwargs
            role_code = kwargs.get('role_code', kwargs.get('role'))

            # Validar que el rol existe en las opciones válidas
            valid_roles = [choice[0] for choice in Role.choices]
            if role_code not in valid_roles:
                return Response({
                    'success': False,
                    'error': f'Rol no válido. Roles válidos: {", ".join(valid_roles)}'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Obtener o crear configuración del rol de forma segura
            with transaction.atomic():
                try:
                    role_config = RolePermissionConfig.objects.get(role=role_code)
                except RolePermissionConfig.DoesNotExist:
                    # Crear grupo único
                    group_name = f"Grupo_{role_code}"
                    try:
                        group = Group.objects.get(name=group_name)
                    except Group.DoesNotExist:
                        group = Group.objects.create(name=group_name)

                    # Crear configuración del rol
                    role_config = RolePermissionConfig.objects.create(
                        role=role_code,
                        group=group,
                        description=f"Permisos para {dict(Role.choices)[role_code]}"
                    )

            # Obtener permisos del rol con información del módulo
            permissions_data = []
            permissions = role_config.group.permissions.all().select_related('content_type')

            for perm in permissions:
                permissions_data.append({
                    'id': perm.id,
                    'codename': perm.codename,
                    'name': perm.name,
                    'module': perm.content_type.app_label,
                    'content_type': perm.content_type.model
                })

            # Contar usuarios con este rol
            users_count = User.objects.filter(profile__role=role_code).count()

            return Response({
                'success': True,
                'data': {
                    'role': role_code,
                    'role_display': dict(Role.choices)[role_code],
                    'permissions': permissions_data,
                    'users_count': users_count,
                    'description': role_config.description
                }
            })

        except Exception as e:
            logger.error(f"Error getting role permissions for {role_code}: {str(e)}")
            return Response({
                'success': False,
                'error': f'Error interno: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UpdateRolePermissionsAPIView(APIView):
    """API para actualizar permisos de un rol"""

    def post(self, request, *args, **kwargs):
        """Manejar peticiones POST"""
        return self._update_permissions(request)

    def put(self, request, *args, **kwargs):
        """Manejar peticiones PUT"""
        return self._update_permissions(request)

    def patch(self, request, *args, **kwargs):
        """Manejar peticiones PATCH"""
        return self._update_permissions(request)

    def _update_permissions(self, request):
        """Lógica común para actualizar permisos"""
        try:
            # Obtener datos del request
            data = request.data if hasattr(request, 'data') else json.loads(request.body)

            role = data.get('role')
            permission_ids = data.get('permission_ids', [])

            # Log para debug
            logger.info(f"Updating permissions for role: {role}")
            logger.info(f"Permission IDs: {permission_ids}")
            logger.info(f"Request method: {request.method}")

            # Validar rol
            valid_roles = [choice[0] for choice in Role.choices]
            if not role or role not in valid_roles:
                return Response({
                    'success': False,
                    'error': f'Rol no válido. Roles válidos: {", ".join(valid_roles)}'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validar que permission_ids sea una lista
            if not isinstance(permission_ids, list):
                return Response({
                    'success': False,
                    'error': 'permission_ids debe ser una lista'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Convertir IDs a enteros
            try:
                permission_ids = [int(pid) for pid in permission_ids]
            except (ValueError, TypeError):
                return Response({
                    'success': False,
                    'error': 'Los IDs de permisos deben ser números'
                }, status=status.HTTP_400_BAD_REQUEST)

            with transaction.atomic():
                # Obtener o crear configuración del rol
                try:
                    role_config = RolePermissionConfig.objects.get(role=role)
                except RolePermissionConfig.DoesNotExist:
                    # Crear grupo único
                    group_name = f"Grupo_{role}"
                    group, created = Group.objects.get_or_create(name=group_name)

                    role_config = RolePermissionConfig.objects.create(
                        role=role,
                        group=group,
                        description=f"Permisos para {dict(Role.choices)[role]}"
                    )

                # Validar que los permisos existen
                if permission_ids:  # Solo validar si hay IDs
                    permissions = Permission.objects.filter(id__in=permission_ids)
                    found_ids = list(permissions.values_list('id', flat=True))
                    invalid_ids = [pid for pid in permission_ids if pid not in found_ids]

                    if invalid_ids:
                        return Response({
                            'success': False,
                            'error': f'Permisos no válidos: {invalid_ids}'
                        }, status=status.HTTP_400_BAD_REQUEST)
                else:
                    # Lista vacía = remover todos los permisos
                    permissions = []

                # Actualizar permisos del rol
                role_config.group.permissions.set(permissions)

                # Contar usuarios afectados
                affected_users = User.objects.filter(profile__role=role).count()

                # Sincronizar usuarios con este rol al grupo
                users_with_role = User.objects.filter(profile__role=role)
                for user in users_with_role:
                    # Remover de otros grupos de roles
                    role_groups = Group.objects.filter(name__startswith='Grupo_')
                    user.groups.remove(*role_groups)
                    # Agregar al grupo correcto
                    user.groups.add(role_config.group)

            return Response({
                'success': True,
                'message': f'Permisos actualizados para el rol {dict(Role.choices)[role]}. {affected_users} usuarios sincronizados.',
                'affected_users': affected_users,
                'permissions_count': len(permissions) if permissions else 0
            })

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            return Response({
                'success': False,
                'error': 'Error en el formato de datos JSON'
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Error updating role permissions: {str(e)}")
            logger.error(f"Request data: {request.data if hasattr(request, 'data') else 'No data'}")
            return Response({
                'success': False,
                'error': f'Error interno: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UsersByRoleAPIView(APIView):
    """API para obtener usuarios por rol"""

    def get(self, request, *args, **kwargs):
        try:
            # Obtener el role_code de los kwargs
            role_code = kwargs.get('role_code', kwargs.get('role'))

            # Validar rol
            valid_roles = [choice[0] for choice in Role.choices]
            if role_code not in valid_roles:
                return Response({
                    'success': False,
                    'error': f'Rol no válido. Roles válidos: {", ".join(valid_roles)}'
                }, status=status.HTTP_400_BAD_REQUEST)

            users = User.objects.filter(
                profile__role=role_code
            ).select_related('profile')

            users_data = []
            for user in users:
                users_data.append({
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'full_name': user.get_full_name() or f"{user.first_name} {user.last_name}".strip(),
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'status': getattr(user.profile, 'status', 'ACTIVO'),
                    'is_active': user.is_active,
                    'date_joined': user.date_joined.isoformat() if user.date_joined else None,
                    'last_login': user.last_login.isoformat() if user.last_login else None
                })

            return Response({
                'success': True,
                'data': users_data
            })

        except Exception as e:
            logger.error(f"Error getting users by role {role_code}: {str(e)}")
            return Response({
                'success': False,
                'error': f'Error interno: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class RoleStatsAPIView(APIView):
    """API para obtener estadísticas de roles"""

    def get(self, request, *args, **kwargs):
        try:
            stats = {}

            for role_code, role_name in Role.choices:
                # Contar usuarios por rol
                total_users = User.objects.filter(profile__role=role_code).count()
                active_users = User.objects.filter(
                    profile__role=role_code,
                    profile__status='ACTIVO'
                ).count()

                # Obtener permisos del rol
                try:
                    role_config = RolePermissionConfig.objects.get(role=role_code)
                    permissions_count = role_config.group.permissions.count()
                except RolePermissionConfig.DoesNotExist:
                    permissions_count = 0

                stats[role_code] = {
                    'name': role_name,
                    'total_users': total_users,
                    'active_users': active_users,
                    'permissions_count': permissions_count
                }

            return Response({
                'success': True,
                'data': stats
            })

        except Exception as e:
            logger.error(f"Error getting role stats: {str(e)}")
            return Response({
                'success': False,
                'error': f'Error interno: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SyncUserRolesAPIView(APIView):
    """API para sincronizar usuarios con sus grupos de roles"""

    def post(self, request, *args, **kwargs):
        try:
            synced_users = 0
            errors = []

            with transaction.atomic():
                # Obtener todos los grupos de roles
                role_groups = Group.objects.filter(name__startswith='Grupo_')

                for user in User.objects.select_related('profile').all():
                    if hasattr(user, 'profile') and user.profile:
                        try:
                            # Remover de todos los grupos de roles
                            user.groups.remove(*role_groups)

                            # Obtener o crear configuración del rol del usuario
                            try:
                                role_config = RolePermissionConfig.objects.get(
                                    role=user.profile.role
                                )
                            except RolePermissionConfig.DoesNotExist:
                                # Crear configuración si no existe
                                group_name = f"Grupo_{user.profile.role}"
                                group, created = Group.objects.get_or_create(name=group_name)

                                role_config = RolePermissionConfig.objects.create(
                                    role=user.profile.role,
                                    group=group,
                                    description=f"Permisos para {dict(Role.choices)[user.profile.role]}"
                                )

                            # Asignar al grupo del rol
                            user.groups.add(role_config.group)
                            synced_users += 1

                        except Exception as e:
                            error_msg = f"Error con usuario {user.username}: {str(e)}"
                            errors.append(error_msg)
                            logger.error(error_msg)

            message = f'Se sincronizaron {synced_users} usuarios'
            if errors:
                message += f' con {len(errors)} errores'

            return Response({
                'success': True,
                'message': message,
                'synced_users': synced_users,
                'errors': errors[:5]  # Solo mostrar primeros 5 errores
            })

        except Exception as e:
            logger.error(f"Error syncing user roles: {str(e)}")
            return Response({
                'success': False,
                'error': f'Error interno: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
