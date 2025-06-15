# apps/ecommerce/purchasing/services.py
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from .models import *
from apps.ecommerce.products.models import Product
from apps.ecommerce.suppliers.models import Supplier
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class PurchaseOrderCalculationService:
    """
    Servicio para cálculos de órdenes de compra
    Responsabilidad única: matemáticas y totales
    """
    
    @staticmethod
    def calculate_totals(purchase_order: PurchaseOrder) -> Dict[str, Decimal]:
        """Calcular totales de la orden de compra"""
        items = purchase_order.items.all()
        
        subtotal = sum(item.line_total for item in items)
        tax_rate = Decimal('0.18')  # IGV 18%
        tax_amount = subtotal * tax_rate
        total = subtotal + tax_amount
        
        return {
            'subtotal': subtotal,
            'tax_amount': tax_amount,
            'total_amount': total
        }
    
    @staticmethod
    def update_po_totals(purchase_order: PurchaseOrder) -> None:
        """Actualizar totales en la orden de compra"""
        totals = PurchaseOrderCalculationService.calculate_totals(purchase_order)
        
        purchase_order.subtotal = totals['subtotal']
        purchase_order.tax_amount = totals['tax_amount']
        purchase_order.total_amount = totals['total_amount']
        purchase_order.save(update_fields=['subtotal', 'tax_amount', 'total_amount'])


class PurchaseOrderValidationService:
    """
    Servicio para validaciones de negocio
    Responsabilidad única: reglas de negocio y validaciones
    """
    
    @staticmethod
    def validate_po_creation(data: Dict[str, Any]) -> List[str]:
        """Validar datos para crear orden de compra"""
        errors = []
        
        # Validar proveedor
        supplier_id = data.get('supplier_id')
        if not supplier_id:
            errors.append("Proveedor es requerido")
        else:
            try:
                supplier = Supplier.objects.get(id=supplier_id, is_active=True)
            except Supplier.DoesNotExist:
                errors.append("Proveedor no válido o inactivo")
        
        # Validar fecha de entrega
        expected_delivery = data.get('expected_delivery')
        if not expected_delivery:
            errors.append("Fecha de entrega esperada es requerida")
        
        # Validar items
        items = data.get('items', [])
        if not items:
            errors.append("Debe incluir al menos un producto")
        
        return errors
    
    @staticmethod
    def validate_po_items(items_data: List[Dict]) -> List[str]:
        """Validar items de la orden de compra"""
        errors = []
        product_ids = []
        
        for idx, item in enumerate(items_data):
            item_errors = []
            
            # Validar producto
            product_id = item.get('product_id')
            if not product_id:
                item_errors.append(f"Item {idx + 1}: Producto es requerido")
            else:
                if product_id in product_ids:
                    item_errors.append(f"Item {idx + 1}: Producto duplicado")
                else:
                    product_ids.append(product_id)
                    
                try:
                    Product.objects.get(id=product_id, is_active=True)
                except Product.DoesNotExist:
                    item_errors.append(f"Item {idx + 1}: Producto no válido")
            
            # Validar cantidad
            quantity = item.get('quantity_ordered', 0)
            if quantity <= 0:
                item_errors.append(f"Item {idx + 1}: Cantidad debe ser mayor a 0")
            
            # Validar precio
            unit_price = item.get('unit_price', 0)
            if unit_price <= 0:
                item_errors.append(f"Item {idx + 1}: Precio unitario debe ser mayor a 0")
            
            errors.extend(item_errors)
        
        return errors


