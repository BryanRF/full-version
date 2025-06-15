# apps/ecommerce/sales/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from decimal import Decimal
from .models import Sale, SaleItem, SalePayment
from apps.ecommerce.products.models import Product
from apps.ecommerce.customers.models import Customer
import logging
logger = logging.getLogger(__name__)
from django.db import transaction  # IMPORTANTE: Agregar este import
class SaleItemSerializer(serializers.ModelSerializer):
    # Información del producto
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)
    product_category = serializers.CharField(source='product.category.name', read_only=True)
    product_image = serializers.SerializerMethodField()
    product_price = serializers.DecimalField(source='product.price', max_digits=10, decimal_places=2, read_only=True)

    # Stock information
    stock_available = serializers.IntegerField(source='product.stock_current', read_only=True)
    has_sufficient_stock = serializers.BooleanField(read_only=True)

    # Campos calculados
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_discount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    # Para crear/actualizar
    product_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = SaleItem
        fields = [
            'id', 'product', 'product_id', 'quantity', 'unit_price',
            'discount_percentage', 'discount_amount', 'notes',
            # Campos de solo lectura
            'product_name', 'product_code', 'product_category', 'product_image',
            'product_price', 'stock_available', 'has_sufficient_stock',
            'subtotal', 'total_discount', 'total',
            'created_at', 'updated_at'
        ]

    def get_product_image(self, obj):
        """Retorna la imagen del producto"""
        if obj.product.image:
            return obj.product.image.url
        return None

    def validate_quantity(self, value):
        """Validar que la cantidad sea mayor a 0"""
        if value <= 0:
            raise serializers.ValidationError("La cantidad debe ser mayor a 0")
        return value

    def validate_unit_price(self, value):
        """Validar que el precio sea mayor a 0"""
        if value <= 0:
            raise serializers.ValidationError("El precio debe ser mayor a 0")
        return value

    def validate(self, data):
        """Validaciones adicionales"""
        # Validar stock disponible
        product_id = data.get('product_id') or (self.instance.product.id if self.instance else None)
        quantity = data.get('quantity', getattr(self.instance, 'quantity', 0))

        if product_id:
            try:
                product = Product.objects.get(id=product_id)
                if product.stock_current < quantity:
                    raise serializers.ValidationError(
                        f"Stock insuficiente para {product.name}. Stock disponible: {product.stock_current}"
                    )
                data['product'] = product
            except Product.DoesNotExist:
                raise serializers.ValidationError("Producto no encontrado")

        return data


class SalePaymentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = SalePayment
        fields = [
            'id', 'amount', 'payment_method', 'payment_method_display',
            'status', 'status_display', 'reference_number', 'payment_date',
            'notes', 'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]


class SaleSerializer(serializers.ModelSerializer):
    # Información del cliente
    customer_display_name = serializers.CharField(read_only=True)
    customer_document_display = serializers.CharField(read_only=True)
    customer_info = serializers.SerializerMethodField()

    # Información del usuario
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    updated_by_name = serializers.CharField(source='updated_by.username', read_only=True)

    # Campos calculados
    total_items = serializers.IntegerField(read_only=True)
    total_products = serializers.IntegerField(read_only=True)
    status_color = serializers.CharField(read_only=True)
    payment_method_display = serializers.CharField(read_only=True)
    status_display = serializers.CharField(read_only=True)

    # Campos de permisos
    can_edit = serializers.BooleanField(read_only=True)
    can_confirm = serializers.BooleanField(read_only=True)
    can_cancel = serializers.BooleanField(read_only=True)

    # Items y pagos
    items = SaleItemSerializer(many=True, read_only=True)
    payments = SalePaymentSerializer(many=True, read_only=True)

    # Información adicional
    sale_type_display = serializers.CharField(source='get_sale_type_display', read_only=True)

    class Meta:
        model = Sale
        fields = [
            'id', 'sale_number', 'sale_type', 'sale_type_display',
            'customer', 'guest_customer_name', 'guest_customer_document',
            'guest_customer_phone', 'guest_customer_email',
            'sale_date', 'due_date', 'subtotal', 'tax_amount', 'discount_amount',
            'total_amount', 'tax_rate', 'includes_tax', 'payment_method',
            'payment_method_display', 'status', 'status_display', 'status_color',
            'notes', 'internal_notes', 'invoice_number', 'reference_number',
            'created_by', 'updated_by', 'created_at', 'updated_at',
            # Campos calculados
            'customer_display_name', 'customer_document_display', 'customer_info',
            'created_by_name', 'updated_by_name', 'total_items', 'total_products',
            'can_edit', 'can_confirm', 'can_cancel',
            # Relaciones
            'items', 'payments'
        ]

    def get_customer_info(self, obj):
        """Información completa del cliente"""
        if obj.customer:
            return {
                'id': obj.customer.id,
                'name': obj.customer.display_name,
                'document': f"{obj.customer.document_type_display}: {obj.customer.document_number}",
                'email': obj.customer.email,
                'phone': obj.customer.mobile_phone or obj.customer.phone,
                'address': obj.customer.full_address,
                'is_frequent': obj.customer.is_frequent
            }
        else:
            return {
                'name': obj.guest_customer_name,
                'document': obj.guest_customer_document,
                'email': obj.guest_customer_email,
                'phone': obj.guest_customer_phone,
                'is_guest': True
            }


class SaleCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear ventas con items"""
    items_data = serializers.JSONField(write_only=True)
    customer_document = serializers.CharField(max_length=20, required=False, allow_blank=True)
    customer_name = serializers.CharField(max_length=255, required=False, allow_blank=True)

    class Meta:
        model = Sale
        fields = [
            'sale_type', 'due_date', 'discount_amount', 'tax_rate',
            'includes_tax', 'payment_method', 'notes', 'reference_number',
            'items_data', 'customer_document', 'customer_name'
        ]


    def create(self, validated_data):
        from django.db import transaction
        
        items_data = validated_data.pop('items_data', [])
        customer_document = validated_data.pop('customer_document', None)
        customer_name = validated_data.pop('customer_name', None)
        
        # Parsear items si viene como string JSON
        if isinstance(items_data, str):
            import json
            items_data = json.loads(items_data)
        
        with transaction.atomic():
            # Buscar o crear cliente si se proporciona documento
            customer = None
            if customer_document and customer_document.strip():
                customer = self._get_or_create_customer(customer_document.strip(), customer_name)
                if customer:
                    validated_data['customer'] = customer
                else:
                    validated_data['guest_customer_document'] = customer_document
                    if customer_name:
                        validated_data['guest_customer_name'] = customer_name
            elif customer_name:
                validated_data['guest_customer_name'] = customer_name
            
            # Crear venta SIN calcular totales automáticamente
            sale = Sale(**validated_data)
            sale.save()  # Guardar primero para obtener ID
            
            # Crear los items DESPUÉS de que sale tenga ID
            for item_data in items_data:
                product_id = item_data.get('product_id')
                if not product_id:
                    raise serializers.ValidationError("product_id es requerido en cada item")
                
                try:
                    product = Product.objects.get(id=product_id)
                except Product.DoesNotExist:
                    raise serializers.ValidationError(f"Producto con ID {product_id} no existe")
                
                # Verificar stock
                quantity = item_data.get('quantity', 1)
                if product.stock_current < quantity:
                    raise serializers.ValidationError(
                        f"Stock insuficiente para {product.name}. Stock disponible: {product.stock_current}"
                    )
                
                SaleItem.objects.create(
                    sale=sale,  # Ahora sale ya tiene ID
                    product=product,
                    quantity=quantity,
                    unit_price=item_data.get('unit_price', product.price),
                    discount_percentage=item_data.get('discount_percentage', 0),
                    discount_amount=item_data.get('discount_amount', 0),
                    notes=item_data.get('notes', '')
                )
            
            # Recalcular totales DESPUÉS de crear todos los items
            sale.calculate_totals()
            sale.save(update_fields=['subtotal', 'tax_amount', 'total_amount'])
            
            return sale
    def _get_or_create_customer(self, document_number, customer_name=None):
        """Buscar cliente existente o crear uno nuevo con consulta API"""
        from apps.ecommerce.customers.services import DocumentAPIService, CustomerService

        # Primero buscar en base de datos local
        existing_customer = Customer.objects.filter(document_number=document_number).first()
        if existing_customer:
            return existing_customer

        # Si no existe localmente, consultar API externa
        try:
            success, result = CustomerService.create_customer_from_document(
                document_number=document_number,
                document_type=None,  # Auto-detectar
                user=None
            )

            if success:
                return result['customer']
            else:
                # Si falla la API, crear cliente básico con datos proporcionados
                if customer_name:
                    document_type = '1' if len(document_number) == 8 else '6' if len(document_number) == 11 else '1'

                    customer_data = {
                        'document_type': document_type,
                        'document_number': document_number,
                        'customer_type': 'persona_natural' if document_type == '1' else 'persona_juridica'
                    }

                    if document_type == '6':  # RUC
                        customer_data['business_name'] = customer_name
                    else:  # DNI
                        names = customer_name.split(' ', 1)
                        customer_data['first_name'] = names[0]
                        if len(names) > 1:
                            customer_data['last_name'] = names[1]

                    return Customer.objects.create(**customer_data)

        except Exception as e:
            print(f"Error consultando API: {e}")

        return None

    def validate_items_data(self, value):
        """Validar que haya al menos un item"""
        if isinstance(value, str):
            import json
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                raise serializers.ValidationError("Formato JSON inválido en items_data")

        if not value or len(value) == 0:
            raise serializers.ValidationError("Debe incluir al menos un producto")

        # Validar que no haya productos duplicados
        product_ids = []
        for item in value:
            product_id = item.get('product_id')
            if not product_id:
                raise serializers.ValidationError("product_id es requerido en cada item")

            if product_id in product_ids:
                raise serializers.ValidationError("No se pueden repetir productos en la misma venta")
            product_ids.append(product_id)

            # Validar cantidad
            quantity = item.get('quantity', 1)
            if quantity <= 0:
                raise serializers.ValidationError("La cantidad debe ser mayor a 0")

        return value

class SaleListSerializer(serializers.ModelSerializer):
    """Serializer optimizado para listados"""
    customer_display_name = serializers.CharField(read_only=True)
    customer_document_display = serializers.CharField(read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    total_items = serializers.IntegerField(read_only=True)
    total_products = serializers.IntegerField(read_only=True)
    status_display = serializers.CharField(read_only=True)
    status_color = serializers.CharField(read_only=True)
    payment_method_display = serializers.CharField(read_only=True)
    sale_type_display = serializers.CharField(source='get_sale_type_display', read_only=True)

    class Meta:
        model = Sale
        fields = [
            'id', 'sale_number', 'sale_type', 'sale_type_display',
            'customer_display_name', 'customer_document_display',
            'sale_date', 'total_amount', 'payment_method', 'payment_method_display',
            'status', 'status_display', 'status_color',
            'total_items', 'total_products', 'created_by_name', 'created_at'
        ]


class SaleUpdateStatusSerializer(serializers.ModelSerializer):
    """Serializer para actualizar solo el estado"""

    class Meta:
        model = Sale
        fields = ['status', 'internal_notes']

    def validate_status(self, value):
        """Validar transiciones de estado válidas"""
        if not self.instance:
            return value

        current_status = self.instance.status

        # Definir transiciones válidas
        valid_transitions = {
            'draft': ['pending', 'confirmed', 'cancelled'],
            'pending': ['confirmed', 'cancelled'],
            'confirmed': ['invoiced', 'delivered', 'cancelled'],
            'invoiced': ['delivered', 'paid', 'cancelled'],
            'delivered': ['paid', 'completed', 'returned'],
            'paid': ['completed'],
            'completed': ['returned'],
            'cancelled': ['draft', 'pending'],
            'returned': [],
        }

        if value not in valid_transitions.get(current_status, []):
            valid_states = ', '.join(valid_transitions.get(current_status, []))
            raise serializers.ValidationError(
                f"No se puede cambiar de '{current_status}' a '{value}'. "
                f"Estados válidos: {valid_states}"
            )

        return value

class SaleQuickCreateSerializer(serializers.Serializer):
    """Serializer para venta rápida (POS)"""
    items = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False
    )
    payment_method = serializers.ChoiceField(choices=Sale.PAYMENT_METHOD_CHOICES)
    customer_id = serializers.IntegerField(required=False)
    customer_document = serializers.CharField(max_length=20, required=False, allow_blank=True)
    customer_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_items(self, value):
        """Validar items de la venta"""
        if not value:
            raise serializers.ValidationError("Debe incluir al menos un producto")

        for item in value:
            if 'product_id' not in item:
                raise serializers.ValidationError("product_id es requerido")
            if 'quantity' not in item or item['quantity'] <= 0:
                raise serializers.ValidationError("quantity debe ser mayor a 0")

        return value

    def create(self, validated_data):
        """Crear venta rápida con debug"""
        from django.db import transaction
        from decimal import Decimal
        
        try:
            logger.info(f"Datos recibidos: {validated_data}")
            
            items_data = validated_data.pop('items')
            customer_id = validated_data.pop('customer_id', None)  # Extraer customer_id
            customer_document = validated_data.pop('customer_document', None)
            customer_name = validated_data.pop('customer_name', None)
            
            logger.info(f"Items data: {items_data}")
            logger.info(f"Customer ID: {customer_id}")
            
            with transaction.atomic():
                # Procesar cliente
                customer = None
                
                # Prioridad: customer_id > customer_document > customer_name
                if customer_id:
                    try:
                        customer = Customer.objects.get(id=customer_id)
                        logger.info(f"Cliente encontrado por ID: {customer}")
                    except Customer.DoesNotExist:
                        logger.warning(f"Cliente con ID {customer_id} no encontrado")
                        # Continuar sin cliente en lugar de fallar
                        
                elif customer_document and customer_document.strip():
                    logger.info(f"Buscando cliente con documento: {customer_document}")
                    customer = self._get_or_create_customer(customer_document.strip(), customer_name)
                    logger.info(f"Cliente encontrado/creado: {customer}")
                
                # Convertir discount_amount a Decimal de forma segura
                discount_amount = validated_data.get('discount_amount', 0)
                if discount_amount:
                    validated_data['discount_amount'] = Decimal(str(discount_amount))
                    logger.info(f"Descuento convertido: {validated_data['discount_amount']}")
                
                # Datos de la venta
                sale_data = {
                    'sale_type': 'venta',
                    'status': 'confirmed',
                    'subtotal': Decimal('0.00'),
                    'tax_amount': Decimal('0.00'),
                    'total_amount': Decimal('0.00'),
                    **validated_data
                }
                
                # Asignar cliente según el caso
                if customer:
                    sale_data['customer'] = customer
                    logger.info(f"Venta asignada a cliente: {customer.display_name}")
                elif customer_document or customer_name:
                    sale_data['guest_customer_document'] = customer_document
                    sale_data['guest_customer_name'] = customer_name
                    logger.info("Venta con datos de cliente invitado")
                else:
                    logger.info("Venta sin cliente")
                
                logger.info(f"Datos de venta preparados: {sale_data}")
                
                # Crear venta
                sale = Sale(**sale_data)
                sale.save()
                logger.info(f"Venta creada con ID: {sale.id}")
                
                # Crear items
                for i, item_data in enumerate(items_data):
                    logger.info(f"Procesando item {i+1}: {item_data}")
                    
                    product_id = item_data['product_id']
                    quantity = int(item_data['quantity'])
                    
                    # Obtener producto
                    try:
                        product = Product.objects.get(id=product_id)
                        logger.info(f"Producto encontrado: {product.name}, precio: {product.price}")
                    except Product.DoesNotExist:
                        logger.error(f"Producto no encontrado: {product_id}")
                        raise serializers.ValidationError(f"Producto {product_id} no existe")
                    
                    # Convertir precio a Decimal
                    unit_price = item_data.get('unit_price', product.price)
                    if isinstance(unit_price, (int, float)):
                        unit_price = Decimal(str(unit_price))
                    elif isinstance(unit_price, str):
                        unit_price = Decimal(unit_price)
                    
                    logger.info(f"Precio unitario convertido: {unit_price} (tipo: {type(unit_price)})")
                    
                    # Verificar stock
                    if product.stock_current < quantity:
                        logger.error(f"Stock insuficiente: {product.stock_current} < {quantity}")
                        raise serializers.ValidationError(f"Stock insuficiente para {product.name}")
                    
                    # Crear item
                    sale_item = SaleItem.objects.create(
                        sale=sale,
                        product=product,
                        quantity=quantity,
                        unit_price=unit_price
                    )
                    logger.info(f"Item creado: {sale_item}")
                    
                    # Actualizar stock
                    product.stock_current -= quantity
                    product.save()
                    logger.info(f"Stock actualizado para {product.name}: {product.stock_current}")
                
                # Calcular totales
                logger.info("Calculando totales...")
                sale.calculate_totals()
                sale.save(update_fields=['subtotal', 'tax_amount', 'total_amount'])
                logger.info(f"Venta finalizada - Total: {sale.total_amount}")
                
                return sale
                
        except Exception as e:
            logger.error(f"Error en create(): {str(e)}", exc_info=True)
            raise serializers.ValidationError(f"Error creando venta: {str(e)}")

    def _get_or_create_customer(self, document_number, customer_name=None):
        """Mismo método que en SaleCreateSerializer"""
        from apps.ecommerce.customers.services import CustomerService

        # Buscar en base de datos local primero
        existing_customer = Customer.objects.filter(document_number=document_number).first()
        if existing_customer:
            return existing_customer

        # Consultar API externa
        try:
            success, result = CustomerService.create_customer_from_document(
                document_number=document_number,
                document_type=None,
                user=None
            )

            if success:
                return result['customer']
            else:
                # Crear cliente básico si falla API
                if customer_name:
                    document_type = '1' if len(document_number) == 8 else '6' if len(document_number) == 11 else '1'

                    customer_data = {
                        'document_type': document_type,
                        'document_number': document_number,
                        'customer_type': 'persona_natural' if document_type == '1' else 'persona_juridica'
                    }

                    if document_type == '6':
                        customer_data['business_name'] = customer_name
                    else:
                        names = customer_name.split(' ', 1)
                        customer_data['first_name'] = names[0]
                        if len(names) > 1:
                            customer_data['last_name'] = names[1]

                    return Customer.objects.create(**customer_data)

        except Exception:
            pass

        return None