# auth/management/commands/translate_permissions.py
from django.core.management.base import BaseCommand
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.db import transaction

class Command(BaseCommand):
    help = 'Traducir permisos existentes a español'

    def handle(self, *args, **options):
        self.translate_default_permissions()
        self.update_permission_names()

    def translate_default_permissions(self):
        """Traducir los permisos por defecto de Django"""

        # Mapeo de traducciones para permisos automáticos
        permission_translations = {
            # Patrones para permisos automáticos
            'Can add': 'Puede agregar',
            'Can change': 'Puede cambiar',
            'Can delete': 'Puede eliminar',
            'Can view': 'Puede ver',

            # Nombres específicos de modelos (si usas nombres en inglés)
            'user': 'usuario',
            'group': 'grupo',
            'permission': 'permiso',
            'session': 'sesión',
            'log entry': 'entrada de log',
            'content type': 'tipo de contenido',
        }

        updated_count = 0

        with transaction.atomic():
            for permission in Permission.objects.all():
                original_name = permission.name
                new_name = original_name

                # Aplicar traducciones
                for english, spanish in permission_translations.items():
                    new_name = new_name.replace(english, spanish)

                # Si cambió, actualizar
                if new_name != original_name:
                    permission.name = new_name
                    permission.save()
                    updated_count += 1
                    self.stdout.write(f'✓ {original_name} → {new_name}')

        self.stdout.write(
            self.style.SUCCESS(f'Se tradujeron {updated_count} permisos')
        )

    def update_permission_names(self):
        """Actualizar nombres específicos de permisos"""

        # Traducciones específicas por app y modelo
        specific_translations = {
            # Permisos de User/Usuario
            'auth.add_user': 'Puede agregar usuario',
            'auth.change_user': 'Puede cambiar usuario',
            'auth.delete_user': 'Puede eliminar usuario',
            'auth.view_user': 'Puede ver usuario',

            # Permisos de Group
            'auth.add_group': 'Puede agregar grupo',
            'auth.change_group': 'Puede cambiar grupo',
            'auth.delete_group': 'Puede eliminar grupo',
            'auth.view_group': 'Puede ver grupo',

            # Agrega aquí más traducciones específicas
        }

        updated_count = 0

        for codename, spanish_name in specific_translations.items():
            try:
                app_label, perm_codename = codename.split('.')
                permission = Permission.objects.get(
                    content_type__app_label=app_label,
                    codename=perm_codename
                )

                if permission.name != spanish_name:
                    old_name = permission.name
                    permission.name = spanish_name
                    permission.save()
                    updated_count += 1
                    self.stdout.write(f'✓ {old_name} → {spanish_name}')

            except Permission.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(f'⚠ Permiso no encontrado: {codename}')
                )

        self.stdout.write(
            self.style.SUCCESS(f'Se actualizaron {updated_count} permisos específicos')
        )
