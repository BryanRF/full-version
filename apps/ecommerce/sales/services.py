
# apps/ecommerce/customers/services.py
import logging
from django.conf import settings
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)
class SalesAnalyticsService:
    """Servicio para analíticas de ventas"""
    
    @staticmethod
    def get_sales_analytics(start_date=None, end_date=None, user=None):
        """Obtener analíticas de ventas"""
        from .models import Sale, SaleItem
        from django.db.models import Sum, Count, Avg
        from datetime import date, timedelta
        
        # Filtros por fecha
        if not start_date:
            start_date = date.today() - timedelta(days=30)
        if not end_date:
            end_date = date.today()
        
        sales_queryset = Sale.objects.filter(
            sale_date__date__gte=start_date,
            sale_date__date__lte=end_date
        )
        
        if user:
            sales_queryset = sales_queryset.filter(created_by=user)
        
        # Estadísticas básicas
        total_sales = sales_queryset.count()
        total_amount = sales_queryset.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        avg_sale_amount = sales_queryset.aggregate(Avg('total_amount'))['total_amount__avg'] or 0
        
        # Ventas por estado
        sales_by_status = sales_queryset.values('status').annotate(
            count=Count('id'),
            total=Sum('total_amount')
        ).order_by('status')
        
        # Ventas por método de pago
        sales_by_payment = sales_queryset.values('payment_method').annotate(
            count=Count('id'),
            total=Sum('total_amount')
        ).order_by('-total')
        
        # Productos más vendidos
        top_products = SaleItem.objects.filter(
            sale__sale_date__date__gte=start_date,
            sale__sale_date__date__lte=end_date
        ).values(
            'product__name', 'product__code'
        ).annotate(
            total_quantity=Sum('quantity'),
            total_amount=Sum('quantity') * Sum('unit_price')
        ).order_by('-total_quantity')[:10]
        
        # Ventas por día (últimos 7 días)
        daily_sales = []
        for i in range(7):
            day = end_date - timedelta(days=i)
            day_sales = sales_queryset.filter(sale_date__date=day).aggregate(
                count=Count('id'),
                total=Sum('total_amount')
            )
            daily_sales.append({
                'date': day,
                'count': day_sales['count'] or 0,
                'total': day_sales['total'] or 0
            })
        
        return {
            'total_sales': total_sales,
            'total_amount': float(total_amount),
            'avg_sale_amount': float(avg_sale_amount),
            'sales_by_status': list(sales_by_status),
            'sales_by_payment': list(sales_by_payment),
            'top_products': list(top_products),
            'daily_sales': daily_sales,
            'period': {
                'start_date': start_date,
                'end_date': end_date
            }
        }
    
    @staticmethod
    def get_customer_analytics():
        """Obtener analíticas de clientes"""
        from .models import Customer, Sale
        from django.db.models import Sum, Count
        
        # Estadísticas básicas de clientes
        total_customers = Customer.objects.count()
        active_customers = Customer.objects.filter(is_active=True).count()
        frequent_customers = Customer.objects.filter(is_frequent=True).count()
        
        # Clientes por tipo
        customers_by_type = Customer.objects.values('customer_type').annotate(
            count=Count('id')
        )
        
        # Clientes por tipo de documento
        customers_by_document = Customer.objects.values('document_type').annotate(
            count=Count('id')
        )
        
        # Top clientes por ventas
        top_customers = Customer.objects.annotate(
            total_sales=Count('sales'),
            total_amount=Sum('sales__total_amount')
        ).filter(total_sales__gt=0).order_by('-total_amount')[:10]
        
        return {
            'total_customers': total_customers,
            'active_customers': active_customers,
            'frequent_customers': frequent_customers,
            'customers_by_type': list(customers_by_type),
            'customers_by_document': list(customers_by_document),
            'top_customers': [
                {
                    'id': customer.id,
                    'name': customer.display_name,
                    'total_sales': customer.total_sales,
                    'total_amount': float(customer.total_amount or 0)
                }
                for customer in top_customers
            ]
        }


class StockMovementService:
    """Servicio para movimientos de stock por ventas"""
    
    @staticmethod
    def record_sale_movement(sale, movement_type='sale'):
        """Registrar movimiento de stock por venta"""
        from apps.ecommerce.products.models import Product
        
        for item in sale.items.all():
            # Aquí podrías registrar en una tabla de movimientos de stock
            # Por ahora solo actualizamos el stock del producto
            pass
    
    @staticmethod
    def check_stock_availability(items_data):
        """Verificar disponibilidad de stock para una lista de items"""
        from apps.ecommerce.products.models import Product
        
        availability = []
        total_available = True
        
        for item_data in items_data:
            product_id = item_data.get('product_id')
            quantity = item_data.get('quantity', 0)
            
            try:
                product = Product.objects.get(id=product_id)
                available = product.stock_current >= quantity
                
                availability.append({
                    'product_id': product_id,
                    'product_name': product.name,
                    'quantity_requested': quantity,
                    'stock_available': product.stock_current,
                    'available': available
                })
                
                if not available:
                    total_available = False
                    
            except Product.DoesNotExist:
                availability.append({
                    'product_id': product_id,
                    'error': 'Producto no encontrado',
                    'available': False
                })
                total_available = False
        
        return {
            'total_available': total_available,
            'items': availability
        }


class SaleReportService:
    """Servicio para reportes de ventas"""
    
    @staticmethod
    def generate_sale_receipt(sale_id):
        """Generar recibo de venta en PDF"""
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib import colors
        from io import BytesIO
        from ..sales.models import Sale
        
        try:
            sale = Sale.objects.get(id=sale_id)
            buffer = BytesIO()
            
            doc = SimpleDocTemplate(buffer, pagesize=letter)
            styles = getSampleStyleSheet()
            story = []
            
            # Título
            title = Paragraph(f"RECIBO DE VENTA {sale.sale_number}", styles['Title'])
            story.append(title)
            story.append(Spacer(1, 20))
            
            # Información del cliente
            customer_info = f"""
            <b>Cliente:</b> {sale.customer_display_name}<br/>
            <b>Documento:</b> {sale.customer_document_display}<br/>
            <b>Fecha:</b> {sale.sale_date.strftime('%d/%m/%Y %H:%M')}<br/>
            <b>Método de Pago:</b> {sale.payment_method_display}
            """
            
            customer_para = Paragraph(customer_info, styles['Normal'])
            story.append(customer_para)
            story.append(Spacer(1, 20))
            
            # Tabla de productos
            data = [['Producto', 'Cantidad', 'P. Unit.', 'Total']]
            
            for item in sale.items.all():
                data.append([
                    item.product.name,
                    str(item.quantity),
                    f"S/.{item.unit_price:.2f}",
                    f"S/.{item.total:.2f}"
                ])
            
            # Totales
            data.extend([
                ['', '', 'Subtotal:', f"S/.{sale.subtotal:.2f}"],
                ['', '', 'IGV:', f"S/.{sale.tax_amount:.2f}"],
                ['', '', 'Total:', f"S/.{sale.total_amount:.2f}"]
            ])
            
            table = Table(data)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -4), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('BACKGROUND', (0, -3), (-1, -1), colors.lightgrey),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ]))
            
            story.append(table)
            
            # Construir documento
            doc.build(story)
            buffer.seek(0)
            
            return buffer
            
        except Sale.DoesNotExist:
            return None
        except Exception as e:
            logger.error(f"Error generando recibo: {e}")
            return None