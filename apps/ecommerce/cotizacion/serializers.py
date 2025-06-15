# apps/ecommerce/cotizacion/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import EnvioCotizacion, RespuestaCotizacion, DetalleRespuestaCotizacion
from apps.ecommerce.requirements.models import Requirement
from apps.ecommerce.suppliers.models import Supplier
from apps.ecommerce.products.models import Product

class EnvioCotizacionSerializer(serializers.ModelSerializer):
    # Información del proveedor
    proveedor_name = serializers.CharField(source='proveedor.company_name', read_only=True)
    proveedor_email = serializers.CharField(source='proveedor.email', read_only=True)
    proveedor_phone = serializers.CharField(source='proveedor.phone_primary', read_only=True)
    proveedor_has_email = serializers.SerializerMethodField()
    
    # Información del requerimiento
    requerimiento_numero = serializers.CharField(source='requerimiento.numero_requerimiento', read_only=True)
    requerimiento_prioridad = serializers.CharField(source='requerimiento.prioridad_display', read_only=True)
    
    # Información del usuario
    usuario_creacion_name = serializers.CharField(source='usuario_creacion.username', read_only=True)
    enviado_por_name = serializers.CharField(source='enviado_por.username', read_only=True)
    
    # Campos calculados
    numero_envio = serializers.CharField(read_only=True)
    dias_desde_envio = serializers.IntegerField(read_only=True)
    dias_hasta_respuesta = serializers.IntegerField(read_only=True)
    estado_color = serializers.CharField(read_only=True)
    metodo_envio_display = serializers.CharField(read_only=True)
    estado_display = serializers.CharField(read_only=True)
    
    class Meta:
        model = EnvioCotizacion
        fields = [
            'id', 'requerimiento', 'proveedor', 'usuario_creacion', 'enviado_por',
            'fecha_creacion', 'fecha_envio', 'metodo_envio', 'fecha_respuesta_esperada',
            'archivo_respuesta', 'estado', 'email_enviado', 'fecha_email_enviado',
            'notas_envio', 'enviado_manualmente', 'fecha_envio_manual',
            # Campos calculados y relacionados
            'proveedor_name', 'proveedor_email', 'proveedor_phone', 'proveedor_has_email',
            'requerimiento_numero', 'requerimiento_prioridad', 'usuario_creacion_name',
            'enviado_por_name', 'numero_envio', 'dias_desde_envio', 'dias_hasta_respuesta',
            'estado_color', 'metodo_envio_display', 'estado_display'
        ]
    
    def get_proveedor_has_email(self, obj):
        return bool(obj.proveedor.email and obj.proveedor.email.strip())

class EnvioCotizacionListSerializer(serializers.ModelSerializer):
    """Serializer optimizado para listados"""
    proveedor_name = serializers.CharField(source='proveedor.company_name', read_only=True)
    proveedor_email = serializers.CharField(source='proveedor.email', read_only=True)
    requerimiento_numero = serializers.CharField(source='requerimiento.numero_requerimiento', read_only=True)
    numero_envio = serializers.CharField(read_only=True)
    dias_hasta_respuesta = serializers.IntegerField(read_only=True)
    estado_color = serializers.CharField(read_only=True)
    metodo_envio_display = serializers.CharField(read_only=True)
    estado_display = serializers.CharField(read_only=True)
    
    class Meta:
        model = EnvioCotizacion
        fields = [
            'id', 'numero_envio', 'proveedor_name', 'proveedor_email',
            'requerimiento_numero', 'fecha_envio', 'metodo_envio',
            'metodo_envio_display', 'fecha_respuesta_esperada', 'estado',
            'estado_display', 'estado_color', 'dias_hasta_respuesta',
            'email_enviado', 'enviado_manualmente'
        ]

class EnvioCotizacionCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear envíos de cotización"""
    supplier_ids = serializers.ListField(
        child=serializers.IntegerField(), 
        write_only=True, 
        required=True
    )
    
    class Meta:
        model = EnvioCotizacion
        fields = [
            'requerimiento', 'fecha_respuesta_esperada', 'notas_envio', 'supplier_ids'
        ]
    
    def validate_supplier_ids(self, value):
        if not value:
            raise serializers.ValidationError("Debe seleccionar al menos un proveedor")
        
        # Verificar que existan todos los proveedores
        existing_suppliers = Supplier.objects.filter(id__in=value, is_active=True)
        if existing_suppliers.count() != len(value):
            raise serializers.ValidationError("Algunos proveedores no existen o están inactivos")
        
        return value
    
    def create(self, validated_data):
        supplier_ids = validated_data.pop('supplier_ids')
        requerimiento = validated_data['requerimiento']
        
        envios_creados = []
        for supplier_id in supplier_ids:
            supplier = Supplier.objects.get(id=supplier_id)
            
            # Verificar si ya existe un envío
            envio_existente = EnvioCotizacion.objects.filter(
                requerimiento=requerimiento,
                proveedor=supplier
            ).first()
            
            if not envio_existente:
                envio = EnvioCotizacion.objects.create(
                    **validated_data,
                    proveedor=supplier,
                    metodo_envio='email' if supplier.email else 'telefono'
                )
                envios_creados.append(envio)
        
        return envios_creados

class DetalleRespuestaCotizacionSerializer(serializers.ModelSerializer):
    producto_name = serializers.CharField(source='producto.name', read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    
    class Meta:
        model = DetalleRespuestaCotizacion
        fields = [
            'id', 'producto_code', 'producto', 'producto_name', 'precio_unitario',
            'cantidad_cotizada', 'nombre_producto_proveedor', 'marca', 'modelo',
            'tiempo_entrega_especifico', 'observaciones', 'subtotal'
        ]

class RespuestaCotizacionSerializer(serializers.ModelSerializer):
    # Información del envío
    envio_numero = serializers.CharField(source='envio.numero_envio', read_only=True)
    proveedor_name = serializers.CharField(source='envio.proveedor.company_name', read_only=True)
    
    # Detalles de la respuesta
    detalles = DetalleRespuestaCotizacionSerializer(many=True, read_only=True)
    
    # Campos calculados
    total_cotizado = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_productos = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = RespuestaCotizacion
        fields = [
            'id', 'envio', 'envio_numero', 'proveedor_name', 'fecha_respuesta',
            'terminos_pago', 'observaciones', 'tiempo_entrega', 'validez_cotizacion',
            'incluye_igv', 'detalles', 'total_cotizado', 'total_productos'
        ]

class EnvioMasivoSerializer(serializers.Serializer):
    """Serializer para envío masivo de cotizaciones"""
    requirement_id = serializers.IntegerField()
    supplier_ids = serializers.ListField(child=serializers.IntegerField())
    fecha_respuesta_esperada = serializers.DateField()
    notas_envio = serializers.CharField(required=False, allow_blank=True)
    
    def validate_requirement_id(self, value):
        try:
            requirement = Requirement.objects.get(id=value)
            if requirement.estado not in ['aprobado']:
                raise serializers.ValidationError("Solo se pueden cotizar requerimientos aprobados")
            return value
        except Requirement.DoesNotExist:
            raise serializers.ValidationError("Requerimiento no encontrado")
    
    def validate_supplier_ids(self, value):
        if len(value) == 0:
            raise serializers.ValidationError("Debe seleccionar al menos un proveedor")
        
        suppliers = Supplier.objects.filter(id__in=value, is_active=True)
        if suppliers.count() != len(value):
            raise serializers.ValidationError("Algunos proveedores no están activos")
        
        return value

class ConfirmarEnvioManualSerializer(serializers.Serializer):
    """Serializer para confirmar envío manual"""
    envio_id = serializers.IntegerField()
    metodo_envio = serializers.ChoiceField(choices=['telefono', 'whatsapp', 'otro'])
    notas = serializers.CharField(required=False, allow_blank=True)
    
    def validate_envio_id(self, value):
        try:
            envio = EnvioCotizacion.objects.get(id=value)
            if envio.estado not in ['pendiente']:
                raise serializers.ValidationError("Solo se pueden confirmar envíos pendientes")
            return value
        except EnvioCotizacion.DoesNotExist:
            raise serializers.ValidationError("Envío no encontrado")