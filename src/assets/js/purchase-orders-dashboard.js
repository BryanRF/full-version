/**
 * Purchase Orders Dashboard JavaScript
 * Funcionalidades para el dashboard de órdenes de compra
 */

$(document).ready(function() {
    'use strict';

    let ordersChart, statusChart;
    let currentDateRange = '6months';

    // URLs de la API
    const API_URLS = {
        analytics: '/purchasing/purchase-orders/dashboard-analytics/',
        ordersData: '/purchasing/purchase-orders/chart-data/',
        topSuppliers: '/purchasing/purchase-orders/top-suppliers/',
        recentOrders: '/purchasing/purchase-orders/recent/',
        alerts: '/purchasing/purchase-orders/alerts/',
        upcomingDeliveries: '/purchasing/purchase-orders/upcoming-deliveries/'
    };

    // Inicialización
    init();

    function init() {
        initializeDatePicker();
        loadDashboardData();
        initializeCharts();
        bindEvents();
        setupAutoRefresh();
    }

    function initializeDatePicker() {
        $('#dateRangePicker').flatpickr({
            mode: 'range',
            dateFormat: 'd/m/Y',
            defaultDate: [
                moment().subtract(6, 'months').toDate(),
                moment().toDate()
            ],
            locale: 'es',
            onChange: function(selectedDates) {
                if (selectedDates.length === 2) {
                    loadDashboardData();
                }
            }
        });
    }

    function loadDashboardData() {
        showLoading('Cargando dashboard...');

        const dateRange = $('#dateRangePicker')[0]._flatpickr.selectedDates;
        const params = {};

        if (dateRange.length === 2) {
            params.start_date = moment(dateRange[0]).format('YYYY-MM-DD');
            params.end_date = moment(dateRange[1]).format('YYYY-MM-DD');
        }

        Promise.all([
            $.get(API_URLS.analytics, params),
            $.get(API_URLS.topSuppliers, params),
            $.get(API_URLS.recentOrders),
            $.get(API_URLS.alerts),
            $.get(API_URLS.upcomingDeliveries)
        ]).then(function([analytics, topSuppliers, recentOrders, alerts, upcomingDeliveries]) {
            updateKPIs(analytics);
            updateTopSuppliers(topSuppliers);
            updateRecentOrders(recentOrders);
            updateAlerts(alerts);
            updateUpcomingDeliveries(upcomingDeliveries);
            updateCharts(analytics);
        }).catch(function(error) {
            console.error('Error loading dashboard data:', error);
            toastr.error('Error al cargar los datos del dashboard');
        }).finally(function() {
            hideLoading();
        });
    }

    function updateKPIs(analytics) {
        // Total órdenes
        $('#totalOrders').text(analytics.total_orders || 0);
        updateChangeIndicator('#totalOrdersChange', analytics.orders_change || 0);

        // Monto total
        $('#totalAmount').text(formatCurrency(analytics.total_amount || 0));
        updateChangeIndicator('#totalAmountChange', analytics.amount_change || 0);

        // Pendientes
        $('#pendingOrders').text(analytics.pending_orders || 0);
        $('#pendingOrdersAmount').text(formatCurrency(analytics.pending_amount || 0));

        // En tránsito
        $('#inTransitOrders').text(analytics.in_transit_orders || 0);
        $('#inTransitOrdersAmount').text(formatCurrency(analytics.in_transit_amount || 0));
    }

    function updateChangeIndicator(selector, change) {
        const element = $(selector);
        const isPositive = change >= 0;

        element
            .removeClass('text-success text-danger')
            .addClass(isPositive ? 'text-success' : 'text-danger')
            .text(`${isPositive ? '+' : ''}${change.toFixed(1)}%`);
    }

    function updateTopSuppliers(suppliers) {
        if (!suppliers || suppliers.length === 0) {
            $('#topSuppliers').html(`
                <div class="empty-state">
                    <i class="ri-user-line ri-48px"></i>
                    <p>No hay datos de proveedores</p>
                </div>
            `);
            return;
        }

        const html = suppliers.map((supplier, index) => `
            <div class="supplier-item">
                <div class="d-flex align-items-center">
                    <div class="supplier-rank me-3">${index + 1}</div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${supplier.company_name}</h6>
                        <small class="text-muted">${supplier.orders_count} órdenes</small>
                    </div>
                </div>
                <div class="text-end">
                    <div class="fw-bold">${formatCurrency(supplier.total_amount)}</div>
                    <small class="text-muted">${supplier.completion_rate}% completado</small>
                </div>
            </div>
        `).join('');

        $('#topSuppliers').html(html);
    }

    function updateRecentOrders(orders) {
        if (!orders || orders.length === 0) {
            $('#recentOrders').html(`
                <div class="empty-state">
                    <i class="ri-shopping-cart-line ri-48px"></i>
                    <p>No hay órdenes recientes</p>
                </div>
            `);
            return;
        }

        const html = orders.map(order => {
            const statusConfig = getStatusConfig(order.status);

            return `
                <div class="recent-order-item">
                    <div class="d-flex align-items-center">
                        <div class="me-3">
                            <h6 class="mb-0">${order.po_number}</h6>
                            <small class="text-muted">${order.supplier_name}</small>
                        </div>
                    </div>
                    <div class="text-end">
                        <div class="fw-bold mb-1">${formatCurrency(order.total_amount)}</div>
                        <span class="badge bg-label-${statusConfig.color}">${statusConfig.text}</span>
                    </div>
                </div>
            `;
        }).join('');

        $('#recentOrders').html(html);
    }

    function updateAlerts(alerts) {
        if (!alerts || alerts.length === 0) {
            $('#alertsList').html(`
                <div class="empty-state">
                    <i class="ri-notification-line ri-48px"></i>
                    <p>No hay alertas activas</p>
                </div>
            `);
            return;
        }

        const html = alerts.map(alert => `
            <div class="alert-item ${alert.type}" role="button" data-alert-id="${alert.id}">
                <div class="d-flex align-items-center">
                    <i class="${getAlertIcon(alert.type)} me-3"></i>
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${alert.title}</h6>
                        <p class="mb-0 small">${alert.message}</p>
                    </div>
                    <small class="text-muted">${moment(alert.created_at).fromNow()}</small>
                </div>
            </div>
        `).join('');

        $('#alertsList').html(html);
    }

    function updateUpcomingDeliveries(deliveries) {
        if (!deliveries || deliveries.length === 0) {
            $('#upcomingDeliveries').html(`
                <div class="empty-state">
                    <i class="ri-truck-line ri-48px"></i>
                    <p>No hay entregas próximas</p>
                </div>
            `);
            return;
        }

        const html = deliveries.map(delivery => {
            const daysUntil = moment(delivery.expected_delivery).diff(moment(), 'days');
            const urgencyClass = daysUntil < 0 ? 'urgent' : daysUntil <= 3 ? 'warning' : 'normal';

            return `
                <div class="delivery-item">
                    <div>
                        <h6 class="mb-1">${delivery.po_number}</h6>
                        <small class="text-muted">${delivery.supplier_name}</small>
                    </div>
                    <div class="text-end">
                        <div class="days-remaining ${urgencyClass}">
                            ${daysUntil < 0 ? 'Vencido' : daysUntil === 0 ? 'Hoy' : `${daysUntil}d`}
                        </div>
                        <small class="text-muted">${moment(delivery.expected_delivery).format('DD/MM')}</small>
                    </div>
                </div>
            `;
        }).join('');

        $('#upcomingDeliveries').html(html);
    }

    function initializeCharts() {
        // Gráfico de órdenes por mes
        const ordersChartElement = document.querySelector('#ordersChart');
        if (ordersChartElement) {
            ordersChart = new ApexCharts(ordersChartElement, getOrdersChartConfig());
            ordersChart.render();
        }

        // Gráfico de distribución por estado
        const statusChartElement = document.querySelector('#statusChart');
        if (statusChartElement) {
            statusChart = new ApexCharts(statusChartElement, getStatusChartConfig());
            statusChart.render();
        }
    }

    function updateCharts(analytics) {
        // Actualizar gráfico de órdenes
        if (ordersChart && analytics.monthly_data) {
            ordersChart.updateSeries([{
                name: 'Órdenes',
                data: analytics.monthly_data.map(item => item.orders_count)
            }, {
                name: 'Monto (S/.)',
                data: analytics.monthly_data.map(item => item.total_amount)
            }]);

            ordersChart.updateOptions({
                xaxis: {
                    categories: analytics.monthly_data.map(item =>
                        moment(item.month, 'YYYY-MM').format('MMM YYYY')
                    )
                }
            });
        }

        // Actualizar gráfico de estados
        if (statusChart && analytics.status_distribution) {
            const statusData = Object.entries(analytics.status_distribution);

            statusChart.updateSeries(statusData.map(([status, count]) => count));
            statusChart.updateOptions({
                labels: statusData.map(([status, count]) => getStatusConfig(status).text)
            });
        }
    }

    function getOrdersChartConfig() {
        return {
            series: [{
                name: 'Órdenes',
                type: 'column',
                data: []
            }, {
                name: 'Monto (S/.)',
                type: 'line',
                data: []
            }],
            chart: {
                height: 300,
                type: 'line',
                toolbar: { show: false }
            },
            stroke: {
                width: [0, 4]
            },
            title: {
                text: 'Tendencia de Órdenes'
            },
            dataLabels: {
                enabled: true,
                enabledOnSeries: [1]
            },
            labels: [],
            xaxis: {
                type: 'category'
            },
            yaxis: [{
                title: {
                    text: 'Número de Órdenes'
                }
            }, {
                opposite: true,
                title: {
                    text: 'Monto (S/.)'
                }
            }],
            colors: ['#696cff', '#8592a3']
        };
    }

    function getStatusChartConfig() {
        return {
            series: [],
            chart: {
                type: 'donut',
                height: 300
            },
            labels: [],
            colors: ['#696cff', '#8592a3', '#71dd37', '#ffab00', '#ff3e1d', '#6c757d'],
            legend: {
                position: 'bottom'
            },
            plotOptions: {
                pie: {
                    donut: {
                        size: '65%'
                    }
                }
            }
        };
    }

    function bindEvents() {
        // Cambio de período en gráficos
        $('[data-period]').on('click', function() {
            const period = $(this).data('period');
            $('[data-period]').removeClass('active');
            $(this).addClass('active');

            currentDateRange = period;
            updateDateRangeFromPeriod(period);
            loadDashboardData();
        });

        // Refresh dashboard
        $('#refreshDashboard').on('click', function() {
            loadDashboardData();
        });

        // Click en alertas
        $(document).on('click', '[data-alert-id]', function() {
            const alertId = $(this).data('alert-id');
            showAlertDetails(alertId);
        });

        // Quick view de órdenes
        $(document).on('click', '.quick-view', function() {
            const orderId = $(this).data('id');
            showQuickView(orderId);
        });
    }

    function updateDateRangeFromPeriod(period) {
        let startDate, endDate = moment();

        switch (period) {
            case '6months':
                startDate = moment().subtract(6, 'months');
                break;
            case '12months':
                startDate = moment().subtract(12, 'months');
                break;
            case '24months':
                startDate = moment().subtract(24, 'months');
                break;
            default:
                startDate = moment().subtract(6, 'months');
        }

        $('#dateRangePicker')[0]._flatpickr.setDate([startDate.toDate(), endDate.toDate()]);
    }

    function showAlertDetails(alertId) {
        // Cargar detalles de la alerta
        showLoading('Cargando detalles...');

        $.get(`${API_URLS.alerts}/${alertId}/`)
            .done(function(alert) {
                renderAlertDetails(alert);
                $('#alertDetailsModal').modal('show');
            })
            .fail(function() {
                toastr.error('Error al cargar los detalles de la alerta');
            })
            .always(function() {
                hideLoading();
            });
    }

    function renderAlertDetails(alert) {
        const html = `
            <div class="alert alert-${alert.type} border-0">
                <div class="d-flex align-items-center mb-3">
                    <i class="${getAlertIcon(alert.type)} me-3 fs-4"></i>
                    <h5 class="mb-0">${alert.title}</h5>
                </div>

                <p class="mb-3">${alert.message}</p>

                <div class="row">
                    <div class="col-md-6">
                        <small class="text-muted d-block">Fecha:</small>
                        <strong>${moment(alert.created_at).format('DD/MM/YYYY HH:mm')}</strong>
                    </div>
                    <div class="col-md-6">
                        <small class="text-muted d-block">Tipo:</small>
                        <strong>${getAlertTypeName(alert.type)}</strong>
                    </div>
                </div>

                ${alert.order_number ? `
                    <hr>
                    <div class="d-flex justify-content-between align-items-center">
                        <span>Orden relacionada:</span>
                        <a href="/app/purchase-orders/detail/${alert.order_id}/" class="btn btn-sm btn-outline-primary">
                            Ver ${alert.order_number}
                        </a>
                    </div>
                ` : ''}
            </div>
        `;

        $('#alertDetailsContent').html(html);

        // Configurar botón de resolver
        if (alert.can_resolve) {
            $('#resolveAlertBtn').show().data('alert-id', alert.id);
        } else {
            $('#resolveAlertBtn').hide();
        }
    }

    function showQuickView(orderId) {
        showLoading('Cargando vista rápida...');

        $.get(`/purchasing/purchase-orders/${orderId}/`)
            .done(function(order) {
                renderQuickView(order);
                $('#quickViewModal').modal('show');
            })
            .fail(function() {
                toastr.error('Error al cargar la orden');
            })
            .always(function() {
                hideLoading();
            });
    }

    function renderQuickView(order) {
        const statusConfig = getStatusConfig(order.status);

        const html = `
            <div class="row">
                <div class="col-md-6">
                    <h6 class="fw-bold mb-3">Información General</h6>
                    <table class="table table-borderless table-sm">
                        <tr><td><strong>Número:</strong></td><td>${order.po_number}</td></tr>
                        <tr><td><strong>Proveedor:</strong></td><td>${order.supplier?.company_name || '-'}</td></tr>
                        <tr><td><strong>Estado:</strong></td><td><span class="badge bg-label-${statusConfig.color}">${statusConfig.text}</span></td></tr>
                        <tr><td><strong>Total:</strong></td><td><strong>${formatCurrency(order.total_amount)}</strong></td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6 class="fw-bold mb-3">Progreso</h6>
                    <div class="mb-3">
                        <div class="d-flex justify-content-between mb-1">
                            <span>Items Completados</span>
                            <span>${order.completion_percentage || 0}%</span>
                        </div>
                        <div class="progress">
                            <div class="progress-bar" style="width: ${order.completion_percentage || 0}%"></div>
                        </div>
                    </div>
                    <small class="text-muted">
                        Entrega esperada: ${moment(order.expected_delivery).format('DD/MM/YYYY')}
                    </small>
                </div>
            </div>
        `;

        $('#quickViewContent').html(html);
        $('#viewDetailsBtn').attr('href', `/app/purchase-orders/detail/${order.id}/`);
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

    function getAlertIcon(type) {
        const icons = {
            'warning': 'ri-alert-line',
            'danger': 'ri-error-warning-line',
            'info': 'ri-information-line',
            'success': 'ri-checkbox-circle-line'
        };
        return icons[type] || 'ri-notification-line';
    }

    function getAlertTypeName(type) {
        const names = {
            'warning': 'Advertencia',
            'danger': 'Error',
            'info': 'Información',
            'success': 'Éxito'
        };
        return names[type] || 'Notificación';
    }

    function formatCurrency(amount) {
        return `S/.${parseFloat(amount || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})}`;
    }

    function setupAutoRefresh() {
        // Actualizar cada 5 minutos
        setInterval(function() {
            if (document.visibilityState === 'visible') {
                loadDashboardData();
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

    // Resolver alerta
    $('#resolveAlertBtn').on('click', function() {
        const alertId = $(this).data('alert-id');

        Swal.fire({
            title: '¿Resolver alerta?',
            text: 'Esta acción marcará la alerta como resuelta',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, resolver',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                showLoading('Resolviendo alerta...');

                $.ajax({
                    url: `${API_URLS.alerts}/${alertId}/resolve/`,
                    method: 'POST',
                    data: {
                        csrfmiddlewaretoken: $('[name=csrfmiddlewaretoken]').val()
                    },
                    success: function() {
                        toastr.success('Alerta resuelta correctamente');
                        $('#alertDetailsModal').modal('hide');
                        loadDashboardData();
                    },
                    error: function() {
                        toastr.error('Error al resolver la alerta');
                    },
                    complete: function() {
                        hideLoading();
                    }
                });
            }
        });
    });

    // Ver detalles desde quick view
    $('#viewDetailsBtn').on('click', function() {
        const href = $(this).attr('href');
        if (href) {
            window.location.href = href;
        }
    });
});
