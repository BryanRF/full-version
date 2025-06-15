/**
 * Requirements List Module
 * Maneja la lista principal de requerimientos con DataTable
 */

'use strict';

const RequirementsList = {
    // Configuración
    config: {
        apiEndpoint: '/api/requirements/data/',
        currentUrl: '/api/requirements/data/',
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
        this.elements.table = $('.datatables-requirements');
        this.initializeDataTable();
        this.setupEventHandlers();
        console.log('Requirements List initialized');
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
            console.error('Requirements table not found');
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
                { data: 'numero_requerimiento' }, // Número
                { data: 'usuario_solicitante_name' }, // Solicitante
                { data: 'fecha_requerimiento' }, // Fecha Requerida
                { data: 'prioridad' }, // Prioridad
                { data: 'estado' }, // Estado
                { data: 'total_productos' }, // Productos
                { data: 'cantidad_total' }, // Cantidad Total
                { data: 'created_at' }, // Fecha Creación
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
                    // Número de requerimiento
                    targets: 2,
                    responsivePriority: 1,
                    render: (data, type, full) => {
                        const priorityIcon = this.getPriorityIcon(full.prioridad);
                        return `<div class="d-flex align-items-center">
                            <div class="avatar-wrapper me-3">
                                <div class="avatar avatar-sm">
                                    <span class="avatar-initial rounded bg-label-${full.prioridad_color}">${priorityIcon}</span>
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
                    // Solicitante
                    targets: 3,
                    render: (data) => `<span class="text-truncate">${data || '-'}</span>`
                },
                {
                    // Fecha requerida
                    targets: 4,
                    render: (data) => {
                        if (!data) return '<span class="text-muted">-</span>';
                        const date = new Date(data);
                        const today = new Date();
                        const diffTime = date - today;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        let badgeClass = 'bg-label-info';
                        let urgencyText = '';
                        
                        if (diffDays < 0) {
                            badgeClass = 'bg-label-danger';
                            urgencyText = 'Vencido';
                        } else if (diffDays <= 3) {
                            badgeClass = 'bg-label-warning';
                            urgencyText = 'Urgente';
                        } else if (diffDays <= 7) {
                            badgeClass = 'bg-label-warning';
                            urgencyText = 'Próximo';
                        }
                        
                        return `<div>
                            <span class="fw-medium">${date.toLocaleDateString()}</span>
                            ${urgencyText ? `<br><span class="badge ${badgeClass}">${urgencyText}</span>` : ''}
                        </div>`;
                    }
                },
                {
                    // Prioridad
                    targets: 5,
                    render: (data, type, full) => {
                        const icon = this.getPriorityIcon(data);
                        return `<span class="badge rounded-pill bg-label-${full.prioridad_color}">
                            ${icon} ${full.prioridad_display}
                        </span>`;
                    }
                },
                {
                    // Estado
                    targets: 6,
                    render: (data, type, full) => {
                        return `<span class="badge rounded-pill bg-label-${full.estado_color}">
                            ${full.estado_display}
                        </span>`;
                    }
                },
                {
                    // Total productos
                    targets: 7,
                    className: 'text-center',
                    render: (data) => `<span class="fw-medium">${data}</span>`
                },
                {
                    // Cantidad total
                    targets: 8,
                    className: 'text-center',
                    render: (data) => `<span class="fw-medium">${data}</span>`
                },
                {
                    // Fecha creación
                    targets: 9,
                    render: (data) => {
                        if (!data) return '<span class="text-muted">-</span>';
                        const date = new Date(data);
                        return `<span class="text-nowrap">${date.toLocaleDateString()}</span>`;
                    }
                },
                {
                    // Acciones
                    targets: -1,
                    title: 'Acciones',
                    searchable: false,
                    orderable: false,
                    render: (data, type, full) => {
                        console.log(full)
                        let actions= `<div class="d-flex align-items-center">
                            <button class="btn btn-sm btn-icon btn-text-secondary waves-effect rounded-pill me-1 btn-view-requirement" 
                                    data-id="${full.id}" title="Ver Detalles">
                                <i class="ri-eye-line ri-20px"></i>
                            </button>
                            <button class="btn btn-sm btn-icon btn-export-pdf"  title="Exportar PDF"  data-requirement-id="${full.id}">
                                <i class="ri-file-pdf-line"></i>
                            </button>
                            <button class="btn btn-sm btn-icon btn-text-secondary waves-effect rounded-pill dropdown-toggle hide-arrow" 
                                    data-bs-toggle="dropdown">
                                <i class="ri-more-2-line ri-20px"></i>
                            </button>
                            <div class="dropdown-menu dropdown-menu-end m-0">
                                <a href="javascript:void(0);" class="dropdown-item btn-change-status" data-id="${full.id}">
                                    Cambiar Estado
                                </a>
                                ${full.estado=='aprobado' ?`<a href="/app/cotizacion/create/${full.id}/" class="dropdown-item text-success">Crear Cotización</a>`: ''}
                                       
                                ${full.estado=='pendiente' ?`<a href="/app/requirements/edit/${full.id}/" class="dropdown-item ">Editar Requirimiento</a>`: ''}
                                <div class="dropdown-divider"></div>
                                <a href="/app/requirements/details/${full.id}/" class="dropdown-item">Ver Completo</a>
                            </div>
                        </div>`;
         

                        return actions;

                    }
                }
            ],
            order: [[9, 'desc']], // Ordenar por fecha de creación descendente
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
                searchPlaceholder: 'Buscar Requerimiento',
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
                            exportOptions: { columns: [2, 3, 4, 5, 6, 7, 8, 9] },
                            customize: function (win) {
                                $(win.document.body)
                                    .css('color', headingColor)
                                    .css('border-color', borderColor)
                                    .css('background-color', bodyBg);
                            }
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
                        },
                        {
                            extend: 'pdf',
                            text: '<i class="ri-file-pdf-line me-1"></i>PDF',
                            className: 'dropdown-item',
                            exportOptions: { columns: [2, 3, 4, 5, 6, 7, 8, 9] }
                        }
                    ]
                },
                {
                    text: '<i class="ri-add-line ri-16px me-0 me-sm-1 align-baseline"></i><span class="d-none d-sm-inline-block">Nuevo Requerimiento</span>',
                    className: 'add-new btn btn-primary waves-effect waves-light',
                    action: () => {
                        window.location.href = '/app/requirements/add/';
                    }
                }
            ],
            responsive: {
                details: {
                    display: $.fn.dataTable.Responsive.display.modal({
                        header: function (row) {
                            const data = row.data();
                            return 'Detalles de ' + data['numero_requerimiento'];
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
        window.dt_requirements = this.elements.dataTable;
    },

    /**
     * Configurar manejadores de eventos
     */
    setupEventHandlers() {
        // Ver detalles del requerimiento
        $(document).on('click', '.btn-view-requirement', (e) => {
            const id = $(e.currentTarget).data('id');
            this.showRequirementDetails(id);
        });

        // Cambiar estado
        $(document).on('click', '.btn-change-status', (e) => {
            const id = $(e.currentTarget).data('id');
            RequirementsActions.showChangeStatusModal(id);
        });

        // Aprobar requerimiento
        $(document).on('click', '.btn-approve-requirement', (e) => {
            const id = $(e.currentTarget).data('id');
            RequirementsActions.approveRequirement(id);
        });

        // Rechazar requerimiento
        $(document).on('click', '.btn-reject-requirement', (e) => {
            const id = $(e.currentTarget).data('id');
            RequirementsActions.rejectRequirement(id);
        });

        // Eliminar requerimiento
        $(document).on('click', '.btn-delete-requirement', (e) => {
            const id = $(e.currentTarget).data('id');
            RequirementsActions.deleteRequirement(id);
        });
    },

    /**
     * Mostrar detalles del requerimiento en modal
     */
async showRequirementDetails(id) {
    try {
        // 1. Obtener datos del requerimiento
        const response = await fetch(`/api/requirements/${id}/details_with_stock/`);
        if (!response.ok) throw new Error('Error al cargar detalles');
        const requirement = await response.json();

        // 2. Configurar funciones auxiliares
        const createBadge = (color, text) => {
            const badge = document.createElement('span');
            badge.className = `badge rounded-pill bg-label-${color}`;
            badge.textContent = text;
            return badge;
        };

        const formatDate = (dateString) => {
            if (!dateString) return 'N/A';
            const date = new Date(dateString);
            return date.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        // 3. Cargar el template al modal
        const modalContent = document.getElementById('requirementDetailsContent');
        modalContent.innerHTML = document.getElementById('requirement-details-template').innerHTML;

        // 4. Llenar información básica
        const fillData = (id, value, defaultValue = '') => {
            const element = document.getElementById(id);
            if (element) element.textContent = value !== undefined && value !== null ? value : defaultValue;
        };

        fillData('detail-numero', requirement.numero_requerimiento);
        fillData('detail-solicitante', requirement.usuario_solicitante_username);
        fillData('detail-fecha', formatDate(requirement.fecha_requerimiento));
        fillData('detail-creado', formatDate(requirement.created_at));
        fillData('detail-total-productos', requirement.total_productos, '0');
        fillData('detail-cantidad-total', requirement.cantidad_total, '0');
        fillData('detail-archivo', requirement.archivo_adjunto_name, 'Ninguno');
        fillData('detail-notas', requirement.notas, 'Sin detalles');

        // 5. Llenar badges de estado y prioridad
        const fillBadge = (containerId, color, text) => {
            const container = document.getElementById(containerId);
            if (container && color && text) {
                container.appendChild(createBadge(color, text));
            }
        };

        fillBadge('detail-prioridad', requirement.prioridad_color, requirement.prioridad_display);
        fillBadge('detail-estado', requirement.estado_color, requirement.estado_display);

        // 6. Manejar tabla de productos
        const productosContainer = document.getElementById('productos-container');
        if (productosContainer) {
            productosContainer.innerHTML = '';

            if (requirement.detalles && requirement.detalles.length > 0) {
                const tableHTML = `
                    <div class="table-responsive">
                        <table class="table table-bordered">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Cantidad</th>
                                    <th>Unidad Medida</th>
                                    <th>Stock Actual</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody id="productos-tbody"></tbody>
                        </table>
                    </div>
                `;
                productosContainer.innerHTML = tableHTML;

                const tbody = document.getElementById('productos-tbody');
                requirement.detalles.forEach(detalle => {
                    const row = document.createElement('tr');
                    
                    // Crear celdas
                    const cells = [
                        detalle.producto_name || '-',
                        detalle.cantidad_solicitada || '0',
                        detalle.unidad_medida || '-',
                        detalle.stock_disponible || '0',
                        createBadge(
                            detalle.tiene_stock_suficiente ? 'success' : 'danger',
                            detalle.tiene_stock_suficiente ? 'Suficiente' : 'Insuficiente'
                        )
                    ];

                    cells.forEach(cellContent => {
                        const td = document.createElement('td');
                        if (cellContent instanceof Node) {
                            td.appendChild(cellContent);
                        } else {
                            td.textContent = cellContent;
                        }
                        row.appendChild(td);
                    });

                    if (tbody) tbody.appendChild(row);
                });
            } else {
                productosContainer.innerHTML = `
                    <div class="alert alert-info">
                        No hay productos asociados a este requerimiento.
                    </div>
                `;
            }
        }

        // 7. Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById('requirementDetailsModal'));
        modal.show();

    } catch (error) {
        console.error('Error al cargar detalles:', error);
        toastr.error('Error al cargar los detalles del requerimiento');
    }
}

,



    /**
     * Obtener icono de prioridad
     */
    getPriorityIcon(priority) {
        const icons = {
            'alta': '🔴',
            'media': '🟡',
            'baja': '🟢'
        };
        return icons[priority] || '⚪';
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
function createStockBadge(tieneStock) {
    const badge = document.createElement('span');
    badge.className = `badge bg-${tieneStock ? 'success' : 'danger'}`;
    badge.textContent = tieneStock ? 'Suficiente' : 'Insuficiente';
    return badge;
}
// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    RequirementsList.init();
});

// Hacer disponible globalmente
window.RequirementsList = RequirementsList;