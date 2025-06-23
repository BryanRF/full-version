# auth/management/commands/update_permission_names.py
from django.core.management.base import BaseCommand
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType

class Command(BaseCommand):
    help = 'Actualiza los nombres de permisos a español'

    def handle(self, *args, **options):
        # Mapeo de nombres de modelos a español
        model_names = {
            'category': 'categoría',
            'customer': 'cliente',
            'product': 'producto',
            'requirement': 'requerimiento',
            'sale': 'venta',
            'supplier': 'proveedor',
            'purchaseorder': 'orden de compra',
            'purchaseorderitem': 'item de orden de compra',
            'cotizacion': 'cotización',
            'notification': 'notificación',
            'userpermissiongroup': 'grupo de permisos de usuario',
        }

        # Prefijos de permisos
        permission_prefixes = {
            'add': 'Puede agregar',
            'change': 'Puede cambiar',
            'delete': 'Puede eliminar',
            'view': 'Puede ver',
        }

        updated_count = 0

        for content_type in ContentType.objects.all():
            # Obtener el nombre en español del modelo
            model_name_spanish = model_names.get(content_type.model, content_type.model)

            # Actualizar permisos para este content type
            permissions = Permission.objects.filter(content_type=content_type)

            for perm in permissions:
                # Determinar el prefijo
                for prefix_eng, prefix_esp in permission_prefixes.items():
                    if perm.codename.startswith(prefix_eng + '_'):
                        new_name = f"{prefix_esp} {model_name_spanish}"

                        if perm.name != new_name:
                            self.stdout.write(
                                f"Actualizando: {perm.codename} - "
                                f"'{perm.name}' -> '{new_name}'"
                            )
                            perm.name = new_name
                            perm.save()
                            updated_count += 1
                        break

        self.stdout.write(
            self.style.SUCCESS(
                f'Actualización completada. {updated_count} permisos actualizados.'
            )
        )
