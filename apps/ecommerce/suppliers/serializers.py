# apps/suppliers/serializers.py
from rest_framework import serializers
from .models import Supplier, SupplierContact

class SupplierContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierContact
        fields = [
            'id', 'name', 'position', 'email', 'phone', 
            'is_primary', 'notes', 'created_at'
        ]

class SupplierSerializer(serializers.ModelSerializer):
    # Campos calculados
    full_address = serializers.CharField(read_only=True)
    contact_info = serializers.CharField(read_only=True)
    rating_display = serializers.CharField(read_only=True)
    
    # Campos para compatibilidad con frontend
    supplier_name = serializers.CharField(source='company_name', required=False)
    supplier_email = serializers.EmailField(source='email', required=False)
    supplier_phone = serializers.CharField(source='phone_primary', required=False)
    supplier_address = serializers.CharField(source='address_line1', required=False)
    supplier_city = serializers.CharField(source='city', required=False)
    supplier_category = serializers.CharField(source='category', required=False)
    
    # Información de imagen
    supplier_logo = serializers.SerializerMethodField()
    
    # Contactos relacionados
    contacts = SupplierContactSerializer(many=True, read_only=True)
    contacts_count = serializers.SerializerMethodField()
    
    # Estado con texto
    status_display = serializers.SerializerMethodField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    
    class Meta:
        model = Supplier
        fields = [
            'id', 'company_name', 'legal_name', 'tax_id', 'contact_person',
            'email', 'phone_primary', 'phone_secondary', 'website',
            'address_line1', 'address_line2', 'city', 'state', 'country',
            'payment_terms', 'credit_limit', 'category', 'is_active',
            'is_preferred', 'rating', 'notes', 'logo', 'created_at', 'updated_at',
            # Campos calculados
            'full_address', 'contact_info', 'rating_display',
            # Campos de compatibilidad
            'supplier_name', 'supplier_email', 'supplier_phone', 'supplier_address',
            'supplier_city', 'supplier_category', 'supplier_logo',
            # Información adicional
            'contacts', 'contacts_count', 'status_display', 'category_display'
        ]
    
    def get_supplier_logo(self, obj):
        """Retorna solo el nombre del archivo de logo para el frontend"""
        if obj.logo:
            return obj.logo.name.split('/')[-1]
        return None
    
    def get_contacts_count(self, obj):
        """Retorna el número de contactos del proveedor"""
        return obj.contacts.count()
    
    def get_status_display(self, obj):
        """Retorna el estado del proveedor con texto descriptivo"""
        if obj.is_active:
            return "Activo" if not obj.is_preferred else "Preferido"
        return "Inactivo"
    
    def create(self, validated_data):
        # Mapear campos del frontend al modelo
        field_mapping = {
            'supplier_name': 'company_name',
            'supplier_email': 'email',
            'supplier_phone': 'phone_primary',
            'supplier_address': 'address_line1',
            'supplier_city': 'city',
            'supplier_category': 'category',
        }
        
        for frontend_field, model_field in field_mapping.items():
            if frontend_field in validated_data:
                validated_data[model_field] = validated_data.pop(frontend_field)
        
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Mapear campos del frontend al modelo
        field_mapping = {
            'supplier_name': 'company_name',
            'supplier_email': 'email',
            'supplier_phone': 'phone_primary',
            'supplier_address': 'address_line1',
            'supplier_city': 'city',
            'supplier_category': 'category',
        }
        
        for frontend_field, model_field in field_mapping.items():
            if frontend_field in validated_data:
                validated_data[model_field] = validated_data.pop(frontend_field)
                
        return super().update(instance, validated_data)

    def validate_tax_id(self, value):
        """Validar que el RUC/NIT sea único"""
        if self.instance and self.instance.tax_id == value:
            return value
        
        if Supplier.objects.filter(tax_id=value).exists():
            raise serializers.ValidationError("Ya existe un proveedor con este RUC/NIT.")
        
        return value
    
    def validate_email(self, value):
        """Validar que el email sea único"""
        if self.instance and self.instance.email == value:
            return value
        
        if Supplier.objects.filter(email=value).exists():
            raise serializers.ValidationError("Ya existe un proveedor con este email.")
        
        return value
    
    def validate(self, data):
        """Validaciones adicionales"""
        # Validar límite de crédito
        credit_limit = data.get('credit_limit', 0)
        if credit_limit < 0:
            raise serializers.ValidationError("El límite de crédito no puede ser negativo.")
        
        # Validar calificación
        rating = data.get('rating', 3)
        if rating not in [1, 2, 3, 4, 5]:
            raise serializers.ValidationError("La calificación debe estar entre 1 y 5.")
        
        return data


class SupplierCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer simplificado para crear/actualizar proveedores"""
    
    class Meta:
        model = Supplier
        fields = [
            'company_name', 'legal_name', 'tax_id', 'contact_person',
            'email', 'phone_primary', 'phone_secondary', 'website',
            'address_line1', 'address_line2', 'city', 'state', 'country',
            'payment_terms', 'credit_limit', 'category',
            'is_active', 'is_preferred', 'rating', 'notes', 'logo'
        ]
    
    def validate_tax_id(self, value):
        """Validar que el RUC/NIT sea único"""
        if self.instance and self.instance.tax_id == value:
            return value
        
        if Supplier.objects.filter(tax_id=value).exists():
            raise serializers.ValidationError("Ya existe un proveedor con este RUC/NIT.")
        
        return value


class SupplierListSerializer(serializers.ModelSerializer):
    """Serializer optimizado para listados"""
    
    rating_display = serializers.CharField(read_only=True)
    status_display = serializers.SerializerMethodField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    contacts_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Supplier
        fields = [
            'id', 'company_name', 'contact_person', 'email', 'phone_primary',
            'city', 'category', 'category_display', 'is_active', 'is_preferred',
            'rating', 'rating_display', 'status_display', 'contacts_count',
            'created_at','credit_limit'
        ]
    
    def get_status_display(self, obj):
        if obj.is_active:
            return "Activo" if not obj.is_preferred else "Preferido"
        return "Inactivo"
    
    def get_contacts_count(self, obj):
        return obj.contacts.count()
    
    def get_has_email(self, obj):
        return bool(obj.email and obj.email.strip())
    
