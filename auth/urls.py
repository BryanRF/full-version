from django.urls import path
from django.contrib.auth.views import LogoutView
from .register.views import RegisterView
from .login.views import LoginView
from .forgot_password.views import ForgetPasswordView
from .reset_password.views import ResetPasswordView
from .verify_email.views import  VerifyEmailTokenView , VerifyEmailView, SendVerificationView
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, ActiveUserListAPIView, UserListCreateAPIView

from .permissions.views import (
    RolePermissionsView,
    RolePermissionsAPIView,
    UpdateRolePermissionsAPIView,
    UsersByRoleAPIView,
    RoleStatsAPIView,
    SyncUserRolesAPIView
)



router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
urlpatterns = [
    path('users/data/', UserListCreateAPIView.as_view(), name='user-list-create'),
    path('users/active/', ActiveUserListAPIView.as_view(), name='active-users'),
    path(
        "login/",
        LoginView.as_view(template_name="auth/login.html"),
        name="login",
    ),

    path(
        "logout/",
        LogoutView.as_view(),
        name="logout",
    ),

    path(
        "register/",
        RegisterView.as_view(template_name="auth/register.html"),
        name="register",
    ),

    path(
        "verify_email/",
        VerifyEmailView.as_view(template_name="auth/verify_email.html"),
        name="verify-email-page",
    ),

    path(
        "verify/email/<str:token>/",
        VerifyEmailTokenView.as_view(),
        name="verify-email",
    ),

    path(
        "send_verification/",
        SendVerificationView.as_view(),
        name="send-verification",
    ),

    path(
        "forgot_password/",
        ForgetPasswordView.as_view(template_name="auth/forgot_password.html"),
        name="forgot-password",
    ),

    path(
        "reset_password/<str:token>/",
        ResetPasswordView.as_view(template_name="auth/reset_password.html"),
        name="reset-password",
    ),



    # URLs para gestión de permisos por roles (sistema simplificado)
    path(
        "auth/role-permissions/",
        RolePermissionsView.as_view(),
        name="role-permissions",
    ),
    path(
        "auth/role-permissions/<str:role>/",
        RolePermissionsAPIView.as_view(),
        name="role-permissions-detail",
    ),
    path(
        "auth/role-permissions/update/",
        UpdateRolePermissionsAPIView.as_view(),
        name="update-role-permissions",
    ),
    path(
        "auth/role-permissions/users/<str:role>/",
        UsersByRoleAPIView.as_view(),
        name="users-by-role",
    ),
    path(
        "auth/role-permissions/stats/",
        RoleStatsAPIView.as_view(),
        name="role-stats",
    ),
    path(
        "auth/role-permissions/sync/",
        SyncUserRolesAPIView.as_view(),
        name="sync-user-roles",
    ),


]+ router.urls
