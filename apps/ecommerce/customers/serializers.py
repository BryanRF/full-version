# apps/ecommerce/customers/serializers.py
from rest_framework import serializers
from .models import Customer, CustomerContact

class CustomerContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerContact
        fields = [
            'id', 'name', 'position', 'email', 'phone', 
            'is_primary', 'notes', 'created_at'
        ]

class CustomerSerializer(serializers.ModelSerializer):
    # Campos calculados
    full_name = serializers.CharField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    full_address = serializers.CharField(read_only=True)
    contact_info = serializers.CharField(read_only=True)
    document_type_display = serializers.CharField(read_only=True)
    
    # Campos para compatibilidad con frontend
    customer_name = serializers.CharField(source='first_name', required=False)
    customer_lastname = serializers.CharField(source='last_name', required=False)
    customer_email = serializers.EmailField(source='email', required=False)
    customer_phone = serializers.CharField(source='phone', required=False)
    customer_document = serializers.CharField(source='document_number', required=False)
    customer_document_type = serializers.CharField(source='document_type', required=False)
    
    # Contactos relacionados
    contacts = CustomerContactSerializer(many=True, read_only=True)
    contacts_count = serializers.SerializerMethodField()
    
    # Estadísticas de ventas
    total_sales = serializers.SerializerMethodField()
    total_sales_amount = serializers.SerializerMethodField()
    last_sale_date = serializers.SerializerMethodField()
    
    class Meta:
        model = Customer
        fields = [
            'id', 'document_type', 'document_number', 'customer_type',
            'first_name', 'last_name', 'business_name', 'commercial_name',
            'email', 'phone', 'mobile_phone', 'address', 'district', 
            'province', 'department', 'sunat_status', 'sunat_condition',
            'ubigeo', 'is_active', 'is_frequent', 'credit_limit', 'notes',
            'created_at', 'updated_at',
            # Campos calculados
            'full_name', 'display_name', 'full_address', 'contact_info',
            'document_type_display',
            # Campos de compatibilidad
            'customer_name', 'customer_lastname', 'customer_email', 
            'customer_phone', 'customer_document', 'customer_document_type',
            # Información adicional
            'contacts', 'contacts_count', 'total_sales', 'total_sales_amount',
            'last_sale_date'
        ]
    
    def get_contacts_count(self, obj):
        """Retorna el número de contactos del cliente"""
        return obj.contacts.count()
    
    def get_total_sales(self, obj):
        """Retorna el número total de ventas del cliente"""
        return obj.sales.count()
    
    def get_total_sales_amount(self, obj):
        """Retorna el monto total de ventas del cliente"""
        from django.db.models import Sum
        total = obj.sales.aggregate(total=Sum('total_amount'))['total']
        return float(total) if total else 0.0
    
    def get_last_sale_date(self, obj):
        """Retorna la fecha de la última venta"""
        last_sale = obj.sales.order_by('-sale_date').first()
        return last_sale.sale_date if last_sale else None
    
    def create(self, validated_data):
        # Mapear campos del frontend al modelo
        field_mapping = {
            'customer_name': 'first_name',
            'customer_lastname': 'last_name',
            'customer_email': 'email',
            'customer_phone': 'phone',
            'customer_document': 'document_number',
            'customer_document_type': 'document_type',
        }
        
        for frontend_field, model_field in field_mapping.items():
            if frontend_field in validated_data:
                validated_data[model_field] = validated_data.pop(frontend_field)
        
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Mapear campos del frontend al modelo
        field_mapping = {
            'customer_name': 'first_name',
            'customer_lastname': 'last_name',
            'customer_email': 'email',
            'customer_phone': 'phone',
            'customer_document': 'document_number',
            'customer_document_type': 'document_type',
        }
        
        for frontend_field, model_field in field_mapping.items():
            if frontend_field in validated_data:
                validated_data[model_field] = validated_data.pop(frontend_field)
                
        return super().update(instance, validated_data)

    def validate_document_number(self, value):
        """Validar que el documento sea único"""
        if self.instance and self.instance.document_number == value:
            return value
        
        if Customer.objects.filter(document_number=value).exists():
            raise serializers.ValidationError("Ya existe un cliente con este documento.")
        
        return value
    
    def validate_email(self, value):
        """Validar que el email sea único si se proporciona"""
        if not value:
            return value
            
        if self.instance and self.instance.email == value:
            return value
        
        if Customer.objects.filter(email=value).exists():
            raise serializers.ValidationError("Ya existe un cliente con este email.")
        
        return value
    
    def validate(self, data):
        """Validaciones adicionales"""
        document_type = data.get('document_type', getattr(self.instance, 'document_type', '1'))
        document_number = data.get('document_number', getattr(self.instance, 'document_number', ''))
        
        # Validar longitud de documento según tipo
        if document_type == '1' and document_number and len(document_number) != 8:
            raise serializers.ValidationError("DNI debe tener 8 dígitos")
        elif document_type == '6' and document_number and len(document_number) != 11:
            raise serializers.ValidationError("RUC debe tener 11 dígitos")
        
        # Validar campos requeridos según tipo de cliente
        customer_type = data.get('customer_type', getattr(self.instance, 'customer_type', 'persona_natural'))
        
        if customer_type == 'persona_juridica':
            if not data.get('business_name') and not getattr(self.instance, 'business_name', None):
                raise serializers.ValidationError("Razón Social es requerida para personas jurídicas")
        else:
            if not data.get('first_name') and not getattr(self.instance, 'first_name', None):
                raise serializers.ValidationError("Nombres son requeridos para personas naturales")
        
        return data


