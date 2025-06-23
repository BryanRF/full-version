/**
 * Notifications Page Module
 * Gestión completa de la página de notificaciones
 */

'use strict';

const NotificationsPage = {
    // Configuración
    config: {
        apiEndpoint: '/api/notifications/json/',
        currentUrl: '/api/notifications/json/',
        csrfToken: null,
        currentNotificationId: null
    },

    // Referencias a elementos
    elements: {
        table: null,
        dataTable: null
    },

    /**
     * Inicializar el módulo
     */
    init() {
        this.config.csrfToken = this.getCookie('csrftoken');
        this.elements.table = $('.datatables-notifications');

        // Debug: Verificar que la URL funcione
        this.testAPIConnection();

        this.initializeDataTable();
        this.setupEventHandlers();
        this.setupFilters();
        this.loadStatistics();
        this.connectToNotificationSystem();
        console.log('Notifications Page initialized');
    },

    /**
     * Probar conexión con la API
     */
    async testAPIConnection() {
        try {
            console.log('🔍 Probando conexión con:', this.config.apiEndpoint);
            const response = await fetch(this.config.apiEndpoint + '?limit=1');

            if (response.ok) {
                const data = await response.json();
                console.log('✅ API responde correctamente:', data);
            } else {
                console.error('❌ Error de API:', response.status, response.statusText);

                // Intentar con la API alternativa
                console.log('🔄 Probando API alternativa...');
                const altResponse = await fetch('/api/notificaciones/?limit=1');
                if (altResponse.ok) {
                    const altData = await altResponse.json();
                    console.log('✅ API alternativa funciona:', altData);
                    this.config.apiEndpoint = '/api/notificaciones/';
                    this.config.currentUrl = '/api/notificaciones/';
                } else {
                    console.error('❌ Ambas APIs fallan');
                }
            }
        } catch (error) {
            console.error('❌ Error de conexión:', error);
        }
    },

    /**
     * Obtener cookie por nombre
     */
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
    },

    /**
     * Inicializar DataTable
     */
    initializeDataTable() {
        if (!this.elements.table.length) {
            console.error('Notifications table not found');
            return;
        }

        this.elements.dataTable = this.elements.table.DataTable({
            ajax: {
                url:  this.config.currentUrl ,
                dataSrc: function(json) {
                    // Actualizar estadísticas cuando se cargan los datos
                    if (json.unread_count !== undefined) {
                        NotificationsPage.updateUnreadCountDisplay(json.unread_count, json.total_count);
                    }
                    return json.data || [];
                },
                error: function(xhr, error, code) {
                    console.error('DataTables AJAX Error:', error, code, xhr);
                    toastr.error('Error cargando notificaciones. Revise la consola para más detalles.');
                }
            },
            columns: [
                { data: null }, // Control responsive
                { data: 'id' }, // Checkboxes
                { data: 'tipo_notificacion' }, // Tipo
                { data: 'titulo' }, // Título
                { data: 'mensaje' }, // Mensaje
                { data: 'fecha_hora' }, // Fecha
                { data: 'leida' }, // Estado
                { data: null } // Acciones
            ],
            columnDefs: [
                {
                    // Control responsive
                    className: 'control',
                    searchable: false,
                    orderable: false,
                    targets: 0,
                    render: () => ''
                },
                {
                    // Checkboxes
                    targets: 1,
                    orderable: false,
                    searchable: false,
                    responsivePriority: 4,
                    checkboxes: true,
                    render: () => '<input type="checkbox" class="dt-checkboxes form-check-input">',
                    checkboxes: {
                        selectAllRender: '<input type="checkbox" class="form-check-input">'
                    }
                },
                {
                    // Tipo
                    targets: 2,
                    render: (data, type, full) => {
                        const typeInfo = this.getNotificationTypeInfo(data);
                        return `<div class="d-flex align-items-center">
                            <div class="avatar avatar-sm me-3">
                                <span class="avatar-initial rounded bg-label-${full.color}">
                                    <i class="${full.icono || typeInfo.icon}"></i>
                                </span>
                            </div>
                            <span class="text-truncate">${full.tipo_notificacion_display || typeInfo.label}</span>
                        </div>`;
                    }
                },
                {
                    // Título
                    targets: 3,
                    responsivePriority: 1,
                    render: (data, type, full) => {
                        const unreadClass = !full.leida ? 'fw-bold' : '';
                        const unreadDot = !full.leida ? '<span class="badge badge-dot bg-primary me-2"></span>' : '';

                        return `<div class="d-flex align-items-center">
                            ${unreadDot}
                            <div>
                                <span class="${unreadClass} text-heading d-block">${data || 'Sin título'}</span>
                                ${full.url_accion ? '<small class="text-muted">Clic para ir a la acción</small>' : ''}
                            </div>
                        </div>`;
                    }
                },
                {
                    // Mensaje
                    targets: 4,
                    render: (data) => {
                        if (!data) return '<span class="text-muted">Sin mensaje</span>';

                        const maxLength = 60;
                        const truncated = data.length > maxLength ?
                            data.substring(0, maxLength) + '...' : data;

                        return `<span class="text-truncate d-block" title="${data}">${truncated}</span>`;
                    }
                },
                {
                    // Fecha
                    targets: 5,
                    render: (data, type, full) => {
                        const date = new Date(data);
                        const today = new Date();
                        const isToday = date.toDateString() === today.toDateString();

                        return `<div>
                            <span class="fw-medium">${date.toLocaleDateString()}</span>
                            <small class="text-muted d-block">
                                ${isToday ? full.tiempo_transcurrido : date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </small>
                        </div>`;
                    }
                },
                {
                    // Estado
                    targets: 6,
                    render: (data) => {
                        if (data) {
                            return '<span class="badge rounded-pill bg-label-success">Leída</span>';
                        } else {
                            return '<span class="badge rounded-pill bg-label-primary">No Leída</span>';
                        }
                    }
                },
                {
                    // Acciones
                    targets: -1,
                    title: 'Acciones',
                    searchable: false,
                    orderable: false,
                    render: (data, type, full) => {
                        let actions = ``;

                        if (!full.leida) {
                            actions += `
                                <button class="btn btn-sm btn-icon btn-text-success waves-effect rounded-pill me-1 btn-mark-read"
                                        data-id="${full.id}" title="Marcar como Leída">
                                    <i class="ri-check-line ri-20px"></i>
                                </button>`;
                        }

                        if (full.url_accion) {
                            actions += `
                                <button class="btn btn-sm btn-icon btn-text-primary waves-effect rounded-pill me-1 btn-go-action"
                                        data-url="${full.url_accion}" data-id="${full.id}" title="Ir a Acción">
                                    <i class="ri-external-link-line ri-20px"></i>
                                </button>`;
                        }



                        return `<div class="d-flex align-items-center">${actions}</div>`;
                    }
                }
            ],
            order: [[5, 'desc']], // Ordenar por fecha descendente
            dom: '<"card-header d-flex rounded-0 flex-wrap pb-md-0 pt-0"' +
                 '<"me-5 ms-n2"f>' +
                 '<"d-flex justify-content-start justify-content-md-end align-items-baseline"<"dt-action-buttons d-flex align-items-start align-items-md-center justify-content-sm-center mb-0 gap-4"lB>>' +
                 '>t' +
                 '<"row mx-1"' +
                 '<"col-sm-12 col-md-6"i>' +
                 '<"col-sm-12 col-md-6"p>' +
                 '>',
            lengthMenu: [10, 25, 50, 100],
            language: {
                sLengthMenu: '_MENU_',
                search: '',
                searchPlaceholder: 'Buscar Notificaciones',
                paginate: {
                    next: '<i class="ri-arrow-right-s-line"></i>',
                    previous: '<i class="ri-arrow-left-s-line"></i>'
                }
            },
            buttons: [
                {
                    extend: 'collection',
                    className: 'btn btn-outline-secondary dropdown-toggle me-4 waves-effect waves-light',
                    text: '<i class="ri-upload-2-line me-1"></i> <span class="d-none d-sm-inline-block">Exportar</span>',
                    buttons: [
                        {
                            extend: 'print',
                            text: '<i class="ri-printer-line me-1"></i>Imprimir',
                            className: 'dropdown-item',
                            exportOptions: { columns: [2, 3, 4, 5, 6] }
                        },
                        {
                            extend: 'csv',
                            text: '<i class="ri-file-text-line me-1"></i>CSV',
                            className: 'dropdown-item',
                            exportOptions: { columns: [2, 3, 4, 5, 6] }
                        },
                        {
                            extend: 'excel',
                            text: '<i class="ri-file-excel-line me-1"></i>Excel',
                            className: 'dropdown-item',
                            exportOptions: { columns: [2, 3, 4, 5, 6] }
                        }
                    ]
                }
            ],
            responsive: {
                details: {
                    display: $.fn.dataTable.Responsive.display.modal({
                        header: function (row) {
                            const data = row.data();
                            return 'Detalles de ' + (data['titulo'] || 'Notificación');
                        }
                    }),
                    type: 'column',
                    renderer: function (api, rowIdx, columns) {
                        const data = $.map(columns, function (col, i) {
                            return col.title !== '' ?
                                '<tr data-dt-row="' + col.rowIndex + '" data-dt-column="' + col.columnIndex + '">' +
                                '<td>' + col.title + ':</td>' +
                                '<td class="ps-0">' + col.data + '</td>' +
                                '</tr>' : '';
                        }).join('');
                        return data ? $('<table class="table"/><tbody />').append(data) : false;
                    }
                }
            }
        });

        // Agregar clases CSS
        $('.dataTables_length').addClass('my-0');
        $('.dt-action-buttons').addClass('pt-0');

        // Almacenar referencia global
        window.dt_notifications = this.elements.dataTable;
    },

    /**
     * Obtener información del tipo de notificación
     */
    getNotificationTypeInfo(type) {
        const types = {
            'ALERTA_STOCK': {
                label: 'Alerta de Stock',
                icon: 'ri-alert-line',
                color: 'warning'
            },
            'APROBACION_PENDIENTE': {
                label: 'Aprobación Pendiente',
                icon: 'ri-time-line',
                color: 'info'
            },
            'ESTADO_PEDIDO': {
                label: 'Estado de Pedido',
                icon: 'ri-shopping-cart-line',
                color: 'primary'
            },
            'PRODUCTO_ACTUALIZADO': {
                label: 'Producto Actualizado',
                icon: 'ri-edit-box-line',
                color: 'success'
            },
            'CATEGORIA_NUEVA': {
                label: 'Nueva Categoría',
                icon: 'ri-folder-add-line',
                color: 'info'
            },
            'SISTEMA': {
                label: 'Sistema',
                icon: 'ri-notification-line',
                color: 'secondary'
            }
        };

        return types[type] || types['SISTEMA'];
    },

    /**
     * Configurar filtros
     */
    setupFilters() {
        // Event listeners para filtros
        $('#statusFilter').on('change', () => this.applyFilters());
        $('#typeFilter').on('change', () => this.applyFilters());
        $('#clearFiltersBtn').on('click', () => this.clearFilters());

        // Búsqueda en tiempo real
        let searchTimeout;
        $('#searchFilter').on('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.applyFilters();
            }, 300);
        });
    },

    /**
     * Aplicar filtros
     */
    applyFilters() {
        const status = $('#statusFilter').val();
        const type = $('#typeFilter').val();
        const search = $('#searchFilter').val();

        let url = this.config.apiEndpoint + '?';
        const params = [];

        if (status === 'unread') {
            params.push('only_unread=true');
        } else if (status === 'read') {
            params.push('only_unread=false');
        }

        if (type) params.push(`tipo=${type}`);
        if (search) params.push(`search=${encodeURIComponent(search)}`);

        this.config.currentUrl = url + params.join('&');
        this.elements.dataTable.ajax.url(this.config.currentUrl).load();
    },

    /**
     * Limpiar filtros
     */
    clearFilters() {
        $('#statusFilter').val('');
        $('#typeFilter').val('');
        $('#searchFilter').val('');

        this.config.currentUrl = this.config.apiEndpoint;
        this.elements.dataTable.ajax.url(this.config.currentUrl).load();
    },

    /**
     * Configurar manejadores de eventos
     */
    setupEventHandlers() {
        // Ver detalles de la notificación
        $(document).on('click', '.btn-view-notification', (e) => {
            e.preventDefault();
            const id = $(e.currentTarget).data('id');
            this.showNotificationDetails(id);
        });

        // Marcar como leída
        $(document).on('click', '.btn-mark-read', (e) => {
            e.preventDefault();
            const id = $(e.currentTarget).data('id');
            this.markAsRead(id);
        });

        // Ir a acción
        $(document).on('click', '.btn-go-action', (e) => {
            e.preventDefault();
            const url = $(e.currentTarget).data('url');
            const id = $(e.currentTarget).data('id');
            this.goToAction(url, id);
        });

        // Configuración de sonido
        $('#soundNotifications').on('change', (e) => {
            localStorage.setItem('notification-sound', e.target.checked);
        });

        // Configuración de notificaciones del navegador
        $('#browserNotifications').on('change', (e) => {
            if (e.target.checked) {
                this.requestNotificationPermission();
            }
        });
    },

    /**
     * Cargar estadísticas
     */
    async loadStatistics() {
        try {
            // Usar la API que ya funciona
            const response = await fetch('/api/notifications/json/?limit=1');
            if (response.ok) {
                const data = await response.json();
                // Calcular estadísticas desde los datos
                const stats = {
                    total: data.total_count || 0,
                    no_leidas: data.unread_count || 0,
                    leidas: (data.total_count || 0) - (data.unread_count || 0)
                };
                this.updateStatistics(stats);
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    },

    /**
     * Actualizar estadísticas en UI
     */
    updateStatistics(stats) {
        document.getElementById('totalNotifications').textContent = stats.total || 0;
        document.getElementById('unreadNotifications').textContent = stats.no_leidas || 0;
        document.getElementById('readNotifications').textContent = stats.leidas || 0;
    },

    /**
     * Actualizar contadores desde la respuesta de la tabla
     */
    updateUnreadCountDisplay(unreadCount, totalCount) {
        const unreadElement = document.getElementById('unreadNotifications');
        const totalElement = document.getElementById('totalNotifications');
        const readElement = document.getElementById('readNotifications');

        if (unreadElement) unreadElement.textContent = unreadCount || 0;
        if (totalElement) totalElement.textContent = totalCount || 0;
        if (readElement) readElement.textContent = (totalCount - unreadCount) || 0;

        // Calcular notificaciones de hoy
        this.updateTodayNotifications();
    },

    /**
     * Actualizar contador de notificaciones de hoy
     */
    updateTodayNotifications() {
        if (!this.notifications || this.notifications.length === 0) return;

        const today = new Date().toDateString();
        const todayCount = this.notifications.filter(notification => {
            const notificationDate = new Date(notification.fecha_hora).toDateString();
            return notificationDate === today;
        }).length;

        const todayElement = document.getElementById('todayNotifications');
        if (todayElement) {
            todayElement.textContent = todayCount;
        }
    },

    /**
     * Mostrar detalles de la notificación
     */
    async showNotificationDetails(notificationId) {
        try {
            // Usar la API REST que ya funciona
            const response = await fetch(`/api/notificaciones/${notificationId}/`);
            if (response.ok) {
                const notification = await response.json();
                this.renderNotificationDetails(notification);

                const modal = new bootstrap.Modal(document.getElementById('notificationDetailsModal'));
                modal.show();

                // Marcar como leída si no lo está
                if (!notification.leida) {
                    this.markAsRead(notificationId);
                }
            } else {
                toastr.error('Error al cargar detalles de la notificación');
            }
        } catch (error) {
            console.error('Error loading notification details:', error);
            toastr.error('Error de conexión');
        }
    },

    /**
     * Renderizar detalles de la notificación
     */
    renderNotificationDetails(notification) {
        const content = document.getElementById('notificationDetailsContent');
        const typeInfo = this.getNotificationTypeInfo(notification.tipo_notificacion);
        const actualColor = notification.color || typeInfo.color;
        const actualIcon = notification.icono || typeInfo.icon;

        content.innerHTML = `
            <div class="row">
                <div class="col-md-8">
                    <div class="d-flex align-items-center mb-3">
                        <div class="avatar avatar-lg me-3">
                            <span class="avatar-initial rounded bg-label-${actualColor}">
                                <i class="${actualIcon} ri-24px"></i>
                            </span>
                        </div>
                        <div>
                            <h5 class="mb-1">${notification.titulo || 'Notificación del Sistema'}</h5>
                            <p class="text-muted mb-0">${notification.tipo_notificacion_display || typeInfo.label}</p>
                        </div>
                    </div>

                    <div class="mb-4">
                        <h6>Mensaje</h6>
                        <p class="text-body">${notification.mensaje}</p>
                    </div>

                    ${notification.datos_adicionales && Object.keys(notification.datos_adicionales).length > 0 ? `
                        <div class="mb-4">
                            <h6>Información Adicional</h6>
                            <div class="bg-light p-3 rounded">
                                ${this.formatAdditionalData(notification.datos_adicionales)}
                            </div>
                        </div>
                    ` : ''}
                </div>

                <div class="col-md-4">
                    <h6>Información</h6>
                    <ul class="list-unstyled">
                        <li class="mb-2">
                            <strong>Estado:</strong>
                            <span class="badge rounded-pill bg-label-${notification.leida ? 'success' : 'primary'}">
                                ${notification.leida ? 'Leída' : 'No Leída'}
                            </span>
                        </li>
                        <li class="mb-2">
                            <strong>Fecha:</strong> ${new Date(notification.fecha_hora).toLocaleString('es-PE')}
                        </li>
                        <li class="mb-2">
                            <strong>Tiempo:</strong> ${notification.tiempo_transcurrido}
                        </li>
                        <li class="mb-2">
                            <strong>Usuario:</strong> ${notification.usuario_info ? notification.usuario_info.nombre_completo : 'Sistema'}
                        </li>
                        ${notification.url_accion ? `
                            <li class="mb-2">
                                <strong>Acción:</strong>
                                <a href="${notification.url_accion}" class="text-primary">Ir a la acción</a>
                            </li>
                        ` : ''}
                    </ul>
                </div>
            </div>
        `;

        // Actualizar botones de acción
        const actionsContainer = document.getElementById('notificationActionsButtons');
        let actionButtons = '';

        if (!notification.leida) {
            actionButtons += `
                <button type="button" class="btn btn-success me-2" onclick="NotificationsPage.markAsRead(${notification.id})">
                    <i class="ri-check-line me-1"></i>Marcar como Leída
                </button>`;
        }

        if (notification.url_accion) {
            actionButtons += `
                <button type="button" class="btn btn-primary" onclick="NotificationsPage.goToAction('${notification.url_accion}', ${notification.id})">
                    <i class="ri-external-link-line me-1"></i>Ir a Acción
                </button>`;
        }

        actionsContainer.innerHTML = actionButtons;
    },

    /**
     * Formatear datos adicionales de manera legible
     */
    formatAdditionalData(data) {
        let html = '<div class="row">';

        for (const [key, value] of Object.entries(data)) {
            const label = this.formatFieldLabel(key);
            const formattedValue = this.formatFieldValue(key, value);

            html += `
                <div class="col-md-6 mb-2">
                    <strong>${label}:</strong> ${formattedValue}
                </div>
            `;
        }

        html += '</div>';
        return html;
    },

    /**
     * Formatear etiquetas de campos
     */
    formatFieldLabel(key) {
        const labels = {
            'requerimiento_id': 'ID Requerimiento',
            'numero_requerimiento': 'Número de Requerimiento',
            'estado_anterior': 'Estado Anterior',
            'estado_nuevo': 'Estado Nuevo',
            'actualizado_por': 'Actualizado Por',
            'producto_id': 'ID Producto',
            'producto_nombre': 'Producto',
            'categoria': 'Categoría',
            'stock_actual': 'Stock Actual',
            'stock_minimo': 'Stock Mínimo',
            'prioridad': 'Prioridad'
        };

        return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    },

    /**
     * Formatear valores de campos
     */
    formatFieldValue(key, value) {
        if (value === null || value === undefined) {
            return '<span class="text-muted">No especificado</span>';
        }

        // Formatear estados
        if (key.includes('estado')) {
            const estados = {
                'pendiente': '<span class="badge bg-warning">Pendiente</span>',
                'aprobado': '<span class="badge bg-success">Aprobado</span>',
                'rechazado': '<span class="badge bg-danger">Rechazado</span>',
                'en_proceso_cotizacion': '<span class="badge bg-info">En Proceso Cotización</span>',
                'cotizado': '<span class="badge bg-primary">Cotizado</span>',
                'orden_generada': '<span class="badge bg-success">Orden Generada</span>',
                'completado': '<span class="badge bg-success">Completado</span>',
                'cancelado': '<span class="badge bg-secondary">Cancelado</span>'
            };
            return estados[value] || `<span class="badge bg-secondary">${value}</span>`;
        }

        // Formatear números de requerimiento como enlaces
        if (key === 'numero_requerimiento' && typeof value === 'string' && value.startsWith('REQ-')) {
            const reqId = value.replace('REQ-', '').replace(/^0+/, ''); // Quitar ceros al inicio
            return `<a href="/app/requirements/details/${reqId}/" class="text-primary">${value}</a>`;
        }

        // Formatear IDs como enlaces
        if (key === 'requerimiento_id') {
            return `<a href="/app/requirements/details/${value}/" class="text-primary">${value}</a>`;
        }

        if (key === 'producto_id') {
            return `<a href="/app/ecommerce/product/add/?edit=${value}" class="text-primary">${value}</a>`;
        }

        return String(value);
    },

    /**
     * Marcar como leída
     */
    async markAsRead(notificationId) {
        try {
            const response = await fetch(`/api/notifications/${notificationId}/mark-read/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.config.csrfToken,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    toastr.success('Notificación marcada como leída');
                    this.reload();
                    this.loadStatistics();

                    // Cerrar modal si está abierto
                    const modal = bootstrap.Modal.getInstance(document.getElementById('notificationDetailsModal'));
                    if (modal) modal.hide();
                }
            } else {
                toastr.error('Error al marcar como leída');
            }
        } catch (error) {
            console.error('Error marking as read:', error);
            toastr.error('Error de conexión');
        }
    },

    /**
     * Marcar todas como leídas
     */
    async markAllAsRead() {
        if (!confirm('¿Está seguro de marcar todas las notificaciones como leídas?')) {
            return;
        }

        try {
            const response = await fetch('/api/notificaciones/marcar_todas_leidas/', {
                method: 'PATCH',
                headers: {
                    'X-CSRFToken': this.config.csrfToken,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                toastr.success(result.message);
                this.reload();
                this.loadStatistics();
            } else {
                toastr.error('Error al marcar todas como leídas');
            }
        } catch (error) {
            console.error('Error marking all as read:', error);
            toastr.error('Error de conexión');
        }
    },

    /**
     * Ir a acción
     */
    goToAction(url, notificationId) {
        // Marcar como leída antes de redirigir
        this.markAsRead(notificationId);

        // Redirigir después de un pequeño delay
        setTimeout(() => {
            window.location.href = url;
        }, 200);
    },

    /**
     * Mostrar solo no leídas
     */
    showOnlyUnread() {
        $('#statusFilter').val('unread').trigger('change');
        toastr.info('Mostrando solo notificaciones no leídas');
    },

    /**
     * Exportar notificaciones
     */
    exportNotifications() {
        // Usar funcionalidad de DataTables
        const buttons = this.elements.dataTable.buttons();
        buttons.container().find('.buttons-excel').click();
    },

    /**
     * Actualizar notificaciones
     */
    refreshNotifications() {
        this.reload();
        this.loadStatistics();
        toastr.success('Notificaciones actualizadas');
    },

    /**
     * Conectar al sistema de notificaciones en tiempo real
     */
    connectToNotificationSystem() {
        // Conectar al sistema de notificaciones si está disponible
        if (window.notificationSystem) {
            // Escuchar cuando lleguen nuevas notificaciones
            const originalAddNotification = window.notificationSystem.addNewNotification;
            window.notificationSystem.addNewNotification = (notification) => {
                originalAddNotification.call(window.notificationSystem, notification);

                // Recargar la tabla si estamos en la página de notificaciones
                this.reload();
                this.loadStatistics();
            };

            this.showConnectionStatus(true);
        } else {
            this.showConnectionStatus(false);
        }
    },

    /**
     * Mostrar estado de conexión
     */
    showConnectionStatus(connected) {
        const toast = document.getElementById('connectionToast');
        const status = document.getElementById('connectionStatus');

        if (connected) {
            toast.className = 'toast align-items-center text-white bg-success border-0';
            status.innerHTML = '<i class="ri-wifi-line me-2"></i>Conectado a notificaciones en tiempo real';
        } else {
            toast.className = 'toast align-items-center text-white bg-warning border-0';
            status.innerHTML = '<i class="ri-wifi-off-line me-2"></i>Modo offline - Actualización manual';
        }

        const bsToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: 3000
        });
        bsToast.show();
    },

    /**
     * Solicitar permisos de notificación
     */
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    toastr.success('Permisos de notificación concedidos');
                } else {
                    toastr.warning('Permisos de notificación denegados');
                    $('#browserNotifications').prop('checked', false);
                }
            });
        }
    },

    /**
     * Recargar tabla
     */
    reload() {
        if (this.elements.dataTable) {
            this.elements.dataTable.ajax.reload();
        }
    },

    /**
     * Actualizar URL de datos y recargar
     */
    updateDataUrl(newUrl) {
        this.config.currentUrl = newUrl;
        if (this.elements.dataTable) {
            this.elements.dataTable.ajax.url(newUrl).load();
        }
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    NotificationsPage.init();
});

// Hacer disponible globalmente
window.NotificationsPage = NotificationsPage;
