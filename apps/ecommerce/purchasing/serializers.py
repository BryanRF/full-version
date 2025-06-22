
# apps/ecommerce/purchasing/serializers.py
from rest_framework import serializers
from .models import PurchaseOrder, PurchaseOrderItem
from apps.ecommerce.products.models import Product
from apps.ecommerce.suppliers.models import Supplier
from django.db.models import Avg, Sum

class PurchasingSupplierSerializer(serializers.ModelSerializer):
    """Serializer específico para suppliers en purchasing"""

    # Campos principales
    name = serializers.CharField(source='company_name', read_only=True)
    supplier_name = serializers.CharField(source='company_name', read_only=True)
    contact_person = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    phone = serializers.CharField(source='phone_primary', read_only=True)
    address = serializers.CharField(source='address_line1', read_only=True)

    # Campos adicionales para purchasing
    payment_terms = serializers.CharField(read_only=True)
    delivery_terms = serializers.CharField(read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    rating_display = serializers.CharField(read_only=True)

    # Información calculada
    total_orders = serializers.SerializerMethodField()
    total_spent = serializers.SerializerMethodField()
    last_order_date = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'supplier_name', 'contact_person', 'email', 'phone',
            'address', 'payment_terms', 'delivery_terms', 'category',
            'category_display', 'rating', 'rating_display', 'is_active',
            'is_preferred', 'total_orders', 'total_spent', 'last_order_date'
        ]

    def get_total_orders(self, obj):
        """Número total de órdenes de compra"""
        return obj.purchaseorder_set.count()

    def get_total_spent(self, obj):
        """Total gastado con este proveedor"""
        total = obj.purchaseorder_set.aggregate(
            total=Sum('total_amount')
        )['total']
        return float(total) if total else 0.0

    def get_last_order_date(self, obj):
        """Fecha de la última orden"""
        last_order = obj.purchaseorder_set.order_by('-order_date').first()
        return last_order.order_date if last_order else None

class PurchasingProductSerializer(serializers.ModelSerializer):
    """Serializer específico para productos en purchasing"""

    # Campos principales
    name = serializers.CharField(read_only=True)
    code = serializers.CharField(read_only=True)
    description = serializers.CharField(read_only=True)

    # Información de stock
    current_stock = serializers.IntegerField(source='stock_current', read_only=True)
    minimum_stock = serializers.IntegerField(source='stock_minimum', read_only=True)
    stock_status = serializers.CharField(read_only=True)

    # Información de precios
    price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    last_purchase_price = serializers.SerializerMethodField()
    average_purchase_price = serializers.SerializerMethodField()

    # Información de categoría
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_id = serializers.IntegerField(source='category.id', read_only=True)

    # Información adicional
    unit_of_measure = serializers.CharField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    # Estadísticas de compras
    total_orders = serializers.SerializerMethodField()
    last_order_date = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'code', 'description', 'current_stock', 'minimum_stock',
            'stock_status', 'price', 'last_purchase_price', 'average_purchase_price',
            'category_name', 'category_id', 'unit_of_measure', 'is_active',
            'total_orders', 'last_order_date'
        ]

    def get_last_purchase_price(self, obj):
        """Último precio de compra"""
        last_item = obj.purchaseorderitem_set.order_by('-created_at').first()
        return float(last_item.unit_price) if last_item else 0.0

    def get_average_purchase_price(self, obj):
        """Precio promedio de compra"""
        avg_price = obj.purchaseorderitem_set.aggregate(
            avg=Avg('unit_price')
        )['avg']
        return float(avg_price) if avg_price else 0.0

    def get_total_orders(self, obj):
        """Total de órdenes donde aparece este producto"""
        return obj.purchaseorderitem_set.values('purchase_order').distinct().count()

    def get_last_order_date(self, obj):
        """Fecha de la última orden"""
        last_item = obj.purchaseorderitem_set.order_by('-created_at').first()
        return last_item.purchase_order.order_date if last_item else None

class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    """Serializer para items de orden de compra"""

    # Información del producto
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)
    product_category = serializers.CharField(source='product.category.name', read_only=True)

    # Campos calculados
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    pending_quantity = serializers.IntegerField(read_only=True)
    is_fully_received = serializers.BooleanField(read_only=True)

    # Para crear/actualizar
    product_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = PurchaseOrderItem
        fields = [
            'id', 'product', 'product_id', 'product_name', 'product_code',
            'product_category', 'quantity_ordered', 'quantity_received',
            'unit_price', 'line_total', 'pending_quantity',
            'is_fully_received', 'notes', 'created_at'
        ]

    def validate_product_id(self, value):
        """Validar que el producto existe y está activo"""
        if value:
            try:
                Product.objects.get(id=value, is_active=True)
            except Product.DoesNotExist:
                raise serializers.ValidationError("Producto no encontrado o inactivo")
        return value

    def validate_quantity_ordered(self, value):
        """Validar cantidad ordenada"""
        if value <= 0:
            raise serializers.ValidationError("La cantidad debe ser mayor a 0")
        return value

    def validate_unit_price(self, value):
        """Validar precio unitario"""
        if value <= 0:
            raise serializers.ValidationError("El precio debe ser mayor a 0")
        return value


