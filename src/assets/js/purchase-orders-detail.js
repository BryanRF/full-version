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
        // Actualizar encabezado
        $('#poNumber').text(po.po_number);

        // Información del proveedor y estado
        const statusConfig = getStatusConfig(po.status);
        $('#supplierName').text(po.supplier?.company_name || 'Sin proveedor');
        $('#supplierContact').text(po.supplier?.contact_person || '');
        $('#statusBadge').removeClass().addClass(`badge bg-label-${statusConfig.color}`).text(statusConfig.text);
        $('#statusIcon').text(statusConfig.icon);

        // Progreso
        const progress = po.completion_percentage || 0;
        $('#progressBadge').text(`${progress}%`);

        // Monto total
        $('#totalAmount').text(`S/.${parseFloat(po.total_amount || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})}`);

        // Información básica
        $('#orderNumber').text(po.po_number);
        $('#orderDate').text(moment(po.order_date).format('DD/MM/YYYY'));
        $('#expectedDelivery').text(moment(po.expected_delivery).format('DD/MM/YYYY'));
        $('#priority').html(getPriorityBadge(po.priority));
        $('#currentStatus').html(`<span class="badge bg-label-${statusConfig.color}">${statusConfig.text}</span>`);
        $('#paymentTerms').text(po.payment_terms || '-');
        $('#notes').text(po.notes || '-');
        $('#createdBy').text(po.created_by?.username || '-');
        $('#createdAt').text(moment(po.created_at).format('DD/MM/YYYY HH:mm'));

        // Información del proveedor
        renderSupplierInfo(po.supplier);

        // Items de la orden
        renderOrderItems(po.items || []);

        // Estadísticas
        renderOrderStats(po);

        // Historial si está disponible
        if (po.history) {
            renderOrderHistory(po.history);
        }
    }

    function renderSupplierInfo(supplier) {
        if (!supplier) {
            $('#supplierDetails').html('<p class="text-muted">Sin información del proveedor</p>');
            return;
        }
        const companyName = supplier.company_name || supplier.name || 'Sin nombre';
        const html = `
            <div class="d-flex align-items-center mb-3">
                <div class="avatar avatar-lg me-3">
                    <span class="avatar-initial rounded bg-label-primary">
                        ${companyName.charAt(0).toUpperCase()}
                    </span>
                </div>
                <div>
                    <h6 class="mb-1">${supplier.company_name}</h6>
                    <p class="mb-0 text-muted">${supplier.contact_person || ''}</p>
                </div>
            </div>

            <div class="contact-info">
                ${supplier.email ? `
                    <div class="d-flex align-items-center mb-2">
                        <i class="ri-mail-line me-2 text-muted"></i>
                        <a href="mailto:${supplier.email}">${supplier.email}</a>
                    </div>
                ` : ''}

                ${supplier.phone ? `
                    <div class="d-flex align-items-center mb-2">
                        <i class="ri-phone-line me-2 text-muted"></i>
                        <a href="tel:${supplier.phone}">${supplier.phone}</a>
                    </div>
                ` : ''}

                ${supplier.address ? `
                    <div class="d-flex align-items-center">
                        <i class="ri-map-pin-line me-2 text-muted"></i>
                        <span>${supplier.address}</span>
                    </div>
                ` : ''}
            </div>
        `;

        $('#supplierDetails').html(html);
    }

    function renderOrderItems(items) {
        if (!items || items.length === 0) {
            $('#orderItems').html(`
                <div class="text-center py-4">
                    <i class="ri-shopping-cart-line ri-48px text-muted mb-3"></i>
                    <p class="text-muted">No hay items en esta orden</p>
                </div>
            `);
            return;
        }

        const html = `
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th class="text-center">Ordenado</th>
                            <th class="text-center">Recibido</th>
                            <th class="text-center">Pendiente</th>
                            <th class="text-end">P. Unit.</th>
                            <th class="text-end">Subtotal</th>
                            <th class="text-center">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => {
                            const received = item.quantity_received || 0;
                            const pending = item.quantity_ordered - received;
                            const isComplete = received >= item.quantity_ordered;

                            return `
                                <tr>
                                    <td>
                                        <div>
                                            <strong>${item.product_name || item.product_code}</strong>
                                            ${item.product_code ? `<br><small class="text-muted">${item.product_code}</small>` : ''}
                                            ${item.notes ? `<br><small class="text-info">${item.notes}</small>` : ''}
                                        </div>
                                    </td>
                                    <td class="text-center">${item.quantity_ordered}</td>
                                    <td class="text-center">
                                        <span class="${isComplete ? 'text-success' : 'text-warning'}">
                                            ${received}
                                        </span>
                                    </td>
                                    <td class="text-center">
                                        <span class="${pending === 0 ? 'text-success' : 'text-warning'}">
                                            ${pending}
                                        </span>
                                    </td>
                                    <td class="text-end">S/.${parseFloat(item.unit_price).toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                                    <td class="text-end">S/.${parseFloat(item.total_price).toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                                    <td class="text-center">
                                        ${isComplete ?
                                            '<span class="badge bg-label-success">Completo</span>' :
                                            '<span class="badge bg-label-warning">Pendiente</span>'
                                        }
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                    <tfoot class="table-secondary">
                        <tr>
                            <th colspan="6" class="text-end">Total:</th>
                            <th class="text-center">
                                S/.${items.reduce((sum, item) => sum + parseFloat(item.total_price), 0).toLocaleString('es-PE', {minimumFractionDigits: 2})}
                            </th>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        $('#orderItems').html(html);
    }

    function renderOrderStats(po) {
        const totalItems = po.items?.length || 0;
        const totalOrdered = po.items?.reduce((sum, item) => sum + item.quantity_ordered, 0) || 0;
        const totalReceived = po.items?.reduce((sum, item) => sum + (item.quantity_received || 0), 0) || 0;
        const totalPending = totalOrdered - totalReceived;
        const completionRate = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

        $('#statsItems').text(totalItems);
        $('#statsOrdered').text(totalOrdered);
        $('#statsReceived').text(totalReceived);
        $('#statsPending').text(totalPending);

        // Actualizar barra de progreso
        $('#completionProgress').css('width', `${completionRate}%`);
        $('#completionText').text(`${completionRate}% Completado`);
    }

    function setupActionButtons(po) {
        const actions = getAvailableActions(po);
        const html = actions.map(action =>
            `<li><a class="dropdown-item ${action.class}" href="#" data-action="${action.action}" ${action.data || ''}>
                <i class="${action.icon} me-2"></i>${action.text}
            </a></li>`
        ).join('');

        $('#actionsList').html(html);
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

    function changeOrderStatus(newStatus) {
        const statusNames = {
            'draft': 'Borrador',
            'sent': 'Enviada',
            'confirmed': 'Confirmada',
            'partially_received': 'Parcialmente Recibida',
            'completed': 'Completada',
            'cancelled': 'Cancelada'
        };

        Swal.fire({
            title: '¿Confirmar cambio de estado?',
            text: `La orden cambiará a estado: ${statusNames[newStatus]}`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, cambiar',
            cancelButtonText: 'Cancelar',
            input: newStatus === 'cancelled' ? 'textarea' : null,
            inputPlaceholder: newStatus === 'cancelled' ? 'Motivo de cancelación (opcional)' : null
        }).then((result) => {
            if (result.isConfirmed) {
                showLoading('Cambiando estado...');

                $.ajax({
                    url: API_URLS.poActions,
                    method: 'POST',
                    data: {
                        action: 'change_status',
                        status: newStatus,
                        reason: result.value || '',
                        csrfmiddlewaretoken: $('[name=csrfmiddlewaretoken]').val()
                    },
                    success: function(response) {
                        toastr.success('Estado cambiado correctamente');
                        loadPODetails();
                    },
                    error: function(xhr) {
                        console.error('Error changing status:', xhr);
                        toastr.error('Error al cambiar el estado');
                    },
                    complete: function() {
                        hideLoading();
                    }
                });
            }
        });
    }

    function openReceiveItemsModal() {
        if (!currentPO || !currentPO.items) {
            toastr.error('No hay datos de la orden disponibles');
            return;
        }

        const pendingItems = currentPO.items.filter(item => {
            const pending = item.quantity_ordered - (item.quantity_received || 0);
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
            const pending = item.quantity_ordered - (item.quantity_received || 0);

            return `
                <div class="row align-items-center mb-3 border-bottom pb-3" data-item-id="${item.id}">
                    <div class="col-md-5">
                        <strong>${item.product_name || item.product_code}</strong>
                        ${item.product_code ? `<br><small class="text-muted">${item.product_code}</small>` : ''}
                    </div>
                    <div class="col-md-2 text-center">
                        <small class="text-muted">Pendiente</small><br>
                        <strong>${pending}</strong>
                    </div>
                    <div class="col-md-3">
                        <input type="number" class="form-control receive-qty"
                               min="0" max="${pending}" value="${pending}"
                               placeholder="Cantidad">
                    </div>
                    <div class="col-md-2">
                        <div class="form-check">
                            <input class="form-check-input receive-check" type="checkbox" checked>
                            <label class="form-check-label">Recibir</label>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        $('#receiveItemsList').html(html);
    }

    function processItemsReception() {
        const items = [];

        $('.receive-check:checked').each(function() {
            const row = $(this).closest('[data-item-id]');
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
            toastr.warning('Seleccione al menos un item para recibir');
            return;
        }

        showLoading('Procesando recepción...');

        $.ajax({
            url: API_URLS.receiveItems,
            method: 'POST',
            data: {
                items: JSON.stringify(items),
                csrfmiddlewaretoken: $('[name=csrfmiddlewaretoken]').val()
            },
            success: function(response) {
                toastr.success('Items recibidos correctamente');
                $('#receiveItemsModal').modal('hide');
                loadPODetails();
            },
            error: function(xhr) {
                console.error('Error receiving items:', xhr);
                toastr.error('Error al procesar la recepción');
            },
            complete: function() {
                hideLoading();
            }
        });
    }

    function cancelOrder() {
        Swal.fire({
            title: '¿Cancelar orden de compra?',
            text: 'Esta acción no se puede deshacer',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, cancelar',
            cancelButtonText: 'No cancelar',
            confirmButtonColor: '#d33',
            input: 'textarea',
            inputPlaceholder: 'Motivo de cancelación (opcional)',
            inputValidator: (value) => {
                if (!value.trim()) {
                    return 'Debe especificar un motivo para cancelar';
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                changeOrderStatus('cancelled');
            }
        });
    }

    function duplicateOrder() {
        Swal.fire({
            title: '¿Duplicar orden de compra?',
            text: 'Se creará una nueva orden con los mismos productos',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, duplicar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                showLoading('Duplicando orden...');

                $.ajax({
                    url: API_URLS.poActions,
                    method: 'POST',
                    data: {
                        action: 'duplicate',
                        csrfmiddlewaretoken: $('[name=csrfmiddlewaretoken]').val()
                    },
                    success: function(response) {
                        toastr.success('Orden duplicada correctamente');
                        setTimeout(() => {
                            window.location.href = `/purchasing/app/purchase-orders/detail/${response.new_po_id}/`;
                        }, 1000);
                    },
                    error: function(xhr) {
                        console.error('Error duplicating order:', xhr);
                        toastr.error('Error al duplicar la orden');
                    },
                    complete: function() {
                        hideLoading();
                    }
                });
            }
        });
    }

    function sendReminder() {
        showLoading('Enviando recordatorio...');

        $.ajax({
            url: API_URLS.poActions,
            method: 'POST',
            data: {
                action: 'send_reminder',
                csrfmiddlewaretoken: $('[name=csrfmiddlewaretoken]').val()
            },
            success: function(response) {
                toastr.success('Recordatorio enviado correctamente');
            },
            error: function(xhr) {
                console.error('Error sending reminder:', xhr);
                toastr.error('Error al enviar el recordatorio');
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
        return configs[status] || { color: 'secondary', text: status, icon: '📋' };
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

        // Cambios de estado disponibles
        if (po.status === 'draft') {
            actions.push({
                action: 'change_status',
                text: 'Enviar',
                icon: 'ri-send-plane-line',
                class: 'text-primary',
                data: 'data-status="sent"'
            });
        }

        if (po.status === 'sent') {
            actions.push({
                action: 'change_status',
                text: 'Confirmar',
                icon: 'ri-check-line',
                class: 'text-success',
                data: 'data-status="confirmed"'
            });
        }

        if (po.status === 'confirmed' || po.status === 'partially_received') {
            actions.push({
                action: 'receive_items',
                text: 'Recibir Items',
                icon: 'ri-truck-line',
                class: 'text-warning'
            });
        }

        // Acciones generales
        if (po.status !== 'cancelled' && po.status !== 'completed') {
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
        if (!['completed', 'cancelled'].includes(po.status)) {
            actions.push({
                action: 'cancel_order',
                text: 'Cancelar Orden',
                icon: 'ri-close-line',
                class: 'text-danger'
            });
        }

        return actions;
    }

    function renderOrderHistory(history) {
        if (!history || history.length === 0) {
            $('#orderHistory').html('<p class="text-muted">No hay historial disponible</p>');
            return;
        }

        const html = history.map(entry => `
            <div class="timeline-item">
                <div class="timeline-marker bg-primary"></div>
                <div class="timeline-content">
                    <h6 class="mb-1">${entry.action}</h6>
                    <p class="text-muted mb-1">${entry.description}</p>
                    <small class="text-muted">
                        ${moment(entry.created_at).format('DD/MM/YYYY HH:mm')} - ${entry.user}
                    </small>
                </div>
            </div>
        `).join('');

        $('#orderHistory').html(`<div class="timeline">${html}</div>`);
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
});
