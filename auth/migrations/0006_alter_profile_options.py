# Generated by Django 5.0.6 on 2025-06-16 00:04

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_rolepermissionconfig_delete_permissionmodule_and_more'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='profile',
            options={'ordering': ['-created_at'], 'verbose_name': 'Perfil de usuarios', 'verbose_name_plural': 'Perfiles'},
        ),
    ]