class PurchaseOrderSerializer(serializers.ModelSerializer):
    """Serializer principal para órdenes de compra"""

    # Información del proveedor
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    supplier_contact = serializers.CharField(source='supplier.contact_person', read_only=True)
    supplier_email = serializers.CharField(source='supplier.email', read_only=True)
    #tomar phone_primary o phone_secondary si phone_primary no está disponible
    supplier_phone = serializers.CharField(source='supplier.get_phone', read_only=True)

    # Información del usuario
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    # Campos calculados
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    can_edit = serializers.BooleanField(read_only=True)
    can_send = serializers.BooleanField(read_only=True)

    # Items relacionados
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    total_items = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'po_number', 'supplier', 'supplier_name', 'supplier_contact',
            'supplier_email', 'created_by', 'created_by_name', 'status', 'supplier_phone',
            'status_display', 'order_date', 'expected_delivery', 'subtotal',
            'tax_amount', 'total_amount', 'notes', 'can_edit', 'can_send',
            'items', 'total_items', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'po_number', 'order_date', 'created_by', 'created_at', 'updated_at']

    def get_total_items(self, obj):
        """Obtener total de items en la orden"""
        return obj.items.count()


class PurchaseOrderCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear órdenes de compra"""

    items = serializers.JSONField(write_only=True)
    supplier_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = PurchaseOrder
        fields = ['supplier_id', 'expected_delivery', 'notes', 'items']

    def validate_supplier_id(self, value):
        """Validar proveedor"""
        try:
            Supplier.objects.get(id=value, is_active=True)
        except Supplier.DoesNotExist:
            raise serializers.ValidationError("Proveedor no encontrado o inactivo")
        return value

    def validate_items(self, value):
        """Validar items"""
        if not value or not isinstance(value, list):
            raise serializers.ValidationError("Debe incluir al menos un item")

        if len(value) == 0:
            raise serializers.ValidationError("Debe incluir al menos un item")

        # Validar estructura de cada item
        required_fields = ['product_id', 'quantity_ordered', 'unit_price']
        product_ids = []

        for idx, item in enumerate(value):
            for field in required_fields:
                if field not in item:
                    raise serializers.ValidationError(f"Item {idx + 1}: {field} es requerido")

            # Validar producto único
            product_id = item['product_id']
            if product_id in product_ids:
                raise serializers.ValidationError("No se pueden repetir productos")
            product_ids.append(product_id)

            # Validar valores
            if item['quantity_ordered'] <= 0:
                raise serializers.ValidationError(f"Item {idx + 1}: Cantidad debe ser mayor a 0")

            if item['unit_price'] <= 0:
                raise serializers.ValidationError(f"Item {idx + 1}: Precio debe ser mayor a 0")

        return value

    def create(self, validated_data):
        """Crear orden de compra usando el service"""
        from .services import PurchaseOrderManagementService

        service = PurchaseOrderManagementService()
        created_by = self.context['request'].user

        return service.create_purchase_order(validated_data, created_by)


class PurchaseOrderListSerializer(serializers.ModelSerializer):
    """Serializer optimizado para listados"""

    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    total_items = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'po_number', 'supplier_name', 'created_by_name',
            'status', 'status_display', 'order_date', 'expected_delivery',
            'total_amount', 'total_items', 'created_at'
        ]

    def get_total_items(self, obj):
        return obj.items.count()


class ReceiveItemsSerializer(serializers.Serializer):
    """Serializer para recibir items"""

    received_items = serializers.ListField(
        child=serializers.DictField(),
        write_only=True
    )

    def validate_received_items(self, value):
        """Validar items a recibir"""
        if not value:
            raise serializers.ValidationError("Debe especificar items a recibir")

        for item in value:
            if 'item_id' not in item:
                raise serializers.ValidationError("item_id es requerido")

            if 'quantity_received' not in item:
                raise serializers.ValidationError("quantity_received es requerido")

            if item['quantity_received'] <= 0:
                raise serializers.ValidationError("Cantidad recibida debe ser mayor a 0")

        return value
