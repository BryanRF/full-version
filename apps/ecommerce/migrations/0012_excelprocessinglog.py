# Generated by Django 5.2.2 on 2025-06-09 06:26

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ecommerce', '0011_customer_customercontact_sale_saleitem_salepayment_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ExcelProcessingLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('archivo_nombre', models.CharField(max_length=255, verbose_name='Nombre del Archivo')),
                ('archivo_tamaño', models.PositiveIntegerField(verbose_name='Tamaño del Archivo (bytes)')),
                ('validacion_exitosa', models.BooleanField(default=False, verbose_name='Validación Exitosa')),
                ('errores_validacion', models.JSONField(default=list, verbose_name='Errores de Validación')),
                ('advertencias_validacion', models.JSONField(default=list, verbose_name='Advertencias de Validación')),
                ('procesamiento_exitoso', models.BooleanField(default=False, verbose_name='Procesamiento Exitoso')),
                ('productos_procesados', models.PositiveIntegerField(default=0, verbose_name='Productos Procesados')),
                ('productos_fallidos', models.PositiveIntegerField(default=0, verbose_name='Productos Fallidos')),
                ('total_filas', models.PositiveIntegerField(default=0, verbose_name='Total de Filas')),
                ('columnas_encontradas', models.JSONField(default=list, verbose_name='Columnas Encontradas')),
                ('estructura_valida', models.BooleanField(default=False, verbose_name='Estructura Válida')),
                ('codigos_validos', models.PositiveIntegerField(default=0, verbose_name='Códigos Válidos')),
                ('codigos_invalidos', models.PositiveIntegerField(default=0, verbose_name='Códigos Inválidos')),
                ('precios_validos', models.PositiveIntegerField(default=0, verbose_name='Precios Válidos')),
                ('precios_invalidos', models.PositiveIntegerField(default=0, verbose_name='Precios Inválidos')),
                ('tiempo_procesamiento', models.DurationField(blank=True, null=True, verbose_name='Tiempo de Procesamiento')),
                ('errores_detallados', models.TextField(blank=True, null=True, verbose_name='Errores Detallados')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Fecha de Procesamiento')),
                ('envio', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='processing_logs', to='ecommerce.enviocotizacion', verbose_name='Envío')),
                ('procesado_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL, verbose_name='Procesado Por')),
            ],
            options={
                'verbose_name': 'Log de Procesamiento Excel',
                'verbose_name_plural': 'Logs de Procesamiento Excel',
                'ordering': ['-created_at'],
            },
        ),
    ]
