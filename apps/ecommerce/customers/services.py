# apps/ecommerce/customers/services.py
import requests
import logging
from django.conf import settings
from typing import Dict, Optional, Tuple
from .models import Customer

logger = logging.getLogger(__name__)

class DocumentAPIService:
    """Servicio para consultar APIs de documentos RUC/DNI"""
    
    def __init__(self):
        self.api_token = getattr(settings, 'DOCUMENT_API_TOKEN', None)
        self.base_url = getattr(settings, 'DOCUMENT_API_BASE_URL', 'https://api.example.com')
        
        if not self.api_token:
            logger.warning("DOCUMENT_API_TOKEN no configurado en settings")
    
    def _make_request(self, endpoint: str, params: Dict = None) -> Tuple[bool, Dict]:
        """Hacer request a la API"""
        if not self.api_token:
            return False, {"error": "Token de API no configurado"}
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_token}'
        }
        
        try:
            url = f"{self.base_url}{endpoint}"
            response = requests.get(url, headers=headers, params=params, timeout=10)
            
            if response.status_code == 200:
                return True, response.json()
            elif response.status_code == 422:
                return False, {"error": "Documento no válido"}
            else:
                return False, {"error": f"Error en API: {response.status_code}"}
                
        except requests.RequestException as e:
            logger.error(f"Error en request de API: {e}")
            return False, {"error": "Error de conexión con la API"}
    
    def get_ruc_info(self, ruc: str) -> Tuple[bool, Dict]:
        """Consultar información de RUC"""
        if not ruc or len(ruc) != 11:
            return False, {"error": "RUC debe tener 11 dígitos"}
        
        endpoint = f"/v2/sunat/ruc"
        params = {"numero": ruc}
        
        success, data = self._make_request(endpoint, params)
        
        if success:
            # Mapear respuesta a nuestro formato
            mapped_data = {
                'document_type': '6',  # RUC
                'document_number': data.get('numeroDocumento', ruc),
                'business_name': data.get('razonSocial', ''),
                'commercial_name': data.get('razonSocial', ''),
                'address': data.get('direccion', ''),
                'district': data.get('distrito', ''),
                'province': data.get('provincia', ''),
                'department': data.get('departamento', ''),
                'ubigeo': data.get('ubigeo', ''),
                'sunat_status': data.get('estado', ''),
                'sunat_condition': data.get('condicion', ''),
                'customer_type': 'persona_juridica',
                # Información adicional que podemos extraer
                'via_tipo': data.get('viaTipo', ''),
                'via_nombre': data.get('viaNombre', ''),
                'numero': data.get('numero', ''),
                'interior': data.get('interior', ''),
                'zona_tipo': data.get('zonaTipo', ''),
                'zona_codigo': data.get('zonaCodigo', ''),
                'es_agente_retencion': data.get('EsAgenteRetencion', False),
            }
            return True, mapped_data
        
        return success, data
    
    def get_dni_info(self, dni: str) -> Tuple[bool, Dict]:
        """Consultar información de DNI"""
        if not dni or len(dni) != 8:
            return False, {"error": "DNI debe tener 8 dígitos"}
        
        endpoint = f"/v2/reniec/dni"
        params = {"numero": dni}
        
        success, data = self._make_request(endpoint, params)
        
        if success:
            # Mapear respuesta a nuestro formato
            mapped_data = {
                'document_type': '1',  # DNI
                'document_number': data.get('numeroDocumento', dni),
                'first_name': data.get('nombres', ''),
                'last_name': f"{data.get('apellidoPaterno', '')} {data.get('apellidoMaterno', '')}".strip(),
                'customer_type': 'persona_natural',
                'digito_verificador': data.get('digitoVerificador', ''),
            }
            return True, mapped_data
        
        return success, data


