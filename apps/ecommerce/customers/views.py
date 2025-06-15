# apps/ecommerce/customers/views.py
from rest_framework import generics, viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.db import models
from django.db.models import Q, Count, Sum
from .models import Customer, CustomerContact
from .serializers import (
    CustomerSerializer, 
    CustomerListSerializer,
    CustomerCreateFromDocumentSerializer,
    CustomerUpdateSerializer,
    CustomerQuickCreateSerializer,
    CustomerContactSerializer
)
from .services import *
from apps.ecommerce.customers.services_notifications import CustomerNotificationService
class CustomerListCreateAPIView(generics.ListCreateAPIView):
    """Lista todos los clientes con filtros y crea nuevos clientes"""
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CustomerSerializer
        return CustomerListSerializer

    def get_queryset(self):
        # AGREGAR las anotaciones que necesita CustomerListSerializer
        queryset = Customer.objects.all().annotate(
            total_sales_count=Count('sales'),
            total_sales_amount=Sum('sales__total_amount')
        ).prefetch_related('contacts')
        
        # Filtro por estado activo/inactivo
        status_filter = self.request.query_params.get('status')
        if status_filter == 'active':
            queryset = queryset.filter(is_active=True)
        elif status_filter == 'inactive':
            queryset = queryset.filter(is_active=False)
        elif status_filter == 'frequent':
            queryset = queryset.filter(is_frequent=True)

        # Filtro por tipo de cliente
        customer_type = self.request.query_params.get('customer_type')
        if customer_type:
            queryset = queryset.filter(customer_type=customer_type)

        # Filtro por tipo de documento
        document_type = self.request.query_params.get('document_type')
        if document_type:
            queryset = queryset.filter(document_type=document_type)

        # Filtro por búsqueda de texto
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(business_name__icontains=search) |
                Q(commercial_name__icontains=search) |
                Q(document_number__icontains=search) |
                Q(email__icontains=search)
            )

        return queryset.order_by('-created_at')

    def list(self, request):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"data": serializer.data})

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class DocumentSearchAPIView(APIView):
    """Vista para buscar documentos en APIs externas"""
    
    def get(self, request):
        document_number = request.query_params.get('document')
        document_type = request.query_params.get('type')
        
        if not document_number:
            return Response({
                "error": "Número de documento es requerido"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Limpiar documento
        document_number = document_number.strip()
        
        # Auto-detectar tipo si no se proporciona
        if not document_type:
            if len(document_number) == 8:
                document_type = '1'  # DNI
            elif len(document_number) == 11:
                document_type = '6'  # RUC
            else:
                return Response({
                    "error": "No se puede determinar el tipo de documento"
                }, status=status.HTTP_400_BAD_REQUEST)
        
        api_service = DocumentAPIService()
        
        try:
            if document_type == '6':  # RUC
                success, data = api_service.get_ruc_info(document_number)
            elif document_type == '1':  # DNI
                success, data = api_service.get_dni_info(document_number)
            else:
                return Response({
                    "error": "Tipo de documento no soportado"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if success:
                # Verificar si ya existe el cliente
                existing_customer = Customer.objects.filter(
                    document_number=document_number
                ).first()
                
                response_data = {
                    "document_info": data,
                    "existing_customer": None
                }
                
                if existing_customer:
                    response_data["existing_customer"] = CustomerSerializer(existing_customer).data
                
                return Response(response_data)
            else:
                return Response(data, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
                
        except Exception as e:
            return Response({
                "error": f"Error consultando documento: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CustomerQuickCreateAPIView(APIView):
    """Vista para creación rápida de clientes"""
    
    def post(self, request):
        serializer = CustomerQuickCreateSerializer(data=request.data)
        
        if serializer.is_valid():
            customer = serializer.save(created_by=request.user)
            response_serializer = CustomerSerializer(customer)
            
            return Response({
                "message": "Cliente creado exitosamente",
                "customer": response_serializer.data
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Vistas adicionales para plantillas
from django.views.generic import TemplateView
from web_project import TemplateLayout

class CustomerTemplateView(TemplateView):
    """Vista base para plantillas de clientes"""
    
    def get_context_data(self, **kwargs):
        context = TemplateLayout.init(self, super().get_context_data(**kwargs))
        return context
        queryset = Customer.objects.all().annotate(
            total_sales_count=Count('sales'),
            total_sales_amount=Sum('sales__total_amount')
        ).prefetch_related('contacts')
        
        # Filtro por estado activo/inactivo
        status_filter = self.request.query_params.get('status')
        if status_filter == 'active':
            queryset = queryset.filter(is_active=True)
        elif status_filter == 'inactive':
            queryset = queryset.filter(is_active=False)
        elif status_filter == 'frequent':
            queryset = queryset.filter(is_frequent=True)

        # Filtro por tipo de cliente
        customer_type = self.request.query_params.get('customer_type')
        if customer_type:
            queryset = queryset.filter(customer_type=customer_type)

        # Filtro por tipo de documento
        document_type = self.request.query_params.get('document_type')
        if document_type:
            queryset = queryset.filter(document_type=document_type)

        # Filtro por búsqueda de texto
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(business_name__icontains=search) |
                Q(commercial_name__icontains=search) |
                Q(document_number__icontains=search) |
                Q(email__icontains=search)
            )

        return queryset.order_by('-created_at')

    def list(self, request):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"data": serializer.data})

class CustomerViewSet(viewsets.ModelViewSet):
    """ViewSet completo para operaciones CRUD de clientes"""
    queryset = Customer.objects.all().prefetch_related('contacts', 'sales')
    serializer_class = CustomerSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    @action(detail=True, methods=['get'])
    def sales_analytics(self, request, pk=None):
        """Obtener analíticas detalladas de ventas del cliente"""
        customer = get_object_or_404(Customer, pk=pk)
        
        analytics = CustomerAnalyticsService.get_customer_sales_summary(customer.id)
        
        if analytics:
            return Response(analytics)
        else:
            return Response({
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
                    'total_sales': 0,
                    'total_amount': 0.0,
                    'avg_sale_amount': 0.0,
                    'last_sale_date': None,
                    'last_sale_amount': 0.0
                },
                'sales_by_payment_method': [],
                'monthly_sales': [],
                'top_products': []
            })
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return CustomerUpdateSerializer
        elif self.action == 'list':
            return CustomerListSerializer
        return CustomerSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'])
    def create_from_document(self, request):
        """Crear cliente desde documento usando API externa"""
        serializer = CustomerCreateFromDocumentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        document_number = serializer.validated_data['document_number']
        document_type = serializer.validated_data.get('document_type')

        success, result = CustomerService.create_customer_from_document(
            document_number=document_number,
            document_type=document_type,
            user=request.user
        )

        if success:
            customer_serializer = CustomerSerializer(result['customer'])
            return Response({
                "message": result['message'],
                "customer": customer_serializer.data,
                "api_data": result.get('api_data', {})
            }, status=status.HTTP_201_CREATED)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def update_from_api(self, request, pk=None):
        """Actualizar datos del cliente desde API"""
        customer = get_object_or_404(Customer, pk=pk)
        
        success, result = CustomerService.update_customer_from_api(customer.id)
        
        if success:
            customer_serializer = CustomerSerializer(result['customer'])
            return Response({
                "message": result['message'],
                "customer": customer_serializer.data
            })
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'])
    def toggle_active(self, request, pk=None):
        """Activar/desactivar cliente"""
        customer = get_object_or_404(Customer, pk=pk)
        customer.is_active = not customer.is_active
        customer.save()
        return Response({
            "message": f"Cliente {'activado' if customer.is_active else 'desactivado'}",
            "is_active": customer.is_active
        })

    @action(detail=True, methods=['patch'])
    def toggle_frequent(self, request, pk=None):
        """Marcar/desmarcar como cliente frecuente"""
        customer = get_object_or_404(Customer, pk=pk)
        customer.is_frequent = not customer.is_frequent
        customer.save()
        return Response({
            "message": f"Cliente {'marcado como frecuente' if customer.is_frequent else 'removido de frecuentes'}",
            "is_frequent": customer.is_frequent
        })

    @action(detail=True, methods=['patch'])
    def update_credit_limit(self, request, pk=None):
        """Actualizar límite de crédito"""
        customer = get_object_or_404(Customer, pk=pk)
        credit_limit = request.data.get('credit_limit')
        
        try:
            credit_limit = float(credit_limit)
            if credit_limit < 0:
                return Response({
                    "error": "El límite de crédito no puede ser negativo"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            customer.credit_limit = credit_limit
            customer.save()
            
            return Response({
                "message": f"Límite de crédito actualizado a S/.{credit_limit:.2f}",
                "credit_limit": customer.credit_limit
            })
            
        except (ValueError, TypeError):
            return Response({
                "error": "Límite de crédito inválido"
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """Obtener analíticas de clientes"""
        analytics = CustomerAnalyticsService.get_customer_analytics()
        return Response(analytics)

    @action(detail=False, methods=['get'])
    def search_document(self, request):
        """Buscar información de documento en APIs externas"""
        document_number = request.query_params.get('document')
        document_type = request.query_params.get('type')
        
        if not document_number:
            return Response({
                "error": "Número de documento es requerido"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        api_service = DocumentAPIService()
        
        if document_type == '6' or len(document_number) == 11:
            success, data = api_service.get_ruc_info(document_number)
        elif document_type == '1' or len(document_number) == 8:
            success, data = api_service.get_dni_info(document_number)
        else:
            return Response({
                "error": "Tipo de documento no válido"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if success:
            return Response(data)
        else:
            return Response(data, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def by_type(self, request):
        """Obtener clientes agrupados por tipo"""
        customers_by_type = {}
        
        for choice_value, choice_label in Customer.CUSTOMER_TYPE_CHOICES:
            customers = self.get_queryset().filter(customer_type=choice_value, is_active=True)
            customers_by_type[choice_value] = {
                'label': choice_label,
                'count': customers.count(),
                'customers': CustomerListSerializer(customers, many=True).data
            }
        
        return Response({"data": customers_by_type})

    @action(detail=False, methods=['get'])
    def frequent_customers(self, request):
        """Obtener clientes frecuentes"""
        customers = self.get_queryset().filter(is_frequent=True, is_active=True)
        serializer = CustomerListSerializer(customers, many=True)
        return Response({"data": serializer.data})

    @action(detail=True, methods=['get'])
    def sales_history(self, request, pk=None):
        """Obtener historial de ventas del cliente"""
        customer = get_object_or_404(Customer, pk=pk)
        sales = customer.sales.all().order_by('-sale_date')
        
        # Paginación simple
        page_size = int(request.query_params.get('page_size', 10))
        page = int(request.query_params.get('page', 1))
        start = (page - 1) * page_size
        end = start + page_size
        
        sales_page = sales[start:end]
        
        # Serializar usando el serializer de sales
        from apps.ecommerce.sales.serializers import SaleListSerializer
        serializer = SaleListSerializer(sales_page, many=True)
        
        return Response({
            "data": serializer.data,
            "total": sales.count(),
            "page": page,
            "page_size": page_size,
            "has_next": end < sales.count()
        })

    @action(detail=False, methods=['get'])
    def dashboard_analytics(self, request):
        """Analíticas para el dashboard"""
        queryset = self.get_queryset()
        
        total_customers = queryset.count()
        active_customers = queryset.filter(is_active=True).count()
        frequent_customers = queryset.filter(is_frequent=True).count()
        
        # Clientes con ventas
        customers_with_sales = queryset.filter(sales__isnull=False).distinct().count()
        
        # Top clientes por monto de ventas
        top_customers = queryset.annotate(
            total_spent=Sum('sales__total_amount')
        ).filter(total_spent__isnull=False).order_by('-total_spent')[:5]
        
        return Response({
            'total_customers': total_customers,
            'active_customers': active_customers,
            'inactive_customers': total_customers - active_customers,
            'frequent_customers': frequent_customers,
            'customers_with_sales': customers_with_sales,
            'top_customers': CustomerListSerializer(top_customers, many=True).data
        })

class CustomerContactViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar contactos de clientes"""
    queryset = CustomerContact.objects.all()
    serializer_class = CustomerContactSerializer

    def get_queryset(self):
        customer_id = self.request.query_params.get('customer', None)
        if customer_id:
            return self.queryset.filter(customer_id=customer_id)
        return self.queryset

    def perform_create(self, serializer):
    # Si se marca como contacto principal, desmarcar otros contactos del mismo cliente
        if serializer.validated_data.get('is_primary', False):
            customer = serializer.validated_data['customer']
            CustomerContact.objects.filter(
                customer=customer, is_primary=True
            ).update(is_primary=False)
        
        serializer.save()

    def perform_update(self, serializer):
    # Si se marca como contacto principal, desmarcar otros contactos del mismo cliente
        if serializer.validated_data.get('is_primary', False):
            customer = serializer.instance.customer
            CustomerContact.objects.filter(
                customer=customer, is_primary=True
            ).exclude(id=serializer.instance.id).update(is_primary=False)
        
        serializer.save()

    @action(detail=True, methods=['patch'])
    def set_primary(self, request, pk=None):
        """Marcar este contacto como principal"""
        contact = get_object_or_404(CustomerContact, pk=pk)
        
        # Desmarcar otros contactos principales del mismo cliente
        CustomerContact.objects.filter(
            customer=contact.customer, is_primary=True
        ).update(is_primary=False)
        
        # Marcar este como principal
        contact.is_primary = True
        contact.save()
        
        return Response({
            "message": f"Contacto {contact.name} marcado como principal",
            "is_primary": contact.is_primary
        })

    @action(detail=False, methods=['get'])
    def primary_contacts(self, request):
        """Obtener solo contactos principales"""
        primary_contacts = self.get_queryset().filter(is_primary=True)
        serializer = self.get_serializer(primary_contacts, many=True)
        return Response({"data": serializer.data})

    @action(detail=True, methods=['delete'])
    def remove_contact(self, request, pk=None):
        """Eliminar contacto con validaciones"""
        contact = get_object_or_404(CustomerContact, pk=pk)
        
        # Verificar si es el único contacto del cliente
        customer_contacts_count = CustomerContact.objects.filter(
            customer=contact.customer
        ).count()
        
        if customer_contacts_count <= 1:
            return Response({
                "error": "No se puede eliminar el único contacto del cliente"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Si es contacto principal, asignar otro como principal
        if contact.is_primary:
            next_contact = CustomerContact.objects.filter(
                customer=contact.customer
            ).exclude(id=contact.id).first()
            
            if next_contact:
                next_contact.is_primary = True
                next_contact.save()
        
        contact.delete()
        
        return Response({
            "message": "Contacto eliminado exitosamente"
        })

# apps/ecommerce/customers/views.py (Agregar al archivo existente)

class CustomerDocumentSearchAPIView(APIView):
    """Búsqueda de cliente por documento (local + API externa)"""
    
    def get(self, request):
        document = request.query_params.get('document', '').strip()
        
        if not document:
            return Response({
                "error": "Parámetro 'document' es requerido"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validar formato
        if len(document) not in [8, 11] or not document.isdigit():
            return Response({
                "error": "Documento debe tener 8 (DNI) o 11 (RUC) dígitos numéricos"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            success, result = CustomerSearchService.search_customer_by_document(document)
            
            if success:
                customer_data = CustomerSerializer(result['customer']).data
                return Response({
                    "success": True,
                    "source": result['source'],
                    "customer": customer_data,
                    "found_in_database": result.get('found_in_database', False),
                    "api_data": result.get('api_data', {})
                })
            else:
                return Response({
                    "success": False,
                    "source": result.get('source', 'unknown'),
                    "error": result.get('error', 'No encontrado'),
                    "document_number": document,
                    "document_type": result.get('document_type'),
                    "can_create_basic": result.get('can_create_basic', False)
                }, status=status.HTTP_404_NOT_FOUND)
                
        except Exception as e:
            return Response({
                "error": f"Error interno: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)