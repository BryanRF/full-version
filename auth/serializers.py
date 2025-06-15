# auth/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Profile, Role
from .services import UserService
import logging

logger = logging.getLogger(__name__)

class ProfileSerializer(serializers.ModelSerializer):
    """Serializer para el perfil del usuario"""

    class Meta:
        model = Profile
        fields = [
            'dni', 'fecha_nacimiento', 'genero', 'status',
            'role', 'is_verified', 'created_at', 'updated_at'
        ]
        read_only_fields = ['status', 'is_verified', 'created_at', 'updated_at']

class UserSerializer(serializers.ModelSerializer):
    """Serializer principal para usuarios"""

    # Campos adicionales del perfil para escritura
    nombre = serializers.CharField(source='first_name', required=True, max_length=30)
    apellidos = serializers.CharField(source='last_name', required=True, max_length=30)
    dni = serializers.CharField(write_only=True, required=True, max_length=20)
    fecha_nacimiento = serializers.DateField(write_only=True, required=True)
    genero = serializers.ChoiceField(
        choices=[('M', 'Masculino'), ('F', 'Femenino'), ('O', 'Otro')],
        write_only=True,
        required=True
    )
    role = serializers.ChoiceField(
        choices=Role.choices,
        write_only=True,
        required=False,
        default=Role.ADMINISTRADOR_SISTEMA
    )

    # Campos de solo lectura del perfil
    profile = ProfileSerializer(read_only=True)
    nombre_completo = serializers.SerializerMethodField(read_only=True)
    status = serializers.CharField(source='profile.status', read_only=True)
    role_display = serializers.CharField(source='profile.role', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'nombre', 'apellidos',
            'dni', 'fecha_nacimiento', 'genero', 'role', 'profile',
            'nombre_completo', 'status', 'role_display', 'is_active',
            'date_joined', 'last_login'
        ]
        read_only_fields = ['id', 'username', 'is_active', 'date_joined', 'last_login']
        extra_kwargs = {
            'email': {'required': True, 'write_only': True}
        }

    def get_nombre_completo(self, obj):
        """Obtener nombre completo del usuario"""
        return obj.get_full_name() or obj.username

    def validate_email(self, value):
        """Validar que el email sea único"""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Este email ya está registrado.")
        return value.lower().strip()

    def validate_dni(self, value):
        """Validar que el DNI sea único"""
        if Profile.objects.filter(dni=value).exists():
            raise serializers.ValidationError("Este DNI ya está registrado.")
        return value.strip()

    def validate_nombre(self, value):
        """Validar nombre"""
        if not value or not value.strip():
            raise serializers.ValidationError("El nombre es requerido.")
        return value.strip()

    def validate_apellidos(self, value):
        """Validar apellidos"""
        if not value or not value.strip():
            raise serializers.ValidationError("Los apellidos son requeridos.")
        return value.strip()

    def create(self, validated_data):
        """Crear usuario usando el UserService"""
        try:
            # Extraer datos del perfil
            dni = validated_data.pop('dni')
            fecha_nacimiento = validated_data.pop('fecha_nacimiento')
            genero = validated_data.pop('genero')
            role = validated_data.pop('role', Role.ADMINISTRADOR_SISTEMA)

            # Obtener datos del usuario
            email = validated_data.get('email')
            nombre = validated_data.get('first_name')
            apellidos = validated_data.get('last_name')

            # Usar el servicio para crear el usuario
            user = UserService.create_user(
                email=email,
                nombre=nombre,
                apellidos=apellidos,
                dni=dni,
                fecha_nacimiento=fecha_nacimiento,
                genero=genero,
                role=role,
                created_by=self.context.get('request').user if self.context.get('request') else None
            )

            return user

        except Exception as e:
            logger.error(f"Error creating user in serializer: {str(e)}")
            raise serializers.ValidationError(f"Error al crear usuario: {str(e)}")

    def to_representation(self, instance):
        """Personalizar la representación de salida"""
        data = super().to_representation(instance)

        # Agregar datos del perfil al nivel principal si existe
        if hasattr(instance, 'profile') and instance.profile:
            profile = instance.profile
            data.update({
                'dni': profile.dni,
                'fecha_nacimiento': profile.fecha_nacimiento.isoformat() if profile.fecha_nacimiento else None,
                'genero': profile.genero,
                'status': profile.status,
                'role': profile.role,
                'role_display': dict(Role.choices).get(profile.role, profile.role),
                'is_verified': profile.is_verified
            })

        # Agregar nombre completo
        data['nombre_completo'] = instance.get_full_name() or instance.username

        return data