class CustomerCreateFromDocumentSerializer(serializers.Serializer):
    """Serializer para crear cliente desde documento usando API"""
    document_number = serializers.CharField(max_length=20)
    document_type = serializers.ChoiceField(
        choices=Customer.DOCUMENT_TYPE_CHOICES,
        required=False
    )
    
    def validate_document_number(self, value):
        """Validar formato del documento"""
        value = value.strip()
        
        if not value.isdigit():
            raise serializers.ValidationError("El documento debe contener solo números")
        
        # Validar que no exista
        if Customer.objects.filter(document_number=value).exists():
            raise serializers.ValidationError("Ya existe un cliente con este documento")
        
        return value
    
    def validate(self, data):
        """Validar documento según tipo"""
        document_number = data['document_number']
        document_type = data.get('document_type')
        
        # Auto-detectar tipo si no se proporciona
        if not document_type:
            if len(document_number) == 8:
                data['document_type'] = '1'  # DNI
            elif len(document_number) == 11:
                data['document_type'] = '6'  # RUC
            else:
                raise serializers.ValidationError(
                    "No se puede determinar el tipo de documento automáticamente. "
                    "Especifique el tipo de documento."
                )
        
        return data


class CustomerListSerializer(serializers.ModelSerializer):
    """Serializer optimizado para listados"""
    
    full_name = serializers.CharField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    document_type_display = serializers.CharField(read_only=True)
    contact_info = serializers.CharField(read_only=True)
    total_sales = serializers.SerializerMethodField()
    total_sales_amount = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Customer
        fields = [
            'id', 'document_number', 'document_type', 'document_type_display',
            'full_name', 'display_name', 'customer_type', 'email', 'phone',
            'mobile_phone', 'district', 'province', 'is_active', 'is_frequent',
            'contact_info', 'total_sales', 'total_sales_amount', 'status_display',
            'created_at', 'credit_limit'
        ]
    
    def get_total_sales(self, obj):
        return getattr(obj, 'total_sales_count', 0)
    
    def get_total_sales_amount(self, obj):
        amount = getattr(obj, 'total_sales_amount', 0)
        return float(amount) if amount else 0.0
    
    def get_status_display(self, obj):
        if not obj.is_active:
            return "Inactivo"
        elif obj.is_frequent:
            return "Cliente Frecuente"
        else:
            return "Activo"


class CustomerUpdateSerializer(serializers.ModelSerializer):
    """Serializer para actualizar clientes"""
    
    class Meta:
        model = Customer
        fields = [
            'first_name', 'last_name', 'business_name', 'commercial_name',
            'email', 'phone', 'mobile_phone', 'address', 'district', 
            'province', 'department', 'is_active', 'is_frequent', 
            'credit_limit', 'notes'
        ]
    
    def validate_email(self, value):
        """Validar que el email sea único si se proporciona"""
        if not value:
            return value
            
        if self.instance and self.instance.email == value:
            return value
        
        if Customer.objects.filter(email=value).exists():
            raise serializers.ValidationError("Ya existe un cliente con este email.")
        
        return value


class CustomerQuickCreateSerializer(serializers.ModelSerializer):
    """Serializer para creación rápida de clientes en ventas"""
    
    class Meta:
        model = Customer
        fields = [
            'document_type', 'document_number', 'first_name', 'last_name',
            'business_name', 'email', 'phone', 'address'
        ]
    
    def validate_document_number(self, value):
        """Validar que el documento sea único"""
        if Customer.objects.filter(document_number=value).exists():
            raise serializers.ValidationError("Ya existe un cliente con este documento.")
        return value
    
    def validate(self, data):
        """Validar campos requeridos"""
        if data.get('document_type') == '6':  # RUC
            if not data.get('business_name'):
                raise serializers.ValidationError("Razón Social es requerida para RUC")
        else:
            if not data.get('first_name'):
                raise serializers.ValidationError("Nombres son requeridos")
        
        return data