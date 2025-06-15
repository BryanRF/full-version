/**
 * Requirements Add Validation Module
 * Maneja todas las validaciones del formulario de requerimientos
 * (Versión sin validación de stock)
 */

'use strict';

const RequirementsAddValidation = {
    // Configuración
    config: {
        validations: {
            fecha: false,
            productos: false
        }
    },

    // Elementos del DOM
    elements: {
        fechaIcon: null,
        productosIcon: null,
        fechaInput: null,
        saveButton: null
    },

    /**
     * Inicializar el módulo
     */
    init() {
        this.initializeElements();
        this.setupEventHandlers();
        this.validateAll();
        console.log('Requirements Add Validation initialized (sin validación de stock)');
    },

    /**
     * Inicializar elementos del DOM
     */
    initializeElements() {
        this.elements.fechaIcon = document.getElementById('fechaIcon');
        this.elements.productosIcon = document.getElementById('productosIcon');
        this.elements.fechaInput = document.getElementById('fechaRequerimiento');
        this.elements.saveButton = document.getElementById('saveRequirement');
    },

    /**
     * Configurar manejadores de eventos
     */
    setupEventHandlers() {
        // Validación de fecha en tiempo real
        if (this.elements.fechaInput) {
            this.elements.fechaInput.addEventListener('change', () => {
                this.validateFecha();
                this.updateSaveButton();
            });
        }

        // Observar cambios en productos (se llamará desde el módulo principal)
        this.setupProductObserver();
    },

    /**
     * Configurar observador de productos
     */
    setupProductObserver() {
        // Se vinculará con RequirementsAddForm cuando se agreguen/eliminen productos
        if (window.RequirementsAddForm) {
            // Escuchar cambios en productos seleccionados
            const originalAddProduct = RequirementsAddForm.addProduct;
            const originalRemoveProduct = RequirementsAddForm.removeProduct;

            RequirementsAddForm.addProduct = function(...args) {
                const result = originalAddProduct.apply(this, args);
                RequirementsAddValidation.validateProductos();
                RequirementsAddValidation.updateSaveButton();
                return result;
            };

            RequirementsAddForm.removeProduct = function(...args) {
                const result = originalRemoveProduct.apply(this, args);
                RequirementsAddValidation.validateProductos();
                RequirementsAddValidation.updateSaveButton();
                return result;
            };
        }
    },

    /**
     * Validar todas las reglas
     */
    validateAll() {
        this.validateFecha();
        this.validateProductos();
        this.updateSaveButton();
    },

    /**
     * Validar fecha requerida
     */
    validateFecha() {
        const fecha = this.elements.fechaInput?.value;
        const isValid = this.isFechaValid(fecha);
        
        this.config.validations.fecha = isValid;
        this.updateValidationIcon(this.elements.fechaIcon, isValid);
        
        return isValid;
    },

    /**
     * Validar productos seleccionados
     */
    validateProductos() {
        const hasProducts = window.RequirementsAddForm ? 
            RequirementsAddForm.config.selectedProducts.size > 0 : false;
        
        this.config.validations.productos = hasProducts;
        this.updateValidationIcon(this.elements.productosIcon, hasProducts);
        
        return hasProducts;
    },

    /**
     * Verificar si la fecha es válida
     */
    isFechaValid(fecha) {
        if (!fecha) return false;
        
        const fechaRequerida = new Date(fecha);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        fechaRequerida.setHours(0, 0, 0, 0);
        
        return fechaRequerida > hoy;
    },

    /**
     * Actualizar icono de validación
     */
    updateValidationIcon(iconElement, isValid) {
        if (!iconElement) return;
        
        iconElement.className = isValid ? 
            'ri-check-circle-line ms-auto text-success' : 
            'ri-close-circle-line ms-auto text-danger';
    },

    /**
     * Actualizar estado del botón guardar
     */
    updateSaveButton() {
        const allValid = Object.values(this.config.validations).every(v => v);
        
        if (this.elements.saveButton) {
            this.elements.saveButton.disabled = !allValid;
            
            if (allValid) {
                this.elements.saveButton.classList.remove('btn-outline-primary');
                this.elements.saveButton.classList.add('btn-primary');
            } else {
                this.elements.saveButton.classList.remove('btn-primary');
                this.elements.saveButton.classList.add('btn-outline-primary');
            }
        }
    },

    /**
     * Obtener errores de validación
     */
    getValidationErrors() {
        const errors = [];
        
        if (!this.config.validations.fecha) {
            errors.push('La fecha requerida debe ser posterior a hoy');
        }
        
        if (!this.config.validations.productos) {
            errors.push('Debe seleccionar al menos un producto');
        }
        
        return errors;
    },

    /**
     * Verificar si el formulario es válido
     */
    isFormValid() {
        return Object.values(this.config.validations).every(v => v);
    },

    /**
     * Mostrar errores de validación
     */
    showValidationErrors() {
        const errors = this.getValidationErrors();
        
        if (errors.length > 0) {
            const errorList = errors.map(error => `• ${error}`).join('\n');
            
            Swal.fire({
                title: 'Errores de Validación',
                text: errorList,
                icon: 'warning',
                customClass: {
                    confirmButton: 'btn btn-warning'
                },
                buttonsStyling: false
            });
        }
        
        return errors.length === 0;
    },

    /**
     * Validar antes de enviar
     */
    validateBeforeSubmit() {
        this.validateAll();
        
        if (!this.isFormValid()) {
            this.showValidationErrors();
            return false;
        }
        
        return true;
    },

    /**
     * Validaciones específicas por campo
     */
    validators: {
        /**
         * Validar cantidad solicitada
         */
        cantidadSolicitada(cantidad) {
            if (cantidad <= 0) {
                return { valid: false, message: 'La cantidad debe ser mayor a 0' };
            }
            
            return { valid: true };
        },

        /**
         * Validar unidad de medida
         */
        unidadMedida(unidad) {
            if (!unidad || unidad.trim().length === 0) {
                return { valid: false, message: 'La unidad de medida es requerida' };
            }
            
            return { valid: true };
        },

        /**
         * Validar archivo adjunto
         */
        archivoAdjunto(archivo) {
            if (!archivo) return { valid: true };
            
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

            if (archivo.size > maxSize) {
                return { 
                    valid: false, 
                    message: 'El archivo no puede ser mayor a 10MB' 
                };
            }

            if (!allowedTypes.includes(archivo.type)) {
                return { 
                    valid: false, 
                    message: 'Formato de archivo no permitido' 
                };
            }

            return { valid: true };
        }
    },

    /**
     * Validar campo específico
     */
    validateField(fieldName, value, ...extraParams) {
        const validator = this.validators[fieldName];
        
        if (validator && typeof validator === 'function') {
            return validator(value, ...extraParams);
        }
        
        return { valid: true };
    },

    /**
     * Mostrar tooltip de validación
     */
    showFieldTooltip(element, message, type = 'error') {
        if (!element) return;
        
        // Remover tooltip anterior si existe
        this.hideFieldTooltip(element);
        
        // Crear tooltip
        const tooltip = document.createElement('div');
        tooltip.className = `validation-tooltip ${type}`;
        tooltip.textContent = message;
        tooltip.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            background: ${type === 'error' ? '#dc3545' : '#28a745'};
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            margin-top: 2px;
        `;
        
        // Posicionar relativamente
        element.style.position = 'relative';
        element.appendChild(tooltip);
        
        // Auto-remover después de 3 segundos
        setTimeout(() => {
            this.hideFieldTooltip(element);
        }, 3000);
    },

    /**
     * Ocultar tooltip de validación
     */
    hideFieldTooltip(element) {
        if (!element) return;
        
        const tooltip = element.querySelector('.validation-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    },

    /**
     * Resetear validaciones
     */
    reset() {
        this.config.validations = {
            fecha: false,
            productos: false
        };
        
        this.updateValidationIcon(this.elements.fechaIcon, false);
        this.updateValidationIcon(this.elements.productosIcon, false);
        
        this.updateSaveButton();
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Esperar a que los otros módulos se inicialicen
    setTimeout(() => {
        RequirementsAddValidation.init();
    }, 100);
});

// Hacer disponible globalmente
window.RequirementsAddValidation = RequirementsAddValidation;