class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer para actualizar usuarios"""

    nombre = serializers.CharField(source='first_name', required=False, max_length=30)
    apellidos = serializers.CharField(source='last_name', required=False, max_length=30)
    dni = serializers.CharField(required=False, max_length=20)
    fecha_nacimiento = serializers.DateField(required=False)
    genero = serializers.ChoiceField(
        choices=[('M', 'Masculino'), ('F', 'Femenino'), ('O', 'Otro')],
        required=False
    )
    role = serializers.ChoiceField(
        choices=Role.choices,
        required=False
    )

    class Meta:
        model = User
        fields = ['nombre', 'apellidos', 'dni', 'fecha_nacimiento', 'genero', 'role']

    def validate_dni(self, value):
        """Validar que el DNI sea único (excluyendo el usuario actual)"""
        if value:
            user_id = self.instance.id if self.instance else None
            if Profile.objects.filter(dni=value).exclude(user_id=user_id).exists():
                raise serializers.ValidationError("Este DNI ya está registrado.")
        return value.strip() if value else value

    def validate_nombre(self, value):
        """Validar nombre"""
        if value and not value.strip():
            raise serializers.ValidationError("El nombre no puede estar vacío.")
        return value.strip() if value else value

    def validate_apellidos(self, value):
        """Validar apellidos"""
        if value and not value.strip():
            raise serializers.ValidationError("Los apellidos no pueden estar vacíos.")
        return value.strip() if value else value

    def update(self, instance, validated_data):
        """Actualizar usuario usando el UserService"""
        try:
            # Extraer datos del perfil
            dni = validated_data.pop('dni', None)
            fecha_nacimiento = validated_data.pop('fecha_nacimiento', None)
            genero = validated_data.pop('genero', None)
            role = validated_data.pop('role', None)

            # Usar el servicio para actualizar
            user = UserService.update_user(
                user=instance,
                nombre=validated_data.get('first_name'),
                apellidos=validated_data.get('last_name'),
                dni=dni,
                fecha_nacimiento=fecha_nacimiento,
                genero=genero,
                role=role,
                updated_by=self.context.get('request').user if self.context.get('request') else None
            )

            return user

        except Exception as e:
            logger.error(f"Error updating user in serializer: {str(e)}")
            raise serializers.ValidationError(f"Error al actualizar usuario: {str(e)}")

class UserListSerializer(serializers.ModelSerializer):
    """Serializer para listar usuarios (optimizado para DataTables)"""

    nombre_completo = serializers.SerializerMethodField()
    status = serializers.CharField(source='profile.status', read_only=True)
    role = serializers.CharField(source='profile.role', read_only=True)
    role_display = serializers.SerializerMethodField()
    dni = serializers.CharField(source='profile.dni', read_only=True)
    fecha_nacimiento = serializers.DateField(source='profile.fecha_nacimiento', read_only=True)
    genero = serializers.CharField(source='profile.genero', read_only=True)
    is_verified = serializers.BooleanField(source='profile.is_verified', read_only=True)
    created_at = serializers.DateTimeField(source='profile.created_at', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'nombre_completo',
            'status', 'role', 'role_display', 'dni', 'fecha_nacimiento', 'genero',
            'is_verified', 'created_at', 'date_joined', 'last_login', 'is_active'
        ]

    def get_nombre_completo(self, obj):
        """Obtener nombre completo del usuario"""
        return obj.get_full_name() or obj.username

    def get_role_display(self, obj):
        """Obtener nombre descriptivo del rol"""
        if hasattr(obj, 'profile') and obj.profile:
            return dict(Role.choices).get(obj.profile.role, obj.profile.role)
        return 'Sin rol asignado'

    def to_representation(self, instance):
        """Personalizar representación para manejar casos sin perfil"""
        data = super().to_representation(instance)

        # Manejar casos donde no existe perfil
        if not hasattr(instance, 'profile') or not instance.profile:
            data.update({
                'status': 'PENDIENTE',
                'role': Role.ADMINISTRADOR_SISTEMA,
                'dni': '',
                'fecha_nacimiento': None,
                'genero': '',
                'is_verified': False,
                'created_at': instance.date_joined
            })

        # Formatear fechas para frontend
        if data.get('date_joined'):
            data['date_joined'] = instance.date_joined.isoformat()
        if data.get('last_login'):
            data['last_login'] = instance.last_login.isoformat()
        if data.get('created_at') and hasattr(instance, 'profile') and instance.profile:
            data['created_at'] = instance.profile.created_at.isoformat()

        return data

class UserDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para un usuario específico"""

    profile = ProfileSerializer(read_only=True)
    nombre_completo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'nombre_completo', 'is_active', 'is_staff', 'is_superuser',
            'date_joined', 'last_login', 'profile'
        ]

    def get_nombre_completo(self, obj):
        """Obtener nombre completo del usuario"""
        return obj.get_full_name() or obj.username

