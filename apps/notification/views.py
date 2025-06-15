from django.shortcuts import render

# Create your views here.
# apps/notifications/views.py
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.decorators import login_required
from django.views.generic import TemplateView
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from .models import Notificacion, NotificacionGrupal, TipoNotificacion
from .serializers import NotificacionSerializer, NotificacionGrupalSerializer
from .services import notification_service
from web_project import TemplateLayout
from auth.models import Role

class NotificacionListView(generics.ListAPIView):
    """API para listar notificaciones del usuario autenticado"""
    serializer_class = NotificacionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        queryset = Notificacion.objects.filter(usuario=user)
        
        # Filtro por leídas/no leídas
        leidas = self.request.query_params.get('leidas', None)
        if leidas is not None:
            if leidas.lower() == 'false':
                queryset = queryset.filter(leida=False)
            elif leidas.lower() == 'true':
                queryset = queryset.filter(leida=True)
        
        # Filtro por tipo
        tipo = self.request.query_params.get('tipo', None)
        if tipo:
            queryset = queryset.filter(tipo_notificacion=tipo)
        
        return queryset.order_by('-fecha_hora')
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        
        # Incluir estadísticas
        unread_count = notification_service.obtener_conteo_no_leidas(request.user)
        
        return Response({
            'data': serializer.data,
            'unread_count': unread_count,
            'total_count': queryset.count()
        })

