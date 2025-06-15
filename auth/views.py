from django.views.generic import TemplateView
from web_project import TemplateLayout
from web_project.template_helpers.theme import TemplateHelper


"""
This file is a view controller for multiple pages as a module.
Here you can override the page view layout.
Refer to auth/urls.py file for more pages.
"""


class AuthView(TemplateView):
    # Predefined function
    def get_context_data(self, **kwargs):
        # A function to init the global layout. It is defined in web_project/__init__.py file
        context = TemplateLayout.init(self, super().get_context_data(**kwargs))

        # Update the context
        context.update(
            {
                "layout_path": TemplateHelper.set_layout("layout_blank.html", context),
            }
        )

        return context

# auth/views.py
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from django.http import JsonResponse
from .models import Profile, Role
from .serializers import (
    UserSerializer, UserListSerializer, UserDetailSerializer,
    UserUpdateSerializer, UserStatusUpdateSerializer
)
from .services import UserService
import logging

logger = logging.getLogger(__name__)

class UserListCreateAPIView(APIView):
    """Vista para listar usuarios (para DataTables)"""

    def get(self, request):
        try:
            users = User.objects.select_related('profile').all().order_by('-date_joined')
            serializer = UserListSerializer(users, many=True)

            # Formato para DataTables
            return JsonResponse({
                'data': serializer.data
            })
        except Exception as e:
            logger.error(f"Error in UserListCreateAPIView GET: {str(e)}")
            return JsonResponse({
                'error': 'Error al cargar usuarios',
                'data': []
            }, status=500)

    def post(self, request):
        try:
            serializer = UserSerializer(data=request.data, context={'request': request})
            if serializer.is_valid():
                user = serializer.save()

                # Retornar datos completos del usuario creado
                response_serializer = UserDetailSerializer(user)
                return JsonResponse({
                    'success': True,
                    'message': 'Usuario creado exitosamente. Se ha enviado la contraseña al correo.',
                    'data': response_serializer.data
                }, status=status.HTTP_201_CREATED)
            else:
                return JsonResponse({
                    'success': False,
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Error creating user: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Error al crear usuario: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserViewSet(viewsets.ModelViewSet):
    """ViewSet para CRUD completo de usuarios"""

    queryset = User.objects.select_related('profile').all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return UserListSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        elif self.action == 'retrieve':
            return UserDetailSerializer
        return UserSerializer

    def retrieve(self, request, pk=None):
        """Obtener detalles de un usuario específico"""
        try:
            user = get_object_or_404(User.objects.select_related('profile'), pk=pk)
            serializer = UserDetailSerializer(user)

            # Agregar datos del perfil al nivel principal para facilitar el acceso
            data = serializer.data.copy()
            if hasattr(user, 'profile') and user.profile:
                profile = user.profile
                data.update({
                    'dni': profile.dni,
                    'fecha_nacimiento': profile.fecha_nacimiento.isoformat() if profile.fecha_nacimiento else None,
                    'genero': profile.genero,
                    'status': profile.status,
                    'role': profile.role,
                })

            return JsonResponse({
                'success': True,
                'data': data
            })
        except Exception as e:
            logger.error(f"Error retrieving user {pk}: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Error al obtener usuario: {str(e)}'
            }, status=500)

    def update(self, request, pk=None):
        """Actualizar usuario completo"""
        try:
            user = get_object_or_404(User.objects.select_related('profile'), pk=pk)
            serializer = UserUpdateSerializer(user, data=request.data, context={'request': request})

            if serializer.is_valid():
                updated_user = serializer.save()
                response_serializer = UserDetailSerializer(updated_user)
                return JsonResponse({
                    'success': True,
                    'message': 'Usuario actualizado exitosamente',
                    'data': response_serializer.data
                })
            else:
                return JsonResponse({
                    'success': False,
                    'errors': serializer.errors
                }, status=400)

        except Exception as e:
            logger.error(f"Error updating user {pk}: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Error al actualizar usuario: {str(e)}'
            }, status=500)

    def partial_update(self, request, pk=None):
        """Actualización parcial"""
        return self.update(request, pk)

    @action(detail=True, methods=['patch'])
    def toggle_status(self, request, pk=None):
        """Cambiar estado del usuario"""
        try:
            user = get_object_or_404(User.objects.select_related('profile'), pk=pk)

            # Determinar el siguiente estado
            current_status = user.profile.status if hasattr(user, 'profile') and user.profile else 'PENDIENTE'

            if current_status == 'PENDIENTE':
                new_status = 'ACTIVO'
            elif current_status == 'ACTIVO':
                new_status = 'INACTIVO'
            else:  # INACTIVO
                new_status = 'ACTIVO'

            # Usar el servicio para cambiar el estado
            updated_user = UserService.change_user_status(
                user=user,
                new_status=new_status,
                changed_by=request.user
            )

            status_messages = {
                'PENDIENTE': 'pendiente',
                'ACTIVO': 'activado',
                'INACTIVO': 'desactivado'
            }

            return JsonResponse({
                'success': True,
                'message': f'Usuario {status_messages.get(new_status, "actualizado")} exitosamente',
                'new_status': new_status
            })

        except Exception as e:
            logger.error(f"Error toggling user status {pk}: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Error al cambiar estado: {str(e)}'
            }, status=500)

    @action(detail=True, methods=['patch'])
    def change_status(self, request, pk=None):
        """Cambiar estado específico del usuario"""
        try:
            user = get_object_or_404(User.objects.select_related('profile'), pk=pk)
            serializer = UserStatusUpdateSerializer(user, data=request.data, context={'request': request})

            if serializer.is_valid():
                updated_user = serializer.save()
                return JsonResponse({
                    'success': True,
                    'message': 'Estado actualizado exitosamente',
                    'new_status': updated_user.profile.status
                })
            else:
                return JsonResponse({
                    'success': False,
                    'errors': serializer.errors
                }, status=400)

        except Exception as e:
            logger.error(f"Error changing user status {pk}: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Error al cambiar estado: {str(e)}'
            }, status=500)

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        """Resetear contraseña del usuario"""
        try:
            user = get_object_or_404(User, pk=pk)

            new_password = UserService.reset_user_password(
                user=user,
                reset_by=request.user
            )

            return JsonResponse({
                'success': True,
                'message': 'Contraseña reseteada exitosamente. Se ha enviado al correo del usuario.',
                'new_password': new_password  # Solo para propósitos de desarrollo
            })

        except Exception as e:
            logger.error(f"Error resetting password for user {pk}: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Error al resetear contraseña: {str(e)}'
            }, status=500)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Obtener estadísticas de usuarios"""
        try:
            stats = UserService.get_user_stats()
            return JsonResponse({
                'success': True,
                'data': stats
            })
        except Exception as e:
            logger.error(f"Error getting user stats: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'Error al obtener estadísticas: {str(e)}'
            }, status=500)

class ActiveUserListAPIView(APIView):
    """Vista para listar solo usuarios activos"""

    def get(self, request):
        try:
            active_users = User.objects.filter(
                is_active=True,
                profile__status='ACTIVO'
            ).select_related('profile')

            serializer = UserListSerializer(active_users, many=True)
            return JsonResponse({
                'success': True,
                'data': serializer.data
            })
        except Exception as e:
            logger.error(f"Error in ActiveUserListAPIView: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': 'Error al cargar usuarios activos',
                'data': []
            }, status=500)
