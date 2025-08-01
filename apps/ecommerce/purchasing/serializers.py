# apps/ecommerce/purchasing/serializers.py
from rest_framework import serializers
from .models import PurchaseOrder, PurchaseOrderItem
from apps.ecommerce.products.models import Product
from apps.ecommerce.suppliers.models import Supplier
from django.contrib.auth.models import User
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
    """Serializer para items de orden de compra con información de recepción"""

    # Información del producto
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)
    product_description = serializers.CharField(source='product.description', read_only=True)
    product_category = serializers.CharField(source='product.category.name', read_only=True)

    # Campos calculados
    line_total = serializers.SerializerMethodField()
    pending_quantity = serializers.SerializerMethodField()
    is_fully_received = serializers.SerializerMethodField()
    reception_percentage = serializers.SerializerMethodField()
    reception_status = serializers.SerializerMethodField()

    # Información de stock actual del producto
    current_stock = serializers.IntegerField(source='product.stock_current', read_only=True)

    # Para crear/actualizar
    product_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = PurchaseOrderItem
        fields = [
            'id', 'product', 'product_id', 'product_name', 'product_code',
            'product_description', 'product_category', 'quantity_ordered',
            'quantity_received', 'unit_price', 'line_total', 'pending_quantity',
            'is_fully_received', 'reception_percentage', 'reception_status',
            'current_stock', 'notes', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_line_total(self, obj):
        """Total de la línea (cantidad ordenada * precio unitario)"""
        return float(obj.quantity_ordered * obj.unit_price)

    def get_pending_quantity(self, obj):
        """Cantidad pendiente de recibir"""
        return max(0, obj.quantity_ordered - obj.quantity_received)

    def get_is_fully_received(self, obj):
        """Si el item está completamente recibido"""
        return obj.quantity_received >= obj.quantity_ordered

    def get_reception_percentage(self, obj):
        """Porcentaje de recepción del item"""
        if obj.quantity_ordered == 0:
            return 0
        return round((obj.quantity_received / obj.quantity_ordered) * 100, 1)

    def get_reception_status(self, obj):
        """Estado de recepción del item"""
        if obj.quantity_received == 0:
            return 'pending'
        elif obj.quantity_received < obj.quantity_ordered:
            return 'partial'
        else:
            return 'complete'

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
    """Serializer completo para órdenes de compra"""

    # Información del proveedor
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    supplier_contact = serializers.CharField(source='supplier.contact_person', read_only=True)
    supplier_email = serializers.CharField(source='supplier.email', read_only=True)
    supplier_phone = serializers.CharField(source='supplier.get_phone', read_only=True)

    # Información del usuario
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    created_by_full_name = serializers.SerializerMethodField()

    # Campos calculados
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    can_edit = serializers.BooleanField(read_only=True)
    can_send = serializers.BooleanField(read_only=True)
    can_cancel = serializers.SerializerMethodField()
    can_duplicate = serializers.SerializerMethodField()
    can_send_reminder = serializers.SerializerMethodField()

    # Items relacionados
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    items_count = serializers.SerializerMethodField()
    total_items = serializers.SerializerMethodField()

    # Campos de recepción
    completion_percentage = serializers.SerializerMethodField()
    pending_items_count = serializers.SerializerMethodField()
    total_pending_quantity = serializers.SerializerMethodField()
    reception_progress = serializers.SerializerMethodField()

    # Historial (si se implementa)
    history = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'po_number', 'supplier', 'supplier_name', 'supplier_contact',
            'supplier_email', 'supplier_phone', 'status', 'status_display',
            'order_date', 'expected_delivery', 'subtotal', 'tax_amount',
            'total_amount', 'notes', 'created_at', 'updated_at', 'created_by',
            'created_by_name', 'created_by_full_name', 'can_edit', 'can_send',
            'can_cancel', 'can_duplicate', 'can_send_reminder', 'items',
            'items_count', 'total_items', 'completion_percentage',
            'pending_items_count', 'total_pending_quantity', 'reception_progress',
            'history'
        ]
        read_only_fields = ['id', 'po_number', 'order_date', 'created_by', 'created_at', 'updated_at']

    def get_created_by_full_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return ''

    def get_items_count(self, obj):
        """Obtener total de items únicos en la orden"""
        return obj.items.count()

    def get_total_items(self, obj):
        """Obtener total de items en la orden (para compatibilidad)"""
        return obj.items.count()

    def get_completion_percentage(self, obj):
        """Calcular porcentaje de completación"""
        items = obj.items.all()
        if not items:
            return 0

        total_ordered = sum(item.quantity_ordered for item in items)
        total_received = sum(item.quantity_received for item in items)

        if total_ordered == 0:
            return 0

        return round((total_received / total_ordered) * 100, 1)

    def get_pending_items_count(self, obj):
        """Contar items con cantidad pendiente"""
        return sum(
            1 for item in obj.items.all()
            if item.quantity_received < item.quantity_ordered
        )

    def get_total_pending_quantity(self, obj):
        """Total de unidades pendientes"""
        return sum(
            item.quantity_ordered - item.quantity_received
            for item in obj.items.all()
        )

    def get_reception_progress(self, obj):
        """Progreso de recepción por item"""
        items = obj.items.all()
        if not items:
            return []

        return [
            {
                'item_id': item.id,
                'product_name': item.product.name if item.product else 'N/A',
                'product_code': item.product.code if item.product else '',
                'ordered': item.quantity_ordered,
                'received': item.quantity_received,
                'pending': item.quantity_ordered - item.quantity_received,
                'progress_percentage': round((item.quantity_received / item.quantity_ordered) * 100, 1) if item.quantity_ordered > 0 else 0,
                'status': 'complete' if item.quantity_received >= item.quantity_ordered else ('partial' if item.quantity_received > 0 else 'pending')
            }
            for item in items
        ]

    def get_can_cancel(self, obj):
        """Verificar si se puede cancelar"""
        return obj.status not in ['completed', 'cancelled']

    def get_can_duplicate(self, obj):
        """Verificar si se puede duplicar"""
        return True  # Siempre se puede duplicar

    def get_can_send_reminder(self, obj):
        """Verificar si se puede enviar recordatorio"""
        return (
            obj.status not in ['cancelled'] and
            obj.supplier and
            obj.supplier.email
        )

    def get_history(self, obj):
        """Obtener historial de la orden"""
        try:
            # Si el modelo tiene campo history_json
            if hasattr(obj, 'history_json') and obj.history_json:
                return obj.history_json

            # Historial básico por defecto
            return [
                {
                    'action': 'created',
                    'description': 'Orden de compra creada',
                    'user': obj.created_by.username if obj.created_by else 'Sistema',
                    'timestamp': obj.created_at.isoformat() if obj.created_at else None,
                    'details': None
                }
            ]
        except Exception:
            return []

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

