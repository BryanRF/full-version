/**
 * Requirements Details Module
 * Gestión completa de detalles de requerimientos
 */

'use strict';

const RequirementDetails = {
    // Configuración
    config: {
        requirementId: null,
        canEdit: false,
        currentStatus: 'pendiente',
        csrfToken: null,
        currentProductId: null
    },

    // Referencias a elementos
    elements: {
        dataTable: null,
        editModal: null,
        addModal: null,
        statusModal: null
    },

    /**
     * Inicializar el módulo
     */
    init() {
        this.loadInitialData();
        this.config.csrfToken = this.getCookie('csrftoken');
        this.initializeDataTable();
        this.setupEventHandlers();
        this.loadRequirementDetails();
        console.log('Requirement Details initialized');
    },

    /**
     * Cargar datos iniciales desde el script JSON
     */
    loadInitialData() {
        const dataScript = document.getElementById('requirementData');
        if (dataScript) {
            const data = JSON.parse(dataScript.textContent);
            this.config.requirementId = data.requirementId;
            this.config.canEdit = data.canEdit;
            this.config.currentStatus = data.currentStatus;
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
     * Inicializar DataTable de productos
     */
    initializeDataTable() {
        const table = $('.datatables-products');
        
        this.elements.dataTable = table.DataTable({
            ajax: {
                url: `/api/requirements/${this.config.requirementId}/details_with_stock/`,
                dataSrc: 'detalles'
            },
            columns: [
                { data: null }, // Responsive control
                { data: 'producto' }, // Producto
                { data: 'producto_category_name' }, // Categoría
                { data: 'cantidad_solicitada' }, // Cantidad
                { data: 'unidad_medida' }, // Unidad
                { data: 'stock_disponible' }, // Stock
                { data: 'stock_status' }, // Estado Stock
                { data: 'producto_price' }, // Precio
                { data: 'observaciones' }, // Observaciones
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
                    // Producto
                    targets: 1,
                    render: (data, type, full) => {
                        const product = full.producto_name || 'Producto no encontrado';
                        const code = full.producto_code || '-';
                        const image = full.producto_image;
                        
                        return `<div class="d-flex align-items-center">
                            <div class="avatar-wrapper me-3">
                                <div class="avatar avatar-sm">
                                    ${image ? 
                                        `<img src="${image}" alt="${product}" class="rounded">` :
                                        `<span class="avatar-initial rounded bg-label-secondary">${product.charAt(0)}</span>`
                                    }
                                </div>
                            </div>
                            <div>
                                <h6 class="mb-0">${product}</h6>
                                <small class="text-muted">Código: ${code}</small>
                            </div>
                        </div>`;
                    }
                },
                {
                    // Categoría
                    targets: 2,
                    render: (data) => {
                        return data ? `<span class="badge bg-label-info">${data}</span>` : '-';
                    }
                },
                {
                    // Cantidad solicitada
                    targets: 3,
                    className: 'text-center',
                    render: (data, type, full) => {
                        return `<span class="fw-medium">${data}</span>`;
                    }
                },
                {
                    // Unidad
                    targets: 4,
                    className: 'text-center',
                    render: (data) => {
                        return `<span class="badge bg-label-secondary">${data}</span>`;
                    }
                },
                {
                    // Stock disponible
                    targets: 5,
                    className: 'text-center',
                    render: (data, type, full) => {
                        const sufficient = full.tiene_stock_suficiente;
                        const colorClass = sufficient ? 'success' : (data > 0 ? 'warning' : 'danger');
                        
                        return `<span class="badge bg-label-${colorClass}">${data}</span>`;
                    }
                },
                {
                    // Estado del stock
                    targets: 6,
                    className: 'text-center',
                    render: (data, type, full) => {
                        const sufficient = full.tiene_stock_suficiente;
                        const stockStatus = data || 'unknown';
                        
                        let statusInfo = {
                            'in_stock': { text: 'En Stock', color: 'success', icon: '✅' },
                            'low_stock': { text: 'Stock Bajo', color: 'warning', icon: '⚠️' },
                            'out_of_stock': { text: 'Sin Stock', color: 'danger', icon: '❌' },
                            'overstock': { text: 'Sobrestock', color: 'info', icon: '📦' }
                        };
                        
                        if (sufficient) {
                            statusInfo = statusInfo['in_stock'];
                        } else if (full.stock_disponible === 0) {
                            statusInfo = statusInfo['out_of_stock'];
                        } else {
                            statusInfo = statusInfo['low_stock'];
                        }
                        
                        return `<span class="badge bg-label-${statusInfo.color}">
                            ${statusInfo.icon} ${statusInfo.text}
                        </span>`;
                    }
                },
                {
                    // Precio estimado
                    targets: 7,
                    className: 'text-end',
                    render: (data, type, full) => {
                        if (data && data > 0) {
                            const total = parseFloat(data) * parseInt(full.cantidad_solicitada);
                            return `<div>
                                <span class="fw-medium">S/.${parseFloat(data).toFixed(2)}</span>
                                <small class="text-muted d-block">Total: S/.${total.toFixed(2)}</small>
                            </div>`;
                        }
                        return '<span class="text-muted">-</span>';
                    }
                },
                {
                    // Observaciones
                    targets: 8,
                    render: (data) => {
                        if (data && data.trim()) {
                            return data.length > 50 ? 
                                `<span title="${data}">${data.substring(0, 50)}...</span>` : 
                                data;
                        }
                        return '<span class="text-muted">-</span>';
                    }
                },
                {
                    // Acciones
                    targets: -1,
                    searchable: false,
                    orderable: false,
                    render: (data, type, full) => {
                        let actions = '';
                        
                        if (this.config.canEdit) {
                            actions += `<button class="btn btn-sm btn-icon btn-text-secondary waves-effect rounded-pill me-1 btn-edit-product" 
                                               data-id="${full.id}" title="Editar">
                                            <i class="ri-edit-line ri-20px"></i>
                                        </button>`;
                            
                            actions += `<button class="btn btn-sm btn-icon btn-text-danger waves-effect rounded-pill btn-remove-product" 
                                               data-id="${full.id}" title="Eliminar">
                                            <i class="ri-delete-bin-line ri-20px"></i>
                                        </button>`;
                        }
                        
                        actions += `<button class="btn btn-sm btn-icon btn-text-info waves-effect rounded-pill btn-view-product" 
                                           data-id="${full.producto}" title="Ver Producto">
                                        <i class="ri-eye-line ri-20px"></i>
                                    </button>`;
                        
                        return `<div class="d-flex align-items-center">${actions}</div>`;//.bind(this);
                    },
                }
            ],
            order: [[1, 'asc']], // Ordenar por producto
            dom: '<"card-header d-flex rounded-0 flex-wrap pb-md-0 pt-0"' +
                 '<"me-5 ms-n2"f>' +
                 '<"d-flex justify-content-start justify-content-md-end align-items-baseline"<"dt-action-buttons d-flex align-items-start align-items-md-center justify-content-sm-center mb-0 gap-4"lB>>' +
                 '>t' +
                 '<"row mx-1"' +
                 '<"col-sm-12 col-md-6"i>' +
                 '<"col-sm-12 col-md-6"p>' +
                 '>',
            language: {
                sLengthMenu: '_MENU_',
                search: '',
                searchPlaceholder: 'Buscar productos...',
                paginate: {
                    next: '<i class="ri-arrow-right-s-line"></i>',
                    previous: '<i class="ri-arrow-left-s-line"></i>'
                },
                emptyTable: 'No hay productos en este requerimiento',
                info: 'Mostrando _START_ a _END_ de _TOTAL_ productos',
                infoEmpty: 'Mostrando 0 a 0 de 0 productos'
            },
            responsive: {
                details: {
                    display: $.fn.dataTable.Responsive.display.modal({
                        header: function (row) {
                            const data = row.data();
                            return 'Detalles de ' + data['producto_name'];
                        }
                    }),
                    type: 'column'
                }
            }
        });

        // Vincular eventos después de inicializar la tabla
        this.bindTableEvents();
    },

    /**
     * Vincular eventos de la tabla
     */
    bindTableEvents() {
        $(document).on('click', '.btn-edit-product', (e) => {
            const detailId = $(e.currentTarget).data('id');
            this.editProduct(detailId);
        });

        $(document).on('click', '.btn-remove-product', (e) => {
            const detailId = $(e.currentTarget).data('id');
            this.removeProduct(detailId);
        });

        $(document).on('click', '.btn-view-product', (e) => {
            const productId = $(e.currentTarget).data('id');
            this.viewProduct(productId);
        });
    },

    /**
     * Configurar manejadores de eventos
     */
    setupEventHandlers() {
        // Inicializar modales
        this.elements.editModal = new bootstrap.Modal(document.getElementById('editProductModal'));
        this.elements.addModal = new bootstrap.Modal(document.getElementById('addProductModal'));
        this.elements.statusModal = new bootstrap.Modal(document.getElementById('changeStatusModal'));

        // Select2 para agregar productos
        $('#productSelect').select2({
            placeholder: 'Buscar producto...',
            ajax: {
                url: '/api/products/data/',
                dataType: 'json',
                delay: 250,
                data: function (params) {
                    return {
                        search: params.term,
                        status: '1' // Solo productos activos
                    };
                },
                processResults: function (data) {
                    return {
                        results: data.data.map(item => ({
                            id: item.id,
                            text: `${item.name} (${item.code})`,
                            data: item
                        }))
                    };
                }
            },
            minimumInputLength: 2
        });

        // Eventos de productos
        $('#productSelect').on('select2:select', (e) => {
            this.onProductSelected(e.params.data.data);
        });

        // Eventos de cambio de estado
        $('#newStatus').on('change', () => {
            this.onStatusChange();
        });
    },

    /**
     * Cargar detalles del requerimiento
     */
    async loadRequirementDetails() {
        try {
            this.showLoading(true, 'Cargando detalles...');
            
            const response = await fetch(`/api/requirements/${this.config.requirementId}/details_with_stock/`);
            if (response.ok) {
                const requirement = await response.json();
                this.updateRequirementInfo(requirement);
                this.updateStockAnalysis(requirement);
                this.updateActionButtons(requirement);
                
                // Mostrar sección de cotizaciones si corresponde
                if (['aprobado', 'en_proceso_cotizacion', 'cotizado'].includes(requirement.estado)) {
                    this.loadQuotations();
                }
            } else {
                toastr.error('Error al cargar detalles del requerimiento');
            }
        } catch (error) {
            console.error('Error loading requirement details:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Actualizar información del requerimiento
     */
    updateRequirementInfo(requirement) {
        document.getElementById('requirementNumber').textContent = requirement.numero_requerimiento;
        document.getElementById('requirementDate').textContent = new Date(requirement.fecha_requerimiento).toLocaleDateString();
        
        // Status badge
        const statusBadge = document.getElementById('statusBadge');
        statusBadge.textContent = requirement.estado_display;
        statusBadge.className = `badge bg-label-${requirement.estado_color} rounded-pill`;
        
        // Priority badge
        const priorityBadge = document.getElementById('priorityBadge');
        priorityBadge.textContent = requirement.prioridad_display;
        priorityBadge.className = `badge bg-label-${requirement.prioridad_color} rounded-pill ms-2`;
        
        // User info
        document.getElementById('userName').textContent = requirement.usuario_solicitante_full_name;
        document.getElementById('userEmail').textContent = requirement.usuario_solicitante_email || requirement.usuario_solicitante_name;
        
        // Stats
        document.getElementById('totalProducts').textContent = requirement.total_productos;
        document.getElementById('totalQuantity').textContent = requirement.cantidad_total;
        
        // Notes
        if (requirement.notas) {
            document.getElementById('requirementNotes').textContent = requirement.notas;
            document.getElementById('notesSection').style.display = 'block';
        }
        
        // Update configuration
        this.config.canEdit = requirement.can_edit;
        this.config.currentStatus = requirement.estado;
    },

    /**
     * Actualizar análisis de stock
     */
    updateStockAnalysis(requirement) {
        const stockAvailable = requirement.productos_con_stock_suficiente || 0;
        const stockInsufficient = requirement.productos_sin_stock_suficiente || 0;
        const stockUnavailable = 0; // Calcular desde los detalles si es necesario
        const coverage = requirement.porcentaje_stock_disponible || 0;
        
        this.animateCounter(document.getElementById('stockAvailable'), stockAvailable);
        this.animateCounter(document.getElementById('stockInsufficient'), stockInsufficient);
        this.animateCounter(document.getElementById('stockUnavailable'), stockUnavailable);
        
        document.getElementById('stockCoverage').textContent = `${coverage}%`;
    },

    /**
     * Actualizar botones de acción
     */
    updateActionButtons(requirement) {
        const container = document.getElementById('actionButtons');
        let buttons = '';
        
        if (requirement.can_edit) {
            document.getElementById('addProductBtn').style.display = 'inline-block';
            
            buttons += `<button class="btn btn-outline-primary" onclick="RequirementDetails.editRequirement()">
                            <i class="ri-edit-line me-1"></i>Editar Requerimiento
                        </button>`;
        }
        
        if (requirement.can_approve) {
            buttons += `<button class="btn btn-success" onclick="RequirementDetails.approveRequirement()">
                            <i class="ri-check-line me-1"></i>Aprobar
                        </button>`;
        }
        
        if (requirement.can_reject) {
            buttons += `<button class="btn btn-outline-danger" onclick="RequirementDetails.rejectRequirement()">
                            <i class="ri-close-line me-1"></i>Rechazar
                        </button>`;
        }
        
        if (requirement.estado === 'aprobado') {
            buttons += `<button class="btn btn-info" onclick="RequirementDetails.createQuotation()">
                            <i class="ri-file-list-line me-1"></i>Crear Cotización
                        </button>`;
        }
        
        buttons += `<button class="btn btn-outline-secondary" onclick="RequirementDetails.showChangeStatusModal()">
                        <i class="ri-settings-line me-1"></i>Cambiar Estado
                    </button>`;
        
        container.innerHTML = buttons;
    },

    /**
     * Animar contador
     */
    animateCounter(element, target, duration = 800) {
        if (!element) return;

        const startTime = performance.now();
        const startValue = 0;

        const updateCount = currentTime => {
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / duration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3);
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
     * Editar producto
     */
    async editProduct(detailId) {
        try {
            const response = await fetch(`/api/requirement-details/${detailId}/`);
            if (response.ok) {
                const detail = await response.json();
                this.populateEditForm(detail);
                this.config.currentProductId = detailId;
                this.elements.editModal.show();
            } else {
                toastr.error('Error al cargar detalles del producto');
            }
        } catch (error) {
            console.error('Error loading product detail:', error);
            toastr.error('Error de conexión');
        }
    },

    /**
     * Poblar formulario de edición
     */
    populateEditForm(detail) {
        document.getElementById('editProductName').value = detail.producto_name;
        document.getElementById('editQuantity').value = detail.cantidad_solicitada;
        document.getElementById('editUnit').value = detail.unidad_medida;
        document.getElementById('editObservations').value = detail.observaciones || '';
        document.getElementById('currentStock').textContent = detail.stock_disponible;
        
        // Actualizar alerta de stock
        const alert = document.getElementById('stockAlert');
        if (detail.tiene_stock_suficiente) {
            alert.className = 'alert alert-success d-flex';
        } else if (detail.stock_disponible > 0) {
            alert.className = 'alert alert-warning d-flex';
        } else {
            alert.className = 'alert alert-danger d-flex';
        }
    },

    /**
     * Guardar cambios del producto
     */
    async saveProductChanges() {
        const quantity = parseInt(document.getElementById('editQuantity').value);
        const unit = document.getElementById('editUnit').value.trim();
        const observations = document.getElementById('editObservations').value.trim();
        
        if (!quantity || quantity <= 0) {
            toastr.error('La cantidad debe ser mayor a 0');
            return;
        }
        
        if (!unit) {
            toastr.error('La unidad de medida es requerida');
            return;
        }
        
        try {
            this.showLoading(true, 'Guardando cambios...');
            
            const response = await fetch(`/api/requirement-details-update/${this.config.currentProductId}/`, {
                method: 'PATCH',
                headers: {
                    'X-CSRFToken': this.config.csrfToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cantidad_solicitada: quantity,
                    unidad_medida: unit,
                    observaciones: observations
                })
            });
            
            if (response.ok) {
                toastr.success('Producto actualizado exitosamente');
                this.elements.editModal.hide();
                this.reloadTable();
                this.loadRequirementDetails(); // Actualizar estadísticas
            } else {
                const error = await response.json();
                toastr.error(error.error || 'Error al actualizar producto');
            }
        } catch (error) {
            console.error('Error updating product:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Remover producto
     */
    async removeProduct(detailId) {
        if (!confirm('¿Está seguro de eliminar este producto del requerimiento?')) {
            return;
        }
        
        try {
            this.showLoading(true, 'Eliminando producto...');
            
            const response = await fetch(`/api/requirement-details-update/${detailId}/`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': this.config.csrfToken
                }
            });
            
            if (response.ok) {
                toastr.success('Producto eliminado exitosamente');
                this.reloadTable();
                this.loadRequirementDetails(); // Actualizar estadísticas
            } else {
                const error = await response.json();
                toastr.error(error.error || 'Error al eliminar producto');
            }
        } catch (error) {
            console.error('Error removing product:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Ver producto
     */
    viewProduct(productId) {
        window.open(`/app/ecommerce/product/add/?edit=${productId}`, '_blank');
    },

    /**
     * Agregar producto
     */
    addProduct() {
        // Limpiar formulario
        document.getElementById('addProductForm').reset();
        $('#productSelect').val(null).trigger('change');
        document.getElementById('duplicateWarning').classList.add('d-none');
        
        this.elements.addModal.show();
    },

    /**
     * Cuando se selecciona un producto
     */
    onProductSelected(product) {
        // Verificar si el producto ya está en el requerimiento
        // Esta verificación la puedes hacer llamando a la API o manteniendo una lista local
        console.log('Product selected:', product);
    },

    /**
     * Guardar nuevo producto
     */
    async saveNewProduct() {
        const productId = $('#productSelect').val();
        const quantity = parseInt(document.getElementById('newQuantity').value);
        const unit = document.getElementById('newUnit').value.trim();
        const observations = document.getElementById('newObservations').value.trim();
        
        if (!productId) {
            toastr.error('Seleccione un producto');
            return;
        }
        
        if (!quantity || quantity <= 0) {
            toastr.error('La cantidad debe ser mayor a 0');
            return;
        }
        
        if (!unit) {
            toastr.error('La unidad de medida es requerida');
            return;
        }
        
        try {
            this.showLoading(true, 'Agregando producto...');
            
            const response = await fetch(`/api/requirements/${this.config.requirementId}/add_product/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.config.csrfToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    producto_id: parseInt(productId),
                    cantidad_solicitada: quantity,
                    unidad_medida: unit,
                    observaciones: observations
                })
            });
            
            if (response.ok) {
                toastr.success('Producto agregado exitosamente');
                this.elements.addModal.hide();
                this.reloadTable();
                this.loadRequirementDetails(); // Actualizar estadísticas
            } else {
                const error = await response.json();
                toastr.error(error.error || 'Error al agregar producto');
            }
        } catch (error) {
            console.error('Error adding product:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Editar requerimiento
     */
    editRequirement() {
        window.location.href = `/app/requirements/edit/${this.config.requirementId}/`;
    },

    /**
     * Duplicar requerimiento
     */
    async duplicateRequirement() {
        if (!confirm('¿Crear una copia de este requerimiento?')) {
            return;
        }
        
        try {
            this.showLoading(true, 'Duplicando requerimiento...');
            
            const response = await fetch(`/api/requirements/${this.config.requirementId}/duplicate/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.config.csrfToken
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                toastr.success('Requerimiento duplicado exitosamente');
                
                // Preguntar si quiere ir al nuevo requerimiento
                if (confirm('¿Desea ir al nuevo requerimiento?')) {
                    window.location.href = `/app/requirements/details/${result.new_id}/`;
                }
            } else {
                const error = await response.json();
                toastr.error(error.error || 'Error al duplicar requerimiento');
            }
        } catch (error) {
            console.error('Error duplicating requirement:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Eliminar requerimiento
     */
    async deleteRequirement() {
        if (!confirm('¿Está seguro de eliminar este requerimiento? Esta acción no se puede deshacer.')) {
            return;
        }
        
        try {
            this.showLoading(true, 'Eliminando requerimiento...');
            
            const response = await fetch(`/api/requirements/${this.config.requirementId}/`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': this.config.csrfToken
                }
            });
            
            if (response.ok) {
                toastr.success('Requerimiento eliminado exitosamente');
                window.location.href = '/app/requirements/list/';
            } else {
                const error = await response.json();
                toastr.error(error.error || 'Error al eliminar requerimiento');
            }
        } catch (error) {
            console.error('Error deleting requirement:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Aprobar requerimiento
     */
    async approveRequirement() {
        if (!confirm('¿Aprobar este requerimiento? Podrá proceder a cotización.')) {
            return;
        }
        
        await this.updateStatus('aprobado');
    },

    /**
     * Rechazar requerimiento
     */
    async rejectRequirement() {
        const motivo = prompt('Motivo del rechazo (opcional):');
        
        try {
            this.showLoading(true, 'Rechazando requerimiento...');
            
            const response = await fetch(`/api/requirements/${this.config.requirementId}/reject/`, {
                method: 'PATCH',
                headers: {
                    'X-CSRFToken': this.config.csrfToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ motivo: motivo || '' })
            });
            
            if (response.ok) {
                const result = await response.json();
                toastr.success(result.message);
                this.loadRequirementDetails();
            } else {
                const error = await response.json();
                toastr.error(error.error || 'Error al rechazar requerimiento');
            }
        } catch (error) {
            console.error('Error rejecting requirement:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Mostrar modal de cambio de estado
     */
    showChangeStatusModal() {
        // Limpiar formulario
        document.getElementById('changeStatusForm').reset();
        document.getElementById('statusInfo').classList.add('d-none');
        
        this.elements.statusModal.show();
    },

    /**
     * Cuando cambia el estado seleccionado
     */
    onStatusChange() {
        const newStatus = document.getElementById('newStatus').value;
        const infoDiv = document.getElementById('statusInfo');
        const infoText = document.getElementById('statusInfoText');
        
        let info = '';
        
        switch (newStatus) {
            case 'aprobado':
                info = 'El requerimiento estará listo para proceso de cotización.';
                break;
            case 'rechazado':
                info = 'El requerimiento será marcado como rechazado y podrá ser editado nuevamente.';
                break;
            case 'en_proceso_cotizacion':
                info = 'Se indica que el requerimiento está en proceso de cotización con proveedores.';
                break;
            case 'cotizado':
                info = 'Indica que se han recibido cotizaciones y está listo para selección.';
                break;
            case 'completado':
                info = 'El requerimiento se marca como completado.';
                break;
            case 'cancelado':
                info = 'El requerimiento será cancelado.';
                break;
        }
        
        if (info) {
            infoText.textContent = info;
            infoDiv.classList.remove('d-none');
        } else {
            infoDiv.classList.add('d-none');
        }
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
        
        await this.updateStatus(newStatus, notes);
    },

    /**
     * Actualizar estado
     */
    async updateStatus(newStatus, notes = '') {
        try {
            this.showLoading(true, 'Actualizando estado...');
            
            const response = await fetch(`/api/requirements/${this.config.requirementId}/update_status/`, {
                method: 'PATCH',
                headers: {
                    'X-CSRFToken': this.config.csrfToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    estado: newStatus,
                    notas: notes
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                toastr.success(result.message);
                
                // Cerrar modal si está abierto
                if (this.elements.statusModal._isShown) {
                    this.elements.statusModal.hide();
                }
                
                this.loadRequirementDetails();
            } else {
                const error = await response.json();
                toastr.error(error.error || 'Error al actualizar estado');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Crear cotización
     */
    createQuotation() {
        window.location.href = `/app/cotizacion/create/${this.config.requirementId}/`;
    },

    /**
     * Comparar cotizaciones
     */
    compareQuotations() {
        window.location.href = `/app/cotizacion/compare/${this.config.requirementId}/`;
    },

    /**
     * Cargar cotizaciones
     */
    async loadQuotations() {
        try {
            const response = await fetch(`/api/cotizacion/envios/data/?requerimiento=${this.config.requirementId}`);
            if (response.ok) {
                const data = await response.json();
                this.renderQuotations(data.data);
                document.getElementById('quotationsSection').style.display = 'block';
            }
        } catch (error) {
            console.error('Error loading quotations:', error);
        }
    },

    /**
     * Renderizar cotizaciones
     */
    renderQuotations(quotations) {
        const container = document.getElementById('quotationsContainer');
        
        if (quotations.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="ri-file-list-line ri-48px text-muted mb-3 d-block"></i>
                    <p class="text-muted">No hay cotizaciones para este requerimiento</p>
                    <button class="btn btn-primary" onclick="RequirementDetails.createQuotation()">
                        <i class="ri-add-line me-1"></i>Crear Primera Cotización
                    </button>
                </div>
            `;
            return;
        }
        
        let html = '<div class="row">';
        quotations.forEach(quotation => {
            html += `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <h6 class="mb-0">${quotation.proveedor_name}</h6>
                                <span class="badge bg-label-${quotation.estado_color}">${quotation.estado_display}</span>
                            </div>
                            <p class="text-muted small">
                                Enviado: ${new Date(quotation.fecha_envio || quotation.fecha_creacion).toLocaleDateString()}<br>
                                Método: ${quotation.metodo_envio_display}
                            </p>
                            <div class="d-flex justify-content-between">
                                <a href="/app/cotizacion/details/${quotation.id}/" class="btn btn-sm btn-outline-primary">
                                    Ver Detalles
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
    },

    /**
     * Exportar PDF
     */
    exportPDF() {
        window.open(`/api/requirements/${this.config.requirementId}/export_pdf/`, '_blank');
    },

    /**
     * Exportar Excel
     */
    exportExcel() {
        window.open(`/api/requirements/${this.config.requirementId}/export_excel/`, '_blank');
    },

    /**
     * Exportar Excel de comparación
     */
    exportComparisonExcel() {
        window.open(`/api/requirements/${this.config.requirementId}/export_comparison_excel/`, '_blank');
    },

    /**
     * Actualizar análisis de stock
     */
    async refreshStockAnalysis() {
        await this.loadRequirementDetails();
        this.reloadTable();
        toastr.success('Análisis de stock actualizado');
    },

    /**
     * Filtrar por stock
     */
    filterByStock(type) {
        // Implementar filtros en la tabla según el tipo de stock
        let searchTerm = '';
        
        switch (type) {
            case 'sufficient':
                // Filtrar productos con stock suficiente
                break;
            case 'insufficient':
                // Filtrar productos con stock insuficiente
                break;
            case 'unavailable':
                // Filtrar productos sin stock
                break;
        }
        
        // Por ahora solo mostrar mensaje
        toastr.info(`Filtro aplicado: ${type}`);
    },

    /**
     * Limpiar filtros
     */
    clearFilters() {
        if (this.elements.dataTable) {
            this.elements.dataTable.search('').draw();
        }
        toastr.info('Filtros limpiados');
    },

    /**
     * Recargar tabla
     */
    reloadTable() {
        if (this.elements.dataTable) {
            this.elements.dataTable.ajax.reload();
        }
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
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Verificar que tenemos un ID de requerimiento
    const pathParts = window.location.pathname.split('/');
    const requirementId = pathParts[pathParts.indexOf('details') + 1];
    
    if (requirementId && !isNaN(requirementId)) {
        RequirementDetails.config.requirementId = parseInt(requirementId);
        RequirementDetails.init();
    } else {
        console.error('No se pudo obtener el ID del requerimiento');
        toastr.error('Error: ID de requerimiento no válido');
    }
});

// Hacer disponible globalmente
window.RequirementDetails = RequirementDetails;