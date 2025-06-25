# auth/management/commands/test_email.py

from django.core.management.base import BaseCommand, CommandError
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Probar la configuración de email del sistema y UserService'

    def add_arguments(self, parser):
        parser.add_argument(
            '--to',
            type=str,
            help='Email específico para enviar la prueba (opcional)',
        )
        parser.add_argument(
            '--user',
            type=str,
            help='Username específico para probar UserService (opcional)',
        )
        parser.add_argument(
            '--skip-userservice',
            action='store_true',
            help='Omitir prueba de UserService',
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.HTTP_INFO('🚀 Iniciando pruebas de configuración de email...\n')
        )

        # Prueba 1: Configuración básica
        basic_result = self.test_basic_configuration()
        
        if not basic_result:
            return

        # Prueba 2: Email directo
        email_result = self.test_direct_email(options.get('to'))
        
        if not email_result:
            return

        # Prueba 3: UserService (opcional)
        if not options.get('skip_userservice'):
            userservice_result = self.test_userservice_email(options.get('user'))
        else:
            userservice_result = True
            self.stdout.write(
                self.style.WARNING('⏭️ Prueba de UserService omitida por --skip-userservice')
            )

        # Resumen final
        self.display_final_results(basic_result, email_result, userservice_result)

    def test_basic_configuration(self):
        """Verificar configuración básica de email"""
        self.stdout.write(self.style.HTTP_INFO('=== VERIFICANDO CONFIGURACIÓN DE EMAIL ==='))
        
        config_items = [
            ('EMAIL_BACKEND', getattr(settings, 'EMAIL_BACKEND', None)),
            ('EMAIL_HOST', getattr(settings, 'EMAIL_HOST', None)),
            ('EMAIL_PORT', getattr(settings, 'EMAIL_PORT', None)),
            ('EMAIL_USE_TLS', getattr(settings, 'EMAIL_USE_TLS', None)),
            ('EMAIL_HOST_USER', getattr(settings, 'EMAIL_HOST_USER', None)),
            ('DEFAULT_FROM_EMAIL', getattr(settings, 'DEFAULT_FROM_EMAIL', None)),
        ]

        all_configured = True

        for key, value in config_items:
            if key == 'EMAIL_HOST_PASSWORD':
                password = getattr(settings, 'EMAIL_HOST_PASSWORD', '')
                display_value = '*' * len(password) if password else 'NO CONFIGURADO'
            else:
                display_value = value if value else 'NO CONFIGURADO'
            
            if value:
                self.stdout.write(f'✅ {key}: {display_value}')
            else:
                self.stdout.write(self.style.ERROR(f'❌ {key}: {display_value}'))
                all_configured = False

        # Verificar contraseña por separado
        password = getattr(settings, 'EMAIL_HOST_PASSWORD', '')
        if password:
            self.stdout.write(f'✅ EMAIL_HOST_PASSWORD: {"*" * len(password)}')
        else:
            self.stdout.write(self.style.ERROR('❌ EMAIL_HOST_PASSWORD: NO CONFIGURADO'))
            all_configured = False

        if not all_configured:
            self.stdout.write(
                self.style.ERROR('\n❌ Configuración incompleta. Verifica tu archivo .env')
            )
            self.display_gmail_help()
            return False

        self.stdout.write(self.style.SUCCESS('✅ Configuración básica completa'))
        return True

    def test_direct_email(self, custom_email=None):
        """Probar envío directo de email"""
        self.stdout.write(
            self.style.HTTP_INFO('\n=== PROBANDO ENVÍO DIRECTO DE EMAIL ===')
        )

        recipient = custom_email or settings.EMAIL_HOST_USER
        
        try:
            subject = f'✅ Prueba de Email - {timezone.now().strftime("%Y-%m-%d %H:%M")}'
            message = f"""
🎉 ¡Felicitaciones!

Este email confirma que la configuración de correo de tu sistema Django está funcionando correctamente.

Detalles de la prueba:
- Fecha: {timezone.now().strftime("%Y-%m-%d %H:%M:%S")}
- Servidor SMTP: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}
- De: {settings.EMAIL_HOST_USER}
- Para: {recipient}
- TLS: {settings.EMAIL_USE_TLS}

El sistema está listo para enviar contraseñas automáticamente a los nuevos usuarios.

---
Sistema de Gestión Django
            """

            result = send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient],
                fail_silently=False,
            )

            if result:
                self.stdout.write(
                    self.style.SUCCESS(f'✅ Email enviado exitosamente a: {recipient}')
                )
                self.stdout.write('📧 Revisa tu bandeja de entrada')
                return True
            else:
                self.stdout.write(
                    self.style.ERROR('❌ Error: send_mail retornó 0 (no enviado)')
                )
                return False

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Error enviando email: {str(e)}')
            )
            self.diagnose_email_error(str(e))
            return False

    def test_userservice_email(self, username=None):
        """Probar envío de email del UserService"""
        self.stdout.write(
            self.style.HTTP_INFO('\n=== PROBANDO USERSERVICE EMAIL ===')
        )

        try:
            from auth.services import UserService
        except ImportError as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Error importando UserService: {e}')
            )
            return False

        # Buscar usuario para probar
        if username:
            user = User.objects.filter(username=username).first()
            if not user:
                self.stdout.write(
                    self.style.ERROR(f'❌ Usuario "{username}" no encontrado')
                )
                return False
        else:
            user = User.objects.first()
            if not user:
                self.stdout.write(
                    self.style.WARNING('❌ No hay usuarios en el sistema para probar')
                )
                self.stdout.write(
                    '💡 Crea un usuario primero o especifica uno con --user=username'
                )
                return False

        self.stdout.write(f'📧 Probando con usuario: {user.username} ({user.email})')

        try:
            result = UserService.send_password_email(user, "contraseña_prueba_123")
            if result:
                self.stdout.write(
                    self.style.SUCCESS('✅ Email del UserService enviado exitosamente!')
                )
                self.stdout.write(f'📧 Revisa la bandeja de entrada de: {user.email}')
                return True
            else:
                self.stdout.write(
                    self.style.ERROR('❌ UserService.send_password_email retornó False')
                )
                return False
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Error en UserService: {str(e)}')
            )
            return False

    def diagnose_email_error(self, error_str):
        """Diagnosticar errores comunes de email"""
        error_lower = error_str.lower()

        if "authentication failed" in error_lower or "username and password not accepted" in error_lower:
            self.stdout.write(self.style.WARNING('\n💡 DIAGNÓSTICO: Error de autenticación'))
            self.display_gmail_help()
            
        elif "connection refused" in error_lower or "timeout" in error_lower:
            self.stdout.write(self.style.WARNING('\n💡 DIAGNÓSTICO: Error de conexión'))
            self.stdout.write('✅ Verifica tu conexión a internet')
            self.stdout.write('✅ Confirma EMAIL_HOST y EMAIL_PORT')
            
        elif "tls" in error_lower or "ssl" in error_lower:
            self.stdout.write(self.style.WARNING('\n💡 DIAGNÓSTICO: Error de seguridad TLS/SSL'))
            self.stdout.write('✅ Asegúrate de tener EMAIL_USE_TLS=True para Gmail')

    def display_gmail_help(self):
        """Mostrar ayuda específica para Gmail"""
        self.stdout.write(self.style.WARNING('\n📧 CONFIGURACIÓN PARA GMAIL:'))
        self.stdout.write('1. Ve a https://myaccount.google.com/')
        self.stdout.write('2. Seguridad > Verificación en dos pasos (activar)')
        self.stdout.write('3. Contraseñas de aplicaciones > Generar')
        self.stdout.write('4. Selecciona "Otra" y escribe "Django App"')
        self.stdout.write('5. Copia la contraseña de 16 caracteres')
        self.stdout.write('6. Usa esa contraseña en EMAIL_HOST_PASSWORD')

    def display_final_results(self, basic, email, userservice):
        """Mostrar resumen final de todas las pruebas"""
        self.stdout.write(self.style.HTTP_INFO('\n' + '='*60))
        self.stdout.write(self.style.HTTP_INFO('🏁 RESUMEN DE PRUEBAS'))
        self.stdout.write('='*60)

        # Mostrar resultados
        tests = [
            ('Configuración básica', basic),
            ('Envío directo de email', email),
            ('UserService email', userservice),
        ]

        all_passed = True
        for test_name, result in tests:
            if result:
                self.stdout.write(f'✅ {test_name}: PASÓ')
            else:
                self.stdout.write(self.style.ERROR(f'❌ {test_name}: FALLÓ'))
                all_passed = False

        # Mensaje final
        if all_passed:
            self.stdout.write(
                self.style.SUCCESS('\n🎉 ¡TODAS LAS PRUEBAS PASARON!')
            )
            self.stdout.write(
                self.style.SUCCESS('✅ El sistema de email está completamente funcional')
            )
            self.stdout.write(
                self.style.SUCCESS('✅ Los usuarios recibirán sus contraseñas por email')
            )
        else:
            self.stdout.write(
                self.style.ERROR('\n❌ ALGUNAS PRUEBAS FALLARON')
            )
            self.stdout.write('🔧 Revisa la configuración y vuelve a ejecutar el comando')

        # Próximos pasos
        self.stdout.write(self.style.HTTP_INFO('\n📋 PRÓXIMOS PASOS:'))
        self.stdout.write('1. Si usas Gmail, configura una contraseña de aplicación')
        self.stdout.write('2. Verifica tu archivo .env con las credenciales correctas')
        self.stdout.write('3. Ejecuta: python manage.py test_email --help para más opciones')
        self.stdout.write('4. Una vez que funcione, prueba crear un usuario desde el frontend')