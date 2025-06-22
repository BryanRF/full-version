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
    receiveItems: `/purchasing/purchase-orders/${poId}/receive_items/`, // ← corregido
    exportPdf: `/purchasing/purchase-orders/${poId}/export_pdf/`,       // ← corregido
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
                                    <a href="/app/purchase-orders/list/" class="btn btn-primary">
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
 // Agregar validación en tiempo real
    $('.receive-qty').on('input change', function() {
        const input = $(this);
        const max = parseInt(input.data('max'));
        const value = parseInt(input.val()) || 0;

        if (value > max) {
            input.val(max);
            input.addClass('is-invalid');
            setTimeout(() => input.removeClass('is-invalid'), 2000);
            toastr.warning(`Cantidad máxima: ${max} unidades`);
        } else if (value < 0) {
            input.val(0);
        }

        updateReceiveTotals();
    });

    updateReceiveTotals();


    }
function updateReceiveTotals() {
    let totalToReceive = 0;
    let itemsToReceive = 0;

    $('.receive-qty').each(function() {
        const qty = parseInt($(this).val()) || 0;
        if (qty > 0) {
            totalToReceive += qty;
            itemsToReceive++;
        }
    });

    $('#totalToReceive').text(totalToReceive);
    $('#itemsToReceive').text(itemsToReceive);

    // Habilitar/deshabilitar botón de confirmación
    $('#confirmReceiveBtn').prop('disabled', totalToReceive === 0);
}
   function processItemsReception() {
    const items = [];
    let hasValidItems = false;

    $('#receiveItemsTableBody tr[data-item-id]').each(function() {
        const row = $(this);
        const itemId = row.data('item-id');
        const quantity = parseInt(row.find('.receive-qty').val()) || 0;
        const notes = row.find('.item-notes').val().trim();

        if (quantity > 0) {
            items.push({
                item_id: itemId,
                quantity_received: quantity,
                reception_notes: notes || ''
            });
            hasValidItems = true;
        }
    });

    if (!hasValidItems) {
        toastr.warning('Ingrese al menos una cantidad a recibir');
        return;
    }

    // Modal de confirmación final
    Swal.fire({
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
        customClass: {
            confirmButton: 'btn btn-success me-2',
            cancelButton: 'btn btn-outline-secondary'
        },
        buttonsStyling: false,
        preConfirm: () => {
            return {
                items: items,
                general_notes: document.getElementById('generalNotes').value.trim(),
                update_inventory: document.getElementById('updateInventory').checked
            };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            performItemsReception(result.value);
        }
    });
}
function performItemsReception(receptionData) {
    showLoading('Procesando recepción...');

    $.ajax({
        url: API_URLS.receiveItems,
        method: 'POST',
        contentType: 'application/json',
        headers: {
            'X-CSRFToken': window.PO_CONFIG?.csrfToken || $('[name=csrfmiddlewaretoken]').val()
        },
        data: JSON.stringify({
            received_items: receptionData.items,
            general_notes: receptionData.general_notes,
            update_inventory: receptionData.update_inventory
        }),
        success: function(response) {
            toastr.success('Items recibidos correctamente');
            $('#receiveItemsModal').modal('hide');

            // Mostrar resumen de recepción
            showReceptionSummary(response);

            // Recargar datos de la orden
            loadPODetails();
        },
        error: function(xhr) {
            console.error('Error receiving items:', xhr);
            const errorData = xhr.responseJSON || {};
            const errorMsg = errorData.error || 'Error al procesar la recepción';

            // Mostrar errores específicos si existen
            if (errorData.item_errors) {
                showItemErrors(errorData.item_errors);
            } else {
                toastr.error(errorMsg);
            }
        },
        complete: function() {
            hideLoading();
        }
    });
}