# ================================
# SERIALIZERS PARA RECEPCIÓN DE ITEMS
# ================================

class ReceiveItemsSerializer(serializers.Serializer):
    """Serializer para recepción de items"""
    received_items = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False
    )
    general_notes = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    update_inventory = serializers.BooleanField(default=True)

    def validate_received_items(self, value):
        """Validar items recibidos"""
        if not value:
            raise serializers.ValidationError("Debe especificar al menos un item")

        required_fields = ['item_id', 'quantity_received']
        for item in value:
            for field in required_fields:
                if field not in item:
                    raise serializers.ValidationError(f"Campo requerido: {field}")

            if not isinstance(item['quantity_received'], int) or item['quantity_received'] <= 0:
                raise serializers.ValidationError("La cantidad debe ser un número entero positivo")

        return value

class ItemReceptionDetailSerializer(serializers.Serializer):
    """Serializer para detalles de recepción de un item"""
    item_id = serializers.IntegerField()
    product_name = serializers.CharField()
    quantity_ordered = serializers.IntegerField()
    quantity_previously_received = serializers.IntegerField()
    quantity_received_now = serializers.IntegerField()
    new_total_received = serializers.IntegerField()
    pending_quantity = serializers.IntegerField()
    reception_notes = serializers.CharField(allow_blank=True)

class ReceptionSummarySerializer(serializers.Serializer):
    """Serializer para resumen de recepción"""
    items_received = serializers.IntegerField()
    total_quantity = serializers.IntegerField()
    new_status = serializers.CharField()
    inventory_updated = serializers.BooleanField()
    general_notes = serializers.CharField(allow_blank=True)
    reception_details = ItemReceptionDetailSerializer(many=True)

# ================================
# SERIALIZERS PARA ACCIONES
# ================================