class CustomerService:
    """Servicio para operaciones con clientes"""
    
    @staticmethod
    def create_customer_from_document(document_number: str, document_type: str = None, user=None) -> Tuple[bool, Dict]:
        """Crear cliente desde documento usando APIs externas"""
        
        # Auto-detectar tipo de documento si no se proporciona
        if not document_type:
            if len(document_number) == 8:
                document_type = '1'  # DNI
            elif len(document_number) == 11:
                document_type = '6'  # RUC
            else:
                return False, {"error": "Tipo de documento no puede ser determinado automáticamente"}
        
        # Verificar si ya existe
        existing_customer = Customer.objects.filter(document_number=document_number).first()
        if existing_customer:
            return False, {"error": "Ya existe un cliente con este documento", "customer": existing_customer}
        
        api_service = DocumentAPIService()
        
        try:
            if document_type == '6':  # RUC
                success, data = api_service.get_ruc_info(document_number)
            elif document_type == '1':  # DNI
                success, data = api_service.get_dni_info(document_number)
            else:
                # Para otros tipos de documento, crear manualmente
                data = {
                    'document_type': document_type,
                    'document_number': document_number,
                    'first_name': '',
                    'customer_type': 'persona_natural' if document_type in ['1', '4', '7'] else 'persona_juridica'
                }
                success = True
            
            if success:
                # Crear cliente con datos de la API
                customer_data = {
                    'document_type': data.get('document_type', document_type),
                    'document_number': data.get('document_number', document_number),
                    'customer_type': data.get('customer_type', 'persona_natural'),
                    'first_name': data.get('first_name', ''),
                    'last_name': data.get('last_name', ''),
                    'business_name': data.get('business_name', ''),
                    'commercial_name': data.get('commercial_name', ''),
                    'address': data.get('address', ''),
                    'district': data.get('district', ''),
                    'province': data.get('province', ''),
                    'department': data.get('department', ''),
                    'ubigeo': data.get('ubigeo', ''),
                    'sunat_status': data.get('sunat_status', ''),
                    'sunat_condition': data.get('sunat_condition', ''),
                    'created_by': user,
                }
                
                # Filtrar campos vacíos
                customer_data = {k: v for k, v in customer_data.items() if v is not None and v != ''}
                
                # Asegurar que tenga al menos un nombre
                if customer_data.get('customer_type') == 'persona_juridica' and not customer_data.get('business_name'):
                    customer_data['business_name'] = f'Empresa RUC {document_number}'
                elif customer_data.get('customer_type') == 'persona_natural' and not customer_data.get('first_name'):
                    customer_data['first_name'] = f'Cliente DNI {document_number}'
                
                customer = Customer.objects.create(**customer_data)
                
                return True, {
                    "message": "Cliente creado exitosamente",
                    "customer": customer,
                    "api_data": data
                }
            else:
                return False, data
                
        except Exception as e:
            logger.error(f"Error creando cliente desde documento: {e}")
            return False, {"error": f"Error interno: {str(e)}"}
    @staticmethod
    def update_customer_from_api(customer_id: int) -> Tuple[bool, Dict]:
        """Actualizar datos del cliente desde API"""
        
        
        try:
            customer = Customer.objects.get(id=customer_id)
            api_service = DocumentAPIService()
            
            if customer.document_type == '6':  # RUC
                success, data = api_service.get_ruc_info(customer.document_number)
            elif customer.document_type == '1':  # DNI
                success, data = api_service.get_dni_info(customer.document_number)
            else:
                return False, {"error": "Tipo de documento no soportado para actualización automática"}
            
            if success:
                # Actualizar campos
                for field, value in data.items():
                    if hasattr(customer, field) and value:
                        setattr(customer, field, value)
                
                customer.save()
                
                return True, {
                    "message": "Cliente actualizado exitosamente",
                    "customer": customer
                }
            else:
                return False, data
                
        except Customer.DoesNotExist:
            return False, {"error": "Cliente no encontrado"}
        except Exception as e:
            logger.error(f"Error actualizando cliente: {e}")
            return False, {"error": f"Error interno: {str(e)}"}


