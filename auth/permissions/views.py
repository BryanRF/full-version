# auth/views.py - Sistema de permisos por roles
from django.views.generic import TemplateView
from django.contrib.auth.mixins import PermissionRequiredMixin
from django.contrib.auth.models import User, Permission, Group
from django.contrib.contenttypes.models import ContentType
from django.http import JsonResponse
from django.db import transaction
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
        """Organizar permisos por módulos"""
        modules = {}

        # Obtener todos los content types (módulos)
        content_types = ContentType.objects.all().order_by('app_label', 'model')

        for ct in content_types:
            app_name = ct.app_label
            if app_name not in modules:
                modules[app_name] = {
                    'name': app_name.title().replace('_', ' '),
                    'permissions': [],
                    'icon': self.get_module_icon(app_name),
                    'color': self.get_module_color(app_name)
                }

            # Obtener permisos para este content type
            permissions = Permission.objects.filter(content_type=ct).order_by('codename')
            for perm in permissions:
                modules[app_name]['permissions'].append({
                    'id': perm.id,
                    'codename': perm.codename,
                    'name': perm.name,
                    'content_type': ct.model
                })

        return modules

    def get_module_icon(self, app_name):
        """Obtener icono según el módulo"""
        icons = {
            'auth': 'ri-user-settings-line',
            'admin': 'ri-admin-line',
            'contenttypes': 'ri-file-list-3-line',
            'sessions': 'ri-time-line',
            'notification': 'ri-notification-3-line',
            'compras': 'ri-shopping-cart-line',
            'inventario': 'ri-archive-line',
            'reportes': 'ri-bar-chart-line',
        }
        return icons.get(app_name, 'ri-settings-3-line')

    def get_module_color(self, app_name):
        """Obtener color según el módulo"""
        colors = {
            'auth': 'primary',
            'admin': 'danger',
            'contenttypes': 'info',
            'sessions': 'warning',
            'notification': 'success',
            'compras': 'purple',
            'inventario': 'orange',
            'reportes': 'cyan',
        }
        return colors.get(app_name, 'secondary')

class RolePermissionsAPIView(APIView):
    """API para obtener permisos de un rol específico"""

    def get(self, request, role):
        try:
            # Validar que el rol existe
            if role not in dict(Role.choices):
                return JsonResponse({
                    'success': False,
                    'error': 'Rol no válido'
                }, status=400)

            # Obtener o crear configuración del rol
            role_config, created = RolePermissionConfig.objects.get_or_create(
                role=role,
                defaults={
                    'group': Group.objects.create(name=f"Grupo_{role}"),
                    'description': f"Permisos para {dict(Role.choices)[role]}"
                }
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
            logger.error(f"Error getting role permissions: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)

class UpdateRolePermissionsAPIView(APIView):
    """API para actualizar permisos de un rol"""

    def post(self, request):
        try:
            role = request.data.get('role')
            permission_ids = request.data.get('permission_ids', [])

            if not role or role not in dict(Role.choices):
                return JsonResponse({
                    'success': False,
                    'error': 'Rol no válido'
                }, status=400)

            with transaction.atomic():
                # Obtener o crear configuración del rol
                role_config, created = RolePermissionConfig.objects.get_or_create(
                    role=role,
                    defaults={
                        'group': Group.objects.create(name=f"Grupo_{role}"),
                        'description': f"Permisos para {dict(Role.choices)[role]}"
                    }
                )

                # Actualizar permisos del rol
                permissions = Permission.objects.filter(id__in=permission_ids)
                role_config.group.permissions.set(permissions)

                # Contar usuarios afectados
                affected_users = User.objects.filter(profile__role=role).count()

            return JsonResponse({
                'success': True,
                'message': f'Permisos actualizados para el rol {dict(Role.choices)[role]}',
                'affected_users': affected_users
            })

        except Exception as e:
            logger.error(f"Error updating role permissions: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)

class UsersByRoleAPIView(APIView):
    """API para obtener usuarios por rol"""

    def get(self, request, role):
        try:
            if role not in dict(Role.choices):
                return JsonResponse({
                    'success': False,
                    'error': 'Rol no válido'
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
                    'count': users.count()
                }
            })

        except Exception as e:
            logger.error(f"Error getting users by role: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': str(e)
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
                'error': str(e)
            }, status=500)

class SyncUserRolesAPIView(APIView):
    """API para sincronizar usuarios con sus grupos de roles"""

    def post(self, request):
        try:
            synced_users = 0
            errors = []

            with transaction.atomic():
                for profile in User.objects.select_related('profile').all():
                    if hasattr(profile, 'profile') and profile.profile:
                        try:
                            # Remover de todos los grupos de roles
                            role_groups = Group.objects.filter(
                                rolepermissionconfig__isnull=False
                            )
                            profile.groups.remove(*role_groups)

                            # Asignar al grupo del rol actual
                            role_config, created = RolePermissionConfig.objects.get_or_create(
                                role=profile.profile.role,
                                defaults={
                                    'group': Group.objects.create(
                                        name=f"Grupo_{profile.profile.role}"
                                    ),
                                    'description': f"Permisos para {dict(Role.choices)[profile.profile.role]}"
                                }
                            )

                            profile.groups.add(role_config.group)
                            synced_users += 1

                        except Exception as e:
                            errors.append(f"Error con usuario {profile.username}: {str(e)}")

            return JsonResponse({
                'success': True,
                'message': f'Se sincronizaron {synced_users} usuarios',
                'synced_users': synced_users,
                'errors': errors
            })

        except Exception as e:
            logger.error(f"Error syncing user roles: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)