class PurchaseOrderActionSerializer(serializers.Serializer):
    """Serializer para validar acciones de la orden de compra"""
    action = serializers.ChoiceField(choices=[
        ('change_status', 'Cambiar Estado'),
        ('cancel_order', 'Cancelar Orden'),
        ('duplicate_order', 'Duplicar Orden'),
        ('send_reminder', 'Enviar Recordatorio'),
    ])

    # Campos específicos para cambio de estado
    new_status = serializers.ChoiceField(
        choices=[
            ('draft', 'Borrador'),
            ('sent', 'Enviada'),
            ('confirmed', 'Confirmada'),
            ('partially_received', 'Parcialmente Recibida'),
            ('completed', 'Completada'),
            ('cancelled', 'Cancelada'),
        ],
        required=False
    )

    # Campos específicos para cancelación
    reason = serializers.CharField(max_length=500, required=False)

    # Campos específicos para duplicación
    options = serializers.DictField(required=False)

    # Campos específicos para recordatorio
    reminder_options = serializers.DictField(required=False)

    def validate(self, data):
        action = data.get('action')

        if action == 'change_status' and not data.get('new_status'):
            raise serializers.ValidationError({
                'new_status': 'Este campo es requerido para cambiar estado'
            })

        if action == 'cancel_order' and not data.get('reason'):
            raise serializers.ValidationError({
                'reason': 'La razón de cancelación es requerida'
            })

        if action == 'duplicate_order':
            options = data.get('options', {})
            if not options.get('expected_delivery'):
                raise serializers.ValidationError({
                    'options': 'La fecha de entrega es requerida para duplicar'
                })

        return data

class DuplicateOrderOptionsSerializer(serializers.Serializer):
    """Serializer para opciones de duplicación de orden"""
    expected_delivery = serializers.DateField()
    copy_notes = serializers.BooleanField(default=True)
    copy_all_items = serializers.BooleanField(default=True)
    additional_notes = serializers.CharField(max_length=1000, required=False, allow_blank=True)

class ReminderOptionsSerializer(serializers.Serializer):
    """Serializer para opciones de recordatorio"""
    type = serializers.ChoiceField(choices=[
        ('delivery', 'Recordatorio de Entrega'),
        ('confirmation', 'Solicitud de Confirmación'),
        ('status_update', 'Actualización de Estado'),
        ('custom', 'Mensaje Personalizado'),
    ])
    message = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    include_details = serializers.BooleanField(default=True)

class PurchaseOrderHistorySerializer(serializers.Serializer):
    """Serializer para el historial de la orden"""
    action = serializers.CharField()
    description = serializers.CharField()
    user = serializers.CharField()
    timestamp = serializers.DateTimeField()
    details = serializers.CharField(required=False, allow_null=True)

# ================================
# SERIALIZERS PARA EXPORTACIÓN
# ================================

class PurchaseOrderPDFSerializer(serializers.ModelSerializer):
    """Serializer para generar PDF"""
    supplier_info = serializers.SerializerMethodField()
    items_detail = serializers.SerializerMethodField()
    company_info = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            'po_number', 'order_date', 'expected_delivery', 'status',
            'subtotal', 'tax_amount', 'total_amount', 'notes',
            'supplier_info', 'items_detail', 'company_info'
        ]

    def get_supplier_info(self, obj):
        return {
            'company_name': obj.supplier.company_name if obj.supplier else '',
            'contact_person': obj.supplier.contact_person if obj.supplier else '',
            'email': obj.supplier.email if obj.supplier else '',
            'phone': obj.supplier.get_phone() if obj.supplier else '',
            'address': getattr(obj.supplier, 'address', '') if obj.supplier else ''
        }

    def get_items_detail(self, obj):
        return [
            {
                'product_name': item.product.name if item.product else 'Producto eliminado',
                'product_code': item.product.code if item.product else '',
                'quantity_ordered': item.quantity_ordered,
                'quantity_received': item.quantity_received,
                'unit_price': float(item.unit_price),
                'line_total': float(item.quantity_ordered * item.unit_price),
                'notes': item.notes or ''
            }
            for item in obj.items.all()
        ]

    def get_company_info(self, obj):
        from django.conf import settings
        return {
            'name': getattr(settings, 'COMPANY_NAME', 'Su Empresa'),
            'address': getattr(settings, 'COMPANY_ADDRESS', ''),
            'phone': getattr(settings, 'COMPANY_PHONE', ''),
            'email': getattr(settings, 'COMPANY_EMAIL', ''),
            'tax_id': getattr(settings, 'COMPANY_TAX_ID', '')
        }

class ActionResponseSerializer(serializers.Serializer):
    """Serializer para respuestas de acciones"""
    success = serializers.BooleanField(default=True)
    message = serializers.CharField()
    data = serializers.DictField(required=False)

    # Campos específicos para duplicación
    new_po_id = serializers.IntegerField(required=False)
    new_po_number = serializers.CharField(required=False)

    # Campos específicos para recordatorio
    sent_to = serializers.EmailField(required=False)
