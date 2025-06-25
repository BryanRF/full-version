# auth/login/views.py - Actualizado para validar estado del usuario
from django.shortcuts import redirect
from django.contrib.auth import authenticate, login
from django.contrib.auth.models import User
from django.contrib import messages
from auth.views import AuthView
from auth.models import Profile, UserStatus
from auth.services import UserService
import logging

logger = logging.getLogger(__name__)

class LoginView(AuthView):
    def get(self, request):
        if request.user.is_authenticated:
            # If the user is already logged in, redirect them to the home page or another appropriate page.
            return redirect("index")  # Replace 'index' with the actual URL name for the home page

        # Render the login page for users who are not logged in.
        return super().get(request)

    def post(self, request):
        if request.method == "POST":
            username = request.POST.get("email-username")
            password = request.POST.get("password")

            if not (username and password):
                messages.error(request, "Por favor ingrese su usuario/email y contraseña.")
                return redirect("login")

            # Si es email, buscar el username correspondiente
            if "@" in username:
                user_email = User.objects.filter(email=username).first()
                if user_email is None:
                    messages.error(request, "Email no registrado en el sistema.")
                    return redirect("login")
                username = user_email.username

            # Verificar que el usuario existe
            user_obj = User.objects.filter(username=username).first()
            if user_obj is None:
                messages.error(request, "Usuario no encontrado.")
                return redirect("login")

            # NUEVA VALIDACIÓN: Verificar estado del usuario
            try:
                profile = user_obj.profile
                if profile.status != UserStatus.ACTIVO:
                    status_messages = {
                        UserStatus.PENDIENTE: "Su cuenta está pendiente de activación. Contacte al administrador.",
                        UserStatus.INACTIVO: "Su cuenta está desactivada. Contacte al administrador."
                    }
                    messages.error(request, status_messages.get(profile.status, "Su cuenta no está activa."))
                    logger.warning(f"Login attempt blocked for user {username} with status {profile.status}")
                    return redirect("login")
                    
            except Profile.DoesNotExist:
                # Si no tiene perfil, crear uno básico y marcar como pendiente
                Profile.objects.create(
                    user=user_obj,
                    email=user_obj.email,
                    status=UserStatus.PENDIENTE
                )
                messages.error(request, "Su cuenta está pendiente de configuración. Contacte al administrador.")
                logger.warning(f"Login attempt for user {username} without profile - created basic profile")
                return redirect("login")

            # Verificar que el usuario esté activo en Django
            if not user_obj.is_active:
                messages.error(request, "Su cuenta está desactivada. Contacte al administrador.")
                logger.warning(f"Login attempt blocked for inactive user {username}")
                return redirect("login")

            # Autenticar usuario
            authenticated_user = authenticate(request, username=username, password=password)
            if authenticated_user is not None:
                # Login exitoso
                login(request, authenticated_user)
                
                # Notificar inicio de sesión (opcional, para auditoría)
                try:
                    UserService.notify_user_login(
                        user=authenticated_user,
                        login_info={
                            'ip_address': request.META.get('REMOTE_ADDR'),
                            'user_agent': request.META.get('HTTP_USER_AGENT', '')[:200]
                        }
                    )
                except Exception as e:
                    logger.error(f"Error sending login notification: {str(e)}")

                logger.info(f"Successful login for user {username}")

                # Redirigir a la página solicitada o al index
                if "next" in request.POST:
                    return redirect(request.POST["next"])
                else:
                    return redirect("index")
            else:
                messages.error(request, "Credenciales incorrectas. Verifique su usuario y contraseña.")
                logger.warning(f"Failed authentication attempt for user {username}")
                return redirect("login")