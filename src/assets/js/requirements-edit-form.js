/**
 * Requirements Edit Form Module
 * Maneja la edición completa de requerimientos
 */

'use strict';

const RequirementsEdit = {
    // Configuración
    config: {
        requirementId: null,
        csrfToken: null,
        originalData: null,
        currentData: null,
        selectedProducts: new Map(),
        hasUnsavedChanges: false
    },

    // Referencias a elementos
    elements: {
        form: null,
        requirementId: null,
        fechaRequerimiento: null,
        prioridad: null,
        notas: null,
        archivoAdjunto: null,
        saveButton: null,
        loadingOverlay: null,
        selectedProductsTable: null,
        selectedProductsBody: null
    },

    /**
     * Inicializar el módulo
     */
    init() {
        this.config.csrfToken = this.getCookie('csrftoken');
        this.config.requirementId = window.RequirementEditConfig?.requirementId;
        
        if (!this.config.requirementId) {
            this.showError('ID de requerimiento no proporcionado');
            return;
        }

        this.initializeElements();
        this.setupEventHandlers();
        this.loadRequirementData();
        this.setupBeforeUnloadWarning();
        
        console.log('Requirements Edit initialized');
    },

    /**
     * Inicializar elementos del DOM
     */
    initializeElements() {
        this.elements.form = document.getElementById('requirementEditForm');
        this.elements.requirementId = document.getElementById('requirementId');
        this.elements.fechaRequerimiento = document.getElementById('fechaRequerimiento');
        this.elements.prioridad = document.getElementById('prioridad');
        this.elements.notas = document.getElementById('notas');
        this.elements.archivoAdjunto = document.getElementById('archivoAdjunto');
        this.elements.saveButton = document.getElementById('saveRequirement');
        this.elements.loadingOverlay = document.getElementById('loadingOverlay');
        this.elements.selectedProductsTable = document.getElementById('selectedProductsTable');
        this.elements.selectedProductsBody = document.getElementById('selectedProductsBody');

        // Configurar Flatpickr para fecha
        if (this.elements.fechaRequerimiento && typeof flatpickr !== 'undefined') {
            flatpickr(this.elements.fechaRequerimiento, {
                dateFormat: "Y-m-d",
                minDate: "today",
                locale: "es"
            });
        }
    },

    /**
     * Configurar manejadores de eventos
     */
    setupEventHandlers() {
        // Guardar cambios
        if (this.elements.saveButton) {
            this.elements.saveButton.addEventListener('click', () => {
                this.saveRequirement();
            });
        }

        // Detectar cambios en el formulario
        if (this.elements.form) {
            this.elements.form.addEventListener('input', () => {
                this.markAsChanged();
                this.validateForm();
            });
            
            this.elements.form.addEventListener('change', () => {
                this.markAsChanged();
                this.validateForm();
            });
        }

        // Manejo de archivo
        if (this.elements.archivoAdjunto) {
            this.elements.archivoAdjunto.addEventListener('change', (e) => {
                this.handleFileChange(e);
            });
        }

        // Acciones de archivo actual
        document.getElementById('downloadCurrentFile')?.addEventListener('click', () => {
            this.downloadCurrentFile();
        });

        document.getElementById('deleteCurrentFile')?.addEventListener('click', () => {
            this.deleteCurrentFile();
        });

        // Validación en tiempo real
        this.elements.fechaRequerimiento?.addEventListener('change', () => {
            this.validateForm();
        });

        // Auto-guardado cada 30 segundos si hay cambios
        setInterval(() => {
            if (this.config.hasUnsavedChanges) {
                this.saveRequirement(true); // Guardado silencioso
            }
        }, 30000);
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
     * Cargar datos del requerimiento
     */
    async loadRequirementData() {
        try {
            this.showLoading(true, 'Cargando requerimiento...');
            
            const response = await fetch(`/api/requirements/${this.config.requirementId}/edit_form_data/`);
            
            if (response.ok) {
                const data = await response.json();
                this.config.originalData = data;
                this.config.currentData = { ...data };
                this.populateForm(data);
                this.loadProducts(data.detalles || []);
                this.updateSummary();
                this.validateForm();
            } else {
                const error = await response.json();
                this.showError(error.error || 'Error al cargar el requerimiento');
            }
        } catch (error) {
            console.error('Error loading requirement:', error);
            this.showError('Error de conexión al cargar el requerimiento');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Poblar formulario con datos
     */
    populateForm(data) {
        // Información básica
        document.getElementById('requirementNumber').textContent = data.numero_requerimiento;
        this.elements.requirementId.value = data.id;
        this.elements.fechaRequerimiento.value = data.fecha_requerimiento;
        this.elements.prioridad.value = data.prioridad;
        this.elements.notas.value = data.notas || '';

        // Estado y badges
        const statusBadge = document.getElementById('statusBadge');
        if (statusBadge) {
            statusBadge.className = `badge bg-label-${data.estado_color}`;
            statusBadge.textContent = data.estado_display;
        }

        // Información original
        document.getElementById('originalUser').textContent = data.usuario_solicitante_name;
        document.getElementById('originalDate').textContent = new Date(data.created_at).toLocaleDateString();
        document.getElementById('lastModified').textContent = new Date(data.updated_at).toLocaleDateString();

        const originalStatus = document.getElementById('originalStatus');
        if (originalStatus) {
            originalStatus.className = `badge bg-label-${data.estado_color}`;
            originalStatus.textContent = data.estado_display;
        }

        // Archivo actual
        if (data.archivo_adjunto_url) {
            this.showCurrentFile(data.archivo_adjunto_name, data.archivo_adjunto_url);
        }

        // Verificar si puede editar
        if (!data.can_edit) {
            this.disableEditing("Este requerimiento no puede ser editado en su estado actual");
        }
    },

    /**
     * Cargar productos en la tabla
     */
    loadProducts(detalles) {
        this.config.selectedProducts.clear();
        this.elements.selectedProductsBody.innerHTML = '';

        detalles.forEach((detalle, index) => {
            this.config.selectedProducts.set(detalle.producto, {
                id: detalle.id,
                producto_id: detalle.producto,
                producto_name: detalle.producto_name,
                producto_code: detalle.producto_code || detalle.producto,
                cantidad_solicitada: detalle.cantidad_solicitada,
                unidad_medida: detalle.unidad_medida,
                observaciones: detalle.observaciones || '',
                stock_disponible: detalle.stock_disponible,
                stock_suficiente: detalle.tiene_stock_suficiente
            });
        });

        this.renderProductsTable();
    },

    /**
     * Renderizar tabla de productos
     */
    renderProductsTable() {
        this.elements.selectedProductsBody.innerHTML = '';

        if (this.config.selectedProducts.size === 0) {
            this.elements.selectedProductsBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <i class="ri-shopping-cart-line ri-48px mb-2 d-block text-muted"></i>
                        No hay productos agregados
                        <br>
                        <button type="button" class="btn btn-sm btn-primary mt-2" data-bs-toggle="modal" data-bs-target="#productSelectorModal">
                            Agregar Productos
                        </button>
                    </td>
                </tr>
            `;
            return;
        }

        let index = 1;
        this.config.selectedProducts.forEach((product, productId) => {
            const row = this.createProductRow(product, index);
            this.elements.selectedProductsBody.appendChild(row);
            index++;
        });

        this.updateSummary();
    },

    /**
     * Crear fila de producto
     */
    createProductRow(product, index) {
        const row = document.createElement('tr');
        
        const stockClass = product.stock_suficiente ? 'text-success' : 'text-danger';
        const stockIcon = product.stock_suficiente ? '✅' : '⚠️';
        
        row.innerHTML = `
            <td class="text-center">${index}</td>
            <td>
                <div class="d-flex align-items-center">
                    <div class="avatar avatar-sm me-2">
                        <span class="avatar-initial rounded bg-label-secondary">${product.producto_name.charAt(0)}</span>
                    </div>
                    <div>
                        <div class="fw-medium">${product.producto_name}</div>
                        <small class="text-muted">${product.producto_code}</small>
                    </div>
                </div>
            </td>
            <td class="text-center">
                <span class="editable-quantity fw-medium" data-product-id="${product.producto_id}">
                    ${product.cantidad_solicitada}
                </span>
            </td>
            <td class="text-center">${product.unidad_medida}</td>
            <td class="text-center">
                <span class="${stockClass}">${stockIcon} ${product.stock_disponible}</span>
            </td>
            <td>
                <small class="text-muted">${product.observaciones || '-'}</small>
            </td>
            <td class="text-center">
                <div class="dropdown">
                    <button class="btn btn-sm btn-icon btn-text-secondary rounded-pill dropdown-toggle hide-arrow" 
                            data-bs-toggle="dropdown">
                        <i class="ri-more-2-line"></i>
                    </button>
                    <div class="dropdown-menu">
                        <a class="dropdown-item edit-product-btn" 
                           data-product-id="${product.producto_id}" 
                           data-detail-id="${product.id}">
                            <i class="ri-edit-line me-1"></i>Editar
                        </a>
                        <div class="dropdown-divider"></div>
                        <a class="dropdown-item text-danger delete-product-btn" 
                           data-product-id="${product.producto_id}">
                            <i class="ri-delete-bin-line me-1"></i>Eliminar
                        </a>
                    </div>
                </div>
            </td>
        `;

        // Event listeners para la fila
        const editBtn = row.querySelector('.edit-product-btn');
        const deleteBtn = row.querySelector('.delete-product-btn');

        editBtn?.addEventListener('click', (e) => {
            const productId = e.target.closest('.edit-product-btn').dataset.productId;
            this.editProduct(productId);
        });

        deleteBtn?.addEventListener('click', (e) => {
            const productId = e.target.closest('.delete-product-btn').dataset.productId;
            this.deleteProduct(productId);
        });

        return row;
    },

    /**
     * Actualizar resumen
     */
    updateSummary() {
        const totalProductos = this.config.selectedProducts.size;
        let cantidadTotal = 0;
        let productosConStock = 0;
        let productosSinStock = 0;

        this.config.selectedProducts.forEach(product => {
            cantidadTotal += product.cantidad_solicitada;
            if (product.stock_suficiente) {
                productosConStock++;
            } else {
                productosSinStock++;
            }
        });

        const porcentajeStock = totalProductos > 0 ? 
            Math.round((productosConStock / totalProductos) * 100) : 0;

        // Actualizar elementos
        document.getElementById('totalProductos').textContent = totalProductos;
        document.getElementById('cantidadTotal').textContent = cantidadTotal;
        document.getElementById('productosConStock').textContent = productosConStock;
        document.getElementById('productosSinStock').textContent = productosSinStock;
        document.getElementById('porcentajeStock').textContent = `${porcentajeStock}%`;
    },

    /**
     * Marcar como cambiado
     */
    markAsChanged() {
        this.config.hasUnsavedChanges = true;
        this.updateValidationIcon('changesIcon', true);
        
        if (this.elements.saveButton) {
            this.elements.saveButton.classList.remove('btn-outline-primary');
            this.elements.saveButton.classList.add('btn-primary');
            this.elements.saveButton.innerHTML = '<i class="ri-save-line me-1"></i>Guardar Cambios';
        }
    },

    /**
     * Marcar como guardado
     */
    markAsSaved() {
        this.config.hasUnsavedChanges = false;
        this.updateValidationIcon('changesIcon', false);
        
        if (this.elements.saveButton) {
            this.elements.saveButton.classList.remove('btn-primary');
            this.elements.saveButton.classList.add('btn-outline-primary');
            this.elements.saveButton.innerHTML = '<i class="ri-check-line me-1"></i>Guardado';
        }

        // Restaurar después de 2 segundos
        setTimeout(() => {
            if (this.elements.saveButton && !this.config.hasUnsavedChanges) {
                this.elements.saveButton.innerHTML = '<i class="ri-save-line me-1"></i>Guardar Cambios';
            }
        }, 2000);
    },

    /**
     * Validar formulario
     */
    validateForm() {
        const fecha = this.elements.fechaRequerimiento?.value;
        const hasProducts = this.config.selectedProducts.size > 0;
        
        // Validar fecha
        const fechaValid = fecha && new Date(fecha) >= new Date().setHours(0,0,0,0);
        this.updateValidationIcon('fechaIcon', fechaValid);
        
        // Validar productos
        this.updateValidationIcon('productosIcon', hasProducts);
        
        // Actualizar botón
        const isValid = fechaValid && hasProducts;
        if (this.elements.saveButton) {
            this.elements.saveButton.disabled = !isValid;
        }
        
        return isValid;
    },

    /**
     * Actualizar icono de validación
     */
    updateValidationIcon(iconId, isValid) {
        const icon = document.getElementById(iconId);
        if (icon) {
            icon.className = isValid ? 
                'ri-check-circle-line ms-auto text-success' : 
                'ri-close-circle-line ms-auto text-danger';
        }
    },

    /**
     * Guardar requerimiento
     */
    async saveRequirement(silent = false) {
        if (!this.validateForm()) {
            if (!silent) {
                toastr.error('Por favor complete todos los campos requeridos');
            }
            return;
        }

        const formData = this.collectFormData();
        
        if (!silent) {
            this.showLoading(true, 'Guardando cambios...');
        }

        try {
            const response = await fetch(`/api/requirements/${this.config.requirementId}/`, {
                method: 'PATCH',
                headers: {
                    'X-CSRFToken': this.config.csrfToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const updatedData = await response.json();
                this.config.currentData = updatedData;
                this.markAsSaved();
                
                if (!silent) {
                    toastr.success('Requerimiento actualizado exitosamente');
                }
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Error al guardar el requerimiento');
            }
        } catch (error) {
            console.error('Error saving requirement:', error);
            if (!silent) {
                toastr.error(error.message || 'Error al guardar el requerimiento');
            }
        } finally {
            if (!silent) {
                this.showLoading(false);
            }
        }
    },

    /**
     * Recopilar datos del formulario
     */
    collectFormData() {
        const detalles = Array.from(this.config.selectedProducts.values()).map(product => ({
            id: product.id,
            producto_id: product.producto_id,
            cantidad_solicitada: product.cantidad_solicitada,
            unidad_medida: product.unidad_medida,
            observaciones: product.observaciones
        }));

        return {
            fecha_requerimiento: this.elements.fechaRequerimiento.value,
            prioridad: this.elements.prioridad.value,
            notas: this.elements.notas.value,
            detalles: detalles
        };
    },

    /**
     * Editar producto
     */
    editProduct(productId) {
        const product = this.config.selectedProducts.get(parseInt(productId));
        if (!product) return;

        // Poblar modal de edición
        document.getElementById('editProductId').value = product.producto_id;
        document.getElementById('editDetailId').value = product.id;
        document.getElementById('editProductName').textContent = product.producto_name;
        document.getElementById('editProductCode').textContent = product.producto_code;
        document.getElementById('editCantidad').value = product.cantidad_solicitada;
        document.getElementById('editUnidad').value = product.unidad_medida;
        document.getElementById('editObservaciones').value = product.observaciones;
        document.getElementById('editStockDisponible').textContent = product.stock_disponible;

        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('editProductModal'));
        modal.show();
    },

    /**
     * Eliminar producto
     */
    deleteProduct(productId) {
        const product = this.config.selectedProducts.get(parseInt(productId));
        if (!product) return;

        // Poblar modal de confirmación
        document.getElementById('deleteProductName').textContent = product.producto_name;
        document.getElementById('deleteProductQuantity').textContent = product.cantidad_solicitada;

        // Configurar botón de confirmación
        const confirmBtn = document.getElementById('confirmDeleteProduct');
        confirmBtn.onclick = () => {
            this.confirmDeleteProduct(productId);
        };

        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('deleteProductModal'));
        modal.show();
    },

    /**
     * Confirmar eliminación de producto
     */
    confirmDeleteProduct(productId) {
        this.config.selectedProducts.delete(parseInt(productId));
        this.renderProductsTable();
        this.markAsChanged();
        this.validateForm();

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteProductModal'));
        modal.hide();

        toastr.success('Producto eliminado del requerimiento');
    },

    /**
     * Mostrar loading
     */
    showLoading(show, text = 'Cargando...') {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.toggle('d-none', !show);
            const loadingText = document.getElementById('loadingText');
            if (loadingText) {
                loadingText.textContent = text;
            }
        }
    },

    /**
     * Mostrar error
     */
    showError(message) {
        const alert = document.getElementById('editAlert');
        if (alert) {
            alert.className = 'alert alert-danger';
            document.getElementById('editAlertText').textContent = message;
            alert.classList.remove('d-none');
        } else {
            toastr.error(message);
        }
    },

    /**
     * Configurar advertencia antes de salir
     */
    setupBeforeUnloadWarning() {
        window.addEventListener('beforeunload', (e) => {
            if (this.config.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
                return 'Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?';
            }
        });
    },

    /**
     * Deshabilitar edición
     */
    disableEditing(reason) {
        // Deshabilitar formulario
        if (this.elements.form) {
            const inputs = this.elements.form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => input.disabled = true);
        }

        // Deshabilitar botón de guardar
        if (this.elements.saveButton) {
            this.elements.saveButton.disabled = true;
            this.elements.saveButton.textContent = 'No Editable';
        }

        // Mostrar alerta
        this.showError(reason);
    },

    /**
     * Manejo de cambio de archivo
     */
    handleFileChange(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Validar tamaño
        const maxSize = window.RequirementEditConfig?.validation?.maxFileSize || 10485760; // 10MB
        if (file.size > maxSize) {
            toastr.error('El archivo no puede ser mayor a 10MB');
            e.target.value = '';
            return;
        }

        // Subir archivo
        this.uploadFile(file);
    },

    /**
     * Subir archivo
     */
    async uploadFile(file) {
        const formData = new FormData();
        formData.append('archivo_adjunto', file);

        try {
            this.showLoading(true, 'Subiendo archivo...');

            const response = await fetch(`/api/requirements/${this.config.requirementId}/upload-file/`, {
                method: 'PATCH',
                headers: {
                    'X-CSRFToken': this.config.csrfToken
                },
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                toastr.success('Archivo subido exitosamente');
                this.showCurrentFile(result.archivo_name, result.archivo_url);
                this.markAsChanged();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Error al subir archivo');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            toastr.error(error.message || 'Error al subir archivo');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Mostrar archivo actual
     */
    showCurrentFile(fileName, fileUrl) {
        const container = document.getElementById('currentFileContainer');
        if (container) {
            container.classList.remove('d-none');
            document.getElementById('currentFileName').textContent = fileName;
            
            // Configurar botón de descarga
            const downloadBtn = document.getElementById('downloadCurrentFile');
            if (downloadBtn) {
                downloadBtn.onclick = () => window.open(fileUrl, '_blank');
            }
        }
    },

    /**
     * Descargar archivo actual
     */
    downloadCurrentFile() {
        if (this.config.currentData?.archivo_adjunto_url) {
            window.open(this.config.currentData.archivo_adjunto_url, '_blank');
        }
    },

    /**
     * Eliminar archivo actual
     */
    async deleteCurrentFile() {
        try {
            const response = await fetch(`/api/requirements/${this.config.requirementId}/upload-file/`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': this.config.csrfToken
                }
            });

            if (response.ok) {
                document.getElementById('currentFileContainer').classList.add('d-none');
                this.elements.archivoAdjunto.value = '';
                toastr.success('Archivo eliminado exitosamente');
                this.markAsChanged();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Error al eliminar archivo');
            }
        } catch (error) {
            console.error('Error deleting file:', error);
            toastr.error(error.message || 'Error al eliminar archivo');
        }
    }
};

// Módulo para el selector de productos
const ProductSelector = {
    // Configuración
    config: {
        allProducts: [],
        selectedProducts: new Set(),
        currentFilters: {
            category: '',
            stock: '',
            search: ''
        }
    },

    // Elementos
    elements: {
        modal: null,
        table: null,
        tableBody: null,
        filterCategory: null,
        filterStock: null,
        searchInput: null,
        selectAllCheckbox: null,
        addButton: null,
        selectedCount: null
    },

    /**
     * Inicializar selector de productos
     */
    init() {
        this.elements.modal = document.getElementById('productSelectorModal');
        this.elements.table = document.getElementById('productsTable');
        this.elements.tableBody = document.getElementById('productsTableBody');
        this.elements.filterCategory = document.getElementById('filterCategory');
        this.elements.filterStock = document.getElementById('filterStock');
        this.elements.searchInput = document.getElementById('searchProduct');
        this.elements.selectAllCheckbox = document.getElementById('selectAllProducts');
        this.elements.addButton = document.getElementById('addSelectedProducts');
        this.elements.selectedCount = document.getElementById('selectedCount');

        this.setupEventHandlers();
        this.loadCategories();
        this.loadProducts();
    },

    /**
     * Configurar event handlers
     */
    setupEventHandlers() {
        // Modal events
        this.elements.modal?.addEventListener('shown.bs.modal', () => {
            this.resetSelection();
        });

        // Filtros
        this.elements.filterCategory?.addEventListener('change', () => {
            this.applyFilters();
        });

        this.elements.filterStock?.addEventListener('change', () => {
            this.applyFilters();
        });

        // Búsqueda con debounce
        let searchTimeout;
        this.elements.searchInput?.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.applyFilters();
            }, 300);
        });

        // Seleccionar todos
        this.elements.selectAllCheckbox?.addEventListener('change', (e) => {
            this.toggleSelectAll(e.target.checked);
        });

        // Agregar productos seleccionados
        this.elements.addButton?.addEventListener('click', () => {
            this.addSelectedProducts();
        });
    },

    /**
     * Cargar categorías
     */
    async loadCategories() {
        try {
            const response = await fetch('/api/categories/active/');
            if (response.ok) {
                const data = await response.json();
                this.populateCategoryFilter(data.data || []);
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    },

    /**
     * Poblar filtro de categorías
     */
    populateCategoryFilter(categories) {
        if (!this.elements.filterCategory) return;

        this.elements.filterCategory.innerHTML = '<option value="">Todas las categorías</option>';
        
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            this.elements.filterCategory.appendChild(option);
        });
    },

    /**
     * Cargar productos
     */
    async loadProducts() {
        try {
            const response = await fetch('/api/products/data/');
            if (response.ok) {
                const data = await response.json();
                this.config.allProducts = data.data || [];
                this.renderProductsTable();
            }
        } catch (error) {
            console.error('Error loading products:', error);
            toastr.error('Error al cargar productos');
        }
    },

    /**
     * Aplicar filtros
     */
    applyFilters() {
        this.config.currentFilters = {
            category: this.elements.filterCategory?.value || '',
            stock: this.elements.filterStock?.value || '',
            search: this.elements.searchInput?.value?.toLowerCase() || ''
        };

        this.renderProductsTable();
    },

    /**
     * Obtener productos filtrados
     */
    getFilteredProducts() {
        let filtered = [...this.config.allProducts];

        // Solo productos activos
        filtered = filtered.filter(product => product.is_active);

        // Excluir productos ya agregados al requerimiento
        const existingProductIds = new Set(RequirementsEdit.config.selectedProducts.keys());
        filtered = filtered.filter(product => !existingProductIds.has(product.id));

        // Filtro por categoría
        if (this.config.currentFilters.category) {
            filtered = filtered.filter(product => 
                product.category == this.config.currentFilters.category
            );
        }

        // Filtro por stock
        if (this.config.currentFilters.stock) {
            switch (this.config.currentFilters.stock) {
                case 'available':
                    filtered = filtered.filter(product => product.stock_current > 0);
                    break;
                case 'low':
                    filtered = filtered.filter(product => 
                        product.stock_current > 0 && 
                        product.stock_current <= product.stock_minimum
                    );
                    break;
                case 'out':
                    filtered = filtered.filter(product => product.stock_current === 0);
                    break;
            }
        }

        // Filtro por búsqueda
        if (this.config.currentFilters.search) {
            filtered = filtered.filter(product =>
                product.name.toLowerCase().includes(this.config.currentFilters.search) ||
                product.code?.toLowerCase().includes(this.config.currentFilters.search) ||
                product.description?.toLowerCase().includes(this.config.currentFilters.search)
            );
        }

        return filtered;
    },

    /**
     * Renderizar tabla de productos
     */
    renderProductsTable() {
        if (!this.elements.tableBody) return;

        const filteredProducts = this.getFilteredProducts();
        this.elements.tableBody.innerHTML = '';

        if (filteredProducts.length === 0) {
            this.elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <i class="ri-search-line ri-48px mb-2 d-block text-muted"></i>
                        No se encontraron productos
                    </td>
                </tr>
            `;
            return;
        }

        filteredProducts.forEach(product => {
            const row = this.createProductRow(product);
            this.elements.tableBody.appendChild(row);
        });

        this.updateSelectAllState();
    },

    /**
     * Crear fila de producto
     */
    createProductRow(product) {
        const row = document.createElement('tr');
        
        const stockStatus = this.getStockStatus(product);
        const isSelected = this.config.selectedProducts.has(product.id);
        
        row.innerHTML = `
            <td>
                <input type="checkbox" class="form-check-input product-checkbox" 
                       data-product-id="${product.id}" ${isSelected ? 'checked' : ''}>
            </td>
            <td>
                <div class="d-flex align-items-center">
                    ${product.image ? 
                        `<img src="${product.image}" alt="${product.name}" 
                              class="rounded me-2" style="width: 40px; height: 40px; object-fit: cover;">` : 
                        `<div class="avatar avatar-sm me-2">
                            <span class="avatar-initial rounded bg-label-secondary">${product.name.charAt(0)}</span>
                        </div>`
                    }
                    <div>
                        <div class="fw-medium">${product.name}</div>
                        <small class="text-muted">${product.code || 'Sin código'}</small>
                    </div>
                </div>
            </td>
            <td>${product.category_name || 'Sin categoría'}</td>
            <td class="text-center">
                <span class="badge ${stockStatus.class}">${stockStatus.text}</span>
            </td>
            <td class="text-center">S/. ${product.price || '0.00'}</td>
            <td class="text-center">
                <span class="badge ${product.is_active ? 'bg-label-success' : 'bg-label-secondary'}">
                    ${product.is_active ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td class="text-center">
                <button type="button" class="btn btn-sm btn-primary quick-add-btn" 
                        data-product-id="${product.id}">
                    <i class="ri-add-line"></i>
                </button>
            </td>
        `;

        // Event listeners
        const checkbox = row.querySelector('.product-checkbox');
        const quickAddBtn = row.querySelector('.quick-add-btn');

        checkbox?.addEventListener('change', (e) => {
            this.toggleProductSelection(product.id, e.target.checked);
        });

        quickAddBtn?.addEventListener('click', () => {
            this.quickAddProduct(product);
        });

        return row;
    },

    /**
     * Obtener estado del stock
     */
    getStockStatus(product) {
        const stock = product.stock_current || 0;
        const minStock = product.stock_minimum || 0;

        if (stock === 0) {
            return { class: 'bg-label-danger', text: 'Sin stock' };
        } else if (stock <= minStock) {
            return { class: 'bg-label-warning', text: `${stock} (Bajo)` };
        } else {
            return { class: 'bg-label-success', text: stock.toString() };
        }
    },

    /**
     * Toggle selección de producto
     */
    toggleProductSelection(productId, selected) {
        if (selected) {
            this.config.selectedProducts.add(productId);
        } else {
            this.config.selectedProducts.delete(productId);
        }

        this.updateSelectedCount();
        this.updateSelectAllState();
    },

    /**
     * Toggle seleccionar todos
     */
    toggleSelectAll(selectAll) {
        const checkboxes = document.querySelectorAll('.product-checkbox');
        
        checkboxes.forEach(checkbox => {
            const productId = parseInt(checkbox.dataset.productId);
            checkbox.checked = selectAll;
            this.toggleProductSelection(productId, selectAll);
        });
    },

    /**
     * Actualizar estado de seleccionar todos
     */
    updateSelectAllState() {
        if (!this.elements.selectAllCheckbox) return;

        const checkboxes = document.querySelectorAll('.product-checkbox');
        const checkedBoxes = document.querySelectorAll('.product-checkbox:checked');
        
        if (checkboxes.length === 0) {
            this.elements.selectAllCheckbox.checked = false;
            this.elements.selectAllCheckbox.indeterminate = false;
        } else if (checkedBoxes.length === checkboxes.length) {
            this.elements.selectAllCheckbox.checked = true;
            this.elements.selectAllCheckbox.indeterminate = false;
        } else if (checkedBoxes.length > 0) {
            this.elements.selectAllCheckbox.checked = false;
            this.elements.selectAllCheckbox.indeterminate = true;
        } else {
            this.elements.selectAllCheckbox.checked = false;
            this.elements.selectAllCheckbox.indeterminate = false;
        }
    },

    /**
     * Actualizar contador de seleccionados
     */
    updateSelectedCount() {
        if (this.elements.selectedCount) {
            this.elements.selectedCount.textContent = this.config.selectedProducts.size;
        }

        if (this.elements.addButton) {
            this.elements.addButton.disabled = this.config.selectedProducts.size === 0;
        }
    },

    /**
     * Agregar producto rápido
     */
    quickAddProduct(product) {
        RequirementsEdit.config.selectedProducts.set(product.id, {
            id: null, // Nuevo producto
            producto_id: product.id,
            producto_name: product.name,
            producto_code: product.code || product.id,
            cantidad_solicitada: 1,
            unidad_medida: 'unidad',
            observaciones: '',
            stock_disponible: product.stock_current,
            stock_suficiente: product.stock_current >= 1
        });

        RequirementsEdit.renderProductsTable();
        RequirementsEdit.markAsChanged();
        RequirementsEdit.validateForm();

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(this.elements.modal);
        modal?.hide();

        toastr.success(`${product.name} agregado al requerimiento`);
    },

    /**
     * Agregar productos seleccionados
     */
    addSelectedProducts() {
        if (this.config.selectedProducts.size === 0) {
            toastr.warning('No hay productos seleccionados');
            return;
        }

        let addedCount = 0;

        this.config.selectedProducts.forEach(productId => {
            const product = this.config.allProducts.find(p => p.id === productId);
            if (product) {
                RequirementsEdit.config.selectedProducts.set(product.id, {
                    id: null, // Nuevo producto
                    producto_id: product.id,
                    producto_name: product.name,
                    producto_code: product.code || product.id,
                    cantidad_solicitada: 1,
                    unidad_medida: 'unidad',
                    observaciones: '',
                    stock_disponible: product.stock_current,
                    stock_suficiente: product.stock_current >= 1
                });
                addedCount++;
            }
        });

        if (addedCount > 0) {
            RequirementsEdit.renderProductsTable();
            RequirementsEdit.markAsChanged();
            RequirementsEdit.validateForm();

            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(this.elements.modal);
            modal?.hide();

            toastr.success(`${addedCount} producto(s) agregado(s) al requerimiento`);
        }
    },

    /**
     * Resetear selección
     */
    resetSelection() {
        this.config.selectedProducts.clear();
        this.updateSelectedCount();
        this.renderProductsTable();
    }
};

// Manejador para editar productos individuales
const ProductEditHandler = {
    /**
     * Inicializar
     */
    init() {
        this.setupEventHandlers();
    },

    /**
     * Configurar event handlers
     */
    setupEventHandlers() {
        // Guardar edición de producto
        document.getElementById('saveProductEdit')?.addEventListener('click', () => {
            this.saveProductEdit();
        });

        // Validación en tiempo real
        document.getElementById('editCantidad')?.addEventListener('input', () => {
            this.validateProductEdit();
        });
    },

    /**
     * Guardar edición de producto
     */
    saveProductEdit() {
        const form = document.getElementById('editProductForm');
        const formData = new FormData(form);
        
        const productId = parseInt(document.getElementById('editProductId').value);
        const cantidad = parseInt(formData.get('cantidad_solicitada'));
        const unidad = formData.get('unidad_medida');
        const observaciones = formData.get('observaciones');

        if (!this.validateProductEdit()) {
            toastr.error('Por favor corrija los errores antes de guardar');
            return;
        }

        // Actualizar en el mapa de productos
        const product = RequirementsEdit.config.selectedProducts.get(productId);
        if (product) {
            product.cantidad_solicitada = cantidad;
            product.unidad_medida = unidad;
            product.observaciones = observaciones;
            product.stock_suficiente = product.stock_disponible >= cantidad;

            RequirementsEdit.renderProductsTable();
            RequirementsEdit.markAsChanged();
            RequirementsEdit.validateForm();

            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editProductModal'));
            modal?.hide();

            toastr.success('Producto actualizado exitosamente');
        }
    },

    /**
     * Validar edición de producto
     */
    validateProductEdit() {
        const cantidad = parseInt(document.getElementById('editCantidad').value);
        const isValid = cantidad > 0;

        const saveBtn = document.getElementById('saveProductEdit');
        if (saveBtn) {
            saveBtn.disabled = !isValid;
        }

        return isValid;
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    RequirementsEdit.init();
    ProductSelector.init();
    ProductEditHandler.init();
});

// Hacer disponibles globalmente
window.RequirementsEdit = RequirementsEdit;
window.ProductSelector = ProductSelector;
window.ProductEditHandler = ProductEditHandler;