class CustomerAnalyticsService:
    """Servicio para analíticas de clientes"""
    
    @staticmethod
    def get_customer_analytics():
        """Obtener analíticas de clientes"""
        
        from django.db.models import Sum, Count, Q
        from datetime import date, timedelta
        
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
        
        # Clientes con ventas (últimos 30 días)
        last_month = date.today() - timedelta(days=30)
        customers_with_recent_sales = Customer.objects.filter(
            sales__sale_date__date__gte=last_month
        ).distinct().count()
        
        # Top clientes por ventas (monto total)
        top_customers_by_amount = Customer.objects.annotate(
            total_sales=Count('sales'),
            total_amount=Sum('sales__total_amount')
        ).filter(total_sales__gt=0).order_by('-total_amount')[:10]
        
        # Top clientes por frecuencia (número de ventas)
        top_customers_by_frequency = Customer.objects.annotate(
            total_sales=Count('sales'),
            total_amount=Sum('sales__total_amount')
        ).filter(total_sales__gt=0).order_by('-total_sales')[:10]
        
        # Clientes nuevos (últimos 7 días)
        last_week = date.today() - timedelta(days=7)
        new_customers = Customer.objects.filter(
            created_at__date__gte=last_week
        ).count()
        
        # Distribución por ubicación (departamento)
        customers_by_location = Customer.objects.exclude(
            department__isnull=True
        ).exclude(
            department__exact=''
        ).values('department').annotate(
            count=Count('id')
        ).order_by('-count')[:10]
        
        # Clientes con crédito
        customers_with_credit = Customer.objects.filter(
            credit_limit__gt=0
        ).count()
        
        total_credit_limit = Customer.objects.aggregate(
            total_credit=Sum('credit_limit')
        )['total_credit'] or 0
        
        return {
            'total_customers': total_customers,
            'active_customers': active_customers,
            'inactive_customers': total_customers - active_customers,
            'frequent_customers': frequent_customers,
            'new_customers_this_week': new_customers,
            'customers_with_recent_sales': customers_with_recent_sales,
            'customers_with_credit': customers_with_credit,
            'total_credit_limit': float(total_credit_limit),
            'customers_by_type': [
                {
                    'type': item['customer_type'],
                    'type_display': 'Persona Jurídica' if item['customer_type'] == 'persona_juridica' else 'Persona Natural',
                    'count': item['count']
                }
                for item in customers_by_type
            ],
            'customers_by_document': [
                {
                    'document_type': item['document_type'],
                    'document_type_display': dict(Customer.DOCUMENT_TYPE_CHOICES).get(item['document_type'], item['document_type']),
                    'count': item['count']
                }
                for item in customers_by_document
            ],
            'customers_by_location': [
                {
                    'location': item['department'],
                    'count': item['count']
                }
                for item in customers_by_location
            ],
            'top_customers_by_amount': [
                {
                    'id': customer.id,
                    'name': customer.display_name,
                    'document': customer.document_number,
                    'total_sales': customer.total_sales,
                    'total_amount': float(customer.total_amount or 0),
                    'is_frequent': customer.is_frequent
                }
                for customer in top_customers_by_amount
            ],
            'top_customers_by_frequency': [
                {
                    'id': customer.id,
                    'name': customer.display_name,
                    'document': customer.document_number,
                    'total_sales': customer.total_sales,
                    'total_amount': float(customer.total_amount or 0),
                    'is_frequent': customer.is_frequent
                }
                for customer in top_customers_by_frequency
            ]
        }
    
    @staticmethod
    def get_customer_sales_summary(customer_id):
        """Obtener resumen de ventas de un cliente específico"""
        
        from django.db.models import Sum, Count, Avg
        from datetime import date, timedelta
        
        try:
            customer = Customer.objects.get(id=customer_id)
        except Customer.DoesNotExist:
            return None
        
        # Estadísticas generales
        total_sales = customer.sales.count()
        total_amount = customer.sales.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        avg_sale_amount = customer.sales.aggregate(Avg('total_amount'))['total_amount__avg'] or 0
        
        # Última venta
        last_sale = customer.sales.order_by('-sale_date').first()
        
        # Ventas por método de pago
        sales_by_payment_method = customer.sales.values('payment_method').annotate(
            count=Count('id'),
            total=Sum('total_amount')
        ).order_by('-total')
        
        # Ventas por mes (últimos 12 meses)
        monthly_sales = []
        for i in range(12):
            month_start = date.today().replace(day=1) - timedelta(days=30*i)
            month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            
            month_data = customer.sales.filter(
                sale_date__date__gte=month_start,
                sale_date__date__lte=month_end
            ).aggregate(
                count=Count('id'),
                total=Sum('total_amount')
            )
            
            monthly_sales.append({
                'month': month_start.strftime('%Y-%m'),
                'month_name': month_start.strftime('%B %Y'),
                'count': month_data['count'] or 0,
                'total': float(month_data['total'] or 0)
            })
        
        monthly_sales.reverse()  # Orden cronológico
        
        # Productos más comprados
        from django.db.models import F
        top_products = customer.sales.values(
            'items__product__name',
            'items__product__code'
        ).annotate(
            total_quantity=Sum('items__quantity'),
            total_amount=Sum(F('items__quantity') * F('items__unit_price'))
        ).order_by('-total_quantity')[:10]
        
        return {
            'customer': {
                'id': customer.id,
                'name': customer.display_name,
                'document': f"{customer.document_type_display}: {customer.document_number}",
                'email': customer.email,
                'phone': customer.mobile_phone or customer.phone,
                'is_frequent': customer.is_frequent,
                'credit_limit': float(customer.credit_limit)
            },
            'summary': {
                'total_sales': total_sales,
                'total_amount': float(total_amount),
                'avg_sale_amount': float(avg_sale_amount),
                'last_sale_date': last_sale.sale_date if last_sale else None,
                'last_sale_amount': float(last_sale.total_amount) if last_sale else 0
            },
            'sales_by_payment_method': [
                {
                    'method': item['payment_method'],
                    'method_display': dict(Customer._meta.get_field('sales__payment_method').choices if hasattr(Customer._meta.get_field('sales'), 'payment_method') else []).get(item['payment_method'], item['payment_method']),
                    'count': item['count'],
                    'total': float(item['total'] or 0)
                }
                for item in sales_by_payment_method
            ],
            'monthly_sales': monthly_sales,
            'top_products': [
                {
                    'product_name': item['items__product__name'],
                    'product_code': item['items__product__code'],
                    'total_quantity': item['total_quantity'],
                    'total_amount': float(item['total_amount'] or 0)
                }
                for item in top_products if item['items__product__name']
            ]
        }
    
    @staticmethod
    def get_customer_segment_analysis():
        """Análisis de segmentación de clientes"""
        
        from django.db.models import Sum, Count, Q, Case, When, IntegerField
        
        try:  # <-- Añadir el try que faltaba
            # Segmentación por valor de compras
            customers_with_sales = Customer.objects.annotate(
                total_sales_amount=Sum('sales__total_amount'),
                total_sales_count=Count('sales')
            ).filter(total_sales_count__gt=0)
            
            # Definir segmentos por valor
            high_value_threshold = 5000  # S/.5,000
            medium_value_threshold = 1000  # S/.1,000
            
            segments = customers_with_sales.aggregate(
                high_value=Count('id', filter=Q(total_sales_amount__gte=high_value_threshold)),
                medium_value=Count('id', filter=Q(
                    total_sales_amount__gte=medium_value_threshold,
                    total_sales_amount__lt=high_value_threshold
                )),
                low_value=Count('id', filter=Q(total_sales_amount__lt=medium_value_threshold))
            )
            
            # Segmentación por frecuencia
            frequent_threshold = 5  # 5 o más compras
            
            frequency_segments = customers_with_sales.aggregate(
                very_frequent=Count('id', filter=Q(total_sales_count__gte=frequent_threshold, is_frequent=True)),
                frequent=Count('id', filter=Q(total_sales_count__gte=frequent_threshold, is_frequent=False)),
                occasional=Count('id', filter=Q(total_sales_count__lt=frequent_threshold))
            )
            
            # Clientes por tipo de documento y valor
            document_value_analysis = Customer.objects.filter(
                sales__isnull=False
            ).values('document_type').annotate(
                customer_count=Count('id', distinct=True),
                total_sales_amount=Sum('sales__total_amount'),
                avg_sale_amount=Sum('sales__total_amount') / Count('sales', distinct=True)
            )
            
            return {
                'value_segments': {
                    'high_value': segments['high_value'],
                    'medium_value': segments['medium_value'],
                    'low_value': segments['low_value'],
                    'thresholds': {
                        'high_value': high_value_threshold,
                        'medium_value': medium_value_threshold
                    }
                },
                'frequency_segments': {
                    'very_frequent': frequency_segments['very_frequent'],
                    'frequent': frequency_segments['frequent'],
                    'occasional': frequency_segments['occasional'],
                    'threshold': frequent_threshold
                },
                'document_analysis': [
                    {
                        'document_type': item['document_type'],
                        'document_type_display': dict(Customer.DOCUMENT_TYPE_CHOICES).get(item['document_type'], item['document_type']),
                        'customer_count': item['customer_count'],
                        'total_sales_amount': float(item['total_sales_amount'] or 0),
                        'avg_sale_amount': float(item['avg_sale_amount'] or 0)
                    }
                    for item in document_value_analysis
                ]
            }
        except Exception as e:
            logger.error(f"Error en segmentación de clientes: {e}")
            return None


