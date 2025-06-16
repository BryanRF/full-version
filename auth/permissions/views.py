# auth/views.py - Corregido
from django.views.generic import TemplateView
from django.contrib.auth.mixins import PermissionRequiredMixin
from django.contrib.auth.models import User, Permission, Group
from django.contrib.contenttypes.models import ContentType
from django.http import JsonResponse
from django.db import transaction, IntegrityError
from rest_framework.views import APIView
from rest_framework import status
from web_project import TemplateLayout
from ..models import Role, RolePermissionConfig
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
        excluded_apps = ['admin', 'sessions', 'contenttypes']

        # Permisos específicos que NO queremos mostrar
        excluded_permissions = [
            'add_permission', 'change_permission', 'delete_permission', 'view_permission',
            'add_contenttype', 'change_contenttype', 'delete_contenttype', 'view_contenttype',
            'add_session', 'change_session', 'delete_session', 'view_session',
            'add_logentry', 'change_logentry', 'delete_logentry', 'view_logentry',
        ]

        # Obtener content types filtrados
        content_types = ContentType.objects.exclude(
            app_label__in=excluded_apps
        ).order_by('app_label', 'model')

        for ct in content_types:
            app_name = ct.app_label
            if app_name not in modules:
                modules[app_name] = {
                    'name': app_name.title().replace('_', ' '),
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
                modules[app_name]['permissions'].append({
                    'id': perm.id,
                    'codename': perm.codename,
                    'name': perm.name,
                    'content_type': ct.model
                })

        # Remover módulos vacíos
        modules = {k: v for k, v in modules.items() if v['permissions']}

        return modules

    def get_module_icon(self, app_name):
        """Obtener icono según el módulo"""
        icons = {
            'auth': 'ri-user-settings-line',
            'compras': 'ri-shopping-cart-line',
            'inventario': 'ri-archive-line',
            'reportes': 'ri-bar-chart-line',
            'notification': 'ri-notification-3-line',
        }
        return icons.get(app_name, 'ri-settings-3-line')

    def get_module_color(self, app_name):
        """Obtener color según el módulo"""
        colors = {
            'auth': 'primary',
            'compras': 'success',
            'inventario': 'warning',
            'reportes': 'info',
            'notification': 'secondary',
        }
        return colors.get(app_name, 'secondary')

class RolePermissionsAPIView(APIView):
    """API para obtener permisos de un rol específico"""

    def get(self, request, role):
        try:
            # Validar que el rol existe en las opciones válidas
            valid_roles = [choice[0] for choice in Role.choices]
            if role not in valid_roles:
                return JsonResponse({
                    'success': False,
                    'error': f'Rol no válido. Roles válidos: {", ".join(valid_roles)}'
                }, status=400)

            # Obtener o crear configuración del rol de forma segura
            with transaction.atomic():
                try:
                    role_config = RolePermissionConfig.objects.get(role=role)
                except RolePermissionConfig.DoesNotExist:
                    # Crear grupo único
                    group_name = f"Grupo_{role}"
                    try:
                        group = Group.objects.get(name=group_name)
                    except Group.DoesNotExist:
                        group = Group.objects.create(name=group_name)

                    # Crear configuración del rol
                    role_config = RolePermissionConfig.objects.create(
                        role=role,
                        group=group,
                        description=f"Permisos para {dict(Role.choices)[role]}"
                    )

            # Obtener permisos del rol
            permissions = role_config.group.permissions.all().values(
                'id', 'codename', 'name', 'content_type__app_label', 'content_type__model'
            )

            # Contar usuarios con este rol
            users_count = User.objects.filter(profile__role=role).count()

            return JsonResponse({
                'success': True,
                'data': {
                    'role': role,
                    'role_display': dict(Role.choices)[role],
                    'permissions': list(permissions),
                    'users_count': users_count,
                    'description': role_config.description
                }
            })

        except Exception as e:
            logger.error(f"Error getting role permissions for {role}: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Error interno: {str(e)}'
            }, status=500)

