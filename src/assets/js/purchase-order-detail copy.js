/**
 * Purchase Order Detail Module
 * Gestión completa de detalles de órdenes de compra
 */

'use strict';

const PurchaseOrderDetail = {
    // Configuración del módulo
    config: {
        csrfToken: null,
        purchaseOrderId: null,
        currentPO: null,
        apiUrls: {
            purchaseOrderDetail: '/purchasing/purchase-orders/{id}/',
            receiveItems: '/purchasing/purchase-orders/{id}/receive-items/',
            quickReceive: '/purchasing/purchase-orders/{id}/quick-receive/',
            updateStatus: '/purchasing/purchase-orders/{id}/update-status/',
            exportPdf: '/purchasing/purchase-orders/{id}/export/pdf/',
            analytics: '/purchasing/purchase-orders/{id}/analytics/'
        },
        statusConfigs: {
            'draft': { color: 'secondary', text: 'Borrador', icon: 'ri-draft-line' },
            'sent': { color: 'info', text: 'Enviada', icon: 'ri-send-plane-line' },
            'confirmed': { color: 'primary', text: 'Confirmada', icon: 'ri-check-line' },
            'partially_received': { color: 'warning', text: 'Parcial', icon: 'ri-truck-line' },
            'completed': { color: 'success', text: 'Completada', icon: 'ri-check-double-line' },
            'cancelled': { color: 'danger', text: 'Cancelada', icon: 'ri-close-circle-line' }
        }
    },

    // Referencias a elementos del DOM
    elements: {
        // Info básica
        poNumber: null,
        orderDate: null,
        expectedDelivery: null,
        createdBy: null,
        supplierCompany: null,
        supplierContactPerson: null,
        supplierEmail: null,
        supplierPhone: null,
        orderNotes: null,
        notesSection: null,
        
        // Tabla de items
        itemsTableBody: null,
        receiveItemsBtn: null,
        
        // Resumen
        priority: null,
        paymentTerms: null,
        currentStatus: null,
        createdAt: null,
        subtotalAmount: null,
        taxAmount: null,
        totalAmountSidebar: null,
        
        // Modal de recepción
        receiveItemsModal: null,
        receiveItemsList: null,
        confirmReceiveBtn: null,
        
        // Loading
        loadingOverlay: null,
        loadingText: null
    },

    /**
     * Inicializar el módulo
     */
    init() {
        this.config.csrfToken = this.getCookie('csrftoken');
        this.config.purchaseOrderId = this.getPurchaseOrderId();
        
        if (!this.config.purchaseOrderId) {
            console.error('No se encontró el ID de la orden de compra');
            return;
        }

        this.initializeElements();
        this.bindEvents();
        this.loadPurchaseOrderDetails();
        
        
    },

    /**
     * Obtener token CSRF
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
     * Obtener ID de la orden desde la URL
     */
    getPurchaseOrderId() {
        const pathParts = window.location.pathname.split('/');
        const idIndex = pathParts.indexOf('detail') + 1;
        return pathParts[idIndex] || null;
    },

    /**
     * Inicializar elementos del DOM
     */
    initializeElements() {
        // Info básica
        this.elements.poNumber = document.getElementById('poNumber');
        this.elements.orderDate = document.getElementById('orderDate');
        this.elements.expectedDelivery = document.getElementById('expectedDelivery');
        this.elements.createdBy = document.getElementById('createdBy');
        this.elements.supplierCompany = document.getElementById('supplierCompany');
        this.elements.supplierContactPerson = document.getElementById('supplierContactPerson');
        this.elements.supplierEmail = document.getElementById('supplierEmail');
        this.elements.supplierPhone = document.getElementById('supplierPhone');
        this.elements.orderNotes = document.getElementById('orderNotes');
        this.elements.notesSection = document.getElementById('notesSection');
        
        // Tabla de items
        this.elements.itemsTableBody = document.getElementById('itemsTableBody');
        this.elements.receiveItemsBtn = document.getElementById('receiveItemsBtn');
        
        // Resumen
        this.elements.priority = document.getElementById('priority');
        this.elements.paymentTerms = document.getElementById('paymentTerms');
        this.elements.currentStatus = document.getElementById('currentStatus');
        this.elements.createdAt = document.getElementById('createdAt');
        this.elements.subtotalAmount = document.getElementById('subtotalAmount');
        this.elements.taxAmount = document.getElementById('taxAmount');
        this.elements.totalAmountSidebar = document.getElementById('totalAmountSidebar');
        
        // Modal de recepción
        this.elements.receiveItemsModal = new bootstrap.Modal(document.getElementById('receiveItemsModal'));
        this.elements.receiveItemsList = document.getElementById('receiveItemsList');
        this.elements.confirmReceiveBtn = document.getElementById('confirmReceiveBtn');
        
        // Loading
        this.elements.loadingOverlay = document.getElementById('loadingOverlay');
        this.elements.loadingText = document.getElementById('loadingText');
    },

    /**
     * Vincular eventos
     */
    bindEvents() {
        // Botón de recibir items
        if (this.elements.receiveItemsBtn) {
            this.elements.receiveItemsBtn.addEventListener('click', () => {
                this.showReceiveItemsModal();
            });
        }

        // Confirmar recepción
        if (this.elements.confirmReceiveBtn) {
            this.elements.confirmReceiveBtn.addEventListener('click', () => {
                this.handleReceiveItems();
            });
        }

        // Teclas de acceso rápido
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'r':
                        e.preventDefault();
                        this.loadPurchaseOrderDetails();
                        break;
                    case 'p':
                        e.preventDefault();
                        this.exportToPdf();
                        break;
                }
            }
        });
    },

    /**
     * Cargar detalles de la orden
     */
    async loadPurchaseOrderDetails() {
        this.showLoading('Cargando orden de compra...');

        try {
            const response = await fetch(
                this.config.apiUrls.purchaseOrderDetail.replace('{id}', this.config.purchaseOrderId),
                {
                    headers: {
                        'X-CSRFToken': this.config.csrfToken,
                        'Accept': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.config.currentPO = data;
            this.renderPurchaseOrderDetails(data);
            this.updateActionButtons(data);

        } catch (error) {
            console.error('Error loading purchase order:', error);
            this.showError('Error al cargar la orden de compra');
        } finally {
            this.hideLoading();
        }
    },

    /**
     * Renderizar detalles de la orden
     */
    renderPurchaseOrderDetails(po) {
    // Información básica
    this.elements.poNumber.textContent = po.po_number;
    this.elements.orderDate.textContent = this.formatDate(po.order_date);
    this.elements.expectedDelivery.textContent = this.formatDate(po.expected_delivery);
    this.elements.createdBy.textContent = po.created_by_name || 'Sistema';

    // Información del proveedor - CORREGIDO
    // Verifica si supplier es un objeto o solo el ID
    if (typeof po.supplier === 'object' && po.supplier !== null) {
        // Si supplier es un objeto anidado
        this.elements.supplierCompany.textContent = po.supplier.company_name || po.supplier.name || '-';
        this.elements.supplierContactPerson.textContent = po.supplier.contact_person || '-';
        this.elements.supplierEmail.textContent = po.supplier.email || '-';
        this.elements.supplierPhone.textContent = po.supplier.phone_primary || po.supplier.phone || '-';
    } else {
        // Si supplier viene como campos separados (tu caso actual)
        this.elements.supplierCompany.textContent = po.supplier_name || '-';
        this.elements.supplierContactPerson.textContent = po.supplier_contact || '-';
        this.elements.supplierEmail.textContent = po.supplier_email || '-';
        this.elements.supplierPhone.textContent = po.supplier_phone || '-';
    }

    // Notas
    if (po.notes) {
        this.elements.orderNotes.textContent = po.notes;
        this.elements.notesSection.style.display = 'block';
    }

    // Resumen
    this.elements.priority.innerHTML = this.getPriorityBadge(po.priority || 'medium');
    this.elements.paymentTerms.textContent = po.payment_terms_display || '-';
    this.elements.currentStatus.innerHTML = this.getStatusBadge(po.status);
    this.elements.createdAt.textContent = this.formatDateTime(po.created_at);

    // Totales
    this.elements.subtotalAmount.textContent = `S/.${this.formatNumber(po.subtotal)}`;
    this.elements.taxAmount.textContent = `S/.${this.formatNumber(po.tax_amount)}`;
    this.elements.totalAmountSidebar.textContent = `S/.${this.formatNumber(po.total_amount)}`;

    // Renderizar items
    this.renderItems(po.items);
},

    /**
     * Renderizar items de la orden
     */
    renderItems(items) {
    if (!items || items.length === 0) {
        this.elements.itemsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <p class="mb-0 text-muted">No hay productos en esta orden</p>
                </td>
            </tr>
        `;
        return;
    }

    const rows = items.map(item => {
        const pendingQty = item.pending_quantity || (item.quantity_ordered - item.quantity_received);
        const isComplete = pendingQty === 0;
        const statusBadge = isComplete 
            ? '<span class="badge bg-success">Completo</span>'
            : `<span class="badge bg-warning">Pendiente: ${pendingQty}</span>`;

        // Manejo seguro de product - puede venir como objeto o como campos separados
        const productCode = item.product_code || (item.product && item.product.code) || '-';
        const productName = item.product_name || (item.product && item.product.name) || 'Sin nombre';

        return `
            <tr data-item-id="${item.id}" class="${isComplete ? 'table-success' : ''}">
                <td>${productCode}</td>
                <td>
                    <div>
                        <strong>${productName}</strong>
                        ${item.notes ? `<br><small class="text-muted">${item.notes}</small>` : ''}
                    </div>
                </td>
                <td class="text-center">${item.quantity_ordered}</td>
                <td class="text-center">
                    <span class="text-${isComplete ? 'success' : 'warning'}">
                        ${item.quantity_received}
                    </span>
                </td>
                <td class="text-end">S/.${this.formatNumber(item.unit_price)}</td>
                <td class="text-end">S/.${this.formatNumber(item.line_total)}</td>
                <td class="text-center">${statusBadge}</td>
            </tr>
        `;
    }).join('');

    this.elements.itemsTableBody.innerHTML = rows;
},

    /**
     * Actualizar botones de acción según el estado
     */
    updateActionButtons(po) {
        const canReceive = ['sent', 'confirmed', 'partially_received'].includes(po.status);
        
        if (this.elements.receiveItemsBtn) {
            this.elements.receiveItemsBtn.style.display = canReceive ? 'block' : 'none';
        }
    },

    /**
     * Mostrar modal de recepción de items
     */
    showReceiveItemsModal() {
        if (!this.config.currentPO) {
            this.showError('No hay datos de la orden cargados');
            return;
        }

        const pendingItems = this.config.currentPO.items.filter(item => 
            item.quantity_ordered > item.quantity_received
        );

        if (pendingItems.length === 0) {
            this.showWarning('No hay items pendientes de recepción');
            return;
        }

        this.renderReceiveItemsForm(pendingItems);
        this.elements.receiveItemsModal.show();
    },

    /**
     * Renderizar formulario de recepción
     */
    renderReceiveItemsForm(items) {
         console.log('Rendering receive items form with items:', items);
    const html = items.map(item => {
        const pendingQty = item.pending_quantity || (item.quantity_ordered - item.quantity_received);
        const productName = item.product_name || (item.product && item.product.name) || 'Sin nombre';
        const productCode = item.product_code || (item.product && item.product.code) || '-';
        
        return `
            <div class="card mb-3" data-item-id="${item.id}">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-6">
                            <h6 class="mb-1">${productName}</h6>
                            <small class="text-muted">
                                Código: ${productCode} | 
                                Ordenado: ${item.quantity_ordered} | 
                                Recibido: ${item.quantity_received} | 
                                Pendiente: ${pendingQty}
                            </small>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label">Cantidad a recibir</label>
                            <input type="number" 
                                   class="form-control receive-qty" 
                                   min="0" 
                                   max="${pendingQty}" 
                                   value="${pendingQty}"
                                   data-item-id="${item.id}">
                        </div>
                        <div class="col-md-3">
                            <div class="form-check mt-4">
                                <input class="form-check-input receive-check" 
                                       type="checkbox" 
                                       checked
                                       data-item-id="${item.id}">
                                <label class="form-check-label">
                                    Recibir
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="row mt-2">
                        <div class="col-12">
                            <label class="form-label">Notas de recepción (opcional)</label>
                            <input type="text" 
                                   class="form-control receive-notes" 
                                   placeholder="Ej: Llegó en buen estado"
                                   data-item-id="${item.id}">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    this.elements.receiveItemsList.innerHTML = html;

    // Vincular eventos a los checkboxes
    document.querySelectorAll('.receive-check').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const itemId = e.target.dataset.itemId;
            const qtyInput = document.querySelector(`.receive-qty[data-item-id="${itemId}"]`);
            const notesInput = document.querySelector(`.receive-notes[data-item-id="${itemId}"]`);
            
            qtyInput.disabled = !e.target.checked;
            notesInput.disabled = !e.target.checked;
            
            if (!e.target.checked) {
                qtyInput.value = 0;
            }
        });
    });
},

    /**
     * Manejar recepción de items
     */
    async handleReceiveItems() {
        const items = [];
        let hasValidItems = false;

        // Recolectar datos del formulario
        document.querySelectorAll('.receive-check:checked').forEach(checkbox => {
            const itemId = checkbox.dataset.itemId;
            const qtyInput = document.querySelector(`.receive-qty[data-item-id="${itemId}"]`);
            const notesInput = document.querySelector(`.receive-notes[data-item-id="${itemId}"]`);
            
            const quantity = parseInt(qtyInput.value) || 0;
            
            if (quantity > 0) {
                hasValidItems = true;
                items.push({
                    item_id: parseInt(itemId),
                    quantity_received: quantity,
                    reception_notes: notesInput.value.trim()
                });
            }
        });

        if (!hasValidItems) {
            this.showWarning('Debe recibir al menos un item con cantidad mayor a 0');
            return;
        }

        // Confirmar acción
        const result = await Swal.fire({
            title: '¿Confirmar recepción?',
            html: `Se recibirán ${items.length} item(s).<br>Esta acción actualizará el inventario.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, recibir',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33'
        });

        if (!result.isConfirmed) {
            return;
        }

        // Enviar recepción
        this.processReceiveItems(items);
    },

    /**
     * Procesar recepción de items
     */
    async processReceiveItems(items) {
        this.showLoading('Procesando recepción...');
        this.elements.receiveItemsModal.hide();

        try {
            const response = await fetch(
                this.config.apiUrls.receiveItems.replace('{id}', this.config.purchaseOrderId),
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.config.csrfToken,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        items: items,
                        update_inventory: true,
                        general_notes: `Recepción realizada el ${new Date().toLocaleString()}`
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al procesar la recepción');
            }

            // Mostrar resultado
            await Swal.fire({
                title: '¡Recepción exitosa!',
                html: `
                    <p>Se recibieron ${data.items_received} item(s)</p>
                    <p>Cantidad total: ${data.total_quantity} unidades</p>
                    <p>Nuevo estado: <span class="badge bg-${this.getStatusColor(data.new_status)}">${this.getStatusText(data.new_status)}</span></p>
                `,
                icon: 'success',
                confirmButtonText: 'Aceptar'
            });

            // Recargar detalles
            this.loadPurchaseOrderDetails();

        } catch (error) {
            console.error('Error processing reception:', error);
            this.showError(error.message || 'Error al procesar la recepción');
        } finally {
            this.hideLoading();
        }
    },

    /**
     * Exportar a PDF
     */
    async exportToPdf() {
        try {
            window.open(
                this.config.apiUrls.exportPdf.replace('{id}', this.config.purchaseOrderId),
                '_blank'
            );
        } catch (error) {
            console.error('Error exporting PDF:', error);
            this.showError('Error al exportar el PDF');
        }
    },

    /**
     * Obtener badge de prioridad
     */
    getPriorityBadge(priority) {
        const configs = {
            'low': { color: 'secondary', text: 'Baja' },
            'medium': { color: 'primary', text: 'Media' },
            'high': { color: 'warning', text: 'Alta' },
            'urgent': { color: 'danger', text: 'Urgente' }
        };

        const config = configs[priority] || configs['medium'];
        return `<span class="badge bg-${config.color}">${config.text}</span>`;
    },

    /**
     * Obtener badge de estado
     */
    getStatusBadge(status) {
        const config = this.config.statusConfigs[status] || this.config.statusConfigs['draft'];
        return `<span class="badge bg-${config.color}">
            <i class="${config.icon} me-1"></i>${config.text}
        </span>`;
    },

    /**
     * Obtener color del estado
     */
    getStatusColor(status) {
        return this.config.statusConfigs[status]?.color || 'secondary';
    },

    /**
     * Obtener texto del estado
     */
    getStatusText(status) {
        return this.config.statusConfigs[status]?.text || status;
    },

    /**
     * Formatear fecha
     */
    formatDate(dateString) {
        if (!dateString) return '-';
        const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
        return new Date(dateString).toLocaleDateString('es-PE', options);
    },

    /**
     * Formatear fecha y hora
     */
    formatDateTime(dateString) {
        if (!dateString) return '-';
        const options = { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(dateString).toLocaleDateString('es-PE', options);
    },

    /**
     * Formatear número
     */
    formatNumber(number) {
        return parseFloat(number || 0).toFixed(2);
    },

    /**
     * Mostrar loading
     */
    showLoading(message = 'Cargando...') {
        if (this.elements.loadingText) {
            this.elements.loadingText.textContent = message;
        }
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.remove('d-none');
        }
    },

    /**
     * Ocultar loading
     */
    hideLoading() {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.add('d-none');
        }
    },

    /**
     * Mostrar mensaje de éxito
     */
    showSuccess(message) {
        Swal.fire({
            icon: 'success',
            title: '¡Éxito!',
            text: message,
            timer: 3000,
            showConfirmButton: false
        });
    },

    /**
     * Mostrar mensaje de error
     */
    showError(message) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: message
        });
    },

    /**
     * Mostrar mensaje de advertencia
     */
    showWarning(message) {
        Swal.fire({
            icon: 'warning',
            title: 'Atención',
            text: message
        });
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    PurchaseOrderDetail.init();
});