class PurchaseOrderManagementService:
    """
    Servicio para gestión de órdenes de compra
    Responsabilidad única: operaciones CRUD y flujo de estados
    """
    
    @transaction.atomic
    def create_purchase_order(self, data: Dict[str, Any], created_by) -> PurchaseOrder:
        """Crear orden de compra completa"""
        
        # Validar datos
        validation_errors = PurchaseOrderValidationService.validate_po_creation(data)
        if validation_errors:
            raise ValidationError(validation_errors)
        
        items_data = data.pop('items', [])
        item_errors = PurchaseOrderValidationService.validate_po_items(items_data)
        if item_errors:
            raise ValidationError(item_errors)
        
        # Crear orden de compra
        purchase_order = PurchaseOrder.objects.create(
            supplier_id=data['supplier_id'],
            expected_delivery=data['expected_delivery'],
            notes=data.get('notes', ''),
            created_by=created_by
        )
        
        # Crear items
        for item_data in items_data:
            PurchaseOrderItem.objects.create(
                purchase_order=purchase_order,
                product_id=item_data['product_id'],
                quantity_ordered=item_data['quantity_ordered'],
                unit_price=item_data['unit_price'],
                notes=item_data.get('notes', '')
            )
        
        # Calcular totales
        PurchaseOrderCalculationService.update_po_totals(purchase_order)
        
        logger.info(f"Purchase Order {purchase_order.po_number} created by {created_by.username}")
        
        return purchase_order
    
    @transaction.atomic
    def update_purchase_order(self, purchase_order: PurchaseOrder, data: Dict[str, Any]) -> PurchaseOrder:
        """Actualizar orden de compra"""
        
        if not purchase_order.can_edit:
            raise ValidationError("No se puede editar la orden en su estado actual")
        
        # Actualizar campos básicos
        purchase_order.expected_delivery = data.get('expected_delivery', purchase_order.expected_delivery)
        purchase_order.notes = data.get('notes', purchase_order.notes)
        purchase_order.save()
        
        # Actualizar items si se proporcionan
        items_data = data.get('items')
        if items_data is not None:
            item_errors = PurchaseOrderValidationService.validate_po_items(items_data)
            if item_errors:
                raise ValidationError(item_errors)
            
            # Eliminar items existentes
            purchase_order.items.all().delete()
            
            # Crear nuevos items
            for item_data in items_data:
                PurchaseOrderItem.objects.create(
                    purchase_order=purchase_order,
                    product_id=item_data['product_id'],
                    quantity_ordered=item_data['quantity_ordered'],
                    unit_price=item_data['unit_price'],
                    notes=item_data.get('notes', '')
                )
            
            # Recalcular totales
            PurchaseOrderCalculationService.update_po_totals(purchase_order)
        
        return purchase_order
    
    def send_purchase_order(self, purchase_order: PurchaseOrder) -> bool:
        """Enviar orden de compra al proveedor"""
        
        if not purchase_order.can_send:
            raise ValidationError("No se puede enviar la orden en su estado actual")
        
        try:
            # Cambiar estado
            purchase_order.status = 'sent'
            purchase_order.save()
            
            # Aquí podrías agregar lógica de envío por email
            # EmailService.send_purchase_order(purchase_order)
            
            logger.info(f"Purchase Order {purchase_order.po_number} sent to {purchase_order.supplier.company_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error sending PO {purchase_order.po_number}: {str(e)}")
            return False
    
    @transaction.atomic
    def receive_items(self, purchase_order: PurchaseOrder, received_items: List[Dict]) -> None:
        """Recibir items de la orden de compra"""
        
        if purchase_order.status not in ['sent', 'confirmed', 'partially_received']:
            raise ValidationError("No se pueden recibir items en el estado actual")
        
        for item_data in received_items:
            item_id = item_data.get('item_id')
            quantity_received = item_data.get('quantity_received', 0)
            
            try:
                po_item = purchase_order.items.get(id=item_id)
                
                # Validar cantidad
                max_receivable = po_item.pending_quantity
                if quantity_received > max_receivable:
                    raise ValidationError(f"No se puede recibir más de {max_receivable} unidades del producto {po_item.product.name}")
                
                # Actualizar cantidad recibida
                po_item.quantity_received += quantity_received
                po_item.save()
                
                # Actualizar stock del producto
                po_item.product.stock_current += quantity_received
                po_item.product.save(update_fields=['stock_current'])
                
            except PurchaseOrderItem.DoesNotExist:
                raise ValidationError(f"Item {item_id} no encontrado")
        
        # Actualizar estado de la orden
        self._update_po_status_after_receipt(purchase_order)
    
    def _update_po_status_after_receipt(self, purchase_order: PurchaseOrder) -> None:
        """Actualizar estado de la orden después de recibir items"""
        items = purchase_order.items.all()
        
        if all(item.is_fully_received for item in items):
            purchase_order.status = 'completed'
        else:
            purchase_order.status = 'partially_received'
        
        purchase_order.save(update_fields=['status'])