class UpdateRolePermissionsAPIView(APIView):
    """API para actualizar permisos de un rol"""

    def post(self, request):
        """Manejar peticiones POST"""
        return self._update_permissions(request)

    def put(self, request):
        """Manejar peticiones PUT"""
        return self._update_permissions(request)

    def patch(self, request):
        """Manejar peticiones PATCH"""
        return self._update_permissions(request)

    def _update_permissions(self, request):
        """Lógica común para actualizar permisos"""
        try:
            # Obtener datos dependiendo del Content-Type
            if hasattr(request, 'data') and request.data:
                # DRF data (cuando Content-Type es application/json)
                data = request.data
            else:
                # Fallback para otros casos
                import json
                if request.content_type == 'application/json':
                    data = json.loads(request.body.decode('utf-8'))
                else:
                    data = request.POST

            role = data.get('role')
            permission_ids = data.get('permission_ids', [])

            # Log para debug
            logger.info(f"Updating permissions for role: {role}")
            logger.info(f"Permission IDs: {permission_ids}")
            logger.info(f"Request method: {request.method}")
            logger.info(f"Content type: {request.content_type}")

            # Validar rol
            valid_roles = [choice[0] for choice in Role.choices]
            if not role or role not in valid_roles:
                return JsonResponse({
                    'success': False,
                    'error': f'Rol no válido. Roles válidos: {", ".join(valid_roles)}'
                }, status=400)

            # Validar que permission_ids sea una lista
            if not isinstance(permission_ids, list):
                return JsonResponse({
                    'success': False,
                    'error': 'permission_ids debe ser una lista'
                }, status=400)

            with transaction.atomic():
                # Obtener o crear configuración del rol
                try:
                    role_config = RolePermissionConfig.objects.get(role=role)
                except RolePermissionConfig.DoesNotExist:
                    # Crear grupo único
                    group_name = f"Grupo_{role}"
                    try:
                        group = Group.objects.get(name=group_name)
                    except Group.DoesNotExist:
                        group = Group.objects.create(name=group_name)

                    role_config = RolePermissionConfig.objects.create(
                        role=role,
                        group=group,
                        description=f"Permisos para {dict(Role.choices)[role]}"
                    )

                # Validar que los permisos existen
                if permission_ids:  # Solo validar si hay IDs
                    permissions = Permission.objects.filter(id__in=permission_ids)
                    if len(permissions) != len(permission_ids):
                        valid_ids = list(permissions.values_list('id', flat=True))
                        invalid_ids = [pid for pid in permission_ids if pid not in valid_ids]
                        return JsonResponse({
                            'success': False,
                            'error': f'Permisos no válidos: {invalid_ids}'
                        }, status=400)
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

            return JsonResponse({
                'success': True,
                'message': f'Permisos actualizados para el rol {dict(Role.choices)[role]}. {affected_users} usuarios sincronizados.',
                'affected_users': affected_users,
                'permissions_count': len(permissions)
            })

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': 'Error en el formato de datos JSON'
            }, status=400)

        except Exception as e:
            logger.error(f"Error updating role permissions: {str(e)}")
            logger.error(f"Request data: {getattr(request, 'data', 'No data')}")
            return JsonResponse({
                'success': False,
                'error': f'Error interno: {str(e)}'
            }, status=500)

class UsersByRoleAPIView(APIView):
    """API para obtener usuarios por rol"""

    def get(self, request, role):
        try:
            # Validar rol
            valid_roles = [choice[0] for choice in Role.choices]
            if role not in valid_roles:
                return JsonResponse({
                    'success': False,
                    'error': f'Rol no válido. Roles válidos: {", ".join(valid_roles)}'
                }, status=400)

            users = User.objects.filter(
                profile__role=role
            ).select_related('profile').values(
                'id', 'username', 'email', 'first_name', 'last_name',
                'profile__status', 'is_active', 'date_joined'
            )

            return JsonResponse({
                'success': True,
                'data': {
                    'role': role,
                    'role_display': dict(Role.choices)[role],
                    'users': list(users),
                    'count': len(users)
                }
            })

        except Exception as e:
            logger.error(f"Error getting users by role {role}: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Error interno: {str(e)}'
            }, status=500)

class RoleStatsAPIView(APIView):
    """API para obtener estadísticas de roles"""

    def get(self, request):
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

            return JsonResponse({
                'success': True,
                'data': stats
            })

        except Exception as e:
            logger.error(f"Error getting role stats: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Error interno: {str(e)}'
            }, status=500)

class SyncUserRolesAPIView(APIView):
    """API para sincronizar usuarios con sus grupos de roles"""

    def post(self, request):
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
                                try:
                                    group = Group.objects.get(name=group_name)
                                except Group.DoesNotExist:
                                    group = Group.objects.create(name=group_name)

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

            return JsonResponse({
                'success': True,
                'message': message,
                'synced_users': synced_users,
                'errors': errors[:5]  # Solo mostrar primeros 5 errores
            })

        except Exception as e:
            logger.error(f"Error syncing user roles: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Error interno: {str(e)}'
            }, status=500)
