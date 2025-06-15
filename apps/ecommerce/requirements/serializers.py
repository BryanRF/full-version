# apps/requirements/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Requirement, RequirementDetail
from apps.ecommerce.products.models import Product
from .services import RequirementUpdateService
from django.db import models

class RequirementDetailSerializer(serializers.ModelSerializer):
    # Información del producto
    producto_name = serializers.CharField(source='producto.name', read_only=True)
    producto_category = serializers.CharField(source='producto.category.name', read_only=True)
    producto_image = serializers.SerializerMethodField()
    producto_price = serializers.DecimalField(source='producto.price', max_digits=10, decimal_places=2, read_only=True)
    
    # Stock information
    stock_disponible = serializers.IntegerField(source='producto.stock_current', read_only=True)
    tiene_stock_suficiente = serializers.BooleanField(read_only=True)
    
    # Para crear/actualizar
    producto_id = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = RequirementDetail
        fields = [
            'id', 'producto', 'producto_id', 'cantidad_solicitada', 
            'unidad_medida', 'observaciones',
            # Campos de solo lectura
            'producto_name', 'producto_category', 'producto_image', 
            'producto_price', 'stock_disponible', 'tiene_stock_suficiente',
            'created_at', 'updated_at'
        ]
    
    def get_producto_image(self, obj):
        """Retorna la imagen del producto"""
        if obj.producto.image:
            return obj.producto.image.url
        return None
    
    def validate_cantidad_solicitada(self, value):
        """Validar que la cantidad sea mayor a 0"""
        if value <= 0:
            raise serializers.ValidationError("La cantidad debe ser mayor a 0")
        return value

class RequirementSerializer(serializers.ModelSerializer):
    # Información del usuario
    usuario_solicitante_name = serializers.CharField(source='usuario_solicitante.username', read_only=True)
    # usuario_solicitante_name = serializers.CharField(source='usuario_solicitante.get_full_name', read_only=True)
    usuario_solicitante_username = serializers.CharField(source='usuario_solicitante.username', read_only=True)
    
    # Campos calculados
    numero_requerimiento = serializers.CharField(read_only=True)
    total_productos = serializers.IntegerField(read_only=True)
    cantidad_total = serializers.IntegerField(read_only=True)
    estado_display = serializers.CharField(read_only=True)
    prioridad_display = serializers.CharField(read_only=True)
    estado_color = serializers.CharField(read_only=True)
    prioridad_color = serializers.CharField(read_only=True)
    
    # Campos de permisos
    can_edit = serializers.BooleanField(read_only=True)
    can_approve = serializers.BooleanField(read_only=True)
    can_reject = serializers.BooleanField(read_only=True)
    
    # Detalles del requerimiento
    detalles = RequirementDetailSerializer(many=True, read_only=True)
    
    # Campo para el archivo adjunto
    archivo_adjunto_url = serializers.SerializerMethodField()
    archivo_adjunto_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Requirement
        fields = [
            'id', 'usuario_solicitante', 'fecha_requerimiento', 'archivo_adjunto',
            'notas', 'prioridad', 'estado', 'created_at', 'updated_at',
            # Campos calculados
            'usuario_solicitante_name', 'usuario_solicitante_username',
            'numero_requerimiento', 'total_productos', 'cantidad_total',
            'estado_display', 'prioridad_display', 'estado_color', 'prioridad_color',
            'can_edit', 'can_approve', 'can_reject',
            # Relaciones
            'detalles', 'archivo_adjunto_url', 'archivo_adjunto_name'
        ]
    
    def get_archivo_adjunto_url(self, obj):
        """Retorna la URL del archivo adjunto"""
        if obj.archivo_adjunto:
            return obj.archivo_adjunto.url
        return None
    
    def get_archivo_adjunto_name(self, obj):
        """Retorna el nombre del archivo adjunto"""
        if obj.archivo_adjunto:
            return obj.archivo_adjunto.name.split('/')[-1]
        return None
    
    def validate_fecha_requerimiento(self, value):
        """Validar que la fecha no sea en el pasado"""
        from datetime import date
        if value < date.today():
            raise serializers.ValidationError("La fecha requerida no puede ser en el pasado")
        return value

class RequirementCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear requerimientos con detalles"""
    detalles = serializers.JSONField(write_only=True)
    
    class Meta:
        model = Requirement
        fields = [
            'usuario_solicitante', 'fecha_requerimiento', 'archivo_adjunto',
            'notas', 'prioridad', 'detalles'
        ]
    
    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles', [])
        
        # Parsear detalles si viene como string JSON
        if isinstance(detalles_data, str):
            import json
            detalles_data = json.loads(detalles_data)
        
        requirement = Requirement.objects.create(**validated_data)
        
        # Crear los detalles
        for detalle_data in detalles_data:
            producto_id = detalle_data.get('producto_id')
            if not producto_id:
                raise serializers.ValidationError("producto_id es requerido en cada detalle")
            
            try:
                producto = Product.objects.get(id=producto_id)
            except Product.DoesNotExist:
                raise serializers.ValidationError(f"Producto con ID {producto_id} no existe")
            
            RequirementDetail.objects.create(
                requerimiento=requirement,
                producto=producto,
                cantidad_solicitada=detalle_data.get('cantidad_solicitada', 1),
                unidad_medida=detalle_data.get('unidad_medida', 'unidad'),
                observaciones=detalle_data.get('observaciones', '')
            )
        
        return requirement
    
    def validate_detalles(self, value):
        """Validar que haya al menos un detalle"""
        # Parsear si viene como string
        if isinstance(value, str):
            import json
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                raise serializers.ValidationError("Formato JSON inválido en detalles")
        
        if not value or len(value) == 0:
            raise serializers.ValidationError("Debe incluir al menos un producto")
        
        # Validar que no haya productos duplicados
        productos_ids = []
        for detalle in value:
            producto_id = detalle.get('producto_id')
            if not producto_id:
                raise serializers.ValidationError("producto_id es requerido en cada detalle")
            
            if producto_id in productos_ids:
                raise serializers.ValidationError("No se pueden repetir productos en el mismo requerimiento")
            productos_ids.append(producto_id)
            
            # Validar cantidad
            cantidad = detalle.get('cantidad_solicitada', 1)
            if cantidad <= 0:
                raise serializers.ValidationError("La cantidad solicitada debe ser mayor a 0")
        
        return value

class RequirementListSerializer(serializers.ModelSerializer):
    """Serializer optimizado para listados"""
    usuario_solicitante_name = serializers.CharField(source='usuario_solicitante.username', read_only=True)
    numero_requerimiento = serializers.CharField(read_only=True)
    total_productos = serializers.IntegerField(read_only=True)
    cantidad_total = serializers.IntegerField(read_only=True)
    estado_display = serializers.CharField(read_only=True)
    prioridad_display = serializers.CharField(read_only=True)
    estado_color = serializers.CharField(read_only=True)
    prioridad_color = serializers.CharField(read_only=True)
    
    class Meta:
        model = Requirement
        fields = [
            'id', 'numero_requerimiento', 'usuario_solicitante_name',
            'fecha_requerimiento', 'prioridad', 'prioridad_display', 'prioridad_color',
            'estado', 'estado_display', 'estado_color',
            'total_productos', 'cantidad_total', 'created_at'
        ]
class RequirementUpdateSerializer(serializers.ModelSerializer):
    """Serializer para actualizar requerimientos completos con detalles"""
    detalles = serializers.JSONField(write_only=True, required=False)
    
    # Campos de solo lectura para respuesta
    numero_requerimiento = serializers.CharField(read_only=True)
    total_productos = serializers.IntegerField(read_only=True)
    cantidad_total = serializers.IntegerField(read_only=True)
    estado_display = serializers.CharField(read_only=True)
    prioridad_display = serializers.CharField(read_only=True)
    can_edit = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Requirement
        fields = [
            'id', 'fecha_requerimiento', 'archivo_adjunto', 'notas', 
            'prioridad', 'detalles',
            # Campos de solo lectura
            'numero_requerimiento', 'total_productos', 'cantidad_total',
            'estado_display', 'prioridad_display', 'can_edit',
            'created_at', 'updated_at'
        ]
    
    def validate(self, data):
        """Validación completa del requerimiento"""
        if not self.instance:
            raise serializers.ValidationError("Se requiere una instancia para actualizar")
        
        # Usar el servicio para validar
        service = RequirementUpdateService(self.instance)
        
        if not service.can_update():
            raise serializers.ValidationError(
                "Este requerimiento no puede ser editado en su estado actual"
            )
        
        errors = service.validate_update_data(data)
        if errors:
            raise serializers.ValidationError(errors)
        
        return data
    
    def validate_fecha_requerimiento(self, value):
        """Validar que la fecha no sea en el pasado"""
        from datetime import date
        if value < date.today():
            raise serializers.ValidationError("La fecha requerida no puede ser en el pasado")
        return value
    
    def validate_detalles(self, value):
        """Validar formato y contenido de detalles"""
        if value is None:
            return value
        
        # Parsear si viene como string
        if isinstance(value, str):
            import json
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                raise serializers.ValidationError("Formato JSON inválido en detalles")
        
        if not isinstance(value, list):
            raise serializers.ValidationError("Los detalles deben ser una lista")
        
        if len(value) == 0:
            raise serializers.ValidationError("Debe incluir al menos un producto")
        
        # Validar cada detalle
        productos_ids = []
        for i, detalle in enumerate(value):
            # Validar estructura del detalle
            if not isinstance(detalle, dict):
                raise serializers.ValidationError(f"Detalle {i+1} debe ser un objeto")
            
            # Validar producto_id
            producto_id = detalle.get('producto_id')
            if not producto_id:
                raise serializers.ValidationError(f"producto_id es requerido en detalle {i+1}")
            
            # Verificar que el producto existe
            try:
                Product.objects.get(id=producto_id)
            except Product.DoesNotExist:
                raise serializers.ValidationError(f"Producto con ID {producto_id} no existe")
            
            # Verificar productos únicos
            if producto_id in productos_ids:
                raise serializers.ValidationError("No se pueden repetir productos")
            productos_ids.append(producto_id)
            
            # Validar cantidad
            cantidad = detalle.get('cantidad_solicitada', 1)
            if not isinstance(cantidad, int) or cantidad <= 0:
                raise serializers.ValidationError(f"Cantidad inválida en detalle {i+1}")
        
        return value
    
    def update(self, instance, validated_data):
        """Actualizar requerimiento usando el servicio"""
        service = RequirementUpdateService(instance)
        return service.update_requirement(validated_data)

class RequirementDetailUpdateSerializer(serializers.ModelSerializer):
    """Serializer para actualizar detalles individuales"""
    
    producto_name = serializers.CharField(source='producto.name', read_only=True)
    producto_id = serializers.IntegerField(write_only=True, required=False)
    stock_disponible = serializers.IntegerField(source='producto.stock_current', read_only=True)
    
    class Meta:
        model = RequirementDetail
        fields = [
            'id', 'producto', 'producto_id', 'cantidad_solicitada', 
            'unidad_medida', 'observaciones',
            'producto_name', 'stock_disponible',
            'created_at', 'updated_at'
        ]
    
    def validate_cantidad_solicitada(self, value):
        """Validar cantidad"""
        if value <= 0:
            raise serializers.ValidationError("La cantidad debe ser mayor a 0")
        return value
    
    def validate_producto_id(self, value):
        """Validar que el producto existe"""
        if value:
            try:
                Product.objects.get(id=value)
            except Product.DoesNotExist:
                raise serializers.ValidationError("Producto no encontrado")
        return value
    
    def validate(self, data):
        """Validaciones adicionales"""
        # Si se está actualizando el producto, verificar que no sea duplicado
        producto_id = data.get('producto_id')
        if producto_id and self.instance:
            requirement = self.instance.requerimiento
            
            # Verificar si ya existe este producto en el requerimiento (excluyendo el actual)
            existing = requirement.detalles.filter(
                producto_id=producto_id
            ).exclude(id=self.instance.id)
            
            if existing.exists():
                raise serializers.ValidationError(
                    "Este producto ya está en el requerimiento"
                )
        
        return data
    
    def update(self, instance, validated_data):
        """Actualizar detalle verificando permisos"""
        requirement = instance.requerimiento
        
        if not requirement.can_edit:
            raise serializers.ValidationError(
                "No se puede modificar este requerimiento en su estado actual"
            )
        
        # Si se proporciona producto_id, actualizar el producto
        producto_id = validated_data.pop('producto_id', None)
        if producto_id:
            validated_data['producto'] = Product.objects.get(id=producto_id)
        
        return super().update(instance, validated_data)

class RequirementProductActionSerializer(serializers.Serializer):
    """Serializer para acciones sobre productos en requerimientos"""
    producto_id = serializers.IntegerField()
    cantidad_solicitada = serializers.IntegerField(default=1, min_value=1)
    unidad_medida = serializers.CharField(default='unidad', max_length=50)
    observaciones = serializers.CharField(required=False, allow_blank=True)
    
    def validate_producto_id(self, value):
        """Validar que el producto existe"""
        try:
            Product.objects.get(id=value)
        except Product.DoesNotExist:
            raise serializers.ValidationError("Producto no encontrado")
        return value
class RequirementComparisonSerializer(serializers.Serializer):
    """Serializer para mostrar comparaciones entre requerimientos"""
    requirement_id_1 = serializers.IntegerField()
    requirement_id_2 = serializers.IntegerField()
    
    def validate_requirement_id_1(self, value):
        try:
            Requirement.objects.get(id=value)
        except Requirement.DoesNotExist:
            raise serializers.ValidationError("Primer requerimiento no encontrado")
        return value
    
    def validate_requirement_id_2(self, value):
        try:
            Requirement.objects.get(id=value)
        except Requirement.DoesNotExist:
            raise serializers.ValidationError("Segundo requerimiento no encontrado")
        return value

class RequirementUpdateStatusSerializer(serializers.ModelSerializer):
    """Serializer para actualizar solo el estado"""
    
    class Meta:
        model = Requirement
        fields = ['estado', 'notas']
    
    def validate_estado(self, value):
        """Validar transiciones de estado válidas"""
        if not self.instance:
            return value
        
        current_state = self.instance.estado
        
        # Definir transiciones válidas
        valid_transitions = {
            'pendiente': ['aprobado', 'rechazado', 'cancelado'],
            'aprobado': ['en_proceso_cotizacion', 'cancelado'],
            'rechazado': ['pendiente'],
            'en_proceso_cotizacion': ['cotizado', 'cancelado'],
            'cotizado': ['orden_generada', 'cancelado'],
            'orden_generada': ['completado', 'cancelado'],
            'completado': [],
            'cancelado': ['pendiente'],
        }
        
        if value not in valid_transitions.get(current_state, []):
            valid_states = ', '.join(valid_transitions.get(current_state, []))
            raise serializers.ValidationError(
                f"No se puede cambiar de '{current_state}' a '{value}'. "
                f"Estados válidos: {valid_states}"
            )
        
        return value
    
class RequirementDetailSerializerExtended(RequirementDetailSerializer):
    """Versión extendida del serializer de detalles con más información"""
    
    # Información adicional del producto
    producto_code = serializers.CharField(source='producto.code', read_only=True)
    producto_price = serializers.DecimalField(source='producto.price', max_digits=10, decimal_places=2, read_only=True)
    producto_category_name = serializers.CharField(source='producto.category.name', read_only=True)
    
    # Información de stock con más detalle
    stock_status = serializers.CharField(source='producto.stock_status', read_only=True)
    stock_minimum = serializers.IntegerField(source='producto.stock_minimum', read_only=True)
    stock_maximum = serializers.IntegerField(source='producto.stock_maximum', read_only=True)
    
    # Validación de stock vs cantidad solicitada
    stock_suficiente = serializers.SerializerMethodField()
    diferencia_stock = serializers.SerializerMethodField()
    
    class Meta(RequirementDetailSerializer.Meta):
        fields = RequirementDetailSerializer.Meta.fields + [
            'producto_code', 'producto_price', 'producto_category_name',
            'stock_status', 'stock_minimum', 'stock_maximum',
            'stock_suficiente', 'diferencia_stock'
        ]
    
    def get_stock_suficiente(self, obj):
        """Verificar si hay stock suficiente"""
        return obj.tiene_stock_suficiente
    
    def get_diferencia_stock(self, obj):
        """Calcular diferencia entre stock disponible y cantidad solicitada"""
        return obj.stock_disponible - obj.cantidad_solicitada
    
class RequirementSerializerExtended(RequirementSerializer):
    """Versión extendida del serializer principal con detalles completos"""
    
    # Usar serializer extendido para detalles
    detalles = RequirementDetailSerializerExtended(many=True, read_only=True)
    
    # Información adicional del usuario
    usuario_solicitante_email = serializers.CharField(source='usuario_solicitante.email', read_only=True)
    usuario_solicitante_full_name = serializers.SerializerMethodField()
    
    # Estadísticas del requerimiento
    productos_con_stock_suficiente = serializers.SerializerMethodField()
    productos_sin_stock_suficiente = serializers.SerializerMethodField()
    porcentaje_stock_disponible = serializers.SerializerMethodField()
    
    # Información del archivo
    archivo_size = serializers.SerializerMethodField()
    archivo_type = serializers.SerializerMethodField()
    
    class Meta(RequirementSerializer.Meta):
        fields = RequirementSerializer.Meta.fields + [
            'usuario_solicitante_email', 'usuario_solicitante_full_name',
            'productos_con_stock_suficiente', 'productos_sin_stock_suficiente',
            'porcentaje_stock_disponible', 'archivo_size', 'archivo_type'
        ]
    
    def get_usuario_solicitante_full_name(self, obj):
        """Obtener nombre completo del usuario"""
        return obj.usuario_solicitante.get_full_name() or obj.usuario_solicitante.username
    
    def get_productos_con_stock_suficiente(self, obj):
        """Contar productos con stock suficiente"""
        return obj.detalles.filter(producto__stock_current__gte=models.F('cantidad_solicitada')).count()
    
    def get_productos_sin_stock_suficiente(self, obj):
        """Contar productos sin stock suficiente"""
        return obj.detalles.filter(
            producto__stock_current__lt=models.F('cantidad_solicitada')
        ).count()
    
    def get_porcentaje_stock_disponible(self, obj):
        """Calcular porcentaje de productos con stock disponible"""
        total = obj.detalles.count()
        if total == 0:
            return 0
        
        con_stock = self.get_productos_con_stock_suficiente(obj)
        return round((con_stock / total) * 100, 2)
    
    def get_archivo_size(self, obj):
        """Obtener tamaño del archivo en bytes"""
        if obj.archivo_adjunto:
            try:
                return obj.archivo_adjunto.size
            except:
                return None
        return None
    
    def get_archivo_type(self, obj):
        """Obtener tipo MIME del archivo"""
        if obj.archivo_adjunto:
            import mimetypes
            file_type, _ = mimetypes.guess_type(obj.archivo_adjunto.name)
            return file_type
        return None