class PurchaseOrderReportService:
    """
    Servicio para reportes y análisis
    Responsabilidad única: generación de reportes
    """
    
    @staticmethod
    def get_po_analytics():
        """Obtener analíticas de órdenes de compra"""
        from django.db.models import Count, Sum, Avg
        
        total_pos = PurchaseOrder.objects.count()
        
        # Estadísticas por estado
        status_stats = PurchaseOrder.objects.values('status').annotate(
            count=Count('id'),
            total_amount=Sum('total_amount')
        ).order_by('status')
        
        # Promedio por proveedor
        supplier_stats = PurchaseOrder.objects.values('supplier__company_name').annotate(
            po_count=Count('id'),
            total_spent=Sum('total_amount'),
            avg_amount=Avg('total_amount')
        ).order_by('-total_spent')[:10]
        
        return {
            'total_purchase_orders': total_pos,
            'status_statistics': list(status_stats),
            'top_suppliers': list(supplier_stats)
        }
class PurchaseOrderPDFService:
    """Servicio para generar PDFs de órdenes de compra"""
    
    @staticmethod
    def generate_po_pdf(purchase_order):
        """Generar PDF de orden de compra"""
        from reportlab.lib.pagesizes import letter, A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
        from io import BytesIO
        from datetime import date
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=18
        )
        
        styles = getSampleStyleSheet()
        story = []
        
        # Título
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            spaceAfter=30,
            alignment=TA_CENTER,
            textColor=colors.darkblue
        )
        
        title = Paragraph("ORDEN DE COMPRA", title_style)
        story.append(title)
        story.append(Spacer(1, 20))
        
        # Información de la empresa
        company_info = f"""
        <b>DE:</b> Tu Empresa S.A.C.<br/>
        <b>DEPARTAMENTO:</b> Compras<br/>
        <b>TELÉFONO:</b> +51 999 999 999<br/>
        <b>EMAIL:</b> compras@tuempresa.com<br/>
        <b>FECHA:</b> {date.today().strftime('%d/%m/%Y')}
        """
        
        company_para = Paragraph(company_info, styles['Normal'])
        story.append(company_para)
        story.append(Spacer(1, 20))
        
        # Información de la orden
        po_info = f"""
        <b>NÚMERO DE ORDEN:</b> {purchase_order.po_number}<br/>
        <b>PROVEEDOR:</b> {purchase_order.supplier.company_name}<br/>
        <b>CONTACTO:</b> {purchase_order.supplier.contact_person}<br/>
        <b>EMAIL:</b> {purchase_order.supplier.email or 'No especificado'}<br/>
        <b>TELÉFONO:</b> {purchase_order.supplier.phone_primary}<br/>
        <b>FECHA ENTREGA ESPERADA:</b> {purchase_order.expected_delivery.strftime('%d/%m/%Y')}<br/>
        <b>ESTADO:</b> {purchase_order.get_status_display()}
        """
        
        if purchase_order.notes:
            po_info += f"<br/><b>NOTAS:</b> {purchase_order.notes}"
        
        po_para = Paragraph(po_info, styles['Normal'])
        story.append(po_para)
        story.append(Spacer(1, 20))
        
        # Tabla de productos
        products_title = Paragraph("PRODUCTOS SOLICITADOS", styles['Heading2'])
        story.append(products_title)
        
        # Datos para la tabla
        data = [['CÓDIGO', 'PRODUCTO', 'CANTIDAD', 'PRECIO UNIT.', 'TOTAL']]
        
        for item in purchase_order.items.all():
            data.append([
                item.product.code,
                item.product.name,
                str(item.quantity_ordered),
                f"S/.{item.unit_price:.2f}",
                f"S/.{item.line_total:.2f}"
            ])
        
        # Totales
        data.append(['', '', '', 'Subtotal:', f"S/.{purchase_order.subtotal:.2f}"])
        data.append(['', '', '', 'IGV (18%):', f"S/.{purchase_order.tax_amount:.2f}"])
        data.append(['', '', '', 'TOTAL:', f"S/.{purchase_order.total_amount:.2f}"])
        
        # Crear tabla
        table = Table(data, colWidths=[1*inch, 2.5*inch, 1*inch, 1.2*inch, 1.2*inch])
        
        # Estilo de la tabla
        table.setStyle(TableStyle([
            # Encabezado
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            
            # Contenido
            ('BACKGROUND', (0, 1), (-1, -4), colors.beige),
            ('TEXTCOLOR', (0, 1), (-1, -4), colors.black),
            ('FONTNAME', (0, 1), (-1, -4), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -4), 9),
            ('ALIGN', (1, 1), (1, -4), 'LEFT'),  # Producto alineado a la izquierda
            
            # Totales
            ('BACKGROUND', (0, -3), (-1, -1), colors.lightgrey),
            ('FONTNAME', (0, -3), (-1, -1), 'Helvetica-Bold'),
            ('ALIGN', (3, -3), (4, -1), 'RIGHT'),
            
            # Bordes
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        
        story.append(table)
        story.append(Spacer(1, 30))
        
        # Términos y condiciones
        terms = """
        <b>TÉRMINOS Y CONDICIONES:</b><br/>
        <br/>
        1. Favor confirmar recepción de esta orden de compra.<br/>
        2. Entregar productos según especificaciones exactas.<br/>
        3. Notificar inmediatamente cualquier retraso en la entrega.<br/>
        4. Incluir número de orden en toda facturación.<br/>
        5. Los productos deben cumplir con estándares de calidad acordados.<br/>
        <br/>
        <b>AUTORIZADO POR:</b> {purchase_order.created_by.get_full_name() or purchase_order.created_by.username}<br/>
        <b>FECHA:</b> {purchase_order.order_date.strftime('%d/%m/%Y')}<br/>
        <br/>
        Gracias por su servicio.
        """
        
        terms_para = Paragraph(terms, styles['Normal'])
        story.append(terms_para)
        
        # Construir el documento
        doc.build(story)
        buffer.seek(0)
        return buffer


class PurchaseOrderIntegrationService:
    """Servicio para integración con otros módulos del sistema"""
    
    @staticmethod
    def create_po_from_cotizacion(cotizacion_id, expected_delivery, user, notes=""):
        """Crear orden de compra desde cotización seleccionada"""
        from apps.ecommerce.cotizacion.models import RespuestaCotizacion
        
        try:
            cotizacion = RespuestaCotizacion.objects.get(id=cotizacion_id)
            
            # Preparar datos
            po_data = {
                'supplier_id': cotizacion.envio.proveedor.id,
                'expected_delivery': expected_delivery,
                'notes': f"Generada desde cotización {cotizacion.envio.numero_envio}\n{notes}",
                'items': []
            }
            
            # Agregar items
            for detalle in cotizacion.detalles.all():
                if detalle.producto:
                    po_data['items'].append({
                        'product_id': detalle.producto.id,
                        'quantity_ordered': detalle.cantidad_cotizada,
                        'unit_price': float(detalle.precio_unitario),
                        'notes': detalle.observaciones or ''
                    })
            
            # Crear orden
            service = PurchaseOrderManagementService()
            purchase_order = service.create_purchase_order(po_data, user)
            
            # Actualizar estado del requerimiento
            requirement = cotizacion.envio.requerimiento
            if requirement.estado == 'cotizado':
                requirement.estado = 'orden_generada'
                requirement.save()
            
            return purchase_order
            
        except Exception as e:
            logger.error(f"Error creating PO from cotizacion {cotizacion_id}: {str(e)}")
            raise
    
    @staticmethod
    def notify_stock_update(purchase_order_item):
        """Notificar actualización de stock al sistema de notificaciones"""
        try:
            from apps.notification.services import notification_service
            from auth.models import Role
            
            producto = purchase_order_item.product
            po = purchase_order_item.purchase_order
            
            mensaje = f"Stock actualizado: {producto.name} +{purchase_order_item.quantity_received} unidades desde orden {po.po_number}"
            
            notification_service.enviar_notificacion_roles(
                roles=[Role.ADMINISTRADOR_SISTEMA, Role.GERENTE_COMPRAS],
                mensaje=mensaje,
                titulo="Stock Actualizado por Compra",
                tipo="STOCK_ACTUALIZADO",
                icono='ri-shopping-cart-line',
                color='success',
                url_accion=f'/app/ecommerce/product/add/?edit={producto.id}',
                datos_adicionales={
                    'producto_id': producto.id,
                    'cantidad_recibida': purchase_order_item.quantity_received,
                    'po_number': po.po_number,
                    'proveedor': po.supplier.company_name
                }
            )
        except Exception as e:
            logger.warning(f"Could not send stock notification: {str(e)}")