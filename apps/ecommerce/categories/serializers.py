from rest_framework import serializers
from .models import Category

class CategorySerializer(serializers.ModelSerializer):
    # Campos adicionales para mantener compatibilidad con el frontend
    categories = serializers.CharField(source='name', required=False)
    category_detail = serializers.CharField(source='detail', required=False)
    cat_image = serializers.SerializerMethodField()
    
    class Meta:
        model = Category
        fields = ['id', 'name', 'detail', 'image', 'is_active', 'categories', 'category_detail', 'cat_image']
        
    def get_cat_image(self, obj):
        """Retorna solo el nombre del archivo de imagen para el frontend"""
        if obj.image:
            return obj.image.name.split('/')[-1]  # Solo el nombre del archivo
        return None
    
    def create(self, validated_data):
        # Mapear campos del frontend al modelo
        if 'categories' in validated_data:
            validated_data['name'] = validated_data.pop('categories')
        if 'category_detail' in validated_data:
            validated_data['detail'] = validated_data.pop('category_detail')
        
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Mapear campos del frontend al modelo
        if 'categories' in validated_data:
            validated_data['name'] = validated_data.pop('categories')
        if 'category_detail' in validated_data:
            validated_data['detail'] = validated_data.pop('category_detail')
            
        return super().update(instance, validated_data)