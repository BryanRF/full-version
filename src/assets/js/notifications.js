// src/assets/js/notifications.js
/**
 * Sistema de Notificaciones Integrado con WebSocket y APIs Django
 */

'use strict';

class NotificationSystem {
    constructor() {
        this.socket = null;
        this.unreadCount = 0;
        this.notifications = [];
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 3000;

        this.init();
    }

    init() {
        this.initWebSocket();
        this.initUI();
        this.bindEvents();
        this.loadInitialNotifications();
    }

    initWebSocket() {
        // Configurar WebSocket para notificaciones
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/notifications/`;

        try {
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log('✅ WebSocket de notificaciones conectado');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
            };

            this.socket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleWebSocketMessage(message);
            };

            this.socket.onclose = (event) => {
                console.log('🔌 WebSocket de notificaciones desconectado', event.code);
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.attemptReconnect();
            };

            this.socket.onerror = (error) => {
                console.error('❌ Error en WebSocket de notificaciones:', error);
                this.isConnected = false;
                this.updateConnectionStatus(false);
            };
        } catch (error) {
            console.error('❌ Error creando WebSocket:', error);
            this.fallbackToPolling();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Intentando reconectar... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            setTimeout(() => {
                if (!this.isConnected) {
                    this.initWebSocket();
                }
            }, this.reconnectInterval * this.reconnectAttempts);
        } else {
            console.log('⚠️ Máximo de intentos de reconexión alcanzado. Cambiando a polling.');
            this.fallbackToPolling();
        }
    }

    fallbackToPolling() {
        // Fallback a polling cada 30 segundos si WebSocket falla
        console.log('📡 Iniciando polling como fallback');
        setInterval(() => {
            this.loadInitialNotifications();
        }, 30000);
    }

    handleWebSocketMessage(message) {
        console.log('📨 Mensaje WebSocket recibido:', message.type);

        switch (message.type) {
            case 'notification':
                this.addNewNotification(message.data);
                break;
            case 'unread_count':
                this.updateUnreadCount(message.count);
                break;
            case 'unread_notifications':
                this.loadNotifications(message.notifications);
                break;
        }
    }

    addNewNotification(notification) {
        console.log('🔔 Nueva notificación:', notification.titulo);

        // Agregar nueva notificación al inicio de la lista
        this.notifications.unshift(notification);

        // Mantener solo las últimas 50 notificaciones
        if (this.notifications.length > 50) {
            this.notifications = this.notifications.slice(0, 50);
        }

        // Actualizar contador si no está leída
        if (!notification.leida) {
            this.unreadCount++;
            this.updateUnreadCount(this.unreadCount);
        }

        // Mostrar notificación visual
        this.showNotificationToast(notification);

        // Actualizar UI
        this.updateNotificationsList();
    }

    loadNotifications(notifications) {
        this.notifications = notifications;
        this.updateNotificationsList();
    }

    updateUnreadCount(count) {
        this.unreadCount = count;

        // Actualizar badge en el navbar
        const badge = document.querySelector('.notification-badge');
        const countElements = document.querySelectorAll('.unread-count-badge, .badge-notifications');

        countElements.forEach(element => {
            if (count > 0) {
                element.style.display = 'inline-block';
                element.textContent = count > 99 ? '99+' : count;
            } else {
                element.style.display = 'none';
            }
        });

        // Actualizar título de la página
        this.updatePageTitle(count);
    }

    updatePageTitle(count) {
        const originalTitle = document.title.replace(/^\(\d+\)\s*/, '');
        if (count > 0) {
            document.title = `(${count}) ${originalTitle}`;
        } else {
            document.title = originalTitle;
        }
    }

    showNotificationToast(notification) {
        // Mostrar con Toastr si está disponible
        if (typeof toastr !== 'undefined') {
            toastr.options = {
                closeButton: true,
                debug: false,
                newestOnTop: true,
                progressBar: true,
                positionClass: "toast-top-right",
                preventDuplicates: false,
                showDuration: "300",
                hideDuration: "1000",
                timeOut: "5000",
                extendedTimeOut: "1000",
                showEasing: "swing",
                hideEasing: "linear",
                showMethod: "fadeIn",
                hideMethod: "fadeOut",
                onclick: () => {
                    this.handleNotificationClick(notification);
                }
            };

            const toastMethod = this.getToastrMethod(notification.color);
            toastr[toastMethod](notification.mensaje, notification.titulo || 'Notificación');
        }

        // Notificación del navegador
        this.showBrowserNotification(notification);

        // Reproducir sonido
        this.playNotificationSound();
    }

    showBrowserNotification(notification) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const browserNotification = new Notification(
                notification.titulo || 'Notificación del Sistema',
                {
                    body: notification.mensaje,
                    icon: '/static/img/favicon/favicon-32x32.png',
                    tag: `notification-${notification.id}`,
                    requireInteraction: false
                }
            );

            browserNotification.onclick = () => {
                window.focus();
                this.handleNotificationClick(notification);
                browserNotification.close();
            };

            setTimeout(() => browserNotification.close(), 5000);
        }
    }

    handleNotificationClick(notification) {
        // Marcar como leída
        this.markAsRead(notification.id);

        // Redirigir si tiene URL de acción
        if (notification.url_accion) {
            setTimeout(() => {
                window.location.href = '/notifications/';
            }, 100);
        }
    }

    playNotificationSound() {
        const soundEnabled = localStorage.getItem('notification-sound') !== 'false';
        if (soundEnabled) {
            const audio = new Audio('/static/sounds/notification.mp3');
            audio.volume = 0.3;
            audio.play().catch(() => {
                // Ignorar errores de autoplay
            });
        }
    }

    getToastrMethod(color) {
        const colorMap = {
            'success': 'success',
            'danger': 'error',
            'warning': 'warning',
            'info': 'info'
        };
        return colorMap[color] || 'info';
    }

    initUI() {
        this.createNotificationUI();
        this.requestNotificationPermission();
    }

    createNotificationUI() {
        // Verificar que el contenedor existe
        const notificationContainer = document.querySelector('.dropdown-notifications');
        if (!notificationContainer) {
            console.warn('⚠️ Contenedor de notificaciones no encontrado en el navbar.');
        }
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                console.log('🔔 Permiso de notificaciones:', permission);
            });
        }
    }

    updateNotificationsList() {
        const notificationsList = document.querySelector('.notifications-list');
        if (!notificationsList) return;

        notificationsList.innerHTML = '';

        if (this.notifications.length === 0) {
            notificationsList.innerHTML = `
                <div class="text-center p-4">
                    <i class="ri-notification-off-line ri-24px text-muted mb-2"></i>
                    <p class="text-muted mb-0">No hay notificaciones</p>
                </div>
            `;
            return;
        }

        // Crear lista de notificaciones
        const listGroup = document.createElement('ul');
        listGroup.className = 'list-group list-group-flush';

        // Mostrar solo las primeras 8 notificaciones
        const notificationsToShow = this.notifications.slice(0, 8);

        notificationsToShow.forEach(notification => {
            const listItem = this.createNotificationListItem(notification);
            listGroup.appendChild(listItem);
        });

        notificationsList.appendChild(listGroup);

        // Mensaje si hay más notificaciones
        if (this.notifications.length > 4) {
            const moreNotifications = document.createElement('div');
            moreNotifications.className = 'text-center p-2 border-top';
            moreNotifications.innerHTML = `
                <small class="text-muted">
                    Y ${this.notifications.length - 4} notificaciones más...
                    <a href="/notifications/" class="ms-1">Ver todas</a>
                </small>
            `;
            notificationsList.appendChild(moreNotifications);
        }
    }

    createNotificationListItem(notification) {
        const li = document.createElement('li');
        li.className = `list-group-item list-group-item-action dropdown-notifications-item ${notification.leida ? 'marked-as-read' : ''}`;
        li.setAttribute('data-notification-id', notification.id);

        const iconClass = notification.icono || 'ri-notification-line';
        const colorClass = this.getBootstrapColor(notification.color);

        li.innerHTML = `
            <div class="d-flex">
                <div class="flex-shrink-0 me-3">
                    <div class="avatar">
                        <span class="avatar-initial rounded-circle bg-label-${colorClass}">
                            <i class="${iconClass}"></i>
                        </span>
                    </div>
                </div>
                <div class="flex-grow-1">
                    <h6 class="small mb-1">${notification.titulo || 'Notificación'}</h6>
                    <small class="mb-1 d-block text-body">${notification.mensaje}</small>
                    <small class="text-muted">${notification.tiempo_transcurrido}</small>
                </div>
                <div class="flex-shrink-0 dropdown-notifications-actions">
                    ${!notification.leida ? `
                        <a href="javascript:void(0)" class="dropdown-notifications-read"
                           onclick="notificationSystem.markAsRead(${notification.id})">
                            <span class="badge badge-dot"></span>
                        </a>
                    ` : ''}
                </div>
            </div>
        `;

        // Evento de clic para redirección
        if (notification.url_accion) {
            li.style.cursor = 'pointer';
            li.addEventListener('click', (e) => {
                if (!e.target.closest('.dropdown-notifications-actions')) {
                    this.handleNotificationClick(notification);
                }
            });
        }

        return li;
    }

    getBootstrapColor(color) {
        const colorMap = {
            'success': 'success',
            'danger': 'danger',
            'warning': 'warning',
            'info': 'info',
            'primary': 'primary'
        };
        return colorMap[color] || 'secondary';
    }

    bindEvents() {
        // Marcar todas como leídas
        const markAllReadBtn = document.querySelector('.mark-all-read-btn');
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.markAllAsRead();
            });
        }

        // Refrescar notificaciones
        const refreshBtn = document.querySelector('.refresh-notifications-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.requestUnreadCount();
            });
        }
    }

    loadInitialNotifications() {
        // Usar tus APIs existentes
        fetch('/api/notifications/json/?only_unread=false&limit=10')
            .then(response => response.json())
            .then(data => {
                this.notifications = data.notifications || [];
                this.updateUnreadCount(data.unread_count || 0);
                this.updateNotificationsList();
            })
            .catch(error => {
                console.error('❌ Error cargando notificaciones:', error);
            });
    }

    markAsRead(notificationId) {
        console.log('✅ Marcando como leída:', notificationId);

        // Marcar via WebSocket si está conectado
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'mark_as_read',
                notification_id: notificationId
            }));
        }

        // También via AJAX usando tu API existente
        fetch(`/api/notifications/${notificationId}/mark-read/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': this.getCookie('csrftoken'),
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Actualizar localmente
                const notification = this.notifications.find(n => n.id === notificationId);
                if (notification && !notification.leida) {
                    notification.leida = true;
                    this.unreadCount = Math.max(0, this.unreadCount - 1);
                    this.updateUnreadCount(this.unreadCount);
                    this.updateNotificationsList();
                }
            }
        })
        .catch(error => {
            console.error('❌ Error marcando como leída:', error);
        });
    }

    markAllAsRead() {
        console.log('✅ Marcando todas como leídas');

        // Marcar via WebSocket
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'mark_all_as_read'
            }));
        }

        // También via AJAX usando tu API
        fetch('/api/notificaciones/marcar_todas_leidas/', {
            method: 'PATCH',
            headers: {
                'X-CSRFToken': this.getCookie('csrftoken'),
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                // Actualizar localmente
                this.notifications.forEach(n => n.leida = true);
                this.updateUnreadCount(0);
                this.updateNotificationsList();

                if (typeof toastr !== 'undefined') {
                    toastr.success('Todas las notificaciones marcadas como leídas');
                }
            }
        })
        .catch(error => {
            console.error('❌ Error marcando todas como leídas:', error);
        });
    }

    requestUnreadCount() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'get_unread_count'
            }));
        } else {
            // Fallback via AJAX
            fetch('/api/notificaciones/conteo_no_leidas/')
                .then(response => response.json())
                .then(data => {
                    this.updateUnreadCount(data.unread_count || 0);
                })
                .catch(error => {
                    console.error('❌ Error obteniendo conteo:', error);
                });
        }
    }

    updateConnectionStatus(connected) {
        const statusIndicator = document.querySelector('.notification-connection-status');
        if (statusIndicator) {
            if (connected) {
                statusIndicator.className = 'notification-connection-status text-success me-2';
                statusIndicator.innerHTML = '<i class="ri-wifi-line ri-16px"></i>';
                statusIndicator.title = 'Conectado - Notificaciones en tiempo real';
            } else {
                statusIndicator.className = 'notification-connection-status text-warning me-2';
                statusIndicator.innerHTML = '<i class="ri-wifi-off-line ri-16px"></i>';
                statusIndicator.title = 'Desconectado - Intentando reconectar...';
            }
        }
    }

    getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
                const trimmed = cookie.trim();
                if (trimmed.startsWith(name + '=')) {
                    cookieValue = decodeURIComponent(trimmed.slice(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
}

/**
 * Funciones auxiliares para notificaciones específicas del sistema
 */
class SystemNotifications {

    static stockBajo(productoNombre, stockActual, stockMinimo, productoId) {
        const notification = {
            id: Date.now(),
            titulo: 'Alerta de Stock Bajo',
            mensaje: `El producto "${productoNombre}" tiene stock bajo. Actual: ${stockActual}, Mínimo: ${stockMinimo}`,
            color: 'warning',
            icono: 'ri-alert-line',
            url_accion: `/app/ecommerce/product/add/?edit=${productoId}`,
            tipo_notificacion: 'ALERTA_STOCK',
            fecha_hora: new Date().toISOString(),
            tiempo_transcurrido: 'ahora',
            leida: false
        };

        if (window.notificationSystem) {
            window.notificationSystem.addNewNotification(notification);
        }
    }

    static productoAgotado(productoNombre, productoId) {
        const notification = {
            id: Date.now(),
            titulo: 'Producto Agotado',
            mensaje: `El producto "${productoNombre}" está completamente agotado. Requiere reposición inmediata.`,
            color: 'danger',
            icono: 'ri-error-warning-line',
            url_accion: `/app/ecommerce/product/add/?edit=${productoId}`,
            tipo_notificacion: 'ALERTA_STOCK',
            fecha_hora: new Date().toISOString(),
            tiempo_transcurrido: 'ahora',
            leida: false
        };

        if (window.notificationSystem) {
            window.notificationSystem.addNewNotification(notification);
        }
    }

    static productoActualizado(productoNombre, actualizadoPor, productoId) {
        const notification = {
            id: Date.now(),
            titulo: 'Producto Actualizado',
            mensaje: `El producto "${productoNombre}" ha sido actualizado por ${actualizadoPor}`,
            color: 'info',
            icono: 'ri-edit-box-line',
            url_accion: `/app/ecommerce/product/add/?edit=${productoId}`,
            tipo_notificacion: 'PRODUCTO_ACTUALIZADO',
            fecha_hora: new Date().toISOString(),
            tiempo_transcurrido: 'ahora',
            leida: false
        };

        if (window.notificationSystem) {
            window.notificationSystem.addNewNotification(notification);
        }
    }

    static requerimientoNuevo(numeroRequerimiento, solicitante, requerimientoId) {
        const notification = {
            id: Date.now(),
            titulo: 'Nuevo Requerimiento',
            mensaje: `Nuevo requerimiento ${numeroRequerimiento} creado por ${solicitante}`,
            color: 'info',
            icono: 'ri-file-add-line',
            url_accion: `/app/requirements/details/${requerimientoId}/`,
            tipo_notificacion: 'APROBACION_PENDIENTE',
            fecha_hora: new Date().toISOString(),
            tiempo_transcurrido: 'ahora',
            leida: false
        };

        if (window.notificationSystem) {
            window.notificationSystem.addNewNotification(notification);
        }
    }

    static cotizacionRecibida(proveedor, numeroRequerimiento, requerimientoId) {
        const notification = {
            id: Date.now(),
            titulo: 'Cotización Recibida',
            mensaje: `Nueva cotización de ${proveedor} para requerimiento ${numeroRequerimiento}`,
            color: 'success',
            icono: 'ri-mail-line',
            url_accion: `/app/cotizacion/compare/${requerimientoId}/`,
            tipo_notificacion: 'ESTADO_PEDIDO',
            fecha_hora: new Date().toISOString(),
            tiempo_transcurrido: 'ahora',
            leida: false
        };

        if (window.notificationSystem) {
            window.notificationSystem.addNewNotification(notification);
        }
    }
}

// Inicializar el sistema de notificaciones
document.addEventListener('DOMContentLoaded', function() {
    // Solo inicializar si el usuario está autenticado
    const isAuthenticated = !document.querySelector('a[href*="login"]') ||
                           document.querySelector('.navbar-dropdown-notifications') !== null;

    if (isAuthenticated) {
        console.log('🚀 Inicializando sistema de notificaciones...');
        window.notificationSystem = new NotificationSystem();

        // Hacer disponibles las clases globalmente
        window.SystemNotifications = SystemNotifications;
    }
});

// Exportar para uso en otros scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NotificationSystem, SystemNotifications };
}