function showItemErrors(itemErrors) {
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
        confirmButtonText: 'Revisar',
        customClass: {
            confirmButton: 'btn btn-warning'
        },
        buttonsStyling: false
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

    /**
 * Funciones completas para Purchase Orders Detail
 * Siguiendo la estructura y patrones del proyecto
 */

// ✅ 1. Función para cambiar estado de la orden
function changeOrderStatus(newStatus) {
    if (!currentPO) {
        toastr.error('No hay datos de la orden disponibles');
        return;
    }

    // Validar transición de estado
    if (!isValidStatusTransition(currentPO.status, newStatus)) {
        toastr.error('Transición de estado no válida');
        return;
    }

    // Confirmar cambio de estado
    const statusConfig = getStatusConfig(newStatus);
    const currentStatusConfig = getStatusConfig(currentPO.status);

    Swal.fire({
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
        customClass: {
            confirmButton: 'btn btn-primary me-2',
            cancelButton: 'btn btn-outline-secondary'
        },
        buttonsStyling: false
    }).then((result) => {
        if (result.isConfirmed) {
            performStatusChange(newStatus);
        }
    });
}

function performStatusChange(newStatus) {
    showLoading('Cambiando estado...');

    $.ajax({
        url: API_URLS.poActions,
        method: 'POST',
        contentType: 'application/json',
        headers: {
            'X-CSRFToken': window.PO_CONFIG?.csrfToken || $('[name=csrfmiddlewaretoken]').val()
        },
        data: JSON.stringify({
            action: 'change_status',
            new_status: newStatus
        }),
        success: function(response) {
            const statusConfig = getStatusConfig(newStatus);
            toastr.success(`Estado cambiado a ${statusConfig.text}`);

            // Actualizar datos locales
            currentPO.status = newStatus;

            // Re-renderizar componentes afectados
            renderPODetails(response);
            setupActionButtons(response);

            // Notificar el cambio
            triggerStatusChangeNotification(newStatus);
        },
        error: function(xhr) {
            console.error('Error changing status:', xhr);
            const errorMsg = xhr.responseJSON?.error || 'Error al cambiar el estado';
            toastr.error(errorMsg);
        },
        complete: function() {
            hideLoading();
        }
    });
}

function isValidStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
        'draft': ['sent', 'cancelled'],
        'sent': ['confirmed', 'cancelled'],
        'confirmed': ['partially_received', 'completed', 'cancelled'],
        'partially_received': ['completed', 'cancelled']
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
}

// ✅ 2. Función para cancelar orden
function cancelOrder() {
    if (!currentPO) {
        toastr.error('No hay datos de la orden disponibles');
        return;
    }

    // Verificar si se puede cancelar
    if (['completed', 'cancelled'].includes(currentPO.status)) {
        toastr.error('No se puede cancelar una orden completada o ya cancelada');
        return;
    }

    // Modal de confirmación con razón de cancelación
    Swal.fire({
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
        customClass: {
            confirmButton: 'btn btn-danger me-2',
            cancelButton: 'btn btn-outline-secondary'
        },
        buttonsStyling: false,
        preConfirm: () => {
            const reason = document.getElementById('cancellationReason').value.trim();
            if (!reason) {
                Swal.showValidationMessage('La razón de cancelación es requerida');
                return false;
            }
            return reason;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            performOrderCancellation(result.value);
        }
    });
}

function performOrderCancellation(reason) {
    showLoading('Cancelando orden...');

    $.ajax({
        url: API_URLS.poActions,
        method: 'POST',
        contentType: 'application/json',
        headers: {
            'X-CSRFToken': window.PO_CONFIG?.csrfToken || $('[name=csrfmiddlewaretoken]').val()
        },
        data: JSON.stringify({
            action: 'cancel_order',
            reason: reason
        }),
        success: function(response) {
            toastr.success('Orden cancelada exitosamente');

            // Actualizar estado local
            currentPO.status = 'cancelled';

            // Re-renderizar vista
            loadPODetails();

            // Mostrar alerta de cancelación
            showCancellationAlert(reason);
        },
        error: function(xhr) {
            console.error('Error cancelling order:', xhr);
            const errorMsg = xhr.responseJSON?.error || 'Error al cancelar la orden';
            toastr.error(errorMsg);
        },
        complete: function() {
            hideLoading();
        }
    });
}

