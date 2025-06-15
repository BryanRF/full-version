from rest_framework import serializers
from .models import Product
from apps.ecommerce.categories.models import Category

class ProductSerializer(serializers.ModelSerializer):
    # Campo de código único (solo lectura)
    code = serializers.CharField(read_only=True)
    
    # Campos adicionales para compatibilidad con frontend
    product_name = serializers.CharField(source='name', required=False)
    product_description = serializers.CharField(source='description', required=False)
    product_price = serializers.DecimalField(source='price', max_digits=10, decimal_places=2, required=False)
    product_discounted_price = serializers.DecimalField(source='discounted_price', max_digits=10, decimal_places=2, required=False)
    
    # Campos de inventario
    current_stock = serializers.IntegerField(source='stock_current', required=False)
    minimum_stock = serializers.IntegerField(source='stock_minimum', required=False)
    maximum_stock = serializers.IntegerField(source='stock_maximum', required=False)
    
    # Campos de organización
    product_tags = serializers.CharField(source='tags', required=False)
    
    # Información de categoría
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_id = serializers.IntegerField(source='category.id', required=False)
    
    # Campo de imagen simplificado
    product_image = serializers.SerializerMethodField()
    
    # Campos calculados
    stock_status_display = serializers.CharField(source='stock_status', read_only=True)
    in_stock = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Product
        fields = [
            'id', 'code', 'name', 'description', 'category', 'price', 
            'discounted_price', 'charge_tax', 'stock_current', 'stock_minimum', 
            'stock_maximum', 'weight', 'dimensions', 'image', 
            'tags',  'is_active', 'is_fragile', 
            'is_biodegradable', 'is_frozen', 'max_temperature', 'expiry_date',
            'created_at', 'updated_at',
            # Campos adicionales para frontend
            'product_name', 'product_description', 
            'product_price', 'product_discounted_price', 'current_stock', 
            'minimum_stock', 'maximum_stock', 
            'product_tags', 'category_name', 'category_id',
            'product_image', 'stock_status_display', 'in_stock'
        ]
        
    def get_product_image(self, obj):
        """Retorna solo el nombre del archivo de imagen para el frontend"""
        if obj.image:
            return obj.image.name.split('/')[-1]
        return None
    
    def to_representation(self, instance):
        """Personalizar la representación para incluir el código en respuestas"""
        data = super().to_representation(instance)
        # Asegurar que el código esté siempre presente
        if not data.get('code') and instance.code:
            data['code'] = instance.code
        return data
    
    def create(self, validated_data):
        # Mapear campos del frontend al modelo
        field_mapping = {
            'product_name': 'name',
            'product_description': 'description',
            'product_price': 'price',
            'product_discounted_price': 'discounted_price',
            'current_stock': 'stock_current',
            'minimum_stock': 'stock_minimum',
            'maximum_stock': 'stock_maximum',
            'product_tags': 'tags',
            'category_id': 'category',
        }
        
        for frontend_field, model_field in field_mapping.items():
            if frontend_field in validated_data:
                validated_data[model_field] = validated_data.pop(frontend_field)
        
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Mapear campos del frontend al modelo
        field_mapping = {
            'product_name': 'name',
            'product_description': 'description',
            'product_price': 'price',
            'product_discounted_price': 'discounted_price',
            'current_stock': 'stock_current',
            'minimum_stock': 'stock_minimum',
            'maximum_stock': 'stock_maximum',
            'product_tags': 'tags',
            'category_id': 'category',
        }
        
        for frontend_field, model_field in field_mapping.items():
            if frontend_field in validated_data:
                validated_data[model_field] = validated_data.pop(frontend_field)
                
        return super().update(instance, validated_data)

    def validate(self, data):
        """Validaciones adicionales"""
        # Validar stock mínimo vs máximo
        stock_min = data.get('stock_minimum', getattr(self.instance, 'stock_minimum', 0) if self.instance else 0)
        stock_max = data.get('stock_maximum', getattr(self.instance, 'stock_maximum', 100) if self.instance else 100)
        
        if stock_min > stock_max:
            raise serializers.ValidationError("El stock mínimo no puede ser mayor al stock máximo.")
        
        # Validar precio con descuento
        price = data.get('price', getattr(self.instance, 'price', 0) if self.instance else 0)
        discounted_price = data.get('discounted_price')
        
        if discounted_price and discounted_price >= price:
            raise serializers.ValidationError("El precio con descuento debe ser menor al precio regular.")
        
        return data