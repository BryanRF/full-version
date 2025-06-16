# auth/management/commands/clean_permissions.py
from django.core.management.base import BaseCommand
from django.contrib.auth.models import Permission, Group
from django.contrib.contenttypes.models import ContentType
from django.db import transaction

class Command(BaseCommand):
    help = 'Limpiar permisos innecesarios y mantener solo los relevantes'

    def add_arguments(self, parser):
        parser.add_argument(
            '--preview',
            action='store_true',
            help='Solo mostrar qué se eliminaría, sin eliminar',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Eliminar permisos sin confirmación',
        )

    def handle(self, *args, **options):
        if options['preview']:
            self.preview_cleanup()
        elif options['force']:
            self.clean_permissions()
        else:
            self.show_help()

    def show_help(self):
        """Mostrar ayuda sobre el comando"""
        self.stdout.write(self.style.WARNING('Opciones disponibles:'))
        self.stdout.write('  --preview    Ver qué permisos se eliminarían')
        self.stdout.write('  --force      Eliminar permisos innecesarios')
        self.stdout.write('\nEjemplos:')
        self.stdout.write('  python manage.py clean_permissions --preview')
        self.stdout.write('  python manage.py clean_permissions --force')

    def get_permissions_to_remove(self):
        """Definir qué permisos eliminar"""

        # 1. Apps completas que NO queremos
        unwanted_apps = [
            'admin',           # Django admin
            'sessions',        # Sesiones de Django
            'contenttypes',    # Content types de Django
            'transactions',    # Content types de Django
            'notification',    # Content types de Django
        ]

        # 2. Permisos específicos que NO queremos (independiente de la app)
        unwanted_permissions = [
            # Permisos de admin de Django
            'add_logentry', 'change_logentry', 'delete_logentry', 'view_logentry',

            # Permisos de auth que no necesitamos
            'add_group', 'change_group', 'delete_group', 'view_group',
            'add_permission', 'change_permission', 'delete_permission', 'view_permission',

            # Sesiones
            'add_session', 'change_session', 'delete_session', 'view_session',

            # Content types
            'add_contenttype', 'change_contenttype', 'delete_contenttype', 'view_contenttype',
            'delete_excelprocessinglog', 'view_excelprocessinglog', 'change_excelprocessinglog', 'add_excelprocessinglog',
            'delete_saleitem', 'view_saleitem', 'change_saleitem', 'add_saleitem',
            'view_purchaseorderitem', 'delete_purchaseorderitem', 'add_purchaseorderitem', 'change_purchaseorderitem',
            'add_detallerespuestacotizacion', 'change_detallerespuestacotizacion', 'view_detallerespuestacotizacion', 'delete_detallerespuestacotizacion',

        ]

        # 3. Apps que han sido eliminadas pero sus permisos siguen en la BD
        # Estas las detectamos automáticamente

        permissions_to_remove = []

        # Permisos de apps no deseadas
        for app in unwanted_apps:
            perms = Permission.objects.filter(content_type__app_label=app)
            permissions_to_remove.extend(perms)

        # Permisos específicos no deseados
        perms = Permission.objects.filter(codename__in=unwanted_permissions)
        permissions_to_remove.extend(perms)

        # Detectar apps eliminadas (content types huérfanos)
        all_content_types = ContentType.objects.all()
        orphaned_content_types = []

        for ct in all_content_types:
            try:
                # Intentar obtener el modelo
                ct.model_class()
            except:
                # Si falla, es porque la app/modelo ya no existe
                orphaned_content_types.append(ct)

        # Permisos de content types huérfanos
        for ct in orphaned_content_types:
            perms = Permission.objects.filter(content_type=ct)
            permissions_to_remove.extend(perms)

        # Remover duplicados
        permissions_to_remove = list(set(permissions_to_remove))

        return permissions_to_remove, orphaned_content_types

    def preview_cleanup(self):
        """Mostrar qué se eliminaría sin eliminar nada"""
        self.stdout.write(self.style.SUCCESS('=== VISTA PREVIA DE LIMPIEZA ===\n'))

        permissions_to_remove, orphaned_content_types = self.get_permissions_to_remove()

        if not permissions_to_remove:
            self.stdout.write(self.style.SUCCESS('✅ No hay permisos innecesarios para eliminar'))
            return

        # Agrupar por app para mostrar mejor
        apps_permissions = {}
        for perm in permissions_to_remove:
            app_label = perm.content_type.app_label
            if app_label not in apps_permissions:
                apps_permissions[app_label] = []
            apps_permissions[app_label].append(perm)

        self.stdout.write('📋 PERMISOS QUE SE ELIMINARÍAN:')
        total = 0
        for app_label, perms in apps_permissions.items():
            self.stdout.write(f'\n🗂️  {app_label.upper()}:')
            for perm in perms:
                self.stdout.write(f'   ❌ {perm.codename} - {perm.name}')
                total += 1

        if orphaned_content_types:
            self.stdout.write('\n👻 CONTENT TYPES HUÉRFANOS:')
            for ct in orphaned_content_types:
                self.stdout.write(f'   🗑️  {ct.app_label}.{ct.model}')

        self.stdout.write(f'\n📊 RESUMEN:')
        self.stdout.write(f'   • {total} permisos se eliminarían')
        self.stdout.write(f'   • {len(orphaned_content_types)} content types huérfanos')

        self.stdout.write(f'\n⚠️  Para ejecutar la limpieza: python manage.py clean_permissions --force')

    def clean_permissions(self):
        """Eliminar permisos innecesarios"""
        self.stdout.write(self.style.SUCCESS('=== LIMPIANDO PERMISOS INNECESARIOS ===\n'))

        permissions_to_remove, orphaned_content_types = self.get_permissions_to_remove()

        if not permissions_to_remove and not orphaned_content_types:
            self.stdout.write(self.style.SUCCESS('✅ No hay nada que limpiar'))
            return

        with transaction.atomic():
            # 1. Eliminar permisos
            if permissions_to_remove:
                self.stdout.write('🗑️  Eliminando permisos...')

                # Agrupar por app para mejor reporte
                apps_count = {}
                for perm in permissions_to_remove:
                    app_label = perm.content_type.app_label
                    apps_count[app_label] = apps_count.get(app_label, 0) + 1

                # Eliminar en lote
                deleted_count = len(permissions_to_remove)
                Permission.objects.filter(
                    id__in=[p.id for p in permissions_to_remove]
                ).delete()

                for app_label, count in apps_count.items():
                    self.stdout.write(f'   ✓ {app_label}: {count} permisos eliminados')

                self.stdout.write(f'   📊 Total: {deleted_count} permisos eliminados')

            # 2. Eliminar content types huérfanos
            if orphaned_content_types:
                self.stdout.write('\n🧹 Eliminando content types huérfanos...')

                for ct in orphaned_content_types:
                    self.stdout.write(f'   ✓ Eliminado: {ct.app_label}.{ct.model}')
                    ct.delete()

                self.stdout.write(f'   📊 Total: {len(orphaned_content_types)} content types eliminados')

        self.stdout.write(self.style.SUCCESS('\n✅ Limpieza completada exitosamente'))

        # Mostrar permisos restantes por app
        self.show_remaining_permissions()

    def show_remaining_permissions(self):
        """Mostrar qué permisos quedan después de la limpieza"""
        self.stdout.write(self.style.SUCCESS('\n=== PERMISOS RESTANTES ==='))

        remaining_apps = {}
        permissions = Permission.objects.select_related('content_type').order_by(
            'content_type__app_label', 'codename'
        )

        for perm in permissions:
            app_label = perm.content_type.app_label
            if app_label not in remaining_apps:
                remaining_apps[app_label] = 0
            remaining_apps[app_label] += 1

        if remaining_apps:
            for app_label, count in remaining_apps.items():
                self.stdout.write(f'📦 {app_label}: {count} permisos')

            total = sum(remaining_apps.values())
            self.stdout.write(f'\n📊 Total permisos restantes: {total}')
        else:
            self.stdout.write('⚠️  No quedan permisos en el sistema')

    def create_minimal_role_permissions(self):
        """Crear solo los permisos mínimos necesarios por rol"""
        self.stdout.write(self.style.SUCCESS('\n=== CONFIGURANDO PERMISOS MÍNIMOS POR ROL ==='))

        from ...models import Role, RolePermissionConfig

        # Permisos mínimos realmente útiles por rol
        minimal_permissions = {
            Role.ADMINISTRADOR_SISTEMA: [
                # Solo permisos de usuarios de Django
                'add_user', 'change_user', 'delete_user', 'view_user',

                # Agregar permisos de tus apps principales aquí
                # 'add_purchaseorder', 'change_purchaseorder', etc.
            ],

            Role.GERENTE_COMPRAS: [
                'view_user',
                # Permisos específicos de compras
            ],

            Role.PLANIFICADOR_COMPRAS: [
                'view_user',
                # Permisos básicos
            ]
        }

        with transaction.atomic():
            for role, permission_codenames in minimal_permissions.items():
                try:
                    # Obtener o crear grupo
                    from django.contrib.auth.models import Group
                    group_name = f"Grupo_{role}"
                    group, _ = Group.objects.get_or_create(name=group_name)

                    # Obtener o crear configuración
                    role_config, _ = RolePermissionConfig.objects.get_or_create(
                        role=role,
                        defaults={
                            'group': group,
                            'description': f'Permisos mínimos para {dict(Role.choices)[role]}'
                        }
                    )

                    # Limpiar permisos actuales
                    group.permissions.clear()

                    # Asignar solo permisos que existen
                    valid_permissions = []
                    for codename in permission_codenames:
                        try:
                            perm = Permission.objects.get(codename=codename)
                            valid_permissions.append(perm)
                        except Permission.DoesNotExist:
                            self.stdout.write(
                                self.style.WARNING(f'   ⚠️  Permiso no encontrado: {codename}')
                            )

                    group.permissions.set(valid_permissions)

                    self.stdout.write(
                        f'✓ {dict(Role.choices)[role]}: {len(valid_permissions)} permisos asignados'
                    )

                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'❌ Error configurando {role}: {str(e)}')
                    )

        self.stdout.write(self.style.SUCCESS('Configuración mínima completada'))
