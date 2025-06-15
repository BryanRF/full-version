/**
 * Cotización Create Module
 * Maneja la creación de cotizaciones desde requerimientos
 */

'use strict';

const CotizacionCreate = {
    // Configuración
    config: {
        csrfToken: null,
        requirementId: null,
        selectedSuppliers: new Set(),
        allSuppliers: []
    },

    // Elementos del DOM
    elements: {
        form: null,
        requirementId: null,
        fechaRespuesta: null,
        notasEnvio: null,
        enviarButton: null,
        suppliersTable: null,
        suppliersTableBody: null,
        selectAllCheckbox: null,
        searchInput: null,
        categoryFilter: null,
        loadingOverlay: null
    },

    /**
     * Inicializar el módulo
     */
    init() {
        this.config.csrfToken = this.getCookie('csrftoken');
        this.initializeElements();
        this.setupEventHandlers();
        this.setDefaultValues();
        this.loadSuppliers();
        console.log('Cotización Create initialized');
    },

    /**
     * Inicializar elementos del DOM
     */
    initializeElements() {
        this.elements.form = document.getElementById('cotizacionForm');
        this.elements.requirementId = document.getElementById('requirementId');
        this.elements.fechaRespuesta = document.getElementById('fechaRespuestaEsperada');
        this.elements.notasEnvio = document.getElementById('notasEnvio');
        this.elements.enviarButton = document.getElementById('enviarCotizacion');
        this.elements.suppliersTable = document.getElementById('suppliersTable');
        this.elements.suppliersTableBody = document.getElementById('suppliersTableBody');
        this.elements.selectAllCheckbox = document.getElementById('selectAllCheckbox');
        this.elements.searchInput = document.getElementById('searchSupplier');
        this.elements.categoryFilter = document.getElementById('filterSupplierCategory');
        this.elements.loadingOverlay = document.getElementById('loadingOverlay');

        // Obtener ID del requerimiento
        this.config.requirementId = this.elements.requirementId?.value;

        // Inicializar Flatpickr para fecha
        if (this.elements.fechaRespuesta && typeof flatpickr !== 'undefined') {
            flatpickr(this.elements.fechaRespuesta, {
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
        // Enviar cotización
        if (this.elements.enviarButton) {
            this.elements.enviarButton.addEventListener('click', () => {
                this.enviarCotizacion();
            });
        }

        // Seleccionar todos los proveedores
        if (this.elements.selectAllCheckbox) {
            this.elements.selectAllCheckbox.addEventListener('change', (e) => {
                this.toggleSelectAll(e.target.checked);
            });
        }

        // Botón seleccionar todos
        const selectAllButton = document.getElementById('selectAllSuppliers');
        if (selectAllButton) {
            selectAllButton.addEventListener('click', () => {
                const allChecked = this.elements.selectAllCheckbox.checked;
                this.toggleSelectAll(!allChecked);
            });
        }

        // Búsqueda y filtros
        if (this.elements.searchInput) {
            let searchTimeout;
            this.elements.searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.applyFilters();
                }, 300);
            });
        }

        if (this.elements.categoryFilter) {
            this.elements.categoryFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        // Validaciones en tiempo real
        if (this.elements.fechaRespuesta) {
            this.elements.fechaRespuesta.addEventListener('change', () => {
                this.validateForm();
            });
        }

        // Botones de archivos
        document.getElementById('previewPDF')?.addEventListener('click', () => {
            this.previewPDF();
        });

        document.getElementById('downloadExcel')?.addEventListener('click', () => {
            this.downloadExcel();
        });

        document.getElementById('downloadPDF')?.addEventListener('click', () => {
            this.downloadPDF();
        });
    },

    /**
     * Establecer valores por defecto
     */
    setDefaultValues() {
        // Fecha por defecto: 7 días desde hoy
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 7);
        if (this.elements.fechaRespuesta) {
            this.elements.fechaRespuesta.value = defaultDate.toISOString().split('T')[0];
        }

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
     * Cargar proveedores
     */
    async loadSuppliers() {
        try {
            const response = await fetch('/api/suppliers/data/');
            if (response.ok) {
                const data = await response.json();
                this.config.allSuppliers = data.data || [];
                this.renderSuppliersTable();
            }
        } catch (error) {
            console.error('Error loading suppliers:', error);
            toastr.error('Error al cargar proveedores');
        }
    },

    /**
     * Renderizar tabla de proveedores
     */
    renderSuppliersTable() {
        if (!this.elements.suppliersTableBody) return;

        // Aplicar filtros primero
        const filteredSuppliers = this.getFilteredSuppliers();

        // Limpiar tabla
        this.elements.suppliersTableBody.innerHTML = '';

        if (filteredSuppliers.length === 0) {
            this.elements.suppliersTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <i class="ri-search-line ri-48px mb-2 d-block text-muted"></i>
                        No se encontraron proveedores
                    </td>
                </tr>
            `;
            return;
        }

        // Renderizar proveedores
        filteredSuppliers.forEach(supplier => {
            const row = this.createSupplierRow(supplier);
            this.elements.suppliersTableBody.appendChild(row);
        });

        this.updateSelectAllState();
        this.updateSummary();
    },

    /**
     * Obtener proveedores filtrados
     */
    getFilteredSuppliers() {
        let filtered = [...this.config.allSuppliers];

        // Solo proveedores activos
        filtered = filtered.filter(supplier => supplier.is_active);

        // Filtro por categoría
        const categoryFilter = this.elements.categoryFilter?.value;
        if (categoryFilter) {
            filtered = filtered.filter(supplier => supplier.category === categoryFilter);
        }

        // Filtro por búsqueda
        const searchTerm = this.elements.searchInput?.value?.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(supplier => 
                supplier.company_name?.toLowerCase().includes(searchTerm) ||
                supplier.contact_person?.toLowerCase().includes(searchTerm) ||
                supplier.email?.toLowerCase().includes(searchTerm)
            );
        }

        return filtered;
    },

    /**
     * Crear fila de proveedor
     */
    createSupplierRow(supplier) {
        const row = document.createElement('tr');
        const hasEmail = supplier.email && supplier.email.trim();
        const metodoEnvio = hasEmail ? 'Email Automático' : 'Manual (Teléfono)';
        const metodoIcon = hasEmail ? '📧' : '📞';
        
        row.innerHTML = `
            <td>
                <input type="checkbox" class="form-check-input supplier-checkbox" 
                       data-supplier-id="${supplier.id}" 
                       ${this.config.selectedSuppliers.has(supplier.id) ? 'checked' : ''}>
            </td>
            <td>
                <div class="d-flex align-items-center">
                    ${supplier.logo ? 
                        `<img src="/media/${supplier.logo}" alt="${supplier.company_name}" 
                              class="rounded me-2" style="width: 30px; height: 30px; object-fit: cover;">` : 
                        `<div class="avatar avatar-sm me-2">
                            <span class="avatar-initial rounded bg-label-secondary">${supplier.company_name.charAt(0)}</span>
                        </div>`
                    }
                    <div>
                        <div class="fw-medium">${supplier.company_name}</div>
                        <small class="text-muted">${supplier.category_display || supplier.category}</small>
                    </div>
                </div>
            </td>
            <td>
                <div>
                    <div class="fw-medium">${supplier.contact_person}</div>
                    <small class="text-muted">${hasEmail ? supplier.email : supplier.phone_primary || 'Sin teléfono'}</small>
                </div>
            </td>
            <td>
                <span class="badge ${hasEmail ? 'bg-label-success' : 'bg-label-warning'}">
                    ${metodoIcon} ${metodoEnvio}
                </span>
            </td>
            <td class="text-center">
                <div class="d-flex align-items-center justify-content-center">
                    ${'⭐'.repeat(supplier.rating || 1)}
                </div>
            </td>
            <td class="text-center">
                <span class="badge ${supplier.is_preferred ? 'bg-label-success' : 'bg-label-info'}">
                    ${supplier.is_preferred ? '💎 Preferido' : 'Activo'}
                </span>
            </td>
        `;

        // Event listener para checkbox
        const checkbox = row.querySelector('.supplier-checkbox');
        checkbox.addEventListener('change', (e) => {
            this.toggleSupplierSelection(supplier.id, e.target.checked);
        });

        return row;
    },

    /**
     * Toggle selección de proveedor
     */
    toggleSupplierSelection(supplierId, selected) {
        if (selected) {
            this.config.selectedSuppliers.add(supplierId);
        } else {
            this.config.selectedSuppliers.delete(supplierId);
        }

        this.updateSelectAllState();
        this.updateSummary();
        this.validateForm();
    },

    /**
     * Toggle seleccionar todos
     */
    toggleSelectAll(selectAll) {
        const filteredSuppliers = this.getFilteredSuppliers();
        const checkboxes = document.querySelectorAll('.supplier-checkbox');
        
        checkboxes.forEach(checkbox => {
            const supplierId = parseInt(checkbox.dataset.supplierId);
            const supplier = filteredSuppliers.find(s => s.id === supplierId);
            
            if (supplier) {
                checkbox.checked = selectAll;
                this.toggleSupplierSelection(supplierId, selectAll);
            }
        });

        this.elements.selectAllCheckbox.checked = selectAll;
    },

    /**
     * Actualizar estado de seleccionar todos
     */
    updateSelectAllState() {
        if (!this.elements.selectAllCheckbox) return;

        const checkboxes = document.querySelectorAll('.supplier-checkbox');
        const checkedBoxes = document.querySelectorAll('.supplier-checkbox:checked');
        
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
     * Actualizar resumen
     */
    updateSummary() {
        const selectedCount = this.config.selectedSuppliers.size;
        const selectedSuppliers = this.config.allSuppliers.filter(s => 
            this.config.selectedSuppliers.has(s.id)
        );
        
        const withEmail = selectedSuppliers.filter(s => s.email && s.email.trim()).length;
        const manual = selectedCount - withEmail;

        // Actualizar elementos
        document.getElementById('selectedSuppliersCount').textContent = selectedCount;
        document.getElementById('suppliersWithEmail').textContent = withEmail;
        document.getElementById('suppliersManual').textContent = manual;
    },

    /**
     * Aplicar filtros
     */
    applyFilters() {
        this.renderSuppliersTable();
    },

    /**
     * Validar formulario
     */
    validateForm() {
        const fecha = this.elements.fechaRespuesta?.value;
        const hasSuppliers = this.config.selectedSuppliers.size > 0;
        
        // Validar fecha
        const fechaValid = fecha && new Date(fecha) > new Date();
        this.updateValidationIcon('fechaIcon', fechaValid);
        
        // Validar proveedores
        this.updateValidationIcon('proveedoresIcon', hasSuppliers);
        
        // Actualizar botón
        const isValid = fechaValid && hasSuppliers;
        if (this.elements.enviarButton) {
            this.elements.enviarButton.disabled = !isValid;
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
     * Enviar cotización
     */
    async enviarCotizacion() {
        if (!this.validateForm()) {
            toastr.error('Por favor complete todos los campos requeridos');
            return;
        }

        const formData = {
            requirement_id: parseInt(this.config.requirementId),
            supplier_ids: Array.from(this.config.selectedSuppliers),
            fecha_respuesta_esperada: this.elements.fechaRespuesta.value,
            notas_envio: this.elements.notasEnvio.value
        };

        this.showLoading(true);

        try {
            const response = await fetch('/api/cotizacion/envios/envio_masivo/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.config.csrfToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const result = await response.json();
                this.showSuccess(result);
            } else {
                const error = await response.json();
                this.showError(error);
            }
        } catch (error) {
            console.error('Error sending cotizacion:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Mostrar loading
     */
    showLoading(show) {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.toggle('d-none', !show);
        }

        if (this.elements.enviarButton) {
            this.elements.enviarButton.disabled = show;
            this.elements.enviarButton.innerHTML = show 
                ? '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...'
                : 'Enviar Cotización';
        }
    },

    /**
     * Mostrar éxito
     */
    showSuccess(result) {
        const { result: envioResult } = result;
        
        Swal.fire({
            title: '¡Cotizaciones Enviadas!',
            html: `
                <div class="text-start">
                    <p><strong>Enviados exitosamente:</strong> ${envioResult.total_enviados}</p>
                    <p><strong>Errores:</strong> ${envioResult.total_errores}</p>
                    ${envioResult.enviados.length > 0 ? `
                        <div class="mt-3">
                            <strong>Proveedores contactados:</strong>
                            <ul class="list-unstyled">
                                ${envioResult.enviados.map(e => `
                                    <li class="text-${e.status === 'sent' ? 'success' : 'warning'}">
                                        ${e.supplier} (${e.method})
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `,
            icon: 'success',
            confirmButtonText: 'Ver Cotizaciones',
            showCancelButton: true,
            cancelButtonText: 'Cerrar',
            customClass: {
                confirmButton: 'btn btn-primary me-2',
                cancelButton: 'btn btn-outline-secondary'
            },
            buttonsStyling: false
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = '/app/cotizacion/list/';
            } else {
                // Opcional: regresar a requerimientos
                // window.location.href = '/app/requirements/list/';
            }
        });
    },

    /**
     * Mostrar error
     */
    showError(error) {
    let message = 'Error al enviar cotizaciones';

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
     * Vista previa PDF
     */
    previewPDF() {
        const url = `/api/requirements/${this.config.requirementId}/view_pdf/`;
        document.getElementById('pdfFrame').src = url;
        const modal = new bootstrap.Modal(document.getElementById('pdfPreviewModal'));
        modal.show();
      

    },

    /**
     * Descargar Excel
     */
    downloadExcel() {
        window.open(`/api/requirements/${this.config.requirementId}/export_excel/`, '_blank');
    },

    /**
     * Descargar PDF
     */
    downloadPDF() {
        window.open(`/api/requirements/${this.config.requirementId}/export_pdf/`, '_blank');
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    CotizacionCreate.init();
});

// Hacer disponible globalmente
window.CotizacionCreate = CotizacionCreate;