class UserStatusUpdateSerializer(serializers.Serializer):
    """Serializer para cambio de estado"""

    status = serializers.ChoiceField(
        choices=['PENDIENTE', 'ACTIVO', 'INACTIVO'],
        required=True
    )

    def update(self, instance, validated_data):
        """Cambiar estado usando el UserService"""
        try:
            new_status = validated_data.get('status')
            user = UserService.change_user_status(
                user=instance,
                new_status=new_status,
                changed_by=self.context.get('request').user if self.context.get('request') else None
            )
            return user

        except Exception as e:
            logger.error(f"Error changing user status in serializer: {str(e)}")
            raise serializers.ValidationError(f"Error al cambiar estado: {str(e)}")

class UserPasswordResetSerializer(serializers.Serializer):
    """Serializer para reset de contraseña"""

    def update(self, instance, validated_data):
        """Resetear contraseña usando el UserService"""
        try:
            new_password = UserService.reset_user_password(
                user=instance,
                reset_by=self.context.get('request').user if self.context.get('request') else None
            )
            return {'new_password': new_password}

        except Exception as e:
            logger.error(f"Error resetting password in serializer: {str(e)}")
            raise serializers.ValidationError(f"Error al resetear contraseña: {str(e)}")

class UserStatsSerializer(serializers.Serializer):
    """Serializer para estadísticas de usuarios"""

    total = serializers.IntegerField()
    active = serializers.IntegerField()
    pending = serializers.IntegerField()
    inactive = serializers.IntegerField()
    activation_rate = serializers.FloatField()

class BulkUserCreateSerializer(serializers.Serializer):
    """Serializer para creación masiva de usuarios"""

    users = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False,
        min_length=1,
        max_length=100  # Límite de usuarios por lote
    )

    def validate_users(self, value):
        """Validar estructura de datos de usuarios"""
        required_fields = ['email', 'nombre', 'apellidos', 'dni', 'fecha_nacimiento', 'genero']

        for index, user_data in enumerate(value):
            for field in required_fields:
                if field not in user_data or not user_data[field]:
                    raise serializers.ValidationError(
                        f"Usuario {index + 1}: El campo '{field}' es requerido."
                    )

        return value

    def create(self, validated_data):
        """Crear usuarios en lote usando el UserService"""
        try:
            users_data = validated_data.get('users')
            created_by = self.context.get('request').user if self.context.get('request') else None

            result = UserService.bulk_create_users(users_data, created_by)
            return result

        except Exception as e:
            logger.error(f"Error in bulk user creation: {str(e)}")
            raise serializers.ValidationError(f"Error en creación masiva: {str(e)}")
