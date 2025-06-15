/**
 * Requirements Add Form Module
 * Maneja el formulario principal de creación de requerimientos
 */

'use strict';

const RequirementsAddForm = {
    // Configuración
    config: {
        csrfToken: null,
        userId: null,
        selectedProducts: new Map() // Map<productId, productData>
    },

    // Elementos del DOM
    elements: {
        form: null,
        saveButton: null,
        fechaInput: null,
        prioridadSelect: null,
        notasTextarea: null,
        archivoInput: null,
        loadingOverlay: null
    },

    /**
     * Inicializar el módulo
     */
    init() {
        this.config.csrfToken = this.getCookie('csrftoken');
        this.config.userId = this.getCurrentUserId();
        this.initializeElements();
        this.setupEventHandlers();
        this.setDefaultValues();
        console.log('Requirements Add Form initialized');
    },

    /**
     * Inicializar elementos del DOM
     */
    initializeElements() {
        this.elements.form = document.getElementById('requirementForm');
        this.elements.saveButton = document.getElementById('saveRequirement');
        this.elements.fechaInput = document.getElementById('fechaRequerimiento');
        this.elements.prioridadSelect = document.getElementById('prioridad');
        this.elements.notasTextarea = document.getElementById('notas');
        this.elements.archivoInput = document.getElementById('archivoAdjunto');
        this.elements.loadingOverlay = document.getElementById('loadingOverlay');

        // Inicializar Flatpickr para fecha
        if (this.elements.fechaInput && typeof flatpickr !== 'undefined') {
            flatpickr(this.elements.fechaInput, {
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
        // Guardar requerimiento
        if (this.elements.saveButton) {
            this.elements.saveButton.addEventListener('click', () => {
                this.saveRequirement();
            });
        }

        // Validaciones en tiempo real
        if (this.elements.fechaInput) {
            this.elements.fechaInput.addEventListener('change', () => {
                this.validateForm();
                this.updateSummary();
            });
        }

        if (this.elements.prioridadSelect) {
            this.elements.prioridadSelect.addEventListener('change', () => {
                this.updateSummary();
            });
        }

        // Validación de archivo
        if (this.elements.archivoInput) {
            this.elements.archivoInput.addEventListener('change', (e) => {
                this.validateFile(e.target.files[0]);
            });
        }
    },

    /**
     * Establecer valores por defecto
     */
    setDefaultValues() {
        // Fecha mínima: mañana
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (this.elements.fechaInput) {
            this.elements.fechaInput.value = tomorrow.toISOString().split('T')[0];
        }

        this.updateSummary();
        this.validateForm();
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
     * Obtener ID del usuario actual (simulado - en producción viene del backend)
     */
    getCurrentUserId() {
        // En producción, esto vendría del contexto del template o una API
        return 1; // Por ahora hardcodeado
    },

    /**
     * Agregar producto seleccionado
     */
    addProduct(productData) {
        this.config.selectedProducts.set(productData.id, {
            ...productData,
            cantidad_solicitada: productData.cantidad_solicitada || 1,
            unidad_medida: productData.unidad_medida || 'unidad',
            observaciones: productData.observaciones || ''
        });

        this.updateProductsTable();
        this.updateSummary();
        this.validateForm();
    },

    /**
     * Remover producto
     */
    removeProduct(productId) {
        this.config.selectedProducts.delete(productId);
        this.updateProductsTable();
        this.updateSummary();
        this.validateForm();
    },

    /**
     * Actualizar producto existente
     */
    updateProduct(productId, field, value) {
        if (this.config.selectedProducts.has(productId)) {
            const product = this.config.selectedProducts.get(productId);
            product[field] = value;
            this.config.selectedProducts.set(productId, product);
            this.updateSummary();
            this.validateForm();
        }
    },

    /**
     * Actualizar tabla de productos
     */
    updateProductsTable() {
        const tbody = document.getElementById('selectedProductsBody');
        const emptyRow = document.getElementById('emptyProductsRow');

        if (this.config.selectedProducts.size === 0) {
            emptyRow.style.display = 'table-row';
            // Limpiar filas de productos
            tbody.querySelectorAll('tr:not(#emptyProductsRow)').forEach(row => row.remove());
            return;
        }

        emptyRow.style.display = 'none';

        // Limpiar tabla actual
        tbody.querySelectorAll('tr:not(#emptyProductsRow)').forEach(row => row.remove());

        // Agregar productos
        let index = 1;
        this.config.selectedProducts.forEach((product, productId) => {
            const row = this.createProductRow(product, index);
            tbody.appendChild(row);
            index++;
        });
    },

    /**
     * Crear fila de producto
     */
    createProductRow(product, index) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="text-center">${index}</td>
            <td>
                <div class="d-flex align-items-center">
                    ${product.image ? `<img src="${product.image}" alt="${product.name}" class="rounded me-2" style="width: 30px; height: 30px; object-fit: cover;">` : ''}
                    <div>
                        <div class="fw-medium">${product.name}</div>
                        <small class="text-muted">${product.category || 'Sin categoría'}</small>
                    </div>
                </div>
            </td>
            <td>
                <input type="number" class="form-control form-control-sm" 
                       value="${product.cantidad_solicitada}" 
                       min="1" 
                       data-product-id="${product.id}" 
                       data-field="cantidad_solicitada">
            </td>
            <td>
                <input type="text" class="form-control form-control-sm" 
                       value="${product.unidad_medida}" 
                       data-product-id="${product.id}" 
                       data-field="unidad_medida">
            </td>
            <td class="text-center">
                <span class="badge ${this.getStockBadgeClass(product.stock_current, product.cantidad_solicitada)}">
                    ${product.stock_current || 0}
                </span>
            </td>
            <td>
                <input type="text" class="form-control form-control-sm" 
                       value="${product.observaciones}" 
                       placeholder="Observaciones..." 
                       data-product-id="${product.id}" 
                       data-field="observaciones">
            </td>
            <td class="text-center">
                <button type="button" class="btn btn-sm btn-icon btn-text-danger" 
                        onclick="RequirementsAddForm.removeProduct(${product.id})" 
                        title="Eliminar">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </td>
        `;

        // Agregar event listeners para inputs
        row.querySelectorAll('input[data-product-id]').forEach(input => {
            input.addEventListener('change', (e) => {
                const productId = parseInt(e.target.dataset.productId);
                const field = e.target.dataset.field;
                let value = e.target.value;

                if (field === 'cantidad_solicitada') {
                    value = parseInt(value) || 1;
                    if (value < 1) {
                        value = 1;
                        e.target.value = value;
                    }
                }

                this.updateProduct(productId, field, value);
            });
        });

        return row;
    },

    /**
     * Obtener clase de badge para stock
     */
    getStockBadgeClass(stock, cantidadSolicitada) {
        if (stock === 0) return 'bg-label-danger';
        if (stock < cantidadSolicitada) return 'bg-label-warning';
        return 'bg-label-success';
    },

    /**
     * Actualizar resumen
     */
    updateSummary() {
        const totalProductos = this.config.selectedProducts.size;
        const cantidadTotal = Array.from(this.config.selectedProducts.values())
            .reduce((sum, product) => sum + (product.cantidad_solicitada || 0), 0);
        
        const prioridad = this.elements.prioridadSelect?.value || 'media';
        const prioridadIcons = {
            'alta': '🔴 Alta',
            'media': '🟡 Media',
            'baja': '🟢 Baja'
        };

        // Actualizar elementos
        const totalElement = document.getElementById('totalProductos');
        if (totalElement) totalElement.textContent = totalProductos;

        const cantidadElement = document.getElementById('cantidadTotal');
        if (cantidadElement) cantidadElement.textContent = cantidadTotal;

        const prioridadBadge = document.getElementById('prioridadBadge');
        if (prioridadBadge) {
            prioridadBadge.textContent = prioridadIcons[prioridad];
            prioridadBadge.className = `badge bg-label-${this.getPriorityColor(prioridad)}`;
        }
    },

    /**
     * Obtener color de prioridad
     */
    getPriorityColor(prioridad) {
        const colors = {
            'alta': 'danger',
            'media': 'warning',
            'baja': 'success'
        };
        return colors[prioridad] || 'secondary';
    },

    /**
     * Validar formulario
     */
    validateForm() {
        if (window.RequirementsAddValidation) {
            window.RequirementsAddValidation.validateAll();
        }
    },

    /**
     * Validar archivo
     */
    validateFile(file) {
        if (!file) return true;

        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/png'
        ];

        if (file.size > maxSize) {
            toastr.error('El archivo no puede ser mayor a 10MB');
            this.elements.archivoInput.value = '';
            return false;
        }

        if (!allowedTypes.includes(file.type)) {
            toastr.error('Formato de archivo no permitido');
            this.elements.archivoInput.value = '';
            return false;
        }

        return true;
    },

    /**
     * Guardar requerimiento
     */
    async saveRequirement() {
        // Validar formulario
        if (!this.validateBeforeSave()) {
            return;
        }

        this.showLoading(true);

        try {
            const formData = this.buildFormData();
            const response = await this.submitRequirement(formData);
            
            if (response.ok) {
                const result = await response.json();
                this.showSuccess(result);
            } else {
                const error = await response.json();
                this.showError(error);
            }
        } catch (error) {
            console.error('Error saving requirement:', error);
            this.showError({ message: 'Error de conexión' });
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Validar antes de guardar
     */
    validateBeforeSave() {
        const fecha = this.elements.fechaInput?.value;
        if (!fecha) {
            toastr.error('La fecha requerida es obligatoria');
            return false;
        }

        if (this.config.selectedProducts.size === 0) {
            toastr.error('Debe seleccionar al menos un producto');
            return false;
        }

        // Validar fechas
        const fechaRequerida = new Date(fecha);
        const hoy = new Date();
        if (fechaRequerida <= hoy) {
            toastr.error('La fecha requerida debe ser posterior a hoy');
            return false;
        }

        return true;
    },

    /**
     * Construir FormData para envío
     */
    buildFormData() {
        const formData = new FormData();
        
        // Datos básicos
        formData.append('usuario_solicitante', this.config.userId);
        formData.append('fecha_requerimiento', this.elements.fechaInput.value);
        formData.append('prioridad', this.elements.prioridadSelect.value);
        formData.append('notas', this.elements.notasTextarea.value);

        // Archivo adjunto
        if (this.elements.archivoInput.files[0]) {
            formData.append('archivo_adjunto', this.elements.archivoInput.files[0]);
        }

        // Detalles de productos - CORREGIDO
        const detalles = Array.from(this.config.selectedProducts.values()).map(product => ({
            producto_id: product.id,
            cantidad_solicitada: parseInt(product.cantidad_solicitada) || 1,
            unidad_medida: product.unidad_medida || 'unidad',
            observaciones: product.observaciones || ''
        }));

        // Enviar como JSON string
        formData.append('detalles', JSON.stringify(detalles));

        return formData;
    },

    /**
     * Enviar requerimiento
     */
    async submitRequirement(formData) {
        return fetch('/api/requirements/', {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': this.config.csrfToken
            }
        });
    },

    /**
     * Mostrar loading
     */
    showLoading(show) {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.toggle('d-none', !show);
        }

        if (this.elements.saveButton) {
            this.elements.saveButton.disabled = show;
            this.elements.saveButton.innerHTML = show 
                ? '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...'
                : 'Crear Requerimiento';
        }
    },

    /**
     * Mostrar éxito
     */
    showSuccess(result) {
        Swal.fire({
            title: '¡Requerimiento Creado!',
            text: `Requerimiento ${result.numero_requerimiento} creado exitosamente`,
            icon: 'success',
            confirmButtonText: 'Ver Lista',
            showCancelButton: true,
            cancelButtonText: 'Crear Otro',
            customClass: {
                confirmButton: 'btn btn-primary me-2',
                cancelButton: 'btn btn-outline-secondary'
            },
            buttonsStyling: false
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = '/app/requirements/list/';
            } else {
                // Reiniciar formulario
                this.resetForm();
            }
        });
    },

    /**
     * Mostrar error
     */
    showError(error) {
    let message = 'Error al crear el requerimiento';

    // Si error es objeto con claves (p.ej. {field: ["msg1", "msg2"]})
    if (error && typeof error === 'object' && !Array.isArray(error)) {
        const messages = [];
        for (const key in error) {
            if (Array.isArray(error[key])) {
                error[key].forEach(msg => {
                    messages.push(`${key}: ${msg}`);
                });
            } else if (typeof error[key] === 'string') {
                messages.push(`${key}: ${error[key]}`);
            }
        }
        if (messages.length > 0) {
            message = messages.join('\n');
        }
    }
    // Si error es array
    else if (Array.isArray(error)) {
        message = error.join('\n');
    }
    // Si error es string
    else if (typeof error === 'string') {
        message = error;
    }
    // Si tiene error.error o error.detail, priorizar
    else if (error.error) {
        message = error.error;
    } else if (error.detail) {
        message = error.detail;
    }

    Swal.fire({
        title: 'Error',
        text: message,
        icon: 'error',
        customClass: {
            confirmButton: 'btn btn-danger'
        },
        buttonsStyling: false
    });
}
,

    /**
     * Reiniciar formulario
     */
    resetForm() {
        this.elements.form?.reset();
        this.config.selectedProducts.clear();
        this.setDefaultValues();
        this.updateProductsTable();
        this.updateSummary();
        this.validateForm();
    },

    /**
     * Obtener productos seleccionados
     */
    getSelectedProducts() {
        return Array.from(this.config.selectedProducts.values());
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    RequirementsAddForm.init();
});

// Hacer disponible globalmente
window.RequirementsAddForm = RequirementsAddForm;