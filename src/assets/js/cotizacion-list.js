/**
 * Cotización List Module
 * Maneja la lista principal de cotizaciones con DataTable
 */

'use strict';

const CotizacionList = {
    // Configuración
    config: {
        apiEndpoint: '/api/cotizacion/envios/data/',
        currentUrl: '/api/cotizacion/envios/data/',
        csrfToken: null
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
        this.elements.table = $('.datatables-cotizaciones');
        this.initializeDataTable();
        this.setupEventHandlers();
        this.loadAnalytics();
        console.log('Cotización List initialized');
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
            console.error('Cotizaciones table not found');
            return;
        }

        // Configuración de colores del tema
        let borderColor, bodyBg, headingColor;
        if (typeof isDarkStyle !== 'undefined' && isDarkStyle) {
            borderColor = config.colors_dark.borderColor;
            bodyBg = config.colors_dark.bodyBg;
            headingColor = config.colors_dark.headingColor;
        } else {
            borderColor = config.colors.borderColor;
            bodyBg = config.colors.bodyBg;
            headingColor = config.colors.headingColor;
        }

        this.elements.dataTable = this.elements.table.DataTable({
            ajax: {
                url: this.config.currentUrl,
                dataSrc: 'data'
            },
            columns: [
                { data: null }, // Control responsive
                { data: 'id' }, // Checkboxes
                { data: 'numero_envio' }, // Número Envío
                { data: 'requerimiento_numero' }, // Requerimiento
                { data: 'proveedor_name' }, // Proveedor
                { data: 'metodo_envio' }, // Método Envío
                { data: 'fecha_envio' }, // Fecha Envío
                { data: 'fecha_respuesta_esperada' }, // Fecha Límite
                { data: 'estado' }, // Estado
                { data: 'dias_hasta_respuesta' }, // Días Restantes
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
                    // Número de envío
                    targets: 2,
                    responsivePriority: 1,
                    render: (data, type, full) => {
                        const estadoIcon = this.getEstadoIcon(full.estado);
                        return `<div class="d-flex align-items-center">
                            <div class="avatar-wrapper me-3">
                                <div class="avatar avatar-sm">
                                    <span class="avatar-initial rounded bg-label-${full.estado_color}">${estadoIcon}</span>
                                </div>
                            </div>
                            <div>
                                <span class="fw-medium text-heading">${data}</span>
                                <small class="text-muted d-block">ID: ${full.id}</small>
                            </div>
                        </div>`;
                    }
                },
                {
                    // Requerimiento
                    targets: 3,
                    render: (data) => `<span class="fw-medium">${data || '-'}</span>`
                },
                {
                    // Proveedor
                    targets: 4,
                    render: (data, type, full) => {
                        const hasEmail = full.proveedor_email && full.proveedor_email.trim();
                        const emailIcon = hasEmail ? '📧' : '📞';
                        return `<div>
                            <span class="fw-medium">${data}</span>
                            <small class="text-muted d-block">${emailIcon} ${hasEmail ? full.proveedor_email : 'Sin email'}</small>
                        </div>`;
                    }
                },
                {
                    // Método de envío
                    targets: 5,
                    render: (data, type, full) => {
                        const methodIcon = this.getMethodIcon(data);
                        return `<span class="badge rounded-pill bg-label-info">
                            ${methodIcon} ${full.metodo_envio_display}
                        </span>`;
                    }
                },
                {
                    // Fecha envío
                    targets: 6,
                    render: (data) => {
                        if (!data) return '<span class="text-muted">Sin registro</span>';
                        const date = new Date(data);
                        return `<span class="text-nowrap">${date.toLocaleDateString()}</span>`;
                    }
                },
                {
                    // Fecha límite
                    targets: 7,
                    render: (data, type, full) => {
                        if (!data) return '<span class="text-muted">-</span>';
                        const date = new Date(data);
                        const today = new Date();
                        const diffTime = date - today;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        let urgencyClass = 'text-muted';
                        let urgencyText = '';
                        
                        if (diffDays < 0) {
                            urgencyClass = 'text-danger';
                            urgencyText = 'Vencida';
                        } else if (diffDays <= 1) {
                            urgencyClass = 'text-warning';
                            urgencyText = 'Hoy/Mañana';
                        } else if (diffDays <= 3) {
                            urgencyClass = 'text-warning';
                            urgencyText = 'Próxima';
                        }
                        
                        return `<div>
                            <span class="fw-medium">${date.toLocaleDateString()}</span>
                            ${urgencyText ? `<br><small class="${urgencyClass}">${urgencyText}</small>` : ''}
                        </div>`;
                    }
                },
                {
                    // Estado
                    targets: 8,
                    render: (data, type, full) => {
                        return `<span class="badge rounded-pill bg-label-${full.estado_color}">
                            ${full.estado_display}
                        </span>`;
                    }
                },
                {
                    // Días restantes
                    targets: 9,
                    className: 'text-center',
                    render: (data) => {
                        if (data === null || data === undefined) return '-';
                        
                        let badgeClass = 'bg-label-info';
                        let displayText = `${data} días`;
                        
                        if (data < 0) {
                            badgeClass = 'bg-label-danger';
                            displayText = `${Math.abs(data)} días vencido`;
                        } else if (data <= 1) {
                            badgeClass = 'bg-label-warning';
                            displayText = data === 0 ? 'Hoy' : '1 día';
                        } else if (data <= 3) {
                            badgeClass = 'bg-label-warning';
                        }
                        
                        return `<span class="badge ${badgeClass}">${displayText}</span>`;
                    }
                },
                {
                    // Acciones
                    targets: -1,
                    title: 'Acciones',
                    searchable: false,
                    orderable: false,
                    render: (data, type, full) => {
                        return `<div class="d-flex align-items-center">
                            <button class="btn btn-sm btn-icon btn-text-secondary waves-effect rounded-pill me-1 btn-view-envio" 
                                    data-id="${full.id}" title="Ver Detalles">
                                <i class="ri-eye-line ri-20px"></i>
                            </button>
                            
                            ${this.getActionButtons(full)}
                            
                            <button class="btn btn-sm btn-icon btn-text-secondary waves-effect rounded-pill dropdown-toggle hide-arrow" 
                                    data-bs-toggle="dropdown">
                                <i class="ri-more-2-line ri-20px"></i>
                            </button>
                            <div class="dropdown-menu dropdown-menu-end m-0">
                                ${this.getDropdownActions(full)}
                            </div>
                        </div>`;
                    }
                }
            ],
            order: [[6, 'desc']], // Ordenar por fecha de envío descendente
            dom: '<"card-header d-flex rounded-0 flex-wrap pb-md-0 pt-0"' +
                 '<"me-5 ms-n2"f>' +
                 '<"d-flex justify-content-start justify-content-md-end align-items-baseline"<"dt-action-buttons d-flex align-items-start align-items-md-center justify-content-sm-center mb-0 gap-4"lB>>' +
                 '>t' +
                 '<"row mx-1"' +
                 '<"col-sm-12 col-md-6"i>' +
                 '<"col-sm-12 col-md-6"p>' +
                 '>',
            lengthMenu: [7, 10, 20, 50, 100],
            language: {
                sLengthMenu: '_MENU_',
                search: '',
                searchPlaceholder: 'Buscar Cotización',
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
                            exportOptions: { columns: [2, 3, 4, 5, 6, 7, 8, 9] }
                        },
                        {
                            extend: 'csv',
                            text: '<i class="ri-file-text-line me-1"></i>CSV',
                            className: 'dropdown-item',
                            exportOptions: { columns: [2, 3, 4, 5, 6, 7, 8, 9] }
                        },
                        {
                            extend: 'excel',
                            text: '<i class="ri-file-excel-line me-1"></i>Excel',
                            className: 'dropdown-item',
                            exportOptions: { columns: [2, 3, 4, 5, 6, 7, 8, 9] }
                        }
                    ]
                }
            ],
            responsive: {
                details: {
                    display: $.fn.dataTable.Responsive.display.modal({
                        header: function (row) {
                            const data = row.data();
                            return 'Detalles de ' + data['numero_envio'];
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
        window.dt_cotizaciones = this.elements.dataTable;
    },

    /**
     * Configurar manejadores de eventos
     */
    setupEventHandlers() {
        // Ver detalles del envío
        $(document).on('click', '.btn-view-envio', (e) => {
            const id = $(e.currentTarget).data('id');
            this.showEnvioDetails(id);
        });

        // Confirmar envío manual
        $(document).on('click', '.btn-confirm-manual', (e) => {
            const id = $(e.currentTarget).data('id');
            this.showConfirmManualModal(id);
        });

        // Reenviar email
        $(document).on('click', '.btn-resend-email', (e) => {
            const id = $(e.currentTarget).data('id');
            this.resendEmail(id);
        });

        // Generar Excel
        $(document).on('click', '.btn-generate-excel', (e) => {
            const id = $(e.currentTarget).data('id');
            this.generateExcel(id);
        });

        // Importar respuesta
        $(document).on('click', '.btn-import-response', (e) => {
            const id = $(e.currentTarget).data('id');
            this.showImportResponseModal(id);
        });
    },

    /**
     * Obtener icono de estado
     */
    getEstadoIcon(estado) {
        const icons = {
            'pendiente': '⏳',
            'enviado': '📤',
            'respondido': '✅',
            'vencido': '⏰',
            'cancelado': '❌'
        };
        return icons[estado] || '📋';
    },

    /**
     * Obtener icono de método
     */
    getMethodIcon(metodo) {
        const icons = {
            'email': '📧',
            'whatsapp': '💬',
            'telefono': '📞',
            'otro': '📋'
        };
        return icons[metodo] || '📋';
    },

    /**
     * Obtener botones de acción específicos
     */
    getActionButtons(envio) {
        let buttons = '';
        
        if (envio.estado === 'pendiente' && !envio.proveedor_email) {
            buttons += `<button class="btn btn-sm btn-icon btn-text-warning waves-effect rounded-pill me-1 btn-confirm-manual" 
                               data-id="${envio.id}" title="Confirmar Envío Manual">
                            <i class="ri-check-line ri-20px"></i>
                        </button>`;
        }
        
        if (envio.proveedor_email && envio.estado !== 'respondido') {
            buttons += `<button class="btn btn-sm btn-icon btn-text-primary waves-effect rounded-pill me-1 btn-resend-email" 
                               data-id="${envio.id}" title="Reenviar Email">
                            <i class="ri-mail-line ri-20px"></i>
                        </button>`;
        }
        
        return buttons;
    },

    /**
     * Obtener acciones del dropdown
     */
    getDropdownActions(envio) {
        let actions = '';
        
        actions += `<a href="javascript:void(0);" class="dropdown-item btn-generate-excel" data-id="${envio.id}">
                        <i class="ri-file-excel-line me-1"></i>Generar Excel
                    </a>`;
        
        if (envio.estado === 'enviado') {
            actions += `<a href="javascript:void(0);" class="dropdown-item btn-import-response" data-id="${envio.id}">
                            <i class="ri-upload-line me-1"></i>Importar Respuesta
                        </a>`;
        }
        
        actions += `<div class="dropdown-divider"></div>
                    <a href="/app/cotizacion/details/${envio.id}/" class="dropdown-item">
                        <i class="ri-eye-line me-1"></i>Ver Completo
                    </a>`;
        
        return actions;
    },

    /**
     * Cargar analíticas
     */
    async loadAnalytics() {
        try {
            const response = await fetch('/api/cotizacion/envios/analytics/');
            if (response.ok) {
                const analytics = await response.json();
                this.updateAnalytics(analytics);
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    },

    /**
     * Actualizar analíticas en UI
     */
    updateAnalytics(analytics) {
        // Animar contadores
        this.animateCounter(document.getElementById('totalEnvios'), analytics.total_envios);
        this.animateCounter(document.getElementById('pendientesEnvios'), analytics.pendientes);
        this.animateCounter(document.getElementById('respondidasEnvios'), analytics.respuestas_recibidas);
        this.animateCounter(document.getElementById('vencidasEnvios'), analytics.vencidos);
        
        // Actualizar textos
        const enviosActivos = analytics.pendientes + analytics.enviados;
        document.getElementById('enviosActivos').textContent = `${enviosActivos} activos`;
        
        const pendientesPercentage = analytics.total_envios > 0 ? 
            Math.round((analytics.pendientes / analytics.total_envios) * 100) : 0;
        document.getElementById('pendientesPercentage').textContent = `${pendientesPercentage}%`;
        
        const tasaRespuesta = Math.round(analytics.tasa_respuesta);
        document.getElementById('tasaRespuesta').textContent = `${tasaRespuesta}%`;
    },

    /**
     * Animar contador
     */
    animateCounter(element, target, duration = 1000) {
        if (!element) return;

        const startTime = performance.now();
        const startValue = 0;

        const updateCount = currentTime => {
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / duration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 4);
            const currentValue = Math.floor(startValue + (target - startValue) * easedProgress);
            
            element.textContent = currentValue;

            if (progress < 1) {
                requestAnimationFrame(updateCount);
            } else {
                element.textContent = target;
            }
        };

        requestAnimationFrame(updateCount);
    },

    /**
     * Mostrar detalles del envío
     */
    async showEnvioDetails(id) {
    console.log('Showing details for :', id);
    window.location.href = `/app/cotizacion/details/${id}/`;
}
,

    /**
     * Mostrar modal para confirmar envío manual
     */
    showConfirmManualModal(id) {
        var modal1 = $(this).closest('.modal');
        modal1.modal('hide');
        window.currentEnvioId = id;
        const modal = new bootstrap.Modal(document.getElementById('confirmarEnvioModal'));
        modal.show();
    },

    /**
     * Reenviar email
     */
    async resendEmail(id) {
        try {
             toastr.info('Enviando email...', 'Sistema', {
        timeOut: 3000,
        closeButton: true,
        progressBar: true,
});
            const response = await fetch(`/api/cotizacion/envios/${id}/reenviar_email/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.config.csrfToken,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                toastr.success('Email reenviado exitosamente');
                this.reload();
            } else {
                const error = await response.json();
                toastr.error(error.error || 'Error al reenviar email');
            }
        } catch (error) {
            console.error('Error resending email:', error);
            toastr.error('Error de conexión');
        }
    },

    /**
     * Generar Excel
     */
    generateExcel(id) {
        window.open(`/api/cotizacion/envios/${id}/generate_excel/`, '_blank');
    },

    /**
     * Mostrar modal para importar respuesta
     */
    showImportResponseModal(id) {
        window.currentEnvioId = id;
        const modal = new bootstrap.Modal(document.getElementById('importarRespuestaModal'));
        modal.show();
    },

    /**
     * Recargar tabla
     */
    reload() {
        if (this.elements.dataTable) {
            this.elements.dataTable.ajax.reload();
        }
        this.loadAnalytics();
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
    CotizacionList.init();
});

// Hacer disponible globalmente
window.CotizacionList = CotizacionList;