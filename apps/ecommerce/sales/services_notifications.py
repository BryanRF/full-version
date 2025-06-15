# apps/ecommerce/sales/services_notifications.py
from apps.notification.services import notification_service
from apps.notification.models import TipoNotificacion
from auth.models import Role

class SalesNotificationService:
    """Servicio para notificaciones de ventas"""
    
    @staticmethod
    def notify_sale_created(sale, created_by):
        """Notificar cuando se crea una nueva venta"""
        mensaje = f"Nueva venta {sale.sale_number} por S/.{sale.total_amount} creada por {created_by.get_full_name() or created_by.username}"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_VENTAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Nueva Venta Registrada",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-shopping-bag-line',
            color='success',
            url_accion=f'/app/sales/details/{sale.id}/',
            datos_adicionales={
                'venta_id': sale.id,
                'numero_venta': sale.sale_number,
                'total': float(sale.total_amount),
                'cliente': sale.customer_display_name,
                'metodo_pago': sale.payment_method,
                'creada_por': created_by.username
            },
            enviado_por=created_by
        )
    
    @staticmethod
    def notify_sale_confirmed(sale, confirmed_by):
        """Notificar cuando se confirma una venta"""
        mensaje = f"Venta {sale.sale_number} confirmada por S/.{sale.total_amount}"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_VENTAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Venta Confirmada",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-check-line',
            color='success',
            url_accion=f'/app/sales/details/{sale.id}/',
            datos_adicionales={
                'venta_id': sale.id,
                'numero_venta': sale.sale_number,
                'total': float(sale.total_amount),
                'cliente': sale.customer_display_name,
                'confirmada_por': confirmed_by.username,
                'estado': 'confirmada'
            },
            enviado_por=confirmed_by
        )
    
    @staticmethod
    def notify_sale_cancelled(sale, cancelled_by, reason=None):
        """Notificar cuando se cancela una venta"""
        mensaje = f"Venta {sale.sale_number} cancelada"
        if reason:
            mensaje += f": {reason}"
        
        datos_adicionales = {
            'venta_id': sale.id,
            'numero_venta': sale.sale_number,
            'total': float(sale.total_amount),
            'cliente': sale.customer_display_name,
            'cancelada_por': cancelled_by.username
        }
        
        if reason:
            datos_adicionales['motivo'] = reason
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_VENTAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Venta Cancelada",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-close-line',
            color='danger',
            url_accion=f'/app/sales/details/{sale.id}/',
            datos_adicionales=datos_adicionales,
            enviado_por=cancelled_by
        )
    
    @staticmethod
    def notify_low_stock_after_sale(sale, low_stock_products):
        """Notificar productos con stock bajo después de una venta"""
        if not low_stock_products:
            return
        
        productos_nombres = [p.name for p in low_stock_products[:3]]
        mensaje = f"Venta {sale.sale_number} dejó {len(low_stock_products)} producto(s) con stock bajo: {', '.join(productos_nombres)}"
        if len(low_stock_products) > 3:
            mensaje += "..."
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.PLANIFICADOR_COMPRAS, Role.GERENTE_COMPRAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Stock Bajo Después de Venta",
            tipo=TipoNotificacion.ALERTA_STOCK,
            icono='ri-alert-line',
            color='warning',
            url_accion='/app/ecommerce/product/list/?stock=low_stock',
            datos_adicionales={
                'venta_id': sale.id,
                'numero_venta': sale.sale_number,
                'productos_bajo_stock': [
                    {
                        'id': p.id,
                        'nombre': p.name,
                        'stock_actual': p.stock_current,
                        'stock_minimo': p.stock_minimum
                    } for p in low_stock_products
                ],
                'total_productos_afectados': len(low_stock_products)
            }
        )
    
    @staticmethod
    def notify_sale_status_changed(sale, user, old_status, new_status):
        """Notificar cambio de estado de venta"""
        status_display = {
            'draft': 'Borrador',
            'pending': 'Pendiente',
            'confirmed': 'Confirmado',
            'invoiced': 'Facturado',
            'delivered': 'Entregado',
            'paid': 'Pagado',
            'completed': 'Completado',
            'cancelled': 'Cancelado',
            'returned': 'Devuelto'
        }
        
        mensaje = f"Venta {sale.sale_number} cambió de {status_display.get(old_status, old_status)} a {status_display.get(new_status, new_status)}"
        
        color_map = {
            'confirmed': 'success',
            'delivered': 'success',
            'completed': 'success',
            'cancelled': 'danger',
            'returned': 'warning',
            'paid': 'success'
        }
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_VENTAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Estado de Venta Actualizado",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-refresh-line',
            color=color_map.get(new_status, 'info'),
            url_accion=f'/app/sales/details/{sale.id}/',
            datos_adicionales={
                'venta_id': sale.id,
                'numero_venta': sale.sale_number,
                'estado_anterior': old_status,
                'estado_nuevo': new_status,
                'actualizado_por': user.username,
                'cliente': sale.customer_display_name
            },
            enviado_por=user
        )
    
    @staticmethod
    def notify_large_sale(sale, threshold=5000):
        """Notificar venta grande (alto valor)"""
        if sale.total_amount < threshold:
            return
        
        mensaje = f"Venta de alto valor: {sale.sale_number} por S/.{sale.total_amount:,.2f}"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_VENTAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Venta de Alto Valor",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-money-dollar-circle-line',
            color='success',
            url_accion=f'/app/sales/details/{sale.id}/',
            datos_adicionales={
                'venta_id': sale.id,
                'numero_venta': sale.sale_number,
                'total': float(sale.total_amount),
                'cliente': sale.customer_display_name,
                'es_venta_grande': True,
                'umbral': threshold
            }
        )
    
    @staticmethod
    def notify_frequent_customer_sale(sale, customer):
        """Notificar venta de cliente frecuente"""
        if not customer or not customer.is_frequent:
            return
        
        mensaje = f"Venta de cliente frecuente: {customer.display_name} - {sale.sale_number}"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_VENTAS],
            mensaje=mensaje,
            titulo="Venta de Cliente Frecuente",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-vip-crown-line',
            color='primary',
            url_accion=f'/app/sales/details/{sale.id}/',
            datos_adicionales={
                'venta_id': sale.id,
                'numero_venta': sale.sale_number,
                'cliente_id': customer.id,
                'cliente_nombre': customer.display_name,
                'es_cliente_frecuente': True,
                'total': float(sale.total_amount)
            }
        )
    
    @staticmethod
    def notify_payment_received(sale_payment):
        """Notificar pago recibido"""
        sale = sale_payment.sale
        mensaje = f"Pago recibido: S/.{sale_payment.amount} para venta {sale.sale_number}"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_VENTAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Pago Recibido",
            tipo=TipoNotificacion.ESTADO_PEDIDO,
            icono='ri-secure-payment-line',
            color='success',
            url_accion=f'/app/sales/details/{sale.id}/',
            datos_adicionales={
                'venta_id': sale.id,
                'numero_venta': sale.sale_number,
                'pago_id': sale_payment.id,
                'monto_pago': float(sale_payment.amount),
                'metodo_pago': sale_payment.payment_method,
                'cliente': sale.customer_display_name
            }
        )
    
    @staticmethod
    def notify_daily_sales_summary(total_sales, total_amount, user=None):
        """Notificar resumen diario de ventas"""
        mensaje = f"Resumen diario: {total_sales} ventas por S/.{total_amount:,.2f}"
        
        return notification_service.enviar_notificacion_roles(
            roles=[Role.GERENTE_VENTAS, Role.ADMINISTRADOR_SISTEMA],
            mensaje=mensaje,
            titulo="Resumen Diario de Ventas",
            tipo=TipoNotificacion.SISTEMA,
            icono='ri-line-chart-line',
            color='info',
            url_accion='/app/sales/dashboard/',
            datos_adicionales={
                'total_ventas': total_sales,
                'total_monto': float(total_amount),
                'fecha': date.today().isoformat(),
                'tipo_reporte': 'diario'
            },
            enviado_por=user
        )