# auth/management/commands/fix_role_groups.py
from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
from django.db import transaction, IntegrityError
from ...models import Role, RolePermissionConfig

class Command(BaseCommand):
    help = 'Corregir grupos duplicados y configurar roles correctamente'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clean',
            action='store_true',
            help='Limpiar grupos duplicados',
        )
        parser.add_argument(
            '--setup',
            action='store_true',
            help='Configurar roles desde cero',
        )
        parser.add_argument(
            '--list',
            action='store_true',
            help='Listar grupos actuales',
        )

    def handle(self, *args, **options):
        if options['list']:
            self.list_current_groups()
            return

        if options['clean']:
            self.clean_duplicate_groups()

        if options['setup']:
            self.setup_roles_from_scratch()

        if not any(options.values()):
            self.stdout.write(self.style.WARNING(
                'Uso: python manage.py fix_role_groups --clean --setup'
            ))

    def list_current_groups(self):
        """Listar todos los grupos actuales"""
        self.stdout.write(self.style.SUCCESS('=== GRUPOS ACTUALES ==='))

        groups = Group.objects.all().order_by('name')
        for group in groups:
            permissions_count = group.permissions.count()
            users_count = group.user_set.count()

            self.stdout.write(f'📁 {group.name}:')
            self.stdout.write(f'   └─ {permissions_count} permisos, {users_count} usuarios')

        self.stdout.write(f'\n📊 Total: {groups.count()} grupos')

        # Mostrar configuraciones de roles
        self.stdout.write(self.style.SUCCESS('\n=== CONFIGURACIONES DE ROLES ==='))
        role_configs = RolePermissionConfig.objects.all()
        for config in role_configs:
            self.stdout.write(f'🎭 {config.role} -> Grupo: {config.group.name}')

    def clean_duplicate_groups(self):
        """Limpiar grupos duplicados y huérfanos"""
        self.stdout.write(self.style.SUCCESS('Limpiando grupos duplicados...'))

        with transaction.atomic():
            # 1. Eliminar configuraciones de roles existentes
            deleted_configs = RolePermissionConfig.objects.all().delete()
            if deleted_configs[0] > 0:
                self.stdout.write(f'  ✓ Eliminadas {deleted_configs[0]} configuraciones de roles')

            # 2. Eliminar grupos relacionados con roles
            role_groups = Group.objects.filter(name__startswith='Grupo_')
            deleted_groups = role_groups.delete()
            if deleted_groups[0] > 0:
                self.stdout.write(f'  ✓ Eliminados {deleted_groups[0]} grupos de roles')

            # 3. Eliminar grupos duplicados en general
            seen_names = set()
            for group in Group.objects.all():
                if group.name in seen_names:
                    group.delete()
                    self.stdout.write(f'  ✓ Eliminado grupo duplicado: {group.name}')
                else:
                    seen_names.add(group.name)

        self.stdout.write(self.style.SUCCESS('Limpieza completada.'))

    def setup_roles_from_scratch(self):
        """Configurar roles desde cero"""
        self.stdout.write(self.style.SUCCESS('Configurando roles desde cero...'))

        # Configuración de permisos por rol
        role_permissions = {
            Role.ADMINISTRADOR_SISTEMA: [
                # Permisos básicos de usuarios de Django
                'add_user', 'change_user', 'delete_user', 'view_user',

                # Si tienes permisos personalizados, agrégalos aquí
                # 'manage_user_permissions', 'reset_user_passwords', etc.
            ],

            Role.GERENTE_COMPRAS: [
                'view_user',
                # Agregar permisos específicos de compras aquí
            ],

            Role.PLANIFICADOR_COMPRAS: [
                'view_user',
                # Permisos básicos aquí
            ]
        }

        with transaction.atomic():
            for role, permission_codenames in role_permissions.items():
                try:
                    # Crear grupo único para el rol
                    group_name = f"Grupo_{role}"
                    group, group_created = Group.objects.get_or_create(name=group_name)

                    if group_created:
                        self.stdout.write(f'  ✓ Creado grupo: {group_name}')
                    else:
                        self.stdout.write(f'  - Grupo existente: {group_name}')

                    # Crear configuración del rol
                    role_config, config_created = RolePermissionConfig.objects.get_or_create(
                        role=role,
                        defaults={
                            'group': group,
                            'description': f'Permisos para {dict(Role.choices)[role]}'
                        }
                    )

                    if config_created:
                        self.stdout.write(f'  ✓ Creada configuración para: {role}')
                    else:
                        self.stdout.write(f'  - Configuración existente para: {role}')

                    # Limpiar permisos actuales del grupo
                    group.permissions.clear()

                    # Asignar permisos
                    permissions_added = 0
                    for codename in permission_codenames:
                        try:
                            permission = Permission.objects.get(codename=codename)
                            group.permissions.add(permission)
                            permissions_added += 1
                        except Permission.DoesNotExist:
                            self.stdout.write(
                                self.style.WARNING(f'    ⚠ Permiso no encontrado: {codename}')
                            )

                    self.stdout.write(f'    → {permissions_added} permisos asignados')

                except IntegrityError as e:
                    self.stdout.write(
                        self.style.ERROR(f'  ✗ Error con rol {role}: {str(e)}')
                    )

        self.stdout.write(self.style.SUCCESS('Configuración de roles completada.'))

        # Sincronizar usuarios existentes
        self.sync_existing_users()

    def sync_existing_users(self):
        """Sincronizar usuarios existentes con sus grupos de rol"""
        self.stdout.write(self.style.SUCCESS('Sincronizando usuarios existentes...'))

        from django.contrib.auth.models import User

        synced_count = 0
        error_count = 0

        for user in User.objects.select_related('profile').all():
            try:
                if hasattr(user, 'profile') and user.profile:
                    # Remover de todos los grupos de roles
                    role_groups = Group.objects.filter(name__startswith='Grupo_')
                    user.groups.remove(*role_groups)

                    # Asignar al grupo del rol actual
                    try:
                        role_config = RolePermissionConfig.objects.get(
                            role=user.profile.role
                        )
                        user.groups.add(role_config.group)
                        synced_count += 1

                    except RolePermissionConfig.DoesNotExist:
                        self.stdout.write(
                            self.style.WARNING(
                                f'  ⚠ No hay configuración para el rol: {user.profile.role} (usuario: {user.username})'
                            )
                        )
                        error_count += 1

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'  ✗ Error con usuario {user.username}: {str(e)}')
                )
                error_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Sincronización completada: {synced_count} usuarios sincronizados'
            )
        )

        if error_count > 0:
            self.stdout.write(
                self.style.WARNING(f'{error_count} usuarios con errores')
            )
