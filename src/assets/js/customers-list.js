/**
 * Customers List Module
 * Gestión de la lista de clientes con DataTable
 */

'use strict';

const CustomersList = {
    // Configuración
    config: {
        apiEndpoint: '/api/customers/data/',
        currentUrl: '/api/customers/data/',
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
        this.elements.table = $('.datatables-customers');
        this.initializeDataTable();
        this.setupEventHandlers();
        this.loadAnalytics();
        console.log('Customers List initialized');
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
            console.error('Customers table not found');
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
                { data: 'display_name' }, // Cliente
                { data: 'document_number' }, // Documento
                { data: 'contact_info' }, // Contacto
                { data: 'district' }, // Ubicación
                { data: 'total_sales' }, // Ventas
                { data: 'is_active' }, // Estado
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
                    // Cliente
                    targets: 2,
                    responsivePriority: 1,
                    render: (data, type, full) => {
                        const isFrequent = full.is_frequent;
                        const customerType = full.customer_type === 'persona_juridica' ? '🏢' : '👤';
                        
                        return `<div class="d-flex align-items-center">
                            <div class="avatar-wrapper me-3">
                                <div class="avatar avatar-sm">
                                    <span class="avatar-initial rounded bg-label-primary">${customerType}</span>
                                </div>
                            </div>
                            <div>
                                <span class="fw-medium text-heading">${data}</span>
                                ${isFrequent ? '<span class="badge bg-label-warning ms-2">⭐ Frecuente</span>' : ''}
                                <small class="text-muted d-block">${full.customer_type === 'persona_juridica' ? 'Empresa' : 'Persona'}</small>
                            </div>
                        </div>`;
                    }
                },
                {
                    // Documento
                    targets: 3,
                    render: (data, type, full) => {
                        return `<div>
                            <span class="fw-medium">${full.document_type_display}</span>
                            <br><span class="text-muted">${data}</span>
                        </div>`;
                    }
                },
                {
                    // Contacto
                    targets: 4,
                    render: (data, type, full) => {
                        if (!data) return '<span class="text-muted">Sin contacto</span>';
                        
                        const parts = data.split(' | ');
                        return `<div>
                            ${parts.map(part => `<small class="d-block">${part}</small>`).join('')}
                        </div>`;
                    }
                },
                {
                    // Ubicación
                    targets: 5,
                    render: (data, type, full) => {
                        if (!data && !full.province) return '<span class="text-muted">-</span>';
                        
                        let location = [];
                        if (data) location.push(data);
                        if (full.province && full.province !== data) location.push(full.province);
                        
                        return location.join(', ') || '-';
                    }
                },
                {
                    // Ventas
                    targets: 6,
                    className: 'text-center',
                    render: (data, type, full) => {
                        const sales = data || 0;
                        const amount = full.total_sales_amount || 0;
                        
                        return `<div>
                            <span class="fw-medium">${sales}</span>
                            <br><small class="text-success">S/.${parseFloat(amount).toFixed(2)}</small>
                        </div>`;
                    }
                },
                {
                    // Estado
                    targets: 7,
                    render: (data, type, full) => {
                        let badgeClass = 'bg-label-success';
                        let badgeText = 'Activo';
                        
                        if (!data) {
                            badgeClass = 'bg-label-secondary';
                            badgeText = 'Inactivo';
                        } else if (full.is_frequent) {
                            badgeClass = 'bg-label-warning';
                            badgeText = 'Frecuente';
                        }
                        
                        return `<span class="badge rounded-pill ${badgeClass}">${badgeText}</span>`;
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
                            <button class="btn btn-sm btn-icon btn-text-secondary waves-effect rounded-pill me-1 btn-view-customer" 
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
            order: [[2, 'asc']], // Ordenar por nombre de cliente
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
                searchPlaceholder: 'Buscar Cliente',
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
                            exportOptions: { columns: [2, 3, 4, 5, 6, 7] }
                        },
                        {
                            extend: 'csv',
                            text: '<i class="ri-file-text-line me-1"></i>CSV',
                            className: 'dropdown-item',
                            exportOptions: { columns: [2, 3, 4, 5, 6, 7] }
                        },
                        {
                            extend: 'excel',
                            text: '<i class="ri-file-excel-line me-1"></i>Excel',
                            className: 'dropdown-item',
                            exportOptions: { columns: [2, 3, 4, 5, 6, 7] }
                        }
                    ]
                }
            ],
            responsive: {
                details: {
                    display: $.fn.dataTable.Responsive.display.modal({
                        header: function (row) {
                            const data = row.data();
                            return 'Detalles de ' + data['display_name'];
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

        // Filtros adicionales
        this.setupFilters();

        // Almacenar referencia global
        window.dt_customers = this.elements.dataTable;
    },

    /**
     * Configurar filtros
     */
    setupFilters() {
        // Status filter
        const statusFilter = $('<select class="form-select"><option value="">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="frequent">Frecuentes</option></select>');
        $('.customer_status').html(statusFilter);
        
        // Customer type filter
        const typeFilter = $('<select class="form-select"><option value="">Todos los tipos</option><option value="persona_natural">Persona Natural</option><option value="persona_juridica">Persona Jurídica</option></select>');
        $('.customer_type').html(typeFilter);
        
        // Document type filter
        const docFilter = $('<select class="form-select"><option value="">Todos los documentos</option><option value="1">DNI</option><option value="6">RUC</option><option value="4">C.E.</option><option value="7">Pasaporte</option></select>');
        $('.document_type').html(docFilter);

        // Event listeners para filtros
        statusFilter.on('change', () => this.applyFilters());
        typeFilter.on('change', () => this.applyFilters());
        docFilter.on('change', () => this.applyFilters());
    },

    /**
     * Aplicar filtros
     */
    applyFilters() {
        const status = $('.customer_status select').val();
        const type = $('.customer_type select').val();
        const docType = $('.document_type select').val();
        const search = $('#customerSearch').val();

        let url = this.config.apiEndpoint + '?';
        const params = [];

        if (status) params.push(`status=${status}`);
        if (type) params.push(`customer_type=${type}`);
        if (docType) params.push(`document_type=${docType}`);
        if (search) params.push(`search=${encodeURIComponent(search)}`);

        this.config.currentUrl = url + params.join('&');
        this.elements.dataTable.ajax.url(this.config.currentUrl).load();
    },

    /**
     * Configurar manejadores de eventos
     */
    setupEventHandlers() {
        // Ver detalles del cliente
        $(document).on('click', '.btn-view-customer', (e) => {
            const id = $(e.currentTarget).data('id');
            window.location.href = `/app/customers/details/${id}/`;
        });

        // Editar cliente
       
        // Toggle estado activo
        $(document).on('click', '.btn-toggle-active', (e) => {
            const id = $(e.currentTarget).data('id');
            this.toggleActive(id);
        });

        // Toggle cliente frecuente
        $(document).on('click', '.btn-toggle-frequent', (e) => {
            const id = $(e.currentTarget).data('id');
            this.toggleFrequent(id);
        });

        

        // Buscar documento API
        $(document).on('click', '#searchApiBtn', () => {
            this.searchDocument();
        });

        // Guardar cliente
        $(document).on('click', '#saveCustomerBtn', () => {
            this.saveCustomer();
        });

        // Búsqueda en tiempo real
        let searchTimeout;
        $('#customerSearch').on('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.applyFilters();
            }, 300);
        });
    },

    /**
     * Obtener botones de acción específicos
     */
    getActionButtons(customer) {
        let buttons = '';
        
        
        
        return buttons;
    },

    /**
     * Obtener acciones del dropdown
     */
    getDropdownActions(customer) {
        let actions = '';
        
        actions += `<a href="javascript:void(0);" class="dropdown-item btn-toggle-active" data-id="${customer.id}">
                        <i class="ri-${customer.is_active ? 'close' : 'check'}-line me-1"></i>
                        ${customer.is_active ? 'Desactivar' : 'Activar'}
                    </a>`;
        
        actions += `<a href="javascript:void(0);" class="dropdown-item btn-toggle-frequent" data-id="${customer.id}">
                        <i class="ri-star-${customer.is_frequent ? 'fill' : 'line'} me-1"></i>
                        ${customer.is_frequent ? 'Quitar de Frecuentes' : 'Marcar como Frecuente'}
                    </a>`;
        
        actions += `<div class="dropdown-divider"></div>
                    <a href="/app/customers/details/${customer.id}/" class="dropdown-item">
                        <i class="ri-eye-line me-1"></i>Ver Perfil Completo
                    </a>`;
        
        if (customer.total_sales > 0) {
            actions += `<a href="javascript:void(0);" class="dropdown-item" onclick="CustomersList.viewSalesHistory(${customer.id})">
                            <i class="ri-history-line me-1"></i>Ver Historial de Ventas
                        </a>`;
        }
        
        return actions;
    },

    /**
     * Cargar analíticas
     */
    async loadAnalytics() {
        try {
            const response = await fetch('/api/customers/analytics/');
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
    this.animateCounter(document.getElementById('totalCustomers'), analytics.total_customers);
    this.animateCounter(document.getElementById('frequentCustomers'), analytics.frequent_customers);
    this.animateCounter(document.getElementById('customersWithSales'), analytics.customers_with_recent_sales || 0);
    this.animateCounter(document.getElementById('newCustomers'), analytics.new_customers_this_week);
    
    // Actualizar textos adicionales
    document.getElementById('activeCustomers').textContent = `${analytics.active_customers} activos`;
    
    // Calcular porcentajes con validación para evitar NaN
    const frequentPercentage = analytics.total_customers > 0 ? 
        Math.round((analytics.frequent_customers / analytics.total_customers) * 100) : 0;
    document.getElementById('frequentPercentage').textContent = `${frequentPercentage}%`;
    
    // CORREGIR: Usar customers_with_sales (sin recent)
    const customersWithSales = analytics.customers_with_recent_sales || 0;
    const conversionRate = analytics.total_customers > 0 ? 
        Math.round((customersWithSales / analytics.total_customers) * 100) : 0;
    document.getElementById('conversionRate').textContent = `${conversionRate}%`;
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
     * Toggle estado activo
     */
    async toggleActive(id) {
        try {
            const response = await fetch(`/api/customers/${id}/toggle_active/`, {
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
            } else {
                const error = await response.json();
                toastr.error(error.error || 'Error al cambiar estado');
            }
        } catch (error) {
            console.error('Error toggling active:', error);
            toastr.error('Error de conexión');
        }
    },

    /**
     * Toggle cliente frecuente
     */
    async toggleFrequent(id) {
        try {
            const response = await fetch(`/api/customers/${id}/toggle_frequent/`, {
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
            } else {
                const error = await response.json();
                toastr.error(error.error || 'Error al cambiar estado');
            }
        } catch (error) {
            console.error('Error toggling frequent:', error);
            toastr.error('Error de conexión');
        }
    },

    /**
     * Buscar documento en API
     */
    async searchDocument() {
        const docType = document.getElementById('apiDocType').value;
        const docNumber = document.getElementById('apiDocNumber').value.trim();

        if (!docNumber) {
            toastr.error('Ingrese un número de documento');
            return;
        }

        const searchBtn = document.getElementById('searchApiBtn');
        const originalText = searchBtn.innerHTML;
        searchBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        searchBtn.disabled = true;

        try {
            const response = await fetch(`/api/documents/search/?document=${docNumber}&type=${docType}`);
            const data = await response.json();

            if (response.ok) {
                this.showApiResults(data);
            } else {
                toastr.error(data.error || 'Error al consultar documento');
                document.getElementById('apiResults').style.display = 'none';
            }
        } catch (error) {
            console.error('Error searching document:', error);
            toastr.error('Error de conexión con la API');
        } finally {
            searchBtn.innerHTML = originalText;
            searchBtn.disabled = false;
        }
    },

    /**
     * Mostrar resultados de API
     */
    showApiResults(data) {
        const resultsDiv = document.getElementById('apiResults');
        
        if (data.existing_customer) {
            resultsDiv.innerHTML = `
                <div class="alert alert-warning">
                    <i class="ri-alert-line me-2"></i>
                    <strong>Cliente ya existe:</strong> ${data.existing_customer.display_name}
                    <br>
                    <a href="/app/customers/details/${data.existing_customer.id}/" class="btn btn-sm btn-outline-primary mt-2">
                        Ver Cliente Existente
                    </a>
                </div>
            `;
        } else {
            const info = data.document_info;
            let content = '<div class="alert alert-success"><i class="ri-check-line me-2"></i><strong>Documento encontrado</strong></div>';
            
            content += '<div class="row">';
            
            if (info.business_name) {
                content += `
                    <div class="col-md-6">
                        <label class="form-label">Razón Social</label>
                        <input type="text" class="form-control" id="apiBusinessName" value="${info.business_name}" readonly>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Nombre Comercial</label>
                        <input type="text" class="form-control" id="apiCommercialName" value="${info.commercial_name || ''}" readonly>
                    </div>
                `;
            } else {
                content += `
                    <div class="col-md-6">
                        <label class="form-label">Nombres</label>
                        <input type="text" class="form-control" id="apiFirstName" value="${info.first_name || ''}" readonly>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Apellidos</label>
                        <input type="text" class="form-control" id="apiLastName" value="${info.last_name || ''}" readonly>
                    </div>
                `;
            }
            
            if (info.address) {
                content += `
                    <div class="col-12 mt-3">
                        <label class="form-label">Dirección</label>
                        <input type="text" class="form-control" id="apiAddress" value="${info.address}" readonly>
                    </div>
                `;
            }
            
            if (info.district || info.province || info.department) {
                content += `
                    <div class="col-md-4 mt-3">
                        <label class="form-label">Distrito</label>
                        <input type="text" class="form-control" id="apiDistrict" value="${info.district || ''}" readonly>
                    </div>
                    <div class="col-md-4 mt-3">
                        <label class="form-label">Provincia</label>
                        <input type="text" class="form-control" id="apiProvince" value="${info.province || ''}" readonly>
                    </div>
                    <div class="col-md-4 mt-3">
                        <label class="form-label">Departamento</label>
                        <input type="text" class="form-control" id="apiDepartment" value="${info.department || ''}" readonly>
                    </div>
                `;
            }
            
            content += '</div>';
            resultsDiv.innerHTML = content;
        }
        
        resultsDiv.style.display = 'block';
    },

    /**
     * Guardar cliente
     */
    async saveCustomer() {
        const activeTab = document.querySelector('.nav-link.active').getAttribute('data-bs-target');
        let formData;

        if (activeTab === '#navs-api') {
            // Datos desde API
            const docType = document.getElementById('apiDocType').value;
            const docNumber = document.getElementById('apiDocNumber').value;
            
            formData = { document_number: docNumber, document_type: docType };
            
            this.showLoading(true, 'Creando cliente desde API...');
            
            try {
                const response = await fetch('/api/customers/create_from_document/', {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': this.config.csrfToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();
                
                if (response.ok) {
                    toastr.success(result.message);
                    bootstrap.Modal.getInstance(document.getElementById('addCustomerModal')).hide();
                    this.reload();
                } else {
                    toastr.error(result.error || 'Error al crear cliente');
                }
            } catch (error) {
                console.error('Error saving customer:', error);
                toastr.error('Error de conexión');
            } finally {
                this.showLoading(false);
            }
        } else {
            // Datos manuales
            const form = document.getElementById('manualCustomerForm');
            formData = new FormData(form);
            
            // Convertir FormData a objeto
            const customerData = {};
            formData.forEach((value, key) => {
                customerData[key] = value;
            });
            
            this.showLoading(true, 'Guardando cliente...');
            
            try {
                const response = await fetch('/api/customers/data/', {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': this.config.csrfToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(customerData)
                });

                const result = await response.json();
                
                if (response.ok) {
                    toastr.success('Cliente guardado exitosamente');
                    bootstrap.Modal.getInstance(document.getElementById('addCustomerModal')).hide();
                    this.reload();
                } else {
                    // Mostrar errores de validación
                    let errorMsg = 'Error al guardar cliente:\n';
                    for (const [field, errors] of Object.entries(result)) {
                        if (Array.isArray(errors)) {
                            errorMsg += `${field}: ${errors.join(', ')}\n`;
                        }
                    }
                    toastr.error(errorMsg);
                }
            } catch (error) {
                console.error('Error saving customer:', error);
                toastr.error('Error de conexión');
            } finally {
                this.showLoading(false);
            }
        }
    },

    /**
     * Ver historial de ventas
     */
    viewSalesHistory(customerId) {
        window.location.href = `/app/customers/details/${customerId}/#sales-history`;
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
    CustomersList.init();
});

// Hacer disponible globalmente
window.CustomersList = CustomersList;