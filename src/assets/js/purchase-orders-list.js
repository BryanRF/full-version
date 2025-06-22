/**
 * Purchase Orders List Module
 * Maneja la lista de órdenes de compra con funcionalidades completas
 */

'use strict';

const PurchaseOrdersList = {
    // Configuración del módulo
    config: {
        csrfToken: null,
        currentPO: null,
        refreshInterval: null,
        refreshIntervalTime: 300000, // 5 minutos
        apiUrls: {
            purchaseOrders: '/purchasing/purchase-orders/data/',
            poDetails: '/purchasing/purchase-orders/{id}/',
            poActions: '/purchasing/purchase-orders/{id}/actions/',
            receiveItems: '/purchasing/purchase-orders/{id}/receive-items/',
            analytics: '/purchasing/purchase-orders/dashboard-analytics/'
        },
        dataTable: null,
        statusConfigs: {
            'draft': { color: 'secondary', text: 'Borrador' },
            'sent': { color: 'info', text: 'Enviada' },
            'confirmed': { color: 'primary', text: 'Confirmada' },
            'partially_received': { color: 'warning', text: 'Parcial' },
            'completed': { color: 'success', text: 'Completada' },
            'cancelled': { color: 'danger', text: 'Cancelada' }
        }
    },

    // Referencias a elementos del DOM
    elements: {
        dataTable: null,
        loadingOverlay: null,
        poDetailsModal: null,
        receiveItemsModal: null,
        refreshButton: null,
        statusFilter: null,
        supplierFilter: null,
        confirmReceiveBtn: null,
        // Analytics elements
        totalOrders: null,
        totalAmount: null,
        pendingOrders: null,
        pendingAmount: null,
        inTransitOrders: null,
        inTransitAmount: null,
        completedOrders: null,
        completedAmount: null,
        // Modal content elements
        poDetailsContent: null,
        poActionsButtons: null,
        receiveItemsList: null
    },

    /**
     * Inicializar el módulo
     */
    init() {
        this.config.csrfToken = this.getCookie('csrftoken');
        this.initializeElements();
        this.initDataTable();
        this.setupEventHandlers();
        this.loadAnalytics();
        this.setupRefreshInterval();

        console.log('Purchase Orders List initialized');
    },

    /**
     * Inicializar elementos del DOM
     */
    initializeElements() {
        this.elements.dataTable = document.querySelector('.datatables-purchase-orders');
        this.elements.loadingOverlay = document.getElementById('loadingOverlay');
        this.elements.poDetailsModal = document.getElementById('poDetailsModal');
        this.elements.receiveItemsModal = document.getElementById('receiveItemsModal');
        this.elements.refreshButton = document.getElementById('refreshTable');
        this.elements.statusFilter = document.getElementById('statusFilter');
        this.elements.supplierFilter = document.getElementById('supplierFilter');
        this.elements.confirmReceiveBtn = document.getElementById('confirmReceiveBtn');

        // Analytics elements
        this.elements.totalOrders = document.getElementById('totalOrders');
        this.elements.totalAmount = document.getElementById('totalAmount');
        this.elements.pendingOrders = document.getElementById('pendingOrders');
        this.elements.pendingAmount = document.getElementById('pendingAmount');
        this.elements.inTransitOrders = document.getElementById('inTransitOrders');
        this.elements.inTransitAmount = document.getElementById('inTransitAmount');
        this.elements.completedOrders = document.getElementById('completedOrders');
        this.elements.completedAmount = document.getElementById('completedAmount');

        // Modal content elements
        this.elements.poDetailsContent = document.getElementById('poDetailsContent');
        this.elements.poActionsButtons = document.getElementById('poActionsButtons');
        this.elements.receiveItemsList = document.getElementById('receiveItemsList');
    },

    /**
     * Configurar manejadores de eventos
     */
    setupEventHandlers() {
        // Eventos de la tabla (delegados)
        document.addEventListener('click', (e) => {
            if (e.target.closest('.view-details')) {
                e.preventDefault();
                const poId = e.target.closest('.view-details').dataset.id;
                this.loadPODetails(poId);
            }

            if (e.target.closest('.receive-items')) {
                e.preventDefault();
                const poId = e.target.closest('.receive-items').dataset.id;
                this.loadReceiveItemsModal(poId);
            }

            if (e.target.closest('.change-status')) {
                e.preventDefault();
                const button = e.target.closest('.change-status');
                const poId = button.dataset.id;
                const newStatus = button.dataset.status;
                this.changeOrderStatus(poId, newStatus);
            }
        });

        // Confirmar recepción
        if (this.elements.confirmReceiveBtn) {
            this.elements.confirmReceiveBtn.addEventListener('click', () => {
                this.processItemsReception();
            });
        }

        // Refresh
        if (this.elements.refreshButton) {
            this.elements.refreshButton.addEventListener('click', () => {
                this.refreshTable();
            });
        }

        // Filtros
        if (this.elements.statusFilter) {
            this.elements.statusFilter.addEventListener('change', (e) => {
                this.applyStatusFilter(e.target.value);
            });
        }

        if (this.elements.supplierFilter) {
            this.elements.supplierFilter.addEventListener('change', (e) => {
                this.applySupplierFilter(e.target.value);
            });
        }

        // Eventos de visibilidad para refresh automático
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.config.dataTable) {
                this.refreshTable(false);
            }
        });
    },

    /**
     * Inicializar DataTable
     */
    initDataTable() {
        if (!this.elements.dataTable) {
            console.error('Elemento de tabla no encontrado');
            return;
        }

        // Destruir tabla existente si existe
        if ($.fn.DataTable.isDataTable(this.elements.dataTable)) {
            $(this.elements.dataTable).DataTable().destroy();
        }

        this.config.dataTable = $(this.elements.dataTable).DataTable({
            ajax: {
                url: this.config.apiUrls.purchaseOrders,
                type: 'GET',
                dataSrc: (response) => {
                    // Actualizar analytics si están disponibles
                    if (response.analytics) {
                        this.updateAnalytics(response.analytics);
                    }
                    return response.data || [];
                },
                error: (xhr, error, thrown) => {
                    console.error('Error loading purchase orders:', error);
                    this.showError('Error al cargar las órdenes de compra');
                }
            },
            columns: this.getTableColumns(),
            columnDefs: this.getColumnDefs(),
            order: [[5, 'desc']], // Order by order_date
            dom: this.getTableDom(),
            lengthMenu: [10, 25, 50, 100],
            pageLength: 25,
            buttons: this.getTableButtons(),
            responsive: this.getResponsiveConfig(),
            language: {
                url: '/static/vendor/libs/datatables-bs5/es.json'
            },
            processing: true,
            serverSide: false,
            stateSave: true,
            stateDuration: 60 * 60 * 24 // 24 horas
        });
    },

    /**
     * Configurar columnas de la tabla - CORREGIDO para coincidir con los datos de la API
     */
    getTableColumns() {
        return [
             {
                data: null,
                defaultContent: '',
                orderable: false,
                searchable: false
            }, // Expand button
            {
                data: null,
                defaultContent: '',
                orderable: false,
                searchable: false
            },
            { data: 'po_number' }, // Número de orden
            {
                data: 'supplier_name', // Nombre del proveedor (viene directamente en la API)
                render: (data, type, row) => this.renderSupplierColumn(data, type, row)
            },
            {
                data: 'status',
                render: (data, type, row) => this.renderStatusColumn(data, type, row)
            },
            {
                data: 'order_date',
                render: (data, type, row) => this.renderDateColumn(data, type, row)
            },
            {
                data: 'expected_delivery',
                render: (data, type, row) => this.renderDeliveryColumn(data, type, row)
            },
            {
                data: 'total_amount',
                render: (data, type, row) => this.renderAmountColumn(data, type, row)
            },
            {
                data: 'total_items', // Total de items
                render: (data, type, row) => this.renderItemsColumn(data, type, row)
            },
            {
                data: null,
                orderable: false,
                searchable: false,
                render: (data, type, row) => this.renderActionsColumn(data, type, row)
            }
        ];
    },

    /**
     * Configurar definiciones de columnas
     */
    getColumnDefs() {
        return [
            {
                className: 'control',
                orderable: false,
                targets: 0
            },
            {
                targets: 1,
                orderable: false,
                checkboxes: {
                    selectRow: true
                },
                render: function () {
                    return '<input type="checkbox" class="dt-checkboxes form-check-input">';
                }
            }
        ];
    },

    /**
     * Configurar DOM de la tabla
     */
    getTableDom() {
        return '<"card-header d-flex border-top rounded-0 flex-wrap py-md-0"<"me-5 ms-n2 pe-5"f><"d-flex justify-content-start justify-content-md-end align-items-baseline"<"dt-action-buttons d-flex align-items-start align-items-md-center justify-content-sm-center mb-3 mb-sm-0 gap-3"lB>>>t<"row mx-2"<"col-sm-12 col-md-6"i><"col-sm-12 col-md-6"p>>';
    },

    /**
     * Configurar botones de la tabla
     */
    getTableButtons() {
        return [
            {
                extend: 'collection',
                className: 'btn btn-outline-secondary dropdown-toggle me-3 waves-effect waves-light',
                text: '<i class="ri-download-line me-1"></i>Exportar',
                buttons: [
                    {
                        extend: 'excel',
                        text: '<i class="ri-file-excel-line me-2"></i>Excel',
                        className: 'dropdown-item',
                        exportOptions: { columns: [2, 3, 4, 5, 6, 7, 8] }
                    },
                    {
                        extend: 'pdf',
                        text: '<i class="ri-file-pdf-line me-2"></i>PDF',
                        className: 'dropdown-item',
                        exportOptions: { columns: [2, 3, 4, 5, 6, 7, 8] }
                    }
                ]
            },
            {
                text: '<i class="ri-add-line me-1"></i>Nueva Orden',
                className: 'btn btn-primary waves-effect waves-light',
                action: () => {
                    window.location.href = '/app/purchase-orders/create/';
                }
            }
        ];
    },

    /**
     * Configurar responsive
     */
    getResponsiveConfig() {
        return {
            details: {
                display: $.fn.dataTable.Responsive.display.modal({
                    header: (row) => `Detalles de la Orden ${row.data().po_number}`
                }),
                type: 'column',
                renderer: (api, rowIdx, columns) => {
                    const data = $.map(columns, (col, i) => {
                        return col.hidden ?
                            `<tr data-dt-row="${col.rowIndex}" data-dt-column="${col.columnIndex}">
                                <td>${col.title}:</td>
                                <td>${col.data}</td>
                            </tr>` : '';
                    }).join('');

                    return data ? $('<table class="table"/><tbody />').append(data) : false;
                }
            }
        };
    },

    /**
     * Renderizar columna de proveedor - SIMPLIFICADO
     */
    renderSupplierColumn(data, type, row) {
        if (!data) return '-';

        return `
            <div class="d-flex align-items-center">
                <div class="avatar avatar-sm me-3">
                    <span class="avatar-initial rounded-circle bg-label-primary">
                        ${data.charAt(0).toUpperCase()}
                    </span>
                </div>
                <div>
                    <h6 class="mb-0">${data}</h6>
                    <small class="text-muted">${row.created_by_name || ''}</small>
                </div>
            </div>
        `;
    },

    /**
     * Renderizar columna de estado
     */
    renderStatusColumn(data, type, row) {
        const statusConfig = this.getStatusConfig(data);
        return `<span class="badge bg-label-${statusConfig.color}">${statusConfig.text}</span>`;
    },

    /**
     * Renderizar columna de fecha
     */
    renderDateColumn(data, type, row) {
        return data ? moment(data).format('DD/MM/YYYY') : '-';
    },

    /**
     * Renderizar columna de entrega
     */
    renderDeliveryColumn(data, type, row) {
        if (!data) return '-';

        const deliveryDate = moment(data);
        const today = moment();
        const daysUntil = deliveryDate.diff(today, 'days');

        let badgeClass = 'bg-label-success';
        if (daysUntil < 0) badgeClass = 'bg-label-danger';
        else if (daysUntil <= 3) badgeClass = 'bg-label-warning';

        return `
            <div>
                ${deliveryDate.format('DD/MM/YYYY')}
                <span class="badge ${badgeClass} ms-1">${daysUntil}d</span>
            </div>
        `;
    },

    /**
     * Renderizar columna de monto
     */
    renderAmountColumn(data, type, row) {
        return data ?
            `S/.${parseFloat(data).toLocaleString('es-PE', {minimumFractionDigits: 2})}` :
            'S/.0.00';
    },

    /**
     * Renderizar columna de items - SIMPLIFICADO
     */
    renderItemsColumn(data, type, row) {
        const total = data || 0;
        return `
            <div class="text-center">
                <span class="badge bg-label-info">${total} items</span>
            </div>
        `;
    },

    /**
     * Renderizar columna de acciones
     */
    renderActionsColumn(data, type, row) {
        return `
            <div class="d-flex align-items-center gap-2">
                <button class="btn btn-sm btn-outline-info view-details"
                        data-id="${row.id}" title="Ver Detalles">
                    <i class="ri-eye-line"></i>
                </button>
                <div class="dropdown">
                    <button class="btn btn-sm btn-outline-secondary dropdown-toggle"
                            data-bs-toggle="dropdown">
                        <i class="ri-more-2-line"></i>
                    </button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item view-details" href="#" data-id="${row.id}">
                            <i class="ri-eye-line me-2"></i>Ver Detalles</a></li>
                        <li><a class="dropdown-item" href="/app/purchase-orders/detail/${row.id}/">
                            <i class="ri-external-link-line me-2"></i>Abrir</a></li>
                        ${this.getActionItems(row)}
                    </ul>
                </div>
            </div>
        `;
    },

    /**
     * Obtener items de acción específicos por estado
     */
    getActionItems(row) {
        let items = '';

        if (row.status === 'confirmed' || row.status === 'partially_received') {
            items += `<li><a class="dropdown-item receive-items" href="#" data-id="${row.id}">
                <i class="ri-truck-line me-2"></i>Recibir Items</a></li>`;
        }

        if (row.status === 'draft') {
            items += `<li><a class="dropdown-item change-status" href="#" data-id="${row.id}" data-status="sent">
                <i class="ri-send-plane-line me-2"></i>Enviar</a></li>`;
        }

        if (row.status === 'sent') {
            items += `<li><a class="dropdown-item change-status" href="#" data-id="${row.id}" data-status="confirmed">
                <i class="ri-check-line me-2"></i>Confirmar</a></li>`;
        }

        if (['draft', 'sent'].includes(row.status)) {
            items += `<li><hr class="dropdown-divider"></li>
                     <li><a class="dropdown-item text-danger change-status" href="#" data-id="${row.id}" data-status="cancelled">
                <i class="ri-close-line me-2"></i>Cancelar</a></li>`;
        }

        return items;
    },

    /**
     * Cargar analytics del dashboard
     */
    async loadAnalytics() {
        try {
            const response = await fetch(this.config.apiUrls.analytics);
            if (response.ok) {
                const data = await response.json();
                this.updateAnalytics(data);
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    },

    /**
     * Actualizar analytics en el dashboard
     */
    updateAnalytics(analytics) {
        if (!analytics) return;

        const updates = [
            { element: this.elements.totalOrders, value: analytics.total_orders || 0 },
            { element: this.elements.totalAmount, value: analytics.total_amount ? `S/.${parseFloat(analytics.total_amount).toLocaleString('es-PE')}` : 'S/.0' },
            { element: this.elements.pendingOrders, value: analytics.pending_orders || 0 },
            { element: this.elements.pendingAmount, value: analytics.pending_amount ? `S/.${parseFloat(analytics.pending_amount).toLocaleString('es-PE')}` : 'S/.0' },
            { element: this.elements.inTransitOrders, value: analytics.in_transit_orders || 0 },
            { element: this.elements.inTransitAmount, value: analytics.in_transit_amount ? `S/.${parseFloat(analytics.in_transit_amount).toLocaleString('es-PE')}` : 'S/.0' },
            { element: this.elements.completedOrders, value: analytics.completed_orders || 0 },
            { element: this.elements.completedAmount, value: analytics.completed_amount ? `S/.${parseFloat(analytics.completed_amount).toLocaleString('es-PE')}` : 'S/.0' }
        ];

        updates.forEach(({ element, value }) => {
            if (element) element.textContent = value;
        });
    },

    /**
     * Cargar detalles de orden de compra
     */
    async loadPODetails(poId) {
        this.showLoading('Cargando detalles...');

        try {
            const response = await fetch(this.config.apiUrls.poDetails.replace('{id}', poId));

            if (response.ok) {
                const data = await response.json();
                this.renderPODetails(data);
                this.showModal(this.elements.poDetailsModal);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading PO details:', error);
            this.showError('Error al cargar los detalles de la orden');
        } finally {
            this.hideLoading();
        }
    },

    /**
     * Renderizar detalles de la orden
     */
    renderPODetails(po) {
        this.config.currentPO = po;
        const statusConfig = this.getStatusConfig(po.status);

        const html = `
            <div class="row">
                <div class="col-md-6">
                    <h6 class="fw-bold mb-3">Información General</h6>
                    <table class="table table-borderless">
                        <tr><td><strong>Número:</strong></td><td>${po.po_number}</td></tr>
                        <tr><td><strong>Proveedor:</strong></td><td>${po.supplier_name || '-'}</td></tr>
                        <tr><td><strong>Estado:</strong></td><td><span class="badge bg-label-${statusConfig.color}">${statusConfig.text}</span></td></tr>
                        <tr><td><strong>Fecha Orden:</strong></td><td>${moment(po.order_date).format('DD/MM/YYYY')}</td></tr>
                        <tr><td><strong>Entrega Esperada:</strong></td><td>${moment(po.expected_delivery).format('DD/MM/YYYY')}</td></tr>
                        <tr><td><strong>Total:</strong></td><td><strong>S/.${parseFloat(po.total_amount).toLocaleString('es-PE', {minimumFractionDigits: 2})}</strong></td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6 class="fw-bold mb-3">Información Adicional</h6>
                    <table class="table table-borderless">
                        <tr><td><strong>Creado por:</strong></td><td>${po.created_by_name || '-'}</td></tr>
                        <tr><td><strong>Fecha Creación:</strong></td><td>${moment(po.created_at).format('DD/MM/YYYY HH:mm')}</td></tr>
                        <tr><td><strong>Total Items:</strong></td><td>${po.total_items || 0}</td></tr>
                    </table>
                </div>
            </div>
        `;

        if (this.elements.poDetailsContent) {
            this.elements.poDetailsContent.innerHTML = html;
        }

        // Configurar botones de acción
        const actionButtons = this.getActionButtons(po);
        if (this.elements.poActionsButtons) {
            this.elements.poActionsButtons.innerHTML = actionButtons;
        }
    },

    /**
     * Obtener botones de acción para la orden
     */
    getActionButtons(po) {
        let buttons = '';

        if (po.status === 'confirmed' || po.status === 'partially_received') {
            buttons += `<button type="button" class="btn btn-warning receive-items me-2" data-id="${po.id}">
                <i class="ri-truck-line me-1"></i>Recibir Items</button>`;
        }

        buttons += `<a href="/app/purchase-orders/detail/${po.id}/" class="btn btn-primary">
            <i class="ri-external-link-line me-1"></i>Ver Completo</a>`;

        return buttons;
    },

    /**
     * Cargar modal de recepción de items
     */
    async loadReceiveItemsModal(poId) {
        this.showLoading('Cargando items...');

        try {
            const response = await fetch(this.config.apiUrls.poDetails.replace('{id}', poId));

            if (response.ok) {
                const data = await response.json();
                this.renderReceiveItemsForm(data);
                this.showModal(this.elements.receiveItemsModal);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading items:', error);
            this.showError('Error al cargar los items');
        } finally {
            this.hideLoading();
        }
    },

    /**
     * Renderizar formulario de recepción de items
     */
    renderReceiveItemsForm(po) {
        this.config.currentPO = po;

        // Por ahora mostramos un mensaje básico ya que no tenemos los items detallados en la API actual
        const html = `
            <div class="alert alert-info">
                <i class="ri-information-line me-2"></i>
                <strong>Orden:</strong> ${po.po_number}<br>
                <strong>Proveedor:</strong> ${po.supplier_name}<br>
                <strong>Total Items:</strong> ${po.total_items}
            </div>
            <p class="text-center text-muted">
                Función de recepción de items en desarrollo.<br>
                Los detalles específicos de items requieren la implementación completa del endpoint.
            </p>
        `;

        if (this.elements.receiveItemsList) {
            this.elements.receiveItemsList.innerHTML = html;
        }
    },

    /**
     * Procesar recepción de items
     */
    async processItemsReception() {
        this.showInfo('Función en desarrollo');
    },

    /**
     * Cambiar estado de orden
     */
    async changeOrderStatus(poId, newStatus) {
        const statusNames = {
            'draft': 'Borrador',
            'sent': 'Enviada',
            'confirmed': 'Confirmada',
            'partially_received': 'Parcialmente Recibida',
            'completed': 'Completada',
            'cancelled': 'Cancelada'
        };

        const result = await this.showConfirmation(
            '¿Confirmar cambio de estado?',
            `La orden cambiará a estado: ${statusNames[newStatus]}`,
            'Sí, cambiar'
        );

        if (!result.isConfirmed) return;

        this.showLoading('Cambiando estado...');

        try {
            const response = await fetch(this.config.apiUrls.poActions.replace('{id}', poId), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.config.csrfToken
                },
                body: JSON.stringify({
                    action: 'change_status',
                    new_status: newStatus
                })
            });

            if (response.ok) {
                this.showSuccess('Estado cambiado correctamente');
                this.refreshTable();
                this.loadAnalytics();
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Error changing status:', error);
            this.showError('Error al cambiar el estado');
        } finally {
            this.hideLoading();
        }
    },

    /**
     * Aplicar filtro de estado
     */
    applyStatusFilter(status) {
        if (this.config.dataTable) {
            this.config.dataTable.column(4).search(status).draw();
        }
    },

    /**
     * Aplicar filtro de proveedor
     */
    applySupplierFilter(supplier) {
        if (this.config.dataTable) {
            this.config.dataTable.column(3).search(supplier).draw();
        }
    },

    /**
     * Refrescar tabla
     */
    refreshTable(showMessage = true) {
        if (this.config.dataTable) {
            this.config.dataTable.ajax.reload(null, false);
            if (showMessage) {
                this.showInfo('Datos actualizados');
            }
        }
        this.loadAnalytics();
    },

    /**
     * Configurar intervalo de actualización automática
     */
    setupRefreshInterval() {
        // Limpiar intervalo existente
        if (this.config.refreshInterval) {
            clearInterval(this.config.refreshInterval);
        }

        // Configurar nuevo intervalo
        this.config.refreshInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                this.refreshTable(false);
            }
        }, this.config.refreshIntervalTime);
    },

    /**
     * Obtener configuración de estado
     */
    getStatusConfig(status) {
        return this.config.statusConfigs[status] || { color: 'secondary', text: status };
    },

    // ========== UTILIDADES ==========

    /**
     * Mostrar loading overlay
     */
    showLoading(text = 'Cargando...') {
        if (this.elements.loadingOverlay) {
            const loadingText = this.elements.loadingOverlay.querySelector('#loadingText');
            if (loadingText) loadingText.textContent = text;
            this.elements.loadingOverlay.classList.remove('d-none');
        }
    },

    /**
     * Ocultar loading overlay
     */
    hideLoading() {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.add('d-none');
        }
    },

    /**
     * Mostrar modal
     */
    showModal(modalElement) {
        if (modalElement && bootstrap?.Modal) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    },

    /**
     * Ocultar modal
     */
    hideModal(modalElement) {
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
        }
    },

    /**
     * Mostrar mensaje de éxito
     */
    showSuccess(message) {
        if (typeof toastr !== 'undefined') {
            toastr.success(message);
        } else {
            console.log('✅ SUCCESS:', message);
        }
    },

    /**
     * Mostrar mensaje de error
     */
    showError(message) {
        if (typeof toastr !== 'undefined') {
            toastr.error(message);
        } else {
            console.error('❌ ERROR:', message);
        }
    },

    /**
     * Mostrar mensaje de advertencia
     */
    showWarning(message) {
        if (typeof toastr !== 'undefined') {
            toastr.warning(message);
        } else {
            console.warn('⚠️ WARNING:', message);
        }
    },

    /**
     * Mostrar mensaje de información
     */
    showInfo(message) {
        if (typeof toastr !== 'undefined') {
            toastr.info(message);
        } else {
            console.info('ℹ️ INFO:', message);
        }
    },

    /**
     * Mostrar confirmación con SweetAlert
     */
    async showConfirmation(title, text, confirmButtonText = 'Confirmar') {
        if (typeof Swal !== 'undefined') {
            return await Swal.fire({
                title,
                text,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText,
                cancelButtonText: 'Cancelar',
                customClass: {
                    confirmButton: 'btn btn-primary',
                    cancelButton: 'btn btn-secondary'
                },
                buttonsStyling: false
            });
        } else {
            return { isConfirmed: confirm(`${title}\n${text}`) };
        }
    },

    /**
     * Obtener cookie CSRF
     */
    getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    },

    /**
     * Limpiar recursos al destruir
     */
    destroy() {
        // Limpiar intervalo
        if (this.config.refreshInterval) {
            clearInterval(this.config.refreshInterval);
            this.config.refreshInterval = null;
        }

        // Destruir DataTable
        if (this.config.dataTable) {
            this.config.dataTable.destroy();
            this.config.dataTable = null;
        }

        // Limpiar referencias
        this.config.currentPO = null;

        console.log('Purchase Orders List destroyed');
    }
};

// ========== INICIALIZACIÓN ==========

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    PurchaseOrdersList.init();
});

// Limpiar recursos al salir de la página
window.addEventListener('beforeunload', () => {
    PurchaseOrdersList.destroy();
});

// Exponer módulo globalmente para debugging
window.PurchaseOrdersList = PurchaseOrdersList;