function showCancellationAlert(reason) {
    const alertHtml = `
        <div class="alert alert-danger alert-dismissible fade show" role="alert">
            <h5 class="alert-heading">
                <i class="ri-close-circle-line me-2"></i>Orden Cancelada
            </h5>
            <p class="mb-2"><strong>Razón:</strong> ${reason}</p>
            <hr>
            <p class="mb-0">
                <small>Esta orden ha sido cancelada y no se pueden realizar más acciones sobre ella.</small>
            </p>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;

    $('#alertContainer').html(alertHtml);
}

// ✅ 3. Función para duplicar orden
function duplicateOrder() {
    if (!currentPO) {
        toastr.error('No hay datos de la orden disponibles');
        return;
    }

    // Modal de configuración de duplicación
    Swal.fire({
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
                                value="${moment().add(7, 'days').format('YYYY-MM-DD')}"
                                min="${moment().format('YYYY-MM-DD')}"
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
        customClass: {
            confirmButton: 'btn btn-primary me-2',
            cancelButton: 'btn btn-outline-secondary'
        },
        buttonsStyling: false,
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
    }).then((result) => {
        if (result.isConfirmed) {
            performOrderDuplication(result.value);
        }
    });
}

function performOrderDuplication(options) {
    showLoading('Duplicando orden...');

    $.ajax({
        url: API_URLS.poActions,
        method: 'POST',
        contentType: 'application/json',
        headers: {
            'X-CSRFToken': window.PO_CONFIG?.csrfToken || $('[name=csrfmiddlewaretoken]').val()
        },
        data: JSON.stringify({
            action: 'duplicate_order',
            options: options
        }),
        success: function(response) {
            toastr.success('Orden duplicada exitosamente');

            // Mostrar opción de ir a la nueva orden
            Swal.fire({
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
                            Número de Orden: <strong>${response.new_po_number}</strong>
                        </p>
                        <p class="text-muted">¿Desea ir a la nueva orden?</p>
                    </div>
                `,
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: 'Ir a Nueva Orden',
                cancelButtonText: 'Quedarse Aquí',
                customClass: {
                    confirmButton: 'btn btn-primary me-2',
                    cancelButton: 'btn btn-outline-secondary'
                },
                buttonsStyling: false
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = `/app/purchase-orders/detail/${response.new_po_id}/`;
                }
            });
        },
        error: function(xhr) {
            console.error('Error duplicating order:', xhr);
            const errorMsg = xhr.responseJSON?.error || 'Error al duplicar la orden';
            toastr.error(errorMsg);
        },
        complete: function() {
            hideLoading();
        }
    });
}

// ✅ 4. Función para enviar recordatorio
function sendReminder() {
    if (!currentPO) {
        toastr.error('No hay datos de la orden disponibles');
        return;
    }

    // Modal de configuración del recordatorio
    Swal.fire({
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
                            <div class="fw-medium">${currentPO.supplier?.company_name || 'Sin proveedor'}</div>
                            <small class="text-muted">${currentPO.supplier?.email || 'Sin email'}</small>
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
        customClass: {
            confirmButton: 'btn btn-primary me-2',
            cancelButton: 'btn btn-outline-secondary'
        },
        buttonsStyling: false,
        preConfirm: () => {
            return {
                type: document.getElementById('reminderType').value,
                message: document.getElementById('reminderMessage').value.trim(),
                include_details: document.getElementById('includeOrderDetails').checked
            };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            performSendReminder(result.value);
        }
    });
}

