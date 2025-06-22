/**
 * Purchase Orders Detail JavaScript
 * Funcionalidades para los detalles de órdenes de compra
 */

$(document).ready(function() {
    'use strict';

    let currentPO = null;
    const poId = window.location.pathname.split('/').slice(-2, -1)[0];

    // URLs de la API
    const API_URLS = {
        poDetails: `/purchasing/purchase-orders/${poId}/`,
        poActions: `/purchasing/purchase-orders/${poId}/actions/`,
        receiveItems: `/purchasing/purchase-orders/${poId}/receive-items/`,
        exportPdf: `/purchasing/purchase-orders/${poId}/export-pdf/`,
        history: `/purchasing/purchase-orders/${poId}/history/`
    };

    // Inicialización
    init();

    function init() {
        loadPODetails();
        bindEvents();
        setupAutoRefresh();
    }

    function loadPODetails() {
        showLoading('Cargando detalles...');

        $.get(API_URLS.poDetails)
            .done(function(response) {
                currentPO = response;
                console.log('PO Details loaded:', response);
                renderPODetails(response);
                setupActionButtons(response);
            })
            .fail(function(xhr) {
                console.error('Error loading PO details:', xhr);
                toastr.error('Error al cargar los detalles de la orden');

                if (xhr.status === 404) {
                    $('#poDetailsContainer').html(`
                        <div class="col-12">
                            <div class="card">
                                <div class="card-body text-center py-5">
                                    <i class="ri-file-search-line ri-48px text-muted mb-3"></i>
                                    <h5 class="text-muted">Orden de Compra No Encontrada</h5>
                                    <p class="text-muted mb-4">La orden de compra solicitada no existe o no tiene permisos para verla.</p>
                                    <a href="/purchasing/app/purchase-orders/list/" class="btn btn-primary">
                                        <i class="ri-arrow-left-line me-1"></i>Volver a la Lista
                                    </a>
                                </div>
                            </div>
                        </div>
                    `);
                }
            })
            .always(function() {
                hideLoading();
            });
    }

    function renderPODetails(po) {
        // ✅ Verificaciones de seguridad para prevenir errores
        if (!po) {
            console.error('No hay datos de la orden');
            return;
        }

        // Actualizar encabezado
        $('#poNumber').text(po.po_number || 'Sin número');

        // Información del proveedor y estado
        const statusConfig = getStatusConfig(po.status);
        const supplierName = po.supplier?.company_name || po.supplier_name || 'Sin proveedor';
        const supplierContact = po.supplier?.contact_person || po.supplier_contact || '';

        $('#supplierName').text(supplierName);
        $('#supplierContact').text(supplierContact);
        $('#statusBadge').removeClass().addClass(`badge bg-label-${statusConfig.color}`).text(statusConfig.text);
        $('#statusIcon').text(statusConfig.icon);

        // Progreso
        const progress = po.completion_percentage || 0;
        $('#progressBadge').text(`${progress}%`);

        // Monto total
        const totalAmount = parseFloat(po.total_amount || 0);
        $('#totalAmount').text(`S/.${totalAmount.toLocaleString('es-PE', {minimumFractionDigits: 2})}`);

        // Información básica
        $('#orderNumber').text(po.po_number || 'Sin número');

        // ✅ Formateo seguro de fechas
        if (po.order_date) {
            $('#orderDate').text(moment(po.order_date).isValid() ? moment(po.order_date).format('DD/MM/YYYY') : po.order_date);
        } else {
            $('#orderDate').text('-');
        }

        if (po.expected_delivery) {
            $('#expectedDelivery').text(moment(po.expected_delivery).isValid() ? moment(po.expected_delivery).format('DD/MM/YYYY') : po.expected_delivery);
        } else {
            $('#expectedDelivery').text('-');
        }

        $('#priority').html(getPriorityBadge(po.priority));
        $('#currentStatus').html(`<span class="badge bg-label-${statusConfig.color}">${statusConfig.text}</span>`);
        $('#paymentTerms').text(po.payment_terms || '-');
        $('#notes').text(po.notes || '-');
        $('#createdBy').text(po.created_by?.username || po.created_by_name || '-');

        if (po.created_at) {
            $('#createdAt').text(moment(po.created_at).isValid() ? moment(po.created_at).format('DD/MM/YYYY HH:mm') : po.created_at);
        } else {
            $('#createdAt').text('-');
        }
          console.log('Rendering PO details:', po);
        // Información del proveedor
        renderSupplierInfo(po);

        // Items de la orden
        renderOrderItems(po.items || []);

        // Estadísticas
        renderOrderStats(po);

        // Totales en el sidebar
        renderSidebarTotals(po);

        // Historial si está disponible
        if (po.history) {
            renderOrderHistory(po.history);
        }
    }

    function renderSupplierInfo(supplier) {

        // ✅ Manejo seguro de información del proveedor
        if (!supplier) {
            $('#supplierCompany').text('-');
            $('#supplierContactPerson').text('-');
            $('#supplierEmail').text('-');
            $('#supplierPhone').text('-');
            return;
        }
            console.log('Rendering supplier info:', supplier);
        // ✅ Verificación segura de company_name antes de usar charAt
        const companyName = supplier.supplier_name || supplier.name || 'Sin nombre';
        const contactPerson = supplier.supplier_contact || '-';
        const email = supplier.supplier_email || '-';
        const phone = supplier.supplier_phone || supplier.phone || '-';

        $('#supplierCompany').text(companyName);
        $('#supplierContactPerson').text(contactPerson);
        $('#supplierEmail').text(email);
        $('#supplierPhone').text(phone);
    }

    function renderOrderItems(items) {
        if (!items || items.length === 0) {
            $('#itemsTableBody').html(`
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <i class="ri-shopping-cart-line ri-48px text-muted mb-3"></i>
                        <p class="text-muted">No hay items en esta orden</p>
                    </td>
                </tr>
            `);
            return;
        }

        let totalSubtotal = 0;

        const html = items.map(item => {
            // ✅ Manejo seguro de propiedades del item
            const productName = item.product_name || item.product?.name || 'Producto sin nombre';
            const productCode = item.product_code || item.product?.code || '-';
            const quantityOrdered = item.quantity_ordered || 0;
            const quantityReceived = item.quantity_received || 0;
            const pending = quantityOrdered - quantityReceived;
            const unitPrice = parseFloat(item.unit_price || 0);
            const lineTotal = quantityOrdered * unitPrice;
            const isComplete = quantityReceived >= quantityOrdered;

            totalSubtotal += lineTotal;

            return `
                <tr>
                    <td>${productCode}</td>
                    <td>
                        <div>
                            <strong>${productName}</strong>
                            ${item.notes ? `<br><small class="text-info">${item.notes}</small>` : ''}
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
                    <td class="text-center">
                        ${isComplete ?
                            '<span class="badge bg-label-success">Completo</span>' :
                            '<span class="badge bg-label-warning">Pendiente</span>'
                        }
                    </td>
                </tr>
            `;
        }).join('');

        $('#itemsTableBody').html(html);

        // Actualizar totales en el pie de tabla
        const tax = totalSubtotal * 0.18;
        const total = totalSubtotal + tax;

        $('#subtotalValue').text(`S/.${totalSubtotal.toLocaleString('es-PE', {minimumFractionDigits: 2})}`);
        $('#taxValue').text(`S/.${tax.toLocaleString('es-PE', {minimumFractionDigits: 2})}`);
        $('#totalValue').text(`S/.${total.toLocaleString('es-PE', {minimumFractionDigits: 2})}`);
    }

    function renderOrderStats(po) {
        // ✅ Cálculos seguros de estadísticas
        const items = po.items || [];
        const totalItems = items.length;
        const totalOrdered = items.reduce((sum, item) => sum + (item.quantity_ordered || 0), 0);
        const totalReceived = items.reduce((sum, item) => sum + (item.quantity_received || 0), 0);
        const totalPending = totalOrdered - totalReceived;
        const completionRate = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

        // Actualizar contadores en el sidebar
        $('#totalItemsCount').text(totalItems);
        $('#pendingItemsCount').text(totalPending);

        // Actualizar progreso
        $('#completionPercentage').text(`${completionRate}%`);
        $('#progressBar').css('width', `${completionRate}%`);

        // Cambiar color de la barra según el progreso
        $('#progressBar').removeClass('bg-danger bg-warning bg-success');
        if (completionRate === 100) {
            $('#progressBar').addClass('bg-success');
        } else if (completionRate >= 50) {
            $('#progressBar').addClass('bg-warning');
        } else {
            $('#progressBar').addClass('bg-danger');
        }
    }

    function renderSidebarTotals(po) {
        // ✅ Renderizar totales en el sidebar
        const subtotal = parseFloat(po.subtotal || 0);
        const taxAmount = parseFloat(po.tax_amount || 0);
        const totalAmount = parseFloat(po.total_amount || 0);

        $('#subtotalAmount').text(`S/.${subtotal.toLocaleString('es-PE', {minimumFractionDigits: 2})}`);
        $('#taxAmount').text(`S/.${taxAmount.toLocaleString('es-PE', {minimumFractionDigits: 2})}`);
        $('#totalAmountSidebar').text(`S/.${totalAmount.toLocaleString('es-PE', {minimumFractionDigits: 2})}`);

        // Mostrar notas si existen
        if (po.notes && po.notes.trim()) {
            $('#notes').text(po.notes);
            $('#notesCard').show();
        } else {
            $('#notesCard').hide();
        }
    }

    function setupActionButtons(po) {
        const actions = getAvailableActions(po);
        const html = actions.map(action =>
            `<li><a class="dropdown-item ${action.class}" href="#" data-action="${action.action}" ${action.data || ''}>
                <i class="${action.icon} me-2"></i>${action.text}
            </a></li>`
        ).join('');

        $('#actionsList').html(html);

        // Setup quick actions en el sidebar
        const quickActionsHtml = actions.slice(0, 3).map(action =>
            `<button class="btn btn-outline-primary btn-sm w-100" data-action="${action.action}" ${action.data || ''}>
                <i class="${action.icon} me-1"></i>${action.text}
            </button>`
        ).join('');

        $('#quickActions').html(quickActionsHtml);
    }

    function bindEvents() {
        // Acciones de la orden
        $(document).on('click', '[data-action]', function(e) {
            e.preventDefault();
            const action = $(this).data('action');
            const data = $(this).data();

            handleAction(action, data);
        });

        // Exportar PDF
        $('#exportPdfBtn').on('click', function() {
            exportToPdf();
        });

        // Recibir items
        $(document).on('click', '.receive-items-btn', function() {
            openReceiveItemsModal();
        });

        // Confirmar recepción
        $('#confirmReceiveBtn').on('click', function() {
            processItemsReception();
        });

        // Refrescar datos
        $('#refreshDataBtn').on('click', function() {
            loadPODetails();
        });
    }

    function handleAction(action, data) {
        switch (action) {
            case 'change_status':
                changeOrderStatus(data.status);
                break;
            case 'receive_items':
                openReceiveItemsModal();
                break;
            case 'cancel_order':
                cancelOrder();
                break;
            case 'duplicate_order':
                duplicateOrder();
                break;
            case 'send_reminder':
                sendReminder();
                break;
            default:
                console.warn('Unknown action:', action);
        }
    }

    function openReceiveItemsModal() {
        if (!currentPO || !currentPO.items) {
            toastr.error('No hay datos de la orden disponibles');
            return;
        }

        const pendingItems = currentPO.items.filter(item => {
            const pending = (item.quantity_ordered || 0) - (item.quantity_received || 0);
            return pending > 0;
        });

        if (pendingItems.length === 0) {
            toastr.info('No hay items pendientes de recepción');
            return;
        }

        renderReceiveItemsForm(pendingItems);
        $('#receiveItemsModal').modal('show');
    }

    function renderReceiveItemsForm(items) {
        const html = items.map(item => {
            const pending = (item.quantity_ordered || 0) - (item.quantity_received || 0);
            const productName = item.product_name || item.product?.name || 'Producto sin nombre';
            const productCode = item.product_code || item.product?.code || '';

            return `
                <tr data-item-id="${item.id}">
                    <td>
                        <strong>${productName}</strong>
                        ${productCode ? `<br><small class="text-muted">${productCode}</small>` : ''}
                    </td>
                    <td class="text-center">${item.quantity_ordered || 0}</td>
                    <td class="text-center">${item.quantity_received || 0}</td>
                    <td class="text-center"><strong>${pending}</strong></td>
                    <td>
                        <input type="number" class="form-control receive-qty"
                               min="0" max="${pending}" value="${pending}"
                               placeholder="Cantidad">
                    </td>
                </tr>
            `;
        }).join('');

        $('#receiveItemsTableBody').html(html);
    }

    function processItemsReception() {
        const items = [];

        $('#receiveItemsTableBody tr[data-item-id]').each(function() {
            const row = $(this);
            const itemId = row.data('item-id');
            const quantity = row.find('.receive-qty').val();

            if (quantity && quantity > 0) {
                items.push({
                    item_id: itemId,
                    quantity_received: parseInt(quantity)
                });
            }
        });

        if (items.length === 0) {
            toastr.warning('Ingrese cantidades a recibir');
            return;
        }

        showLoading('Procesando recepción...');

        $.ajax({
            url: API_URLS.receiveItems,
            method: 'POST',
            contentType: 'application/json',
            headers: {
                'X-CSRFToken': window.PO_CONFIG?.csrfToken || $('[name=csrfmiddlewaretoken]').val()
            },
            data: JSON.stringify({received_items: items}),
            success: function(response) {
                toastr.success('Items recibidos correctamente');
                $('#receiveItemsModal').modal('hide');
                loadPODetails();
            },
            error: function(xhr) {
                console.error('Error receiving items:', xhr);
                const errorMsg = xhr.responseJSON?.error || 'Error al procesar la recepción';
                toastr.error(errorMsg);
            },
            complete: function() {
                hideLoading();
            }
        });
    }

    function exportToPdf() {
        showLoading('Generando PDF...');

        // Crear un iframe temporal para la descarga
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = API_URLS.exportPdf;
        document.body.appendChild(iframe);

        // Remover el iframe después de un tiempo
        setTimeout(() => {
            document.body.removeChild(iframe);
            hideLoading();
        }, 3000);

        toastr.info('Descarga iniciada...');
    }

    function getStatusConfig(status) {
        const configs = {
            'draft': { color: 'secondary', text: 'Borrador', icon: '📝' },
            'sent': { color: 'info', text: 'Enviada', icon: '📤' },
            'confirmed': { color: 'primary', text: 'Confirmada', icon: '✅' },
            'partially_received': { color: 'warning', text: 'Parcialmente Recibida', icon: '📦' },
            'completed': { color: 'success', text: 'Completada', icon: '🎉' },
            'cancelled': { color: 'danger', text: 'Cancelada', icon: '❌' }
        };
        return configs[status] || { color: 'secondary', text: status || 'Sin estado', icon: '📋' };
    }

    function getPriorityBadge(priority) {
        const priorities = {
            'normal': '<span class="badge bg-label-info">Normal</span>',
            'high': '<span class="badge bg-label-warning">Alta</span>',
            'urgent': '<span class="badge bg-label-danger">Urgente</span>'
        };
        return priorities[priority] || '<span class="badge bg-label-info">Normal</span>';
    }

    function getAvailableActions(po) {
        const actions = [];
        const status = po.status;

        // Cambios de estado disponibles
        if (status === 'draft') {
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

        // Acciones generales
        if (status !== 'cancelled' && status !== 'completed') {
            actions.push({
                action: 'send_reminder',
                text: 'Enviar Recordatorio',
                icon: 'ri-notification-line',
                class: ''
            });
        }

        actions.push({
            action: 'duplicate_order',
            text: 'Duplicar Orden',
            icon: 'ri-file-copy-line',
            class: ''
        });

        // Cancelar (solo si no está completada o cancelada)
        if (!['completed', 'cancelled'].includes(status)) {
            actions.push({
                action: 'cancel_order',
                text: 'Cancelar Orden',
                icon: 'ri-close-line',
                class: 'text-danger'
            });
        }

        return actions;
    }

    function setupAutoRefresh() {
        // Actualizar cada 5 minutos si la página está visible
        setInterval(function() {
            if (document.visibilityState === 'visible' && currentPO) {
                // Solo actualizar si la orden no está completada o cancelada
                if (!['completed', 'cancelled'].includes(currentPO.status)) {
                    loadPODetails();
                }
            }
        }, 300000); // 5 minutos
    }

    function showLoading(text = 'Cargando...') {
        $('#loadingText').text(text);
        $('#loadingOverlay').removeClass('d-none');
    }

    function hideLoading() {
        $('#loadingOverlay').addClass('d-none');
    }

    // ✅ Funciones adicionales para acciones que pueden faltar
    function changeOrderStatus(newStatus) {
        console.log('Changing status to:', newStatus);
        // Implementar lógica de cambio de estado
    }

    function cancelOrder() {
        console.log('Canceling order');
        // Implementar lógica de cancelación
    }

    function duplicateOrder() {
        console.log('Duplicating order');
        // Implementar lógica de duplicación
    }

    function sendReminder() {
        console.log('Sending reminder');
        // Implementar lógica de recordatorio
    }

    function renderOrderHistory(history) {
        console.log('Rendering history:', history);
        // Implementar renderizado de historial
    }
});