class CustomerSearchService:
    """Servicio para búsqueda inteligente de clientes"""
    
    @staticmethod
    def search_customer_by_document(document_number: str) -> Tuple[bool, Dict]:
        """Buscar cliente por documento (local primero, luego API)"""
        document_number = document_number.strip()
        
        if not document_number:
            return False, {"error": "Documento requerido"}
        
        # Validar formato básico
        if len(document_number) not in [8, 11]:
            return False, {"error": "Documento debe tener 8 (DNI) o 11 (RUC) dígitos"}
        
        if not document_number.isdigit():
            return False, {"error": "Documento debe contener solo números"}
        
        # 1. Buscar primero en base de datos local
        existing_customer = Customer.objects.filter(document_number=document_number).first()
        if existing_customer:
            return True, {
                "source": "local",
                "customer": existing_customer,
                "found_in_database": True
            }
        
        # 2. Si no existe localmente, consultar API externa
        document_type = '1' if len(document_number) == 8 else '6'
        api_service = DocumentAPIService()
        
        try:
            if document_type == '6':  # RUC
                success, api_data = api_service.get_ruc_info(document_number)
            else:  # DNI
                success, api_data = api_service.get_dni_info(document_number)
            
            if success:
                # Crear cliente con datos de API
                customer_data = {
                    'document_type': api_data.get('document_type', document_type),
                    'document_number': api_data.get('document_number', document_number),
                    'customer_type': api_data.get('customer_type', 'persona_natural'),
                    'first_name': api_data.get('first_name', ''),
                    'last_name': api_data.get('last_name', ''),
                    'business_name': api_data.get('business_name', ''),
                    'commercial_name': api_data.get('commercial_name', ''),
                    'address': api_data.get('address', ''),
                    'district': api_data.get('district', ''),
                    'province': api_data.get('province', ''),
                    'department': api_data.get('department', ''),
                    'ubigeo': api_data.get('ubigeo', ''),
                    'sunat_status': api_data.get('sunat_status', ''),
                    'sunat_condition': api_data.get('sunat_condition', ''),
                }
                
                # Filtrar campos vacíos
                customer_data = {k: v for k, v in customer_data.items() if v}
                
                # Crear cliente
                customer = Customer.objects.create(**customer_data)
                
                return True, {
                    "source": "api",
                    "customer": customer,
                    "found_in_database": False,
                    "api_data": api_data
                }
            else:
                # API no encontró datos, pero documento es válido
                return False, {
                    "source": "api",
                    "error": "Documento no encontrado en registros oficiales",
                    "document_number": document_number,
                    "document_type": document_type,
                    "can_create_basic": True
                }
                
        except Exception as e:
            logger.error(f"Error en búsqueda de documento: {e}")
            return False, {
                "source": "error",
                "error": "Error consultando registros oficiales",
                "document_number": document_number,
                "document_type": document_type,
                "can_create_basic": True
            }
    
    @staticmethod
    def create_basic_customer(document_number: str, customer_name: str = None) -> Customer:
        """Crear cliente básico sin API"""
        document_type = '1' if len(document_number) == 8 else '6'
        
        customer_data = {
            'document_type': document_type,
            'document_number': document_number,
            'customer_type': 'persona_natural' if document_type == '1' else 'persona_juridica'
        }
        
        if customer_name:
            if document_type == '6':  # RUC - Es empresa
                customer_data['business_name'] = customer_name
            else:  # DNI - Es persona
                names = customer_name.split(' ', 1)
                customer_data['first_name'] = names[0]
                if len(names) > 1:
                    customer_data['last_name'] = names[1]
        else:
            # Nombre por defecto
            if document_type == '6':
                customer_data['business_name'] = f"Empresa RUC {document_number}"
            else:
                customer_data['first_name'] = f"Cliente DNI {document_number}"
        
        return Customer.objects.create(**customer_data)