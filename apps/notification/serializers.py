# apps/notifications/serializers.py
from rest_framework import serializers
from .models import Notificacion, NotificacionGrupal, TipoNotificacion
from django.contrib.auth.models import User

class UsuarioBasicoSerializer(serializers.ModelSerializer):
    """Serializer básico para usuario"""
    nombre_completo = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'nombre_completo']
    
    def get_nombre_completo(self, obj):
        return obj.get_full_name() or obj.username

class NotificacionSerializer(serializers.ModelSerializer):
    """Serializer para notificaciones individuales"""
    usuario_info = UsuarioBasicoSerializer(source='usuario', read_only=True)
    tiempo_transcurrido = serializers.ReadOnlyField()
    tipo_notificacion_display = serializers.CharField(
        source='get_tipo_notificacion_display', 
        read_only=True
    )
    
    class Meta:
        model = Notificacion
        fields = [
            'id', 'usuario', 'usuario_info', 'mensaje', 'titulo',
            'fecha_hora', 'leida', 'tipo_notificacion', 
            'tipo_notificacion_display', 'icono', 'color', 
            'url_accion', 'datos_adicionales', 'tiempo_transcurrido'
        ]
        read_only_fields = ['id', 'fecha_hora', 'usuario', 'tiempo_transcurrido']
    
    def create(self, validated_data):
        # Asignar el usuario actual si no se especifica
        if 'usuario' not in validated_data:
            validated_data['usuario'] = self.context['request'].user
        return super().create(validated_data)

class NotificacionGrupalSerializer(serializers.ModelSerializer):
    """Serializer para notificaciones grupales"""
    enviado_por_info = UsuarioBasicoSerializer(source='enviado_por', read_only=True)
    tipo_notificacion_display = serializers.CharField(
        source='get_tipo_notificacion_display', 
        read_only=True
    )
    usuarios_notificados_count = serializers.SerializerMethodField()
    
    class Meta:
        model = NotificacionGrupal
        fields = [
            'id', 'roles_destinatarios', 'mensaje', 'titulo',
            'tipo_notificacion', 'tipo_notificacion_display',
            'fecha_hora', 'icono', 'color', 'url_accion',
            'datos_adicionales', 'enviado_por', 'enviado_por_info',
            'usuarios_notificados_count'
        ]
        read_only_fields = ['id', 'fecha_hora', 'enviado_por']
    
    def get_usuarios_notificados_count(self, obj):
        """Obtiene el número de usuarios que recibieron la notificación"""
        return obj.usuarios_notificados.count()
    
    def validate_roles_destinatarios(self, value):
        """Validar que los roles existan"""
        if not value or not isinstance(value, list):
            raise serializers.ValidationError("Debe especificar al menos un rol")
        
        # Verificar que los roles son válidos
        from auth.models import Role
        roles_validos = [choice[0] for choice in Role.choices]
        
        for rol in value:
            if rol not in roles_validos:
                raise serializers.ValidationError(f"Rol '{rol}' no es válido")
        
        return value

class CrearNotificacionSerializer(serializers.Serializer):
    """Serializer para crear notificaciones desde la API"""
    usuarios = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        help_text="Lista de IDs de usuarios (opcional si se especifican roles)"
    )
    roles = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        help_text="Lista de roles (opcional si se especifican usuarios)"
    )
    titulo = serializers.CharField(max_length=200)
    mensaje = serializers.CharField()
    tipo_notificacion = serializers.ChoiceField(
        choices=TipoNotificacion.choices,
        default=TipoNotificacion.SISTEMA
    )
    icono = serializers.CharField(max_length=50, required=False)
    color = serializers.CharField(max_length=20, default='info')
    url_accion = serializers.URLField(required=False, allow_blank=True)
    datos_adicionales = serializers.JSONField(required=False)
    
    def validate(self, data):
        """Validar que se especifiquen usuarios o roles"""
        usuarios = data.get('usuarios')
        roles = data.get('roles')
        
        if not usuarios and not roles:
            raise serializers.ValidationError(
                "Debe especificar al menos usuarios o roles destinatarios"
            )
        
        return data
    
    def validate_usuarios(self, value):
        """Validar que los usuarios existan"""
        if value:
            usuarios_existentes = User.objects.filter(
                id__in=value, 
                is_active=True
            ).count()
            
            if usuarios_existentes != len(value):
                raise serializers.ValidationError(
                    "Algunos usuarios no existen o están inactivos"
                )
        
        return value
    
    def validate_roles(self, value):
        """Validar que los roles sean válidos"""
        if value:
            from auth.models import Role
            roles_validos = [choice[0] for choice in Role.choices]
            
            for rol in value:
                if rol not in roles_validos:
                    raise serializers.ValidationError(f"Rol '{rol}' no es válido")
        
        return value

class EstadisticasNotificacionesSerializer(serializers.Serializer):
    """Serializer para estadísticas de notificaciones"""
    total_notificaciones = serializers.IntegerField()
    no_leidas = serializers.IntegerField()
    leidas = serializers.IntegerField()
    por_tipo = serializers.DictField()
    ultimas_24h = serializers.IntegerField()
    esta_semana = serializers.IntegerField()
    este_mes = serializers.IntegerField()

class NotificacionResumenSerializer(serializers.ModelSerializer):
    """Serializer resumido para notificaciones (para listas)"""
    tiempo_transcurrido = serializers.ReadOnlyField()
    
    class Meta:
        model = Notificacion
        fields = [
            'id', 'titulo', 'mensaje', 'tipo_notificacion',
            'icono', 'color', 'fecha_hora', 'leida', 
            'tiempo_transcurrido', 'url_accion'
        ]