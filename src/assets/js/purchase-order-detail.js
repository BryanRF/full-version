/**
 * Purchase Order Detail - Data Module
 * Módulo para consumir y renderizar información de órdenes de compra
 * Siguiendo la estructura y patrones del proyecto
 */

'use strict';

const PurchaseOrderDetailData = {
    // Configuración del módulo
    config: {
        csrfToken: null,
        purchaseOrderId: null,
        currentPO: null,
        apiUrls: {
            purchaseOrderDetail: '/purchasing/purchase-orders/{id}/',
            history: '/purchasing/purchase-orders/{id}/history/',
            analytics: '/purchasing/purchase-orders/{id}/analytics/'
        },
        statusConfigs: {
            'draft': { color: 'secondary', text: 'Borrador', icon: '📝' },
            'sent': { color: 'info', text: 'Enviada', icon: '📤' },
            'confirmed': { color: 'primary', text: 'Confirmada', icon: '✅' },
            'partially_received': { color: 'warning', text: 'Parcialmente Recibida', icon: '📦' },
            'completed': { color: 'success', text: 'Completada', icon: '🎉' },
            'cancelled': { color: 'danger', text: 'Cancelada', icon: '❌' }
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
        
        // Encabezado
        supplierName: null,
        supplierContact: null,
        statusBadge: null,
        statusIcon: null,
        progressBadge: null,
        totalAmount: null,
        
        // Tabla de items
        itemsTableBody: null,
        
        // Resumen
        priority: null,
        paymentTerms: null,
        currentStatus: null,
        createdAt: null,
        subtotalAmount: null,
        taxAmount: null,
        totalAmountSidebar: null,
        
        // Loading
        loadingOverlay: null,
        loadingText: null,
        
        // Historial
        orderHistoryContainer: null
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
        this.loadPurchaseOrderDetails();
        this.setupAutoRefresh();
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
        
        // Encabezado
        this.elements.supplierName = document.getElementById('supplierName');
        this.elements.supplierContact = document.getElementById('supplierContact');
        this.elements.statusBadge = document.getElementById('statusBadge');
        this.elements.statusIcon = document.getElementById('statusIcon');
        this.elements.progressBadge = document.getElementById('progressBadge');
        this.elements.totalAmount = document.getElementById('totalAmount');
        
        // Tabla de items
        this.elements.itemsTableBody = document.getElementById('itemsTableBody');
        
        // Resumen
        this.elements.priority = document.getElementById('priority');
        this.elements.paymentTerms = document.getElementById('paymentTerms');
        this.elements.currentStatus = document.getElementById('currentStatus');
        this.elements.createdAt = document.getElementById('createdAt');
        this.elements.subtotalAmount = document.getElementById('subtotalAmount');
        this.elements.taxAmount = document.getElementById('taxAmount');
        this.elements.totalAmountSidebar = document.getElementById('totalAmountSidebar');
        
        // Loading
        this.elements.loadingOverlay = document.getElementById('loadingOverlay');
        this.elements.loadingText = document.getElementById('loadingText');
        
        // Historial
        this.elements.orderHistoryContainer = document.getElementById('orderHistoryContainer');
    },

    /**
     * Cargar detalles de la orden
     */
    async loadPurchaseOrderDetails() {
        this.showLoading('Cargando detalles...');

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
                if (response.status === 404) {
                    this.showNotFoundPage();
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.config.currentPO = data;
            console.log('PO Details loaded:', data);
            
            this.renderPODetails(data);

            // Notificar que los datos están cargados
            this.triggerDataLoadedEvent(data);

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
    renderPODetails(po) {
        // Verificaciones de seguridad
        if (!po) {
            console.error('No hay datos de la orden');
            return;
        }

        // Actualizar encabezado
        if (this.elements.poNumber) {
            this.elements.poNumber.textContent = po.po_number || 'Sin número';
        }

        // Información del proveedor y estado en el encabezado
        const statusConfig = this.getStatusConfig(po.status);
        
        if (this.elements.supplierName) {
            this.elements.supplierName.textContent = po.supplier_name || 'Sin proveedor';
        }
        if (this.elements.supplierContact) {
            this.elements.supplierContact.textContent = po.supplier_contact || '';
        }
        if (this.elements.statusBadge) {
            this.elements.statusBadge.className = `badge bg-label-${statusConfig.color}`;
            this.elements.statusBadge.textContent = statusConfig.text;
        }
        if (this.elements.statusIcon) {
            this.elements.statusIcon.textContent = statusConfig.icon;
        }

        // Progreso
        const progress = po.completion_percentage || 0;
        if (this.elements.progressBadge) {
            this.elements.progressBadge.textContent = `${progress}%`;
        }

        // Monto total en encabezado
        const totalAmount = parseFloat(po.total_amount || 0);
        if (this.elements.totalAmount) {
            this.elements.totalAmount.textContent = `S/.${totalAmount.toLocaleString('es-PE', {minimumFractionDigits: 2})}`;
        }

        // Información básica
        if (this.elements.orderDate) {
            this.elements.orderDate.textContent = this.formatDate(po.order_date);
        }
        if (this.elements.expectedDelivery) {
            this.elements.expectedDelivery.textContent = this.formatDate(po.expected_delivery);
        }
        if (this.elements.createdBy) {
            this.elements.createdBy.textContent = po.created_by_name || po.created_by_full_name || 'Sistema';
        }

        // Información del proveedor
        if (this.elements.supplierCompany) {
            this.elements.supplierCompany.textContent = po.supplier_name || '-';
        }
        if (this.elements.supplierContactPerson) {
            this.elements.supplierContactPerson.textContent = po.supplier_contact || '-';
        }
        if (this.elements.supplierEmail) {
            this.elements.supplierEmail.textContent = po.supplier_email || '-';
        }
        if (this.elements.supplierPhone) {
            this.elements.supplierPhone.textContent = po.supplier_phone || '-';
        }

        // Notas
        if (po.notes && po.notes.trim() && this.elements.orderNotes && this.elements.notesSection) {
            this.elements.orderNotes.textContent = po.notes;
            this.elements.notesSection.style.display = 'block';
        } else if (this.elements.notesSection) {
            this.elements.notesSection.style.display = 'none';
        }

        // Resumen
        if (this.elements.priority) {
            this.elements.priority.innerHTML = this.getPriorityBadge('normal'); // Default priority
        }
        if (this.elements.paymentTerms) {
            this.elements.paymentTerms.textContent = '-'; // No viene en el response
        }
        if (this.elements.currentStatus) {
            this.elements.currentStatus.innerHTML = this.getStatusBadge(po.status);
        }
        if (this.elements.createdAt) {
            this.elements.createdAt.textContent = this.formatDateTime(po.created_at);
        }

        // Totales
        const subtotal = parseFloat(po.subtotal || 0);
        const taxAmount = parseFloat(po.tax_amount || 0);

        if (this.elements.subtotalAmount) {
            this.elements.subtotalAmount.textContent = `S/.${this.formatNumber(subtotal)}`;
        }
        if (this.elements.taxAmount) {
            this.elements.taxAmount.textContent = `S/.${this.formatNumber(taxAmount)}`;
        }
        if (this.elements.totalAmountSidebar) {
            this.elements.totalAmountSidebar.textContent = `S/.${this.formatNumber(totalAmount)}`;
        }

        // Renderizar items
        this.renderItems(po.items || []);

        // Renderizar estadísticas
        this.renderOrderStats(po);

        // Renderizar historial
        this.renderOrderHistory(po.history || []);
    },

    /**
     * Renderizar items de la orden
     */
    renderItems(items) {
        if (!items || items.length === 0) {
            if (this.elements.itemsTableBody) {
                this.elements.itemsTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center py-4">
                            <i class="ri-shopping-cart-line ri-48px text-muted mb-3"></i>
                            <p class="mb-0 text-muted">No hay productos en esta orden</p>
                        </td>
                    </tr>
                `;
            }
            return;
        }

        let totalSubtotal = 0;

        const rows = items.map(item => {
            const quantityOrdered = item.quantity_ordered || 0;
            const quantityReceived = item.quantity_received || 0;
            const pendingQty = item.pending_quantity || (quantityOrdered - quantityReceived);
            const isComplete = item.is_fully_received || pendingQty === 0;
            const unitPrice = parseFloat(item.unit_price || 0);
            const lineTotal = item.line_total || (quantityOrdered * unitPrice);

            totalSubtotal += lineTotal;

            const statusBadge = isComplete 
                ? '<span class="badge bg-label-success">Completo</span>'
                : `<span class="badge bg-label-warning">Pendiente: ${pendingQty}</span>`;

            // Información del producto
            const productCode = item.product_code || '-';
            const productName = item.product_name || 'Sin nombre';

            return `
                <tr data-item-id="${item.id}" class="${isComplete ? 'table-success' : ''}">
                    <td>${productCode}</td>
                    <td>
                        <div>
                            <strong>${productName}</strong>
                            ${item.notes ? `<br><small class="text-info">${item.notes}</small>` : ''}
                            ${item.product_description && item.product_description !== '<p><br></p>' ? 
                                `<br><small class="text-muted">${item.product_description.replace(/<[^>]*>/g, '')}</small>` : ''}
                        </div>
                    </td>
                    <td class="text-center">${quantityOrdered}</td>
                    <td class="text-center">
                        <span class="${isComplete ? 'text-success' : 'text-warning'}">
                            ${quantityReceived}
                        </span>
                    </td>
                    <td class="text-end">S/.${unitPrice.toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                    <td class="text-end">S/.${lineTotal.toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                    <td class="text-center">${statusBadge}</td>
                </tr>
            `;
        }).join('');

        if (this.elements.itemsTableBody) {
            this.elements.itemsTableBody.innerHTML = rows;
        }

        // Actualizar totales en el pie de tabla si existen elementos
        const tax = totalSubtotal * 0.18;
        const total = totalSubtotal + tax;

        const subtotalValue = document.getElementById('subtotalValue');
        const taxValue = document.getElementById('taxValue');
        const totalValue = document.getElementById('totalValue');

        if (subtotalValue) {
            subtotalValue.textContent = `S/.${totalSubtotal.toLocaleString('es-PE', {minimumFractionDigits: 2})}`;
        }
        if (taxValue) {
            taxValue.textContent = `S/.${tax.toLocaleString('es-PE', {minimumFractionDigits: 2})}`;
        }
        if (totalValue) {
            totalValue.textContent = `S/.${total.toLocaleString('es-PE', {minimumFractionDigits: 2})}`;
        }
    },

    /**
     * Renderizar estadísticas de la orden
     */
    renderOrderStats(po) {
        const items = po.items || [];
        const totalItems = po.total_items || items.length;
        const totalOrdered = items.reduce((sum, item) => sum + (item.quantity_ordered || 0), 0);
        const totalReceived = items.reduce((sum, item) => sum + (item.quantity_received || 0), 0);
        const totalPending = po.total_pending_quantity || (totalOrdered - totalReceived);
        const completionRate = po.completion_percentage || 0;

        // Actualizar contadores en el sidebar
        const totalItemsCount = document.getElementById('totalItemsCount');
        const pendingItemsCount = document.getElementById('pendingItemsCount');
        const completionPercentage = document.getElementById('completionPercentage');
        const progressBar = document.getElementById('progressBar');

        if (totalItemsCount) {
            totalItemsCount.textContent = totalItems;
        }
        if (pendingItemsCount) {
            pendingItemsCount.textContent = totalPending;
        }
        if (completionPercentage) {
            completionPercentage.textContent = `${completionRate}%`;
        }
        if (progressBar) {
            progressBar.style.width = `${completionRate}%`;
            
            // Cambiar color de la barra según el progreso
            progressBar.classList.remove('bg-danger', 'bg-warning', 'bg-success');
            if (completionRate === 100) {
                progressBar.classList.add('bg-success');
            } else if (completionRate >= 50) {
                progressBar.classList.add('bg-warning');
            } else {
                progressBar.classList.add('bg-danger');
            }
        }

        // Renderizar progreso de recepción si existe
        if (po.reception_progress && po.reception_progress.length > 0) {
            this.renderReceptionProgress(po.reception_progress);
        }
    },

    /**
     * Renderizar progreso de recepción
     */
    renderReceptionProgress(receptionProgress) {
        const container = document.getElementById('receptionProgressContainer');
        if (!container) return;

        const html = receptionProgress.map(progress => {
            const statusColor = progress.status === 'completed' ? 'success' : 
                               progress.status === 'partial' ? 'warning' : 'secondary';
            
            return `
                <div class="card mb-2">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <div>
                                <h6 class="mb-0">${progress.product_name}</h6>
                                <small class="text-muted">${progress.product_code}</small>
                            </div>
                            <span class="badge bg-label-${statusColor}">${progress.progress_percentage}%</span>
                        </div>
                        <div class="progress" style="height: 6px;">
                            <div class="progress-bar bg-${statusColor}" style="width: ${progress.progress_percentage}%"></div>
                        </div>
                        <div class="d-flex justify-content-between mt-2">
                            <small class="text-muted">Ordenado: ${progress.ordered}</small>
                            <small class="text-muted">Recibido: ${progress.received}</small>
                            <small class="text-muted">Pendiente: ${progress.pending}</small>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    },

    /**
     * Renderizar historial de la orden
     */
    renderOrderHistory(history) {
        if (!this.elements.orderHistoryContainer) return;

        if (!history || history.length === 0) {
            this.elements.orderHistoryContainer.innerHTML = `
                <div class="text-center py-4">
                    <i class="ri-history-line ri-48px text-muted mb-3"></i>
                    <p class="text-muted">No hay historial disponible</p>
                </div>
            `;
            return;
        }

        const historyHtml = history.map(item => {
            const actionIcon = this.getHistoryActionIcon(item.action);
            const actionColor = this.getHistoryActionColor(item.action);
            const timeAgo = this.getTimeAgo(item.timestamp);
            const fullDate = this.formatDateTime(item.timestamp);

            return `
                <div class="timeline-item">
                    <div class="timeline-point timeline-point-${actionColor}">
                        <i class="${actionIcon}"></i>
                    </div>
                    <div class="timeline-content">
                        <div class="d-flex justify-content-between align-items-start mb-1">
                            <h6 class="mb-0">${this.getHistoryActionTitle(item.action)}</h6>
                            <small class="text-muted" title="${fullDate}">${timeAgo}</small>
                        </div>
                        <p class="text-muted mb-2">${item.description}</p>
                        ${item.user ? `
                            <div class="d-flex align-items-center">
                                <div class="avatar avatar-xs me-2">
                                    <span class="avatar-initial rounded bg-label-primary">
                                        ${item.user.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <small class="text-muted">por ${item.user}</small>
                            </div>
                        ` : ''}
                        ${item.details ? `
                            <div class="mt-2">
                                <small class="text-info">${item.details}</small>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        this.elements.orderHistoryContainer.innerHTML = `
            <div class="timeline">
                ${historyHtml}
            </div>
        `;
    },

    /**
     * Configurar actualización automática
     */
    setupAutoRefresh() {
        // Actualizar cada 5 minutos si la página está visible
        setInterval(() => {
            if (document.visibilityState === 'visible' && this.config.currentPO) {
                // Solo actualizar si la orden no está completada o cancelada
                if (!['completed', 'cancelled'].includes(this.config.currentPO.status)) {
                    this.loadPurchaseOrderDetails();
                }
            }
        }, 300000); // 5 minutos
    },

    /**
     * Mostrar página de no encontrado
     */
    showNotFoundPage() {
        const container = document.getElementById('poDetailsContainer') || document.body;
        container.innerHTML = `
            <div class="col-12">
                <div class="card">
                    <div class="card-body text-center py-5">
                        <i class="ri-file-search-line ri-48px text-muted mb-3"></i>
                        <h5 class="text-muted">Orden de Compra No Encontrada</h5>
                        <p class="text-muted mb-4">La orden de compra solicitada no existe o no tiene permisos para verla.</p>
                        <a href="/app/purchase-orders/list/" class="btn btn-primary">
                            <i class="ri-arrow-left-line me-1"></i>Volver a la Lista
                        </a>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Notificar que los datos están cargados
     */
    triggerDataLoadedEvent(data) {
        const event = new CustomEvent('poDataLoaded', {
            detail: data
        });
        window.dispatchEvent(event);
    },

    /**
     * Obtener configuración de estado
     */
    getStatusConfig(status) {
        return this.config.statusConfigs[status] || { color: 'secondary', text: status || 'Sin estado', icon: '📋' };
    },

    /**
     * Obtener badge de prioridad
     */
    getPriorityBadge(priority) {
        const configs = {
            'low': { color: 'secondary', text: 'Baja' },
            'normal': { color: 'primary', text: 'Normal' },
            'medium': { color: 'primary', text: 'Media' },
            'high': { color: 'warning', text: 'Alta' },
            'urgent': { color: 'danger', text: 'Urgente' }
        };

        const config = configs[priority] || configs['normal'];
        return `<span class="badge bg-label-${config.color}">${config.text}</span>`;
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
     * Obtener iconos de historial
     */
    getHistoryActionIcon(action) {
        const icons = {
            'created': 'ri-add-circle-line',
            'status_changed': 'ri-refresh-line',
            'items_received': 'ri-truck-line',
            'cancelled': 'ri-close-circle-line',
            'reminder_sent': 'ri-mail-line',
            'duplicated': 'ri-file-copy-line',
            'exported': 'ri-download-line',
            'updated': 'ri-edit-line'
        };
        return icons[action] || 'ri-information-line';
    },

    /**
     * Obtener colores de historial
     */
    getHistoryActionColor(action) {
        const colors = {
            'created': 'success',
            'status_changed': 'primary',
            'items_received': 'warning',
            'cancelled': 'danger',
            'reminder_sent': 'info',
            'duplicated': 'secondary',
            'exported': 'dark',
            'updated': 'primary'
        };
        return colors[action] || 'secondary';
    },

    /**
     * Obtener títulos de historial
     */
    getHistoryActionTitle(action) {
        const titles = {
            'created': 'Orden Creada',
            'status_changed': 'Estado Cambiado',
            'items_received': 'Items Recibidos',
            'cancelled': 'Orden Cancelada',
            'reminder_sent': 'Recordatorio Enviado',
            'duplicated': 'Orden Duplicada',
            'exported': 'PDF Exportado',
            'updated': 'Orden Actualizada'
        };
        return titles[action] || 'Actividad';
    },

    /**
     * Formatear fecha
     */
    formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
            return new Date(dateString).toLocaleDateString('es-PE', options);
        } catch (error) {
            return dateString;
        }
    },

    /**
     * Formatear fecha y hora
     */
    formatDateTime(dateString) {
        if (!dateString) return '-';
        try {
            const options = { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            };
            return new Date(dateString).toLocaleDateString('es-PE', options);
        } catch (error) {
            return dateString;
        }
    },

    /**
     * Obtener tiempo relativo
     */
    getTimeAgo(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffInSeconds = Math.floor((now - date) / 1000);

            if (diffInSeconds < 60) return 'Hace unos segundos';
            if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)} minutos`;
            if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)} horas`;
            if (diffInSeconds < 2592000) return `Hace ${Math.floor(diffInSeconds / 86400)} días`;
            return this.formatDate(dateString);
        } catch (error) {
            return dateString;
        }
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
     * Mostrar mensaje de error
     */
    showError(message) {
        if (typeof toastr !== 'undefined') {
            toastr.error(message);
        } else {
            console.error(message);
        }
    },

    /**
     * Refrescar datos (método público)
     */
    refresh() {
        this.loadPurchaseOrderDetails();
    },

    /**
     * Obtener datos actuales (método público)
     */
    getCurrentData() {
        return this.config.currentPO;
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    PurchaseOrderDetailData.init();
});

// Exportar para uso global
window.PurchaseOrderDetailData = PurchaseOrderDetailData;
/**
 * Purchase Order Detail - Actions Module
 * Módulo para manejar todas las acciones de órdenes de compra
 * Siguiendo la estructura y patrones del proyecto
 */

'use strict';

const PurchaseOrderDetailActions = {
    // Configuración del módulo
    config: {
        csrfToken: null,
        purchaseOrderId: null,
        currentPO: null,
        apiUrls: {
            poActions: '/purchasing/purchase-orders/{id}/actions/',
            receiveItems: '/purchasing/purchase-orders/{id}/receive_items/',
            exportPdf: '/purchasing/purchase-orders/{id}/export_pdf/',
            quickReceive: '/purchasing/purchase-orders/{id}/quick-receive/'
        },
        statusConfigs: {
            'draft': { color: 'secondary', text: 'Borrador', icon: 'ri-draft-line' },
            'sent': { color: 'info', text: 'Enviada', icon: 'ri-send-plane-line' },
            'confirmed': { color: 'primary', text: 'Confirmada', icon: 'ri-check-line' },
            'partially_received': { color: 'warning', text: 'Parcialmente Recibida', icon: 'ri-truck-line' },
            'completed': { color: 'success', text: 'Completada', icon: 'ri-check-double-line' },
            'cancelled': { color: 'danger', text: 'Cancelada', icon: 'ri-close-circle-line' }
        }
    },

    // Referencias a elementos del DOM
    elements: {
        // Modal de recepción
        receiveItemsModal: null,
        receiveItemsList: null,
        confirmReceiveBtn: null,
        
        // Botones de acción
        actionsList: null,
        quickActions: null,
        exportPdfBtn: null,
        receiveItemsBtn: null,
        
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
        this.listenToDataEvents();
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
        // Modal de recepción
        const modalElement = document.getElementById('receiveItemsModal');
        if (modalElement) {
            this.elements.receiveItemsModal = new bootstrap.Modal(modalElement);
        }
        this.elements.receiveItemsList = document.getElementById('receiveItemsList');
        this.elements.confirmReceiveBtn = document.getElementById('confirmReceiveBtn');
        
        // Botones de acción
        this.elements.actionsList = document.getElementById('actionsList');
        this.elements.quickActions = document.getElementById('quickActions');
        this.elements.exportPdfBtn = document.getElementById('exportPdfBtn');
        this.elements.receiveItemsBtn = document.getElementById('receiveItemsBtn');
        
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
                this.openReceiveItemsModal();
            });
        }

        // Confirmar recepción
        if (this.elements.confirmReceiveBtn) {
            this.elements.confirmReceiveBtn.addEventListener('click', () => {
                this.processItemsReception();
            });
        }

        // Exportar PDF
        if (this.elements.exportPdfBtn) {
            this.elements.exportPdfBtn.addEventListener('click', () => {
                this.exportToPdf();
            });
        }

        // Acciones de la orden usando delegación de eventos
        document.addEventListener('click', (e) => {
            const actionElement = e.target.closest('[data-action]');
            if (actionElement) {
                e.preventDefault();
                const action = actionElement.dataset.action;
                const data = actionElement.dataset;
                this.handleAction(action, data);
            }
        });

        // Teclas de acceso rápido
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'p':
                        e.preventDefault();
                        this.exportToPdf();
                        break;
                    case 'r':
                        e.preventDefault();
                        if (window.PurchaseOrderDetailData) {
                            window.PurchaseOrderDetailData.refresh();
                        }
                        break;
                }
            }
        });
    },

    /**
     * Escuchar eventos de datos
     */
    listenToDataEvents() {
        window.addEventListener('poDataLoaded', (e) => {
            this.config.currentPO = e.detail;
            this.setupActionButtons(e.detail);
        });
    },

    /**
     * Configurar botones de acción
     */
    setupActionButtons(po) {
        const actions = this.getAvailableActions(po);
        
        // Configurar dropdown de acciones
        if (this.elements.actionsList) {
            const html = actions.map(action =>
                `<li><a class="dropdown-item ${action.class}" href="#" data-action="${action.action}" ${action.data || ''}>
                    <i class="${action.icon} me-2"></i>${action.text}
                </a></li>`
            ).join('');
            this.elements.actionsList.innerHTML = html;
        }

        // Configurar acciones rápidas en el sidebar
        if (this.elements.quickActions) {
            const quickActionsHtml = actions.slice(0, 3).map(action =>
                `<button class="btn btn-outline-primary btn-sm w-100 mb-2" data-action="${action.action}" ${action.data || ''}>
                    <i class="${action.icon} me-1"></i>${action.text}
                </button>`
            ).join('');
            this.elements.quickActions.innerHTML = quickActionsHtml;
        }

        // Mostrar/ocultar botón de recibir items
        const canReceive = ['sent', 'confirmed', 'partially_received'].includes(po.status);
        if (this.elements.receiveItemsBtn) {
            this.elements.receiveItemsBtn.style.display = canReceive ? 'block' : 'none';
        }
    },

    /**
     * Obtener acciones disponibles según el estado y permisos
     */
    getAvailableActions(po) {
        const actions = [];
        const status = po.status;

        // Cambios de estado disponibles basados en can_edit y can_send
        if (status === 'draft' && po.can_send) {
            actions.push({
                action: 'change_status',
                text: 'Enviar',
                icon: 'ri-send-plane-line',
                class: 'text-primary',
                data: 'data-status="sent"'
            });
        }

        if (status === 'sent') {
            actions.push({
                action: 'change_status',
                text: 'Confirmar',
                icon: 'ri-check-line',
                class: 'text-success',
                data: 'data-status="confirmed"'
            });
        }

        if (status === 'confirmed' || status === 'partially_received') {
            actions.push({
                action: 'receive_items',
                text: 'Recibir Items',
                icon: 'ri-truck-line',
                class: 'text-warning'
            });
        }

        // Recordatorio (basado en can_send_reminder)
        if (po.can_send_reminder && status !== 'cancelled' && status !== 'completed') {
            actions.push({
                action: 'send_reminder',
                text: 'Enviar Recordatorio',
                icon: 'ri-notification-line',
                class: ''
            });
        }

        // Duplicar (basado en can_duplicate)
        if (po.can_duplicate) {
            actions.push({
                action: 'duplicate_order',
                text: 'Duplicar Orden',
                icon: 'ri-file-copy-line',
                class: ''
            });
        }

        // Cancelar (basado en can_cancel)
        if (po.can_cancel) {
            actions.push({
                action: 'cancel_order',
                text: 'Cancelar Orden',
                icon: 'ri-close-line',
                class: 'text-danger'
            });
        }

        return actions;
    },

    /**
     * Manejar acciones
     */
    handleAction(action, data) {
        if (!this.validateOrderForAction(action)) {
            return;
        }

        switch (action) {
            case 'change_status':
                this.changeOrderStatus(data.status);
                break;
            case 'receive_items':
                this.openReceiveItemsModal();
                break;
            case 'cancel_order':
                this.cancelOrder();
                break;
            case 'duplicate_order':
                this.duplicateOrder();
                break;
            case 'send_reminder':
                this.sendReminder();
                break;
            default:
                console.warn('Unknown action:', action);
        }
    },

    /**
     * Validar si se puede ejecutar la acción
     */
    validateOrderForAction(action) {
        if (!this.config.currentPO) {
            this.showError('No hay datos de la orden disponibles');
            return false;
        }

        const validations = {
            'change_status': () => this.config.currentPO.status !== 'completed' && this.config.currentPO.status !== 'cancelled',
            'cancel_order': () => this.config.currentPO.can_cancel,
            'duplicate_order': () => this.config.currentPO.can_duplicate,
            'send_reminder': () => this.config.currentPO.can_send_reminder,
            'receive_items': () => ['confirmed', 'partially_received'].includes(this.config.currentPO.status)
        };

        const validator = validations[action];
        if (validator && !validator()) {
            this.showWarning('Esta acción no está disponible en el estado actual');
            return false;
        }

        return true;
    },

    /**
     * Cambiar estado de la orden
     */
    async changeOrderStatus(newStatus) {
        // Validar transición de estado
        if (!this.isValidStatusTransition(this.config.currentPO.status, newStatus)) {
            this.showError('Transición de estado no válida');
            return;
        }

        const statusConfig = this.getStatusConfig(newStatus);
        const currentStatusConfig = this.getStatusConfig(this.config.currentPO.status);

        // Confirmar cambio de estado
        const result = await Swal.fire({
            title: 'Confirmar Cambio de Estado',
            html: `
                <div class="text-center">
                    <p class="mb-3">¿Desea cambiar el estado de la orden?</p>
                    <div class="d-flex justify-content-center align-items-center gap-3">
                        <span class="badge bg-label-${currentStatusConfig.color}">${currentStatusConfig.text}</span>
                        <i class="ri-arrow-right-line"></i>
                        <span class="badge bg-label-${statusConfig.color}">${statusConfig.text}</span>
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: `Cambiar a ${statusConfig.text}`,
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33'
        });

        if (result.isConfirmed) {
            this.performStatusChange(newStatus);
        }
    },

    /**
     * Ejecutar cambio de estado
     */
    async performStatusChange(newStatus) {
        this.showLoading('Cambiando estado...');

        try {
            // Usar la acción del ViewSet
            const response = await fetch(
                `/purchasing/purchase-orders/${this.config.purchaseOrderId}/actions/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.config.csrfToken,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'change_status',
                        new_status: newStatus
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al cambiar el estado');
            }

            const statusConfig = this.getStatusConfig(newStatus);
            this.showSuccess(`Estado cambiado a ${statusConfig.text}`);

            // Actualizar datos locales
            this.config.currentPO.status = newStatus;

            // Recargar datos desde el módulo de datos
            if (window.PurchaseOrderDetailData) {
                window.PurchaseOrderDetailData.refresh();
            }

        } catch (error) {
            console.error('Error changing status:', error);
            this.showError(error.message || 'Error al cambiar el estado');
        } finally {
            this.hideLoading();
        }
    },

    /**
     * Validar transición de estado
     */
    isValidStatusTransition(currentStatus, newStatus) {
        const validTransitions = {
            'draft': ['sent', 'cancelled'],
            'sent': ['confirmed', 'cancelled'],
            'confirmed': ['partially_received', 'completed', 'cancelled'],
            'partially_received': ['completed', 'cancelled']
        };

        return validTransitions[currentStatus]?.includes(newStatus) || false;
    },

    /**
     * Mostrar modal de recepción de items
     */
    openReceiveItemsModal() {
        if (!this.config.currentPO) {
            this.showError('No hay datos de la orden disponibles');
            return;
        }

        const pendingItems = this.config.currentPO.items?.filter(item => {
            const pending = item.pending_quantity || (item.quantity_ordered - item.quantity_received);
            return pending > 0;
        }) || [];

        if (pendingItems.length === 0) {
            this.showWarning('No hay items pendientes de recepción');
            return;
        }

        this.renderReceiveItemsForm(pendingItems);
        if (this.elements.receiveItemsModal) {
            this.elements.receiveItemsModal.show();
        }
    },

    /**
     * Renderizar formulario de recepción
     */
    renderReceiveItemsForm(items) {
        if (!this.elements.receiveItemsList) {
            console.error('Element receiveItemsList not found');
            return;
        }

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
                                       data-item-id="${item.id}"
                                       data-max="${pendingQty}">
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
                
                this.updateReceiveTotals();
            });
        });

        // Agregar validación en tiempo real a los inputs de cantidad
        const receiveQtyInputs = document.querySelectorAll('.receive-qty');
        receiveQtyInputs.forEach(input => {
            input.addEventListener('input', this.updateReceiveTotals.bind(this));
            input.addEventListener('change', this.updateReceiveTotals.bind(this));
        });

        this.updateReceiveTotals();
    },

    /**
     * Actualizar totales de recepción
     */
    updateReceiveTotals() {
        let totalToReceive = 0;
        let itemsToReceive = 0;

        document.querySelectorAll('.receive-qty').forEach(input => {
            const qty = parseInt(input.value) || 0;
            const max = parseInt(input.dataset.max) || 0;
            
            if (qty > max) {
                input.value = max;
                input.classList.add('is-invalid');
                setTimeout(() => input.classList.remove('is-invalid'), 2000);
                this.showWarning(`Cantidad máxima: ${max} unidades`);
            } else if (qty < 0) {
                input.value = 0;
            }

            if (qty > 0) {
                totalToReceive += qty;
                itemsToReceive++;
            }
        });

        const totalToReceiveEl = document.getElementById('totalToReceive');
        const itemsToReceiveEl = document.getElementById('itemsToReceive');

        if (totalToReceiveEl) {
            totalToReceiveEl.textContent = totalToReceive;
        }
        if (itemsToReceiveEl) {
            itemsToReceiveEl.textContent = itemsToReceive;
        }

        // Habilitar/deshabilitar botón de confirmación
        if (this.elements.confirmReceiveBtn) {
            this.elements.confirmReceiveBtn.disabled = totalToReceive === 0;
        }
    },

    /**
     * Procesar recepción de items
     */
    async processItemsReception() {
        const items = [];
        let hasValidItems = false;

        // Recolectar datos del formulario usando la estructura de cards
        document.querySelectorAll('.receive-check:checked').forEach(checkbox => {
            const itemId = checkbox.dataset.itemId;
            const qtyInput = document.querySelector(`.receive-qty[data-item-id="${itemId}"]`);
            const notesInput = document.querySelector(`.receive-notes[data-item-id="${itemId}"]`);
            
            const quantity = parseInt(qtyInput.value) || 0;
            const notes = notesInput.value.trim();

            if (quantity > 0) {
                items.push({
                    item_id: parseInt(itemId),
                    quantity_received: quantity,
                    reception_notes: notes || ''
                });
                hasValidItems = true;
            }
        });

        if (!hasValidItems) {
            this.showWarning('Debe recibir al menos un item con cantidad mayor a 0');
            return;
        }

        // Modal de confirmación final
        const result = await Swal.fire({
            title: 'Confirmar Recepción',
            html: `
                <div class="text-start">
                    <div class="alert alert-info">
                        <strong>📦 Items a recibir:</strong> ${items.length}<br>
                        <strong>🔢 Total unidades:</strong> ${items.reduce((sum, item) => sum + item.quantity_received, 0)}
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Observaciones Generales (opcional):</label>
                        <textarea id="generalNotes" class="form-control" rows="3"
                                  placeholder="Comentarios sobre la recepción en general..."></textarea>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="updateInventory" checked>
                        <label class="form-check-label" for="updateInventory">
                            Actualizar inventario automáticamente
                        </label>
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Confirmar Recepción',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            preConfirm: () => {
                return {
                    items: items,
                    general_notes: document.getElementById('generalNotes').value.trim(),
                    update_inventory: document.getElementById('updateInventory').checked
                };
            }
        });

        if (result.isConfirmed) {
            this.performItemsReception(result.value);
        }
    },

    /**
     * Ejecutar recepción de items
     */
    async performItemsReception(receptionData) {
        this.showLoading('Procesando recepción...');
        if (this.elements.receiveItemsModal) {
            this.elements.receiveItemsModal.hide();
        }

        try {
            // Estructurar datos según lo que espera el servicio
            const payload = {
                received_items: receptionData.items,  // El servicio espera 'received_items'
                update_inventory: receptionData.update_inventory,
                general_notes: receptionData.general_notes || `Recepción realizada el ${new Date().toLocaleString()}`
            };

            const response = await fetch(
                `/purchasing/purchase-orders/${this.config.purchaseOrderId}/receive-items/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.config.csrfToken,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                if (data.item_errors) {
                    this.showItemErrors(data.item_errors);
                } else {
                    throw new Error(data.error || 'Error al procesar la recepción');
                }
                return;
            }

            // Mostrar resultado exitoso
            this.showSuccess('Items recibidos correctamente');
            this.showReceptionSummary(data);

            // Recargar datos
            if (window.PurchaseOrderDetailData) {
                window.PurchaseOrderDetailData.refresh();
            }

        } catch (error) {
            console.error('Error processing reception:', error);
            this.showError(error.message || 'Error al procesar la recepción');
        } finally {
            this.hideLoading();
        }
    },

    /**
     * Mostrar errores de items
     */
    showItemErrors(itemErrors) {
        const errorHtml = itemErrors.map(error => `
            <div class="alert alert-warning">
                <strong>Item ${error.item_id}:</strong> ${error.message}
            </div>
        `).join('');

        Swal.fire({
            title: 'Errores en la Recepción',
            html: `
                <div class="text-start">
                    <p class="mb-3">Se encontraron los siguientes errores:</p>
                    ${errorHtml}
                </div>
            `,
            icon: 'warning',
            confirmButtonText: 'Revisar'
        });
    },

    /**
     * Mostrar resumen de recepción
     */
    showReceptionSummary(response) {
        Swal.fire({
            title: '¡Recepción Exitosa!',
            html: `
                <div class="text-center">
                    <div class="avatar avatar-xl mx-auto mb-3">
                        <span class="avatar-initial rounded bg-label-success">
                            <i class="ri-truck-line ri-24px"></i>
                        </span>
                    </div>
                    <p>Se recibieron ${response.items_received || 0} item(s)</p>
                    <p>Cantidad total: ${response.total_quantity || 0} unidades</p>
                    ${response.new_status ? `
                        <p>Nuevo estado: <span class="badge bg-${this.getStatusColor(response.new_status)}">${this.getStatusText(response.new_status)}</span></p>
                    ` : ''}
                </div>
            `,
            icon: 'success',
                    showCancelButton: true,
        confirmButtonText: 'Aceptar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ff3e1d',
        customClass: {
            confirmButton: 'btn btn-danger me-2',
            cancelButton: 'btn btn-label-secondary'
        },
        buttonsStyling: false
        });
    },

    /**
     * Cancelar orden
     */
    async cancelOrder() {
        // Verificar si se puede cancelar
        if (!this.config.currentPO.can_cancel) {
            this.showError('No tiene permisos para cancelar esta orden');
            return;
        }

        // Modal de confirmación con razón de cancelación
        const result = await Swal.fire({
            title: 'Cancelar Orden de Compra',
            html: `
                <div class="text-start">
                    <div class="alert alert-warning d-flex align-items-center mb-3">
                        <i class="ri-alert-line me-2"></i>
                        <span>Esta acción no se puede deshacer</span>
                    </div>
                    <div class="form-floating form-floating-outline">
                        <textarea
                            id="cancellationReason"
                            class="form-control"
                            placeholder="Ingrese la razón de cancelación..."
                            style="height: 100px"
                            required
                        ></textarea>
                        <label for="cancellationReason">Razón de Cancelación *</label>
                    </div>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Cancelar Orden',
            cancelButtonText: 'Volver',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            preConfirm: () => {
                const reason = document.getElementById('cancellationReason').value.trim();
                if (!reason) {
                    Swal.showValidationMessage('La razón de cancelación es requerida');
                    return false;
                }
                return reason;
            }
        });

        if (result.isConfirmed) {
            this.performOrderCancellation(result.value);
        }
    },

    /**
     * Ejecutar cancelación de orden
     */
    async performOrderCancellation(reason) {
        this.showLoading('Cancelando orden...');

        try {
            const response = await fetch(
                this.config.apiUrls.poActions.replace('{id}', this.config.purchaseOrderId),
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.config.csrfToken,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'cancel_order',
                        reason: reason
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al cancelar la orden');
            }

            this.showSuccess('Orden cancelada exitosamente');

            // Actualizar estado local
            this.config.currentPO.status = 'cancelled';

            // Recargar datos
            if (window.PurchaseOrderDetailData) {
                window.PurchaseOrderDetailData.refresh();
            }

        } catch (error) {
            console.error('Error cancelling order:', error);
            this.showError(error.message || 'Error al cancelar la orden');
        } finally {
            this.hideLoading();
        }
    },

    /**
     * Duplicar orden
     */
    async duplicateOrder() {
        if (!this.config.currentPO.can_duplicate) {
            this.showError('No tiene permisos para duplicar esta orden');
            return;
        }

        const today = new Date();
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        const defaultDate = nextWeek.toISOString().split('T')[0];

        // Modal de configuración de duplicación
        const result = await Swal.fire({
            title: 'Duplicar Orden de Compra',
            html: `
                <div class="text-start">
                    <div class="alert alert-info d-flex align-items-center mb-3">
                        <i class="ri-information-line me-2"></i>
                        <span>Se creará una nueva orden basada en la actual</span>
                    </div>

                    <div class="row g-3">
                        <div class="col-12">
                            <div class="form-floating form-floating-outline">
                                <input
                                    type="date"
                                    id="newExpectedDelivery"
                                    class="form-control"
                                    value="${defaultDate}"
                                    min="${today.toISOString().split('T')[0]}"
                                >
                                <label for="newExpectedDelivery">Nueva Fecha de Entrega</label>
                            </div>
                        </div>

                        <div class="col-12">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="copyNotes" checked>
                                <label class="form-check-label" for="copyNotes">
                                    Copiar notas de la orden original
                                </label>
                            </div>
                        </div>

                        <div class="col-12">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="copyAllItems" checked>
                                <label class="form-check-label" for="copyAllItems">
                                    Copiar todos los items
                                </label>
                            </div>
                        </div>
                    </div>

                    <div class="mt-3">
                        <div class="form-floating form-floating-outline">
                            <textarea
                                id="duplicateNotes"
                                class="form-control"
                                placeholder="Notas adicionales para la nueva orden..."
                                style="height: 80px"
                            ></textarea>
                            <label for="duplicateNotes">Notas Adicionales</label>
                        </div>
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Crear Duplicado',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#6c757d',
            preConfirm: () => {
                const expectedDelivery = document.getElementById('newExpectedDelivery').value;
                if (!expectedDelivery) {
                    Swal.showValidationMessage('La fecha de entrega es requerida');
                    return false;
                }

                return {
                    expected_delivery: expectedDelivery,
                    copy_notes: document.getElementById('copyNotes').checked,
                    copy_all_items: document.getElementById('copyAllItems').checked,
                    additional_notes: document.getElementById('duplicateNotes').value.trim()
                };
            }
        });

        if (result.isConfirmed) {
            this.performOrderDuplication(result.value);
        }
    },

    /**
     * Ejecutar duplicación de orden
     */
    async performOrderDuplication(options) {
        this.showLoading('Duplicando orden...');

        try {
            const response = await fetch(
                this.config.apiUrls.poActions.replace('{id}', this.config.purchaseOrderId),
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.config.csrfToken,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'duplicate_order',
                        options: options
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al duplicar la orden');
            }

            this.showSuccess('Orden duplicada exitosamente');

            // Mostrar opción de ir a la nueva orden
            const goToNewOrder = await Swal.fire({
                title: 'Orden Duplicada',
                html: `
                    <div class="text-center">
                        <div class="avatar avatar-xl mx-auto mb-3">
                            <span class="avatar-initial rounded bg-label-success">
                                <i class="ri-file-copy-line ri-24px"></i>
                            </span>
                        </div>
                        <h6 class="mb-2">Nueva Orden Creada</h6>
                        <p class="text-muted mb-3">
                            Número de Orden: <strong>${data.new_po_number}</strong>
                        </p>
                        <p class="text-muted">¿Desea ir a la nueva orden?</p>
                    </div>
                `,
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: 'Ir a Nueva Orden',
                cancelButtonText: 'Quedarse Aquí',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#6c757d'
            });

            if (goToNewOrder.isConfirmed) {
                window.location.href = `/app/purchase-orders/detail/${data.new_po_id}/`;
            }

        } catch (error) {
            console.error('Error duplicating order:', error);
            this.showError(error.message || 'Error al duplicar la orden');
        } finally {
            this.hideLoading();
        }
    },

    /**
     * Enviar recordatorio
     */
    async sendReminder() {
        if (!this.config.currentPO.can_send_reminder) {
            this.showError('No se puede enviar recordatorio para esta orden');
            return;
        }

        // Modal de configuración del recordatorio
        const result = await Swal.fire({
            title: 'Enviar Recordatorio',
            html: `
                <div class="text-start">
                    <div class="alert alert-info d-flex align-items-center mb-3">
                        <i class="ri-mail-line me-2"></i>
                        <span>Se enviará un recordatorio al proveedor</span>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Proveedor:</label>
                        <div class="d-flex align-items-center p-2 bg-light rounded">
                            <i class="ri-building-line me-2"></i>
                            <div>
                                <div class="fw-medium">${this.config.currentPO.supplier_name || 'Sin proveedor'}</div>
                                <small class="text-muted">${this.config.currentPO.supplier_email || 'Sin email'}</small>
                            </div>
                        </div>
                    </div>

                    <div class="row g-3">
                        <div class="col-12">
                            <label for="reminderType" class="form-label">Tipo de Recordatorio</label>
                            <select id="reminderType" class="form-select">
                                <option value="delivery">Recordatorio de Entrega</option>
                                <option value="confirmation">Solicitud de Confirmación</option>
                                <option value="status_update">Actualización de Estado</option>
                                <option value="custom">Mensaje Personalizado</option>
                            </select>
                        </div>

                        <div class="col-12">
                            <div class="form-floating form-floating-outline">
                                <textarea
                                    id="reminderMessage"
                                    class="form-control"
                                    placeholder="Mensaje adicional..."
                                    style="height: 100px"
                                ></textarea>
                                <label for="reminderMessage">Mensaje Adicional</label>
                            </div>
                        </div>

                        <div class="col-12">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="includeOrderDetails" checked>
                                <label class="form-check-label" for="includeOrderDetails">
                                    Incluir detalles de la orden
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Enviar Recordatorio',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#6c757d',
            preConfirm: () => {
                return {
                    type: document.getElementById('reminderType').value,
                    message: document.getElementById('reminderMessage').value.trim(),
                    include_details: document.getElementById('includeOrderDetails').checked
                };
            }
        });

        if (result.isConfirmed) {
            this.performSendReminder(result.value);
        }
    },

    /**
     * Ejecutar envío de recordatorio
     */
    async performSendReminder(options) {
        this.showLoading('Enviando recordatorio...');

        try {
            const response = await fetch(
                this.config.apiUrls.poActions.replace('{id}', this.config.purchaseOrderId),
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.config.csrfToken,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'send_reminder',
                        reminder_options: options
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al enviar el recordatorio');
            }

            this.showSuccess('Recordatorio enviado exitosamente');

            // Mostrar confirmación
            Swal.fire({
                title: 'Recordatorio Enviado',
                html: `
                    <div class="text-center">
                        <div class="avatar avatar-xl mx-auto mb-3">
                            <span class="avatar-initial rounded bg-label-success">
                                <i class="ri-mail-check-line ri-24px"></i>
                            </span>
                        </div>
                        <p class="text-muted">
                            El recordatorio ha sido enviado a:<br>
                            <strong>${this.config.currentPO.supplier_email || 'Proveedor'}</strong>
                        </p>
                    </div>
                `,
                icon: 'success',
                confirmButtonText: 'Entendido'
            });

        } catch (error) {
            console.error('Error sending reminder:', error);
            this.showError(error.message || 'Error al enviar el recordatorio');
        } finally {
            this.hideLoading();
        }
    },

    /**
     * Exportar a PDF
     */
    async exportToPdf() {
        this.showLoading('Generando PDF...');

        try {
            // Usar la acción del ViewSet para exportar PDF
            const pdfUrl = `/purchasing/purchase-orders/${this.config.purchaseOrderId}/export_pdf/`;
            
            // Crear un iframe temporal para la descarga
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = pdfUrl;
            document.body.appendChild(iframe);

            // Remover el iframe después de un tiempo
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 3000);

            this.showInfo('Descarga iniciada...');

        } catch (error) {
            console.error('Error exporting PDF:', error);
            this.showError('Error al exportar el PDF');
        } finally {
            this.hideLoading();
        }
    },

    /**
     * Obtener configuración de estado
     */
    getStatusConfig(status) {
        return this.config.statusConfigs[status] || { color: 'secondary', text: status || 'Sin estado', icon: '📋' };
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
        if (typeof toastr !== 'undefined') {
            toastr.success(message);
        } else {
            Swal.fire({
                icon: 'success',
                title: '¡Éxito!',
                text: message,
                timer: 3000,
                showConfirmButton: false
            });
        }
    },

    /**
     * Mostrar mensaje de error
     */
    showError(message) {
        if (typeof toastr !== 'undefined') {
            toastr.error(message);
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: message
            });
        }
    },

    /**
     * Mostrar mensaje de advertencia
     */
    showWarning(message) {
        if (typeof toastr !== 'undefined') {
            toastr.warning(message);
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Atención',
                text: message
            });
        }
    },

    /**
     * Mostrar mensaje de información
     */
    showInfo(message) {
        if (typeof toastr !== 'undefined') {
            toastr.info(message);
        } else {
            Swal.fire({
                icon: 'info',
                title: 'Información',
                text: message
            });
        }
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    PurchaseOrderDetailActions.init();
});

// Exportar para uso global
window.PurchaseOrderDetailActions = PurchaseOrderDetailActions;