class NotificacionViewSet(viewsets.ModelViewSet):
    """ViewSet completo para gestionar notificaciones"""
    serializer_class = NotificacionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Notificacion.objects.filter(usuario=self.request.user)
    
    @action(detail=True, methods=['patch'])
    def marcar_leida(self, request, pk=None):
        """Marca una notificación como leída"""
        notificacion = get_object_or_404(Notificacion, pk=pk, usuario=request.user)
        notificacion.marcar_como_leida()
        
        return Response({
            'message': 'Notificación marcada como leída',
            'leida': True
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['patch'])
    def marcar_todas_leidas(self, request):
        """Marca todas las notificaciones como leídas"""
        count = notification_service.marcar_todas_como_leidas(request.user)
        
        return Response({
            'message': f'{count} notificaciones marcadas como leídas',
            'count': count
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'])
    def conteo_no_leidas(self, request):
        """Obtiene el conteo de notificaciones no leídas"""
        count = notification_service.obtener_conteo_no_leidas(request.user)
        return Response({'unread_count': count})
    
    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        """Obtiene estadísticas de notificaciones del usuario"""
        user = request.user
        
        total = Notificacion.objects.filter(usuario=user).count()
        no_leidas = Notificacion.objects.filter(usuario=user, leida=False).count()
        leidas = total - no_leidas
        
        # Estadísticas por tipo
        tipos_stats = {}
        for tipo_choice in TipoNotificacion.choices:
            tipo_key = tipo_choice[0]
            count = Notificacion.objects.filter(
                usuario=user, 
                tipo_notificacion=tipo_key
            ).count()
            tipos_stats[tipo_key] = count
        
        return Response({
            'total': total,
            'leidas': leidas,
            'no_leidas': no_leidas,
            'por_tipo': tipos_stats
        })

class NotificacionGrupalViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar notificaciones grupales (solo admin)"""
    serializer_class = NotificacionGrupalSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Solo administradores pueden ver todas las notificaciones grupales
        if self.request.user.is_staff or (
            hasattr(self.request.user, 'profile') and 
            self.request.user.profile.role == Role.ADMINISTRADOR_SISTEMA
        ):
            return NotificacionGrupal.objects.all()
        return NotificacionGrupal.objects.filter(enviado_por=self.request.user)
    
    def perform_create(self, serializer):
        """Al crear una notificación grupal, asignar el usuario que la envía"""
        serializer.save(enviado_por=self.request.user)

@login_required
def notificaciones_json(request):
    """Vista JSON para obtener notificaciones (para uso con AJAX)"""
    user = request.user
    
    # Parámetros de consulta
    limit = int(request.GET.get('limit', 10))
    offset = int(request.GET.get('offset', 0))
    only_unread = request.GET.get('only_unread', 'false').lower() == 'true'
    
    # Consulta base
    queryset = Notificacion.objects.filter(usuario=user)
    
    if only_unread:
        queryset = queryset.filter(leida=False)
    
    # Paginación manual
    total = queryset.count()
    notifications = queryset.order_by('-fecha_hora')[offset:offset + limit]
    
    # Serializar datos
    data = []
    for notif in notifications:
        data.append({
            'id': notif.id,
            'titulo': notif.titulo,
            'mensaje': notif.mensaje,
            'tipo': notif.tipo_notificacion,
            'icono': notif.icono,
            'color': notif.color,
            'url_accion': notif.url_accion,
            'fecha_hora': notif.fecha_hora.isoformat(),
            'tiempo_transcurrido': notif.tiempo_transcurrido,
            'leida': notif.leida,
            'datos_adicionales': notif.datos_adicionales
        })
    
    unread_count = Notificacion.objects.filter(usuario=user, leida=False).count()
    
    return JsonResponse({
        'notifications': data,
        'total': total,
        'unread_count': unread_count,
        'has_more': (offset + limit) < total
    })

@login_required 
def marcar_notificacion_leida(request, notification_id):
    """Vista para marcar una notificación como leída"""
    if request.method == 'POST':
        try:
            notificacion = Notificacion.objects.get(
                id=notification_id, 
                usuario=request.user
            )
            notificacion.marcar_como_leida()
            
            return JsonResponse({
                'success': True,
                'message': 'Notificación marcada como leída'
            })
        except Notificacion.DoesNotExist:
            return JsonResponse({
                'success': False,
                'message': 'Notificación no encontrada'
            }, status=404)
    
    return JsonResponse({
        'success': False,
        'message': 'Método no permitido'
    }, status=405)

class NotificationsTemplateView(TemplateView):
    """Vista de template para la página de notificaciones"""
    
    def get_context_data(self, **kwargs):
        context = TemplateLayout.init(self, super().get_context_data(**kwargs))
        
        user = self.request.user
        
        # Estadísticas básicas
        total_notificaciones = Notificacion.objects.filter(usuario=user).count()
        no_leidas = Notificacion.objects.filter(usuario=user, leida=False).count()
        
        # Últimas notificaciones
        ultimas_notificaciones = Notificacion.objects.filter(
            usuario=user
        ).order_by('-fecha_hora')[:10]
        
        # Tipos de notificación disponibles
        tipos_notificacion = TipoNotificacion.choices
        
        context.update({
            'total_notificaciones': total_notificaciones,
            'no_leidas': no_leidas,
            'ultimas_notificaciones': ultimas_notificaciones,
            'tipos_notificacion': tipos_notificacion,
        })
        
        return context

# Vista para administradores - enviar notificaciones
class EnviarNotificacionView(TemplateView):
    """Vista para que los administradores envíen notificaciones"""
    
    def get_context_data(self, **kwargs):
        context = TemplateLayout.init(self, super().get_context_data(**kwargs))
        
        # Solo para administradores
        if not (self.request.user.is_staff or (
            hasattr(self.request.user, 'profile') and 
            self.request.user.profile.role == Role.ADMINISTRADOR_SISTEMA
        )):
            context['error'] = 'No tienes permisos para acceder a esta página'
            return context
        
        # Roles disponibles
        roles_disponibles = Role.choices
        tipos_notificacion = TipoNotificacion.choices
        
        context.update({
            'roles_disponibles': roles_disponibles,
            'tipos_notificacion': tipos_notificacion,
        })
        
        return context
    
    def post(self, request, *args, **kwargs):
        """Procesar el envío de notificaciones"""
        if not (request.user.is_staff or (
            hasattr(request.user, 'profile') and 
            request.user.profile.role == Role.ADMINISTRADOR_SISTEMA
        )):
            return JsonResponse({
                'success': False,
                'message': 'No tienes permisos para enviar notificaciones'
            }, status=403)
        
        try:
            # Obtener datos del formulario
            titulo = request.POST.get('titulo')
            mensaje = request.POST.get('mensaje')
            tipo = request.POST.get('tipo', TipoNotificacion.SISTEMA)
            color = request.POST.get('color', 'info')
            url_accion = request.POST.get('url_accion', '')
            
            # Roles seleccionados
            roles_seleccionados = request.POST.getlist('roles')
            
            if not titulo or not mensaje:
                return JsonResponse({
                    'success': False,
                    'message': 'Título y mensaje son obligatorios'
                }, status=400)
            
            if not roles_seleccionados:
                return JsonResponse({
                    'success': False,
                    'message': 'Debe seleccionar al menos un rol'
                }, status=400)
            
            # Enviar notificación
            notificacion_grupal = notification_service.enviar_notificacion_roles(
                roles=roles_seleccionados,
                mensaje=mensaje,
                titulo=titulo,
                tipo=tipo,
                color=color,
                url_accion=url_accion if url_accion else None,
                enviado_por=request.user
            )
            
            return JsonResponse({
                'success': True,
                'message': f'Notificación enviada a roles: {", ".join(roles_seleccionados)}',
                'notificacion_id': notificacion_grupal.id
            })
            
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'Error al enviar notificación: {str(e)}'
            }, status=500)