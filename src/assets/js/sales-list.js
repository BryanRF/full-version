/**
 * Sales List Module
 * Gestión de la lista de ventas con DataTable
 */

'use strict';

const SalesList = {
    // Configuración
    config: {
        apiEndpoint: '/api/sales/data/',
        currentUrl: '/api/sales/data/',
        csrfToken: null,
        currentSaleId: null
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
        this.elements.table = $('.datatables-sales');
        this.initializeDataTable();
        this.setupEventHandlers();
        this.setupFilters();
        this.loadAnalytics();
        console.log('Sales List initialized');
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
            console.error('Sales table not found');
            return;
        }

        this.elements.dataTable = this.elements.table.DataTable({
            ajax: {
                url: this.config.currentUrl,
                dataSrc: 'data'
            },
            columns: [
                { data: null }, // Control responsive
                { data: 'id' }, // Checkboxes
                { data: 'sale_number' }, // Número
                { data: 'customer_display_name' }, // Cliente
                { data: 'sale_date' }, // Fecha
                { data: 'total_amount' }, // Total
                { data: 'payment_method' }, // Pago
                { data: 'status' }, // Estado
                { data: 'total_items' }, // Items
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
                    // Número de venta
                    targets: 2,
                    responsivePriority: 1,
                    render: (data, type, full) => {
                        const statusIcon = this.getStatusIcon(full.status);
                        const saleTypeIcon = this.getSaleTypeIcon(full.sale_type);
                        
                        return `<div class="d-flex align-items-center">
                            <div class="avatar-wrapper me-3">
                                <div class="avatar avatar-sm">
                                    <span class="avatar-initial rounded bg-label-${full.status_color}">${statusIcon}</span>
                                </div>
                            </div>
                            <div>
                                <span class="fw-medium text-heading">${data}</span>
                                <small class="text-muted d-block">${saleTypeIcon} ${full.sale_type_display || 'Venta'}</small>
                            </div>
                        </div>`;
                    }
                },
                {
                    // Cliente
                    targets: 3,
                    render: (data, type, full) => {
                        if (!data || data === 'Cliente no especificado') {
                            return '<span class="text-muted">Sin cliente</span>';
                        }
                        
                        return `<div>
                            <span class="fw-medium">${data}</span>
                            <small class="text-muted d-block">${full.customer_document_display || '-'}</small>
                        </div>`;
                    }
                },
                {
                    // Fecha
                    targets: 4,
                    render: (data) => {
                        const date = new Date(data);
                        const today = new Date();
                        const isToday = date.toDateString() === today.toDateString();
                        
                        return `<div>
                            <span class="fw-medium">${date.toLocaleDateString()}</span>
                            <small class="text-muted d-block">
                                ${isToday ? '🔥 Hoy' : date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </small>
                        </div>`;
                    }
                },
                {
                    // Total
                    targets: 5,
                    className: 'text-end',
                    render: (data) => {
                        return `<strong class="text-success">S/.${parseFloat(data).toLocaleString('es-PE', {minimumFractionDigits: 2})}</strong>`;
                    }
                },
                {
                    // Método de pago
                    targets: 6,
                    render: (data, type, full) => {
                        const methodIcon = this.getPaymentMethodIcon(data);
                        return `<span class="badge rounded-pill bg-label-info">
                            ${methodIcon} ${full.payment_method_display}
                        </span>`;
                    }
                },
                {
                    // Estado
                    targets: 7,
                    render: (data, type, full) => {
                        return `<span class="badge rounded-pill bg-label-${full.status_color}">
                            ${full.status_display}
                        </span>`;
                    }
                },
                {
                    // Items
                    targets: 8,
                    className: 'text-center',
                    render: (data, type, full) => {
                        return `<div>
                            <span class="fw-medium">${data || 0}</span>
                            <small class="text-muted d-block">${full.total_products || 0} productos</small>
                        </div>`;
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
                            <button class="btn btn-sm btn-icon btn-text-secondary waves-effect rounded-pill me-1 btn-view-sale" 
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
            order: [[4, 'desc']], // Ordenar por fecha descendente
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
                searchPlaceholder: 'Buscar Venta',
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
                            exportOptions: { columns: [2, 3, 4, 5, 6, 7, 8] }
                        },
                        {
                            extend: 'csv',
                            text: '<i class="ri-file-text-line me-1"></i>CSV',
                            className: 'dropdown-item',
                            exportOptions: { columns: [2, 3, 4, 5, 6, 7, 8] }
                        },
                        {
                            extend: 'excel',
                            text: '<i class="ri-file-excel-line me-1"></i>Excel',
                            className: 'dropdown-item',
                            exportOptions: { columns: [2, 3, 4, 5, 6, 7, 8] }
                        }
                    ]
                }
            ],
            responsive: {
                details: {
                    display: $.fn.dataTable.Responsive.display.modal({
                        header: function (row) {
                            const data = row.data();
                            return 'Detalles de ' + data['sale_number'];
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
        window.dt_sales = this.elements.dataTable;
    },

    /**
     * Configurar filtros
     */
    setupFilters() {
        // Configurar flatpickr para fechas
        if (typeof flatpickr !== 'undefined') {
            flatpickr('#dateFromFilter', {
                dateFormat: 'Y-m-d',
                onChange: () => this.applyFilters()
            });
            
            flatpickr('#dateToFilter', {
                dateFormat: 'Y-m-d',
                onChange: () => this.applyFilters()
            });
        }

        // Event listeners para filtros
        $('#statusFilter').on('change', () => this.applyFilters());
        $('#paymentMethodFilter').on('change', () => this.applyFilters());
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
        const paymentMethod = $('#paymentMethodFilter').val();
        const dateFrom = $('#dateFromFilter').val();
        const dateTo = $('#dateToFilter').val();
        const search = $('#searchFilter').val();

        let url = this.config.apiEndpoint + '?';
        const params = [];

        if (status) params.push(`status=${status}`);
        if (paymentMethod) params.push(`payment_method=${paymentMethod}`);
        if (dateFrom) params.push(`fecha_desde=${dateFrom}`);
        if (dateTo) params.push(`fecha_hasta=${dateTo}`);
        if (search) params.push(`search=${encodeURIComponent(search)}`);

        this.config.currentUrl = url + params.join('&');
        this.elements.dataTable.ajax.url(this.config.currentUrl).load();
    },

    /**
     * Limpiar filtros
     */
    clearFilters() {
        $('#statusFilter').val('');
        $('#paymentMethodFilter').val('');
        $('#dateFromFilter').val('');
        $('#dateToFilter').val('');
        $('#searchFilter').val('');
        
        this.config.currentUrl = this.config.apiEndpoint;
        this.elements.dataTable.ajax.url(this.config.currentUrl).load();
    },

    /**
     * Configurar manejadores de eventos
     */
    setupEventHandlers() {
        // Ver detalles de la venta
        $(document).on('click', '.btn-view-sale', (e) => {
            const id = $(e.currentTarget).data('id');
            this.showSaleDetails(id);
        });

        // Confirmar venta
        $(document).on('click', '.btn-confirm-sale', (e) => {
            const id = $(e.currentTarget).data('id');
            this.confirmSale(id);
        });

        // Cancelar venta
        $(document).on('click', '.btn-cancel-sale', (e) => {
            const id = $(e.currentTarget).data('id');
            this.cancelSale(id);
        });

        // Cambiar estado
        $(document).on('click', '.btn-change-status', (e) => {
            const id = $(e.currentTarget).data('id');
            this.showChangeStatusModal(id);
        });

        // Generar recibo
        $(document).on('click', '.btn-generate-receipt', (e) => {
            const id = $(e.currentTarget).data('id');
            this.generateReceipt(id);
        });

        // Confirmar cambio de estado
        $('#confirmStatusChangeBtn').on('click', () => {
            this.confirmStatusChange();
        });
    },

    /**
     * Obtener icono de estado
     */
    getStatusIcon(status) {
        const icons = {
            'draft': '📝',
            'pending': '⏳',
            'confirmed': '✅',
            'invoiced': '🧾',
            'delivered': '🚚',
            'paid': '💰',
            'completed': '✅',
            'cancelled': '❌',
            'returned': '↩️'
        };
        return icons[status] || '📋';
    },

    /**
     * Obtener icono de tipo de venta
     */
    getSaleTypeIcon(saleType) {
        const icons = {
            'venta': '🛒',
            'cotizacion': '📋',
            'orden': '📝',
            'servicio': '🔧'
        };
        return icons[saleType] || '🛒';
    },

    /**
     * Obtener icono de método de pago
     */
    getPaymentMethodIcon(method) {
        const icons = {
            'efectivo': '💵',
            'tarjeta_credito': '💳',
            'tarjeta_debito': '💳',
            'transferencia': '🏦',
            'yape': '📱',
            'plin': '📱',
            'credito': '📄',
            'deposito': '🏦'
        };
        return icons[method] || '💰';
    },

    /**
     * Obtener botones de acción específicos
     */
    getActionButtons(sale) {
        let buttons = '';
        
        if (sale.status === 'draft' || sale.status === 'pending') {
            buttons += `<button class="btn btn-sm btn-icon btn-text-success waves-effect rounded-pill me-1 btn-confirm-sale" 
                               data-id="${sale.id}" title="Confirmar Venta">
                            <i class="ri-check-line ri-20px"></i>
                        </button>`;
        }
        
        if (sale.status !== 'cancelled' && sale.status !== 'completed') {
            buttons += `<button class="btn btn-sm btn-icon btn-text-warning waves-effect rounded-pill me-1 btn-change-status" 
                               data-id="${sale.id}" title="Cambiar Estado">
                            <i class="ri-edit-line ri-20px"></i>
                        </button>`;
        }
        
        return buttons;
    },

    /**
     * Obtener acciones del dropdown
     */
    getDropdownActions(sale) {
        let actions = '';
        
        actions += `<a href="/app/sales/details/${sale.id}/" class="dropdown-item">
                        <i class="ri-eye-line me-1"></i>Ver Completo
                    </a>`;
        
        actions += `<a href="javascript:void(0);" class="dropdown-item btn-generate-receipt" data-id="${sale.id}">
                        <i class="ri-printer-line me-1"></i>Generar Recibo
                    </a>`;
        
        if (sale.status !== 'cancelled' && sale.status !== 'completed') {
            actions += `<div class="dropdown-divider"></div>
                        <a href="javascript:void(0);" class="dropdown-item btn-cancel-sale" data-id="${sale.id}">
                            <i class="ri-close-line me-1"></i>Cancelar Venta
                        </a>`;
        }
        
        return actions;
    },

    /**
     * Cargar analíticas
     */
    async loadAnalytics() {
        try {
            const response = await fetch('/api/sales/dashboard_analytics/');
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
        this.animateCounter(document.getElementById('todaySales'), analytics.today_sales);
        this.animateCounter(document.getElementById('monthSales'), analytics.total_sales);
        this.animateCounter(document.getElementById('pendingSales'), this.getPendingSalesCount(analytics.sales_by_status));
        this.animateCounter(document.getElementById('completedSales'), this.getCompletedSalesCount(analytics.sales_by_status));
        
        // Actualizar montos
        document.getElementById('todayAmount').textContent = `S/.${parseFloat(analytics.today_amount).toLocaleString('es-PE', {minimumFractionDigits: 2})}`;
        document.getElementById('monthAmount').textContent = `S/.${parseFloat(analytics.total_amount).toLocaleString('es-PE', {minimumFractionDigits: 2})}`;
        document.getElementById('pendingAmount').textContent = `S/.${this.getPendingAmount(analytics.sales_by_status).toLocaleString('es-PE', {minimumFractionDigits: 2})}`;
        document.getElementById('completedAmount').textContent = `S/.${this.getCompletedAmount(analytics.sales_by_status).toLocaleString('es-PE', {minimumFractionDigits: 2})}`;
    },

    /**
     * Obtener cantidad de ventas pendientes
     */
    getPendingSalesCount(salesByStatus) {
        return salesByStatus.filter(item => ['draft', 'pending'].includes(item.status))
                           .reduce((sum, item) => sum + item.count, 0);
    },

    /**
     * Obtener cantidad de ventas completadas
     */
    getCompletedSalesCount(salesByStatus) {
        return salesByStatus.filter(item => ['completed', 'delivered', 'paid'].includes(item.status))
                           .reduce((sum, item) => sum + item.count, 0);
    },

    /**
     * Obtener monto de ventas pendientes
     */
    getPendingAmount(salesByStatus) {
        return salesByStatus.filter(item => ['draft', 'pending'].includes(item.status))
                           .reduce((sum, item) => sum + parseFloat(item.total || 0), 0);
    },

    /**
     * Obtener monto de ventas completadas
     */
    getCompletedAmount(salesByStatus) {
        return salesByStatus.filter(item => ['completed', 'delivered', 'paid'].includes(item.status))
                           .reduce((sum, item) => sum + parseFloat(item.total || 0), 0);
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
     * Mostrar detalles de la venta
     */
    async showSaleDetails(saleId) {
        try {
            this.showLoading(true, 'Cargando detalles...');
            
            const response = await fetch(`/api/sales/${saleId}/`);
            if (response.ok) {
                const sale = await response.json();
                this.renderSaleDetails(sale);
                
                const modal = new bootstrap.Modal(document.getElementById('saleDetailsModal'));
                modal.show();
            } else {
                toastr.error('Error al cargar detalles de la venta');
            }
        } catch (error) {
            console.error('Error loading sale details:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Renderizar detalles de la venta
     */
    renderSaleDetails(sale) {
        const content = document.getElementById('saleDetailsContent');
        
        let customerInfo = '';
        if (sale.customer_info) {
            customerInfo = `
                <div class="col-md-6">
                    <h6>Información del Cliente</h6>
                    <p class="mb-1"><strong>Nombre:</strong> ${sale.customer_info.name}</p>
                    <p class="mb-1"><strong>Documento:</strong> ${sale.customer_info.document}</p>
                    ${sale.customer_info.email ? `<p class="mb-1"><strong>Email:</strong> ${sale.customer_info.email}</p>` : ''}
                    ${sale.customer_info.phone ? `<p class="mb-1"><strong>Teléfono:</strong> ${sale.customer_info.phone}</p>` : ''}
                </div>
            `;
        }
        
        let itemsTable = '';
        if (sale.items && sale.items.length > 0) {
            itemsTable = `
                <h6 class="mt-4">Productos</h6>
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Cantidad</th>
                                <th>Precio Unit.</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sale.items.map(item => `
                                <tr>
                                    <td>${item.product_name}</td>
                                    <td>${item.quantity}</td>
                                    <td>S/.${parseFloat(item.unit_price).toFixed(2)}</td>
                                    <td>S/.${parseFloat(item.total).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        content.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6>Información de la Venta</h6>
                    <p class="mb-1"><strong>Número:</strong> ${sale.sale_number}</p>
                    <p class="mb-1"><strong>Fecha:</strong> ${new Date(sale.sale_date).toLocaleString()}</p>
                    <p class="mb-1"><strong>Estado:</strong> <span class="badge bg-label-${sale.status_color}">${sale.status_display}</span></p>
                    <p class="mb-1"><strong>Método de Pago:</strong> ${sale.payment_method_display}</p>
                    <p class="mb-1"><strong>Total:</strong> <strong class="text-success">S/.${parseFloat(sale.total_amount).toFixed(2)}</strong></p>
                </div>
                ${customerInfo}
            </div>
            
            ${itemsTable}
            
            <div class="row mt-4">
                <div class="col-md-6">
                    <h6>Totales</h6>
                    <p class="mb-1">Subtotal: S/.${parseFloat(sale.subtotal).toFixed(2)}</p>
                    <p class="mb-1">IGV: S/.${parseFloat(sale.tax_amount).toFixed(2)}</p>
                    <p class="mb-1">Descuento: S/.${parseFloat(sale.discount_amount).toFixed(2)}</p>
                    <hr>
                    <p class="mb-0"><strong>Total: S/.${parseFloat(sale.total_amount).toFixed(2)}</strong></p>
                </div>
                <div class="col-md-6">
                    ${sale.notes ? `<h6>Observaciones</h6><p>${sale.notes}</p>` : ''}
                </div>
            </div>
        `;
        
        // Actualizar botones de acción
        const actionsContainer = document.getElementById('saleActionsButtons');
        let actionButtons = '';
        
        if (sale.can_confirm) {
            actionButtons += `<button type="button" class="btn btn-success me-2" onclick="SalesList.confirmSale(${sale.id})">
                                <i class="ri-check-line me-1"></i>Confirmar
                              </button>`;
        }
        
        if (sale.can_cancel) {
            actionButtons += `<button type="button" class="btn btn-danger me-2" onclick="SalesList.cancelSale(${sale.id})">
                                <i class="ri-close-line me-1"></i>Cancelar
                              </button>`;
        }
        
        actionButtons += `<button type="button" class="btn btn-info" onclick="SalesList.generateReceipt(${sale.id})">
                            <i class="ri-printer-line me-1"></i>Imprimir
                          </button>`;
        
        actionsContainer.innerHTML = actionButtons;
    },

    /**
     * Confirmar venta
     */
    async confirmSale(saleId) {
        if (!confirm('¿Está seguro de confirmar esta venta? Se actualizará el stock de los productos.')) {
            return;
        }
        
        try {
            this.showLoading(true, 'Confirmando venta...');
            
            const response = await fetch(`/api/sales/${saleId}/confirm/`, {
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
                
                // Cerrar modal si está abierto
                const modal = bootstrap.Modal.getInstance(document.getElementById('saleDetailsModal'));
                if (modal) modal.hide();
            } else {
                const error = await response.json();
                toastr.error(error.error || 'Error al confirmar venta');
            }
        } catch (error) {
            console.error('Error confirming sale:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Cancelar venta
     */
    async cancelSale(saleId) {
        if (!confirm('¿Está seguro de cancelar esta venta? Se restaurará el stock si corresponde.')) {
            return;
        }
        
        try {
            this.showLoading(true, 'Cancelando venta...');
            
            const response = await fetch(`/api/sales/${saleId}/cancel/`, {
                method: 'PATCH',
                headers: {
                    'X-CSRFToken': this.config.csrfToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ restore_stock: true })
            });

            if (response.ok) {
                const result = await response.json();
                toastr.success(result.message);
                this.reload();
                
                // Cerrar modal si está abierto
                const modal = bootstrap.Modal.getInstance(document.getElementById('saleDetailsModal'));
                if (modal) modal.hide();
            } else {
                const error = await response.json();
                toastr.error(error.error || 'Error al cancelar venta');
            }
        } catch (error) {
            console.error('Error cancelling sale:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Mostrar modal de cambio de estado
     */
    showChangeStatusModal(saleId) {
        this.config.currentSaleId = saleId;
        const modal = new bootstrap.Modal(document.getElementById('changeStatusModal'));
        modal.show();
    },

    /**
     * Confirmar cambio de estado
     */
    async confirmStatusChange() {
        const newStatus = document.getElementById('newStatus').value;
        const notes = document.getElementById('statusNotes').value;
        
        if (!newStatus) {
            toastr.error('Seleccione un estado');
            return;
        }
        
        try {
            this.showLoading(true, 'Cambiando estado...');
            
            const response = await fetch(`/api/sales/${this.config.currentSaleId}/update_status/`, {
                method: 'PATCH',
                headers: {
                    'X-CSRFToken': this.config.csrfToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: newStatus,
                    internal_notes: notes
                })
            });

            if (response.ok) {
                const result = await response.json();
                toastr.success(result.message);
                
                // Cerrar modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('changeStatusModal'));
                modal.hide();
                
                // Limpiar formulario
                document.getElementById('changeStatusForm').reset();
                
                this.reload();
            } else {
                const error = await response.json();
                toastr.error(error.error || 'Error al cambiar estado');
            }
        } catch (error) {
            console.error('Error changing status:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Generar recibo
     */
    generateReceipt(saleId) {
        window.open(`/api/sales/${saleId}/receipt/`, '_blank');
    },

    /**
     * Mostrar loading
     */
    showLoading(show, text = 'Procesando...') {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.toggle('d-none', !show);
            if (show && text) {
                document.getElementById('loadingText').textContent = text;
            }
        }
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
    SalesList.init();
});

// Hacer disponible globalmente
window.SalesList = SalesList;