function performSendReminder(options) {
    showLoading('Enviando recordatorio...');

    $.ajax({
        url: API_URLS.poActions,
        method: 'POST',
        contentType: 'application/json',
        headers: {
            'X-CSRFToken': window.PO_CONFIG?.csrfToken || $('[name=csrfmiddlewaretoken]').val()
        },
        data: JSON.stringify({
            action: 'send_reminder',
            reminder_options: options
        }),
        success: function(response) {
            toastr.success('Recordatorio enviado exitosamente');

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
                            <strong>${currentPO.supplier?.email || 'Proveedor'}</strong>
                        </p>
                    </div>
                `,
                icon: 'success',
                confirmButtonText: 'Entendido',
                customClass: {
                    confirmButton: 'btn btn-primary'
                },
                buttonsStyling: false
            });

            // Registrar en historial si existe
            addToOrderHistory({
                action: 'reminder_sent',
                description: `Recordatorio enviado: ${options.type}`,
                timestamp: new Date().toISOString()
            });
        },
        error: function(xhr) {
            console.error('Error sending reminder:', xhr);
            const errorMsg = xhr.responseJSON?.error || 'Error al enviar el recordatorio';
            toastr.error(errorMsg);
        },
        complete: function() {
            hideLoading();
        }
    });
}

// ✅ 5. Función para renderizar historial de orden
function renderOrderHistory(history) {
    if (!history || !Array.isArray(history)) {
        $('#orderHistoryContainer').html(`
            <div class="text-center py-4">
                <i class="ri-history-line ri-48px text-muted mb-3"></i>
                <p class="text-muted">No hay historial disponible</p>
            </div>
        `);
        return;
    }

    if (history.length === 0) {
        $('#orderHistoryContainer').html(`
            <div class="text-center py-4">
                <i class="ri-time-line ri-48px text-muted mb-3"></i>
                <p class="text-muted">Aún no hay actividades registradas</p>
            </div>
        `);
        return;
    }

    const historyHtml = history.map(item => {
        const actionIcon = getHistoryActionIcon(item.action);
        const actionColor = getHistoryActionColor(item.action);
        const timeAgo = moment(item.timestamp).fromNow();
        const fullDate = moment(item.timestamp).format('DD/MM/YYYY HH:mm');

        return `
            <div class="timeline-item">
                <div class="timeline-point timeline-point-${actionColor}">
                    <i class="${actionIcon}"></i>
                </div>
                <div class="timeline-content">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                        <h6 class="mb-0">${item.title || getHistoryActionTitle(item.action)}</h6>
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

    $('#orderHistoryContainer').html(`
        <div class="timeline">
            ${historyHtml}
        </div>
    `);
}

function getHistoryActionIcon(action) {
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
}

function getHistoryActionColor(action) {
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
}

function getHistoryActionTitle(action) {
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
}

// ✅ Función auxiliar para agregar al historial
function addToOrderHistory(historyItem) {
    if (!currentPO.history) {
        currentPO.history = [];
    }

    currentPO.history.unshift({
        ...historyItem,
        id: Date.now(),
        user: window.currentUser?.username || 'Usuario',
        timestamp: historyItem.timestamp || new Date().toISOString()
    });

    renderOrderHistory(currentPO.history);
}

// ✅ Función para notificar cambio de estado
function triggerStatusChangeNotification(newStatus) {
    // Emitir evento personalizado para otros componentes
    const event = new CustomEvent('poStatusChanged', {
        detail: {
            poId: currentPO.id,
            oldStatus: currentPO.status,
            newStatus: newStatus,
            poNumber: currentPO.po_number
        }
    });

    window.dispatchEvent(event);

    // Actualizar título de la página si es necesario
    const statusConfig = getStatusConfig(newStatus);
    document.title = `${currentPO.po_number} - ${statusConfig.text} | Purchase Orders`;
}

// ✅ Funciones auxiliares para validación
function validateOrderForAction(action) {
    if (!currentPO) {
        toastr.error('No hay datos de la orden disponibles');
        return false;
    }

    const validations = {
        'change_status': () => currentPO.status !== 'completed' && currentPO.status !== 'cancelled',
        'cancel_order': () => !['completed', 'cancelled'].includes(currentPO.status),
        'duplicate_order': () => true, // Siempre permitido
        'send_reminder': () => currentPO.status !== 'cancelled' && currentPO.supplier?.email,
        'receive_items': () => ['confirmed', 'partially_received'].includes(currentPO.status)
    };

    const validator = validations[action];
    if (validator && !validator()) {
        toastr.warning('Esta acción no está disponible en el estado actual');
        return false;
    }

    return true;
}
});
