/**
 * Purchase Orders List JavaScript
 * Funcionalidades para la lista de órdenes de compra
 */

$(document).ready(function() {
    'use strict';

    let dtPurchaseOrders;
    let currentPO = null;

    // URLs de la API
    const API_URLS = {
        purchaseOrders: '/purchasing/purchase-orders/data/',
        poDetails: '/purchasing/purchase-orders/{id}/',
        poActions: '/purchasing/purchase-orders/{id}/actions/',
        receiveItems: '/purchasing/purchase-orders/{id}/receive-items/',
        analytics: '/purchasing/purchase-orders/dashboard-analytics/'
    };

    // Inicialización
    init();

    function init() {
        initDataTable();
        loadAnalytics();
        bindEvents();
        setupRefreshInterval();
    }

    function initDataTable() {
        if ($.fn.DataTable.isDataTable('.datatables-purchase-orders')) {
            $('.datatables-purchase-orders').DataTable().destroy();
        }

        dtPurchaseOrders = $('.datatables-purchase-orders').DataTable({
            ajax: {
                url: API_URLS.purchaseOrders,
                type: 'GET',
                dataSrc: function(response) {
                    updateAnalytics(response.analytics);
                    return response.data || [];
                },
                error: function(xhr, error, thrown) {
                    console.error('Error loading purchase orders:', error);
                    toastr.error('Error al cargar las órdenes de compra');
                }
            },
            columns: [
                { data: '' }, // Expand button
                { data: '' }, // Select checkbox
                { data: 'po_number' },
                { 
                    data: 'supplier',
                    render: function(data, type, row) {
                        if (!data) return '-';
                        return `
                            <div class="d-flex align-items-center">
                                <div class="avatar avatar-sm me-3">
                                    <span class="avatar-initial rounded-circle bg-label-primary">
                                        ${data.company_name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <h6 class="mb-0">${data.company_name}</h6>
                                    <small class="text-muted">${data.contact_person || ''}</small>
                                </div>
                            </div>
                        `;
                    }
                },
                { 
                    data: 'status',
                    render: function(data, type, row) {
                        const statusConfig = getStatusConfig(data);
                        return `<span class="badge bg-label-${statusConfig.color}">${statusConfig.text}</span>`;
                    }
                },
                { 
                    data: 'order_date',
                    render: function(data, type, row) {
                        return data ? moment(data).format('DD/MM/YYYY') : '-';
                    }
                },
                { 
                    data: 'expected_delivery',
                    render: function(data, type, row) {
                        if (!data) return '-';
                        const deliveryDate = moment(data);
                        const today = moment();
                        const daysUntil = deliveryDate.diff(today, 'days');
                        
                        let badgeClass = 'bg-label-success';
                        if (daysUntil < 0) badgeClass = 'bg-label-danger';
                        else if (daysUntil <= 3) badgeClass = 'bg-label-warning';
                        
                        return `
                            <div>
                                ${deliveryDate.format('DD/MM/YYYY')}
                                <span class="badge ${badgeClass} ms-1">${daysUntil}d</span>
                            </div>
                        `;
                    }
                },
                { 
                    data: 'total_amount',
                    render: function(data, type, row) {
                        return data ? `S/.${parseFloat(data).toLocaleString('es-PE', {minimumFractionDigits: 2})}` : 'S/.0.00';
                    }
                },
                { 
                    data: 'items_count',
                    render: function(data, type, row) {
                        const received = row.items_received || 0;
                        const total = data || 0;
                        const percentage = total > 0 ? Math.round((received / total) * 100) : 0;
                        
                        return `
                            <div class="d-flex align-items-center">
                                <span class="me-2">${received}/${total}</span>
                                <div class="progress" style="width: 60px; height: 8px;">
                                    <div class="progress-bar" style="width: ${percentage}%"></div>
                                </div>
                                <small class="ms-2">${percentage}%</small>
                            </div>
                        `;
                    }
                },
                { 
                    data: '',
                    orderable: false,
                    searchable: false,
                    render: function(data, type, row) {
                        return `
                            <div class="d-flex align-items-center gap-2">
                                <button class="btn btn-sm btn-outline-info view-details" 
                                        data-id="${row.id}" title="Ver Detalles">
                                    <i class="ri-eye-line"></i>
                                </button>
                                <div class="dropdown">
                                    <button class="btn btn-sm btn-outline-secondary dropdown-toggle" 
                                            data-bs-toggle="dropdown">
                                        <i class="ri-more-2-line"></i>
                                    </button>
                                    <ul class="dropdown-menu">
                                        <li><a class="dropdown-item view-details" href="#" data-id="${row.id}">
                                            <i class="ri-eye-line me-2"></i>Ver Detalles</a></li>
                                        <li><a class="dropdown-item" href="/app/purchase-orders/detail/${row.id}/">
                                            <i class="ri-external-link-line me-2"></i>Abrir</a></li>
                                        ${getActionItems(row)}
                                    </ul>
                                </div>
                            </div>
                        `;
                    }
                }
            ],
            columnDefs: [
                {
                    className: 'control',
                    orderable: false,
                    targets: 0
                },
                {
                    targets: 1,
                    orderable: false,
                    checkboxes: {
                        selectRow: true
                    }
                }
            ],
            order: [[5, 'desc']], // Order by order_date
            dom: '<"card-header d-flex border-top rounded-0 flex-wrap py-md-0"<"me-5 ms-n2 pe-5"f><"d-flex justify-content-start justify-content-md-end align-items-baseline"<"dt-action-buttons d-flex align-items-start align-items-md-center justify-content-sm-center mb-3 mb-sm-0 gap-3"lB>>>t<"row mx-2"<"col-sm-12 col-md-6"i><"col-sm-12 col-md-6"p>>',
            lengthMenu: [10, 25, 50, 100],
            pageLength: 25,
            buttons: [
                {
                    extend: 'collection',
                    className: 'btn btn-outline-secondary dropdown-toggle me-3 waves-effect waves-light',
                    text: '<i class="ri-download-line me-1"></i>Exportar',
                    buttons: [
                        {
                            extend: 'excel',
                            text: '<i class="ri-file-excel-line me-2"></i>Excel',
                            className: 'dropdown-item',
                            exportOptions: {
                                columns: [2, 3, 4, 5, 6, 7, 8]
                            }
                        },
                        {
                            extend: 'pdf',
                            text: '<i class="ri-file-pdf-line me-2"></i>PDF',
                            className: 'dropdown-item',
                            exportOptions: {
                                columns: [2, 3, 4, 5, 6, 7, 8]
                            }
                        }
                    ]
                },
                {
                    text: '<i class="ri-add-line me-1"></i>Nueva Orden',
                    className: 'btn btn-primary waves-effect waves-light',
                    action: function() {
                        window.location.href = '/app/purchase-orders/create/';
                    }
                }
            ],
            responsive: {
                details: {
                    display: $.fn.dataTable.Responsive.display.modal({
                        header: function(row) {
                            return 'Detalles de la Orden ' + row.data().po_number;
                        }
                    }),
                    type: 'column',
                    renderer: function(api, rowIdx, columns) {
                        const data = $.map(columns, function(col, i) {
                            return col.hidden ?
                                '<tr data-dt-row="' + col.rowIndex + '" data-dt-column="' + col.columnIndex + '">' +
                                '<td>' + col.title + ':</td> ' +
                                '<td>' + col.data + '</td>' +
                                '</tr>' : '';
                        }).join('');

                        return data ? $('<table class="table"/><tbody />').append(data) : false;
                    }
                }
            },
            language: {
                url: '/static/vendor/libs/datatables-bs5/es.json'
            }
        });
    }

    function loadAnalytics() {
        $.get(API_URLS.analytics)
            .done(function(response) {
                updateAnalytics(response);
            })
            .fail(function() {
                console.error('Error loading analytics');
            });
    }

    function updateAnalytics(analytics) {
        if (!analytics) return;

        $('#totalOrders').text(analytics.total_orders || 0);
        $('#totalAmount').text(analytics.total_amount ? `S/.${parseFloat(analytics.total_amount).toLocaleString('es-PE')}` : 'S/.0');
        $('#pendingOrders').text(analytics.pending_orders || 0);
        $('#pendingAmount').text(analytics.pending_amount ? `S/.${parseFloat(analytics.pending_amount).toLocaleString('es-PE')}` : 'S/.0');
        $('#inTransitOrders').text(analytics.in_transit_orders || 0);
        $('#inTransitAmount').text(analytics.in_transit_amount ? `S/.${parseFloat(analytics.in_transit_amount).toLocaleString('es-PE')}` : 'S/.0');
        $('#completedOrders').text(analytics.completed_orders || 0);
        $('#completedAmount').text(analytics.completed_amount ? `S/.${parseFloat(analytics.completed_amount).toLocaleString('es-PE')}` : 'S/.0');
    }

    function bindEvents() {
        // Ver detalles
        $(document).on('click', '.view-details', function(e) {
            e.preventDefault();
            const poId = $(this).data('id');
            loadPODetails(poId);
        });

        // Recibir items
        $(document).on('click', '.receive-items', function(e) {
            e.preventDefault();
            const poId = $(this).data('id');
            loadReceiveItemsModal(poId);
        });

        // Cambiar estado
        $(document).on('click', '.change-status', function(e) {
            e.preventDefault();
            const poId = $(this).data('id');
            const newStatus = $(this).data('status');
            changeOrderStatus(poId, newStatus);
        });

        // Confirmar recepción
        $('#confirmReceiveBtn').on('click', function() {
            processItemsReception();
        });

        // Refresh
        $('#refreshTable').on('click', function() {
            dtPurchaseOrders.ajax.reload();
            loadAnalytics();
        });

        // Filtros
        $('#statusFilter').on('change', function() {
            const status = $(this).val();
            dtPurchaseOrders.column(4).search(status).draw();
        });

        $('#supplierFilter').on('change', function() {
            const supplier = $(this).val();
            dtPurchaseOrders.column(3).search(supplier).draw();
        });
    }

    function loadPODetails(poId) {
        showLoading('Cargando detalles...');
        
        $.get(API_URLS.poDetails.replace('{id}', poId))
            .done(function(response) {
                renderPODetails(response);
                $('#poDetailsModal').modal('show');
            })
            .fail(function(xhr) {
                console.error('Error loading PO details:', xhr);
                toastr.error('Error al cargar los detalles de la orden');
            })
            .always(function() {
                hideLoading();
            });
    }

    function renderPODetails(po) {
        const statusConfig = getStatusConfig(po.status);
        
        const html = `
            <div class="row">
                <div class="col-md-6">
                    <h6 class="fw-bold mb-3">Información General</h6>
                    <table class="table table-borderless">
                        <tr><td><strong>Número:</strong></td><td>${po.po_number}</td></tr>
                        <tr><td><strong>Proveedor:</strong></td><td>${po.supplier?.company_name || '-'}</td></tr>
                        <tr><td><strong>Estado:</strong></td><td><span class="badge bg-label-${statusConfig.color}">${statusConfig.text}</span></td></tr>
                        <tr><td><strong>Fecha Orden:</strong></td><td>${moment(po.order_date).format('DD/MM/YYYY')}</td></tr>
                        <tr><td><strong>Entrega Esperada:</strong></td><td>${moment(po.expected_delivery).format('DD/MM/YYYY')}</td></tr>
                        <tr><td><strong>Total:</strong></td><td><strong>S/.${parseFloat(po.total_amount).toLocaleString('es-PE', {minimumFractionDigits: 2})}</strong></td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6 class="fw-bold mb-3">Progreso</h6>
                    <div class="mb-3">
                        <div class="d-flex justify-content-between">
                            <span>Items Recibidos</span>
                            <span>${po.items_received || 0}/${po.items_count || 0}</span>
                        </div>
                        <div class="progress mt-1">
                            <div class="progress-bar" style="width: ${po.completion_percentage || 0}%"></div>
                        </div>
                    </div>
                    ${po.notes ? `<div><strong>Notas:</strong><br>${po.notes}</div>` : ''}
                </div>
            </div>
            
            <hr class="my-4">
            
            <h6 class="fw-bold mb-3">Items de la Orden</h6>
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Cantidad</th>
                            <th>Recibido</th>
                            <th>Precio Unit.</th>
                            <th>Subtotal</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${po.items?.map(item => `
                            <tr>
                                <td>
                                    <div>
                                        <strong>${item.product_name || item.product_code}</strong>
                                        ${item.product_code ? `<br><small class="text-muted">${item.product_code}</small>` : ''}
                                    </div>
                                </td>
                                <td>${item.quantity_ordered}</td>
                                <td>
                                    <span class="${item.quantity_received < item.quantity_ordered ? 'text-warning' : 'text-success'}">
                                        ${item.quantity_received || 0}
                                    </span>
                                </td>
                                <td>S/.${parseFloat(item.unit_price).toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                                <td>S/.${parseFloat(item.total_price).toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                                <td>
                                    ${item.quantity_received >= item.quantity_ordered ? 
                                        '<span class="badge bg-label-success">Completo</span>' : 
                                        '<span class="badge bg-label-warning">Pendiente</span>'
                                    }
                                </td>
                            </tr>
                        `).join('') || '<tr><td colspan="6" class="text-center">No hay items</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
        
        $('#poDetailsContent').html(html);
        
        // Configurar botones de acción
        const actionButtons = getActionButtons(po);
        $('#poActionsButtons').html(actionButtons);
        
        currentPO = po;
    }

    function loadReceiveItemsModal(poId) {
        showLoading('Cargando items...');
        
        $.get(API_URLS.poDetails.replace('{id}', poId))
            .done(function(response) {
                renderReceiveItemsForm(response);
                $('#receiveItemsModal').modal('show');
            })
            .fail(function(xhr) {
                console.error('Error loading items:', xhr);
                toastr.error('Error al cargar los items');
            })
            .always(function() {
                hideLoading();
            });
    }

    function renderReceiveItemsForm(po) {
        const html = po.items?.map(item => {
            const pending = item.quantity_ordered - (item.quantity_received || 0);
            if (pending <= 0) return '';
            
            return `
                <div class="row align-items-center mb-3 border-bottom pb-3">
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
                               data-item-id="${item.id}"
                               min="0" max="${pending}" value="${pending}"
                               placeholder="Cantidad">
                    </div>
                    <div class="col-md-2">
                        <div class="form-check">
                            <input class="form-check-input receive-check" type="checkbox" 
                                   data-item-id="${item.id}" checked>
                            <label class="form-check-label">Recibir</label>
                        </div>
                    </div>
                </div>
            `;
        }).filter(Boolean).join('') || '<p class="text-center text-muted">No hay items pendientes de recepción</p>';
        
        $('#receiveItemsList').html(html);
        currentPO = po;
    }

    function processItemsReception() {
        const items = [];
        
        $('.receive-check:checked').each(function() {
            const itemId = $(this).data('item-id');
            const quantity = $(`.receive-qty[data-item-id="${itemId}"]`).val();
            
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
            url: API_URLS.receiveItems.replace('{id}', currentPO.id),
            method: 'POST',
            data: {
                items: JSON.stringify(items),
                csrfmiddlewaretoken: $('[name=csrfmiddlewaretoken]').val()
            },
            success: function(response) {
                toastr.success('Items recibidos correctamente');
                $('#receiveItemsModal').modal('hide');
                dtPurchaseOrders.ajax.reload();
                loadAnalytics();
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

    function changeOrderStatus(poId, newStatus) {
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
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                showLoading('Cambiando estado...');
                
                $.ajax({
                    url: API_URLS.poActions.replace('{id}', poId),
                    method: 'POST',
                    data: {
                        action: 'change_status',
                        status: newStatus,
                        csrfmiddlewaretoken: $('[name=csrfmiddlewaretoken]').val()
                    },
                    success: function(response) {
                        toastr.success('Estado cambiado correctamente');
                        dtPurchaseOrders.ajax.reload();
                        loadAnalytics();
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

    function getStatusConfig(status) {
        const configs = {
            'draft': { color: 'secondary', text: 'Borrador' },
            'sent': { color: 'info', text: 'Enviada' },
            'confirmed': { color: 'primary', text: 'Confirmada' },
            'partially_received': { color: 'warning', text: 'Parcial' },
            'completed': { color: 'success', text: 'Completada' },
            'cancelled': { color: 'danger', text: 'Cancelada' }
        };
        return configs[status] || { color: 'secondary', text: status };
    }

    function getActionItems(row) {
        let items = '';
        
        if (row.status === 'confirmed' || row.status === 'partially_received') {
            items += `<li><a class="dropdown-item receive-items" href="#" data-id="${row.id}">
                <i class="ri-truck-line me-2"></i>Recibir Items</a></li>`;
        }
        
        if (row.status === 'draft') {
            items += `<li><a class="dropdown-item change-status" href="#" data-id="${row.id}" data-status="sent">
                <i class="ri-send-plane-line me-2"></i>Enviar</a></li>`;
        }
        
        if (row.status === 'sent') {
            items += `<li><a class="dropdown-item change-status" href="#" data-id="${row.id}" data-status="confirmed">
                <i class="ri-check-line me-2"></i>Confirmar</a></li>`;
        }
        
        if (['draft', 'sent'].includes(row.status)) {
            items += `<li><hr class="dropdown-divider"></li>
                     <li><a class="dropdown-item text-danger change-status" href="#" data-id="${row.id}" data-status="cancelled">
                <i class="ri-close-line me-2"></i>Cancelar</a></li>`;
        }
        
        return items;
    }

    function getActionButtons(po) {
        let buttons = '';
        
        if (po.status === 'confirmed' || po.status === 'partially_received') {
            buttons += `<button type="button" class="btn btn-warning receive-items me-2" data-id="${po.id}">
                <i class="ri-truck-line me-1"></i>Recibir Items</button>`;
        }
        
        buttons += `<a href="/app/purchase-orders/detail/${po.id}/" class="btn btn-primary">
            <i class="ri-external-link-line me-1"></i>Ver Completo</a>`;
        
        return buttons;
    }

    function setupRefreshInterval() {
        // Actualizar cada 5 minutos
        setInterval(function() {
            if (document.visibilityState === 'visible') {
                dtPurchaseOrders.ajax.reload(null, false);
                loadAnalytics();
            }
        }, 300000);
    }

    function showLoading(text = 'Cargando...') {
        $('#loadingText').text(text);
        $('#loadingOverlay').removeClass('d-none');
    }

    function hideLoading() {
        $('#loadingOverlay').addClass('d-none');
    }
});