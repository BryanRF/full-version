/**
 * Cotización Compare Module
 * Maneja la comparación de cotizaciones entre proveedores
 */

'use strict';

const CotizacionCompare = {
    // Configuración
    config: {
        requirementId: null,
        csrfToken: null,
        cotizaciones: [],
        productos: [],
        selectedSupplier: null
    },

    // Elementos del DOM
    elements: {
        comparisonTableBody: null,
        productAccordion: null,
        tableView: null,
        chartView: null,
        detalleModal: null,
        selectSupplierModal: null,
        loadingOverlay: null
    },

    // Charts
    charts: {
        priceChart: null,
        coverageChart: null
    },

    /**
     * Inicializar el módulo
     */
    init() {
        this.config.requirementId = window.REQUIREMENT_ID;
        this.config.csrfToken = this.getCookie('csrftoken');
        this.initializeElements();
        this.setupEventHandlers();
        this.loadComparison();
        console.log('Cotización Compare initialized');
    },

    /**
     * Inicializar elementos del DOM
     */
    initializeElements() {
        this.elements.comparisonTableBody = document.getElementById('comparisonTableBody');
        this.elements.productAccordion = document.getElementById('productAccordion');
        this.elements.tableView = document.getElementById('tableView');
        this.elements.chartView = document.getElementById('chartView');
        this.elements.detalleModal = new bootstrap.Modal(document.getElementById('detalleModal'));
        this.elements.selectSupplierModal = new bootstrap.Modal(document.getElementById('selectSupplierModal'));
        this.elements.loadingOverlay = document.getElementById('loadingOverlay');
    },

    /**
     * Configurar manejadores de eventos
     */
    setupEventHandlers() {
        // Toggle entre vista tabla y gráfico
        document.querySelectorAll('input[name="viewMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.toggleView(e.target.value);
            });
        });

        // Botones de exportación
        document.getElementById('exportExcelBtn')?.addEventListener('click', () => {
            this.exportExcel();
        });

        document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
            this.exportPdf();
        });

        document.getElementById('generateReportBtn')?.addEventListener('click', () => {
            this.generateReport();
        });

        // Modal de selección de proveedor
        document.getElementById('selectSupplierBtn')?.addEventListener('click', () => {
            this.showSelectSupplierModal();
        });

        document.getElementById('confirmSelectSupplierBtn')?.addEventListener('click', () => {
            this.confirmSelectSupplier();
        });
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
     * Cargar datos de comparación
     */
    async loadComparison() {
        try {
            this.showLoading(true, 'Cargando comparación...');

            const response = await fetch(`/api/respuestas/comparar_cotizaciones/?requirement_id=${this.config.requirementId}`);
            if (response.ok) {
                const data = await response.json();
                this.config.cotizaciones = data.cotizaciones || [];
                this.processData();
                this.renderComparison();
                this.renderAnalysis();
            } else {
                toastr.error('Error al cargar comparación');
            }
        } catch (error) {
            console.error('Error loading comparison:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Procesar datos para análisis
     */
    processData() {
        // Obtener todos los productos únicos
        const productosMap = new Map();
        
        this.config.cotizaciones.forEach(cotizacion => {
            cotizacion.productos.forEach(producto => {
                if (!productosMap.has(producto.codigo)) {
                    productosMap.set(producto.codigo, {
                        codigo: producto.codigo,
                        nombre: producto.nombre,
                        cotizaciones: []
                    });
                }
                
                productosMap.get(producto.codigo).cotizaciones.push({
                    proveedor: cotizacion.proveedor,
                    precio_unitario: producto.precio_unitario,
                    cantidad: producto.cantidad,
                    subtotal: producto.subtotal
                });
            });
        });

        this.config.productos = Array.from(productosMap.values());

        // Actualizar estadísticas en header
        document.getElementById('totalEnvios').textContent = this.config.cotizaciones.length;
        document.getElementById('totalRespuestas').textContent = this.config.cotizaciones.filter(c => c.productos.length > 0).length;
    },

    /**
     * Renderizar tabla de comparación
     */
    renderComparison() {
        if (!this.elements.comparisonTableBody) return;

        this.elements.comparisonTableBody.innerHTML = '';

        this.config.cotizaciones.forEach(cotizacion => {
            const totalProductos = this.config.productos.length;
            const productosCompletos = cotizacion.productos.length;
            const cobertura = totalProductos > 0 ? Math.round((productosCompletos / totalProductos) * 100) : 0;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar avatar-sm me-2">
                            <span class="avatar-initial rounded bg-label-primary">${cotizacion.proveedor.charAt(0)}</span>
                        </div>
                        <div>
                            <div class="fw-medium">${cotizacion.proveedor}</div>
                            <small class="text-muted">Cotización recibida</small>
                        </div>
                    </div>
                </td>
                <td class="text-end">
                    <strong class="text-success">S/ ${cotizacion.total_cotizado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</strong>
                </td>
                <td>${cotizacion.terminos_pago || '-'}</td>
                <td>${cotizacion.tiempo_entrega || '-'}</td>
                <td class="text-center">
                    <div class="d-flex align-items-center justify-content-center">
                        ${'⭐'.repeat(this.getSupplierRating(cotizacion.proveedor))}
                    </div>
                </td>
                <td class="text-center">${totalProductos}</td>
                <td class="text-center">
                    <span class="badge ${this.getCoverageBadgeClass(cobertura)}">${productosCompletos}</span>
                </td>
                <td class="text-center">
                    <div class="progress" style="height: 6px;">
                        <div class="progress-bar ${this.getCoverageProgressClass(cobertura)}" 
                             style="width: ${cobertura}%"></div>
                    </div>
                    <small>${cobertura}%</small>
                </td>
                <td>
                    <div class="d-flex gap-1">
                        <button class="btn btn-sm btn-icon btn-text-secondary" 
                                onclick="CotizacionCompare.showDetail('${cotizacion.proveedor}')" 
                                title="Ver Detalle">
                            <i class="ri-eye-line"></i>
                        </button>
                        <button class="btn btn-sm btn-icon btn-text-primary" 
                                onclick="CotizacionCompare.selectSupplier('${cotizacion.proveedor}')" 
                                title="Seleccionar">
                            <i class="ri-check-line"></i>
                        </button>
                    </div>
                </td>
            `;

            this.elements.comparisonTableBody.appendChild(row);
        });
    },

    /**
     * Renderizar comparación detallada por producto
     */
    renderProductComparison() {
        if (!this.elements.productAccordion) return;

        this.elements.productAccordion.innerHTML = '';

        this.config.productos.forEach((producto, index) => {
            const accordionItem = document.createElement('div');
            accordionItem.className = 'accordion-item';

            // Encontrar mejor precio
            const mejorPrecio = Math.min(...producto.cotizaciones.map(c => c.precio_unitario));

            accordionItem.innerHTML = `
                <h2 class="accordion-header" id="heading${index}">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" 
                            data-bs-target="#collapse${index}" aria-expanded="false">
                        <div class="d-flex justify-content-between align-items-center w-100 me-3">
                            <div>
                                <strong>${producto.codigo}</strong> - ${producto.nombre}
                            </div>
                            <div class="d-flex gap-3">
                                <small class="text-muted">${producto.cotizaciones.length} cotizaciones</small>
                                <small class="text-success">Mejor: S/ ${mejorPrecio.toFixed(2)}</small>
                            </div>
                        </div>
                    </button>
                </h2>
                <div id="collapse${index}" class="accordion-collapse collapse" 
                     data-bs-parent="#productAccordion">
                    <div class="accordion-body">
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Proveedor</th>
                                        <th class="text-center">Cantidad</th>
                                        <th class="text-end">Precio Unit.</th>
                                        <th class="text-end">Subtotal</th>
                                        <th class="text-center">Diferencia</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${producto.cotizaciones.map(cot => {
                                        const diferencia = ((cot.precio_unitario - mejorPrecio) / mejorPrecio * 100);
                                        const esMejor = cot.precio_unitario === mejorPrecio;
                                        
                                        return `
                                            <tr class="${esMejor ? 'table-success' : ''}">
                                                <td>
                                                    ${cot.proveedor}
                                                    ${esMejor ? '<span class="badge bg-success ms-2">Mejor</span>' : ''}
                                                </td>
                                                <td class="text-center">${cot.cantidad}</td>
                                                <td class="text-end">S/ ${cot.precio_unitario.toFixed(2)}</td>
                                                <td class="text-end">S/ ${cot.subtotal.toFixed(2)}</td>
                                                <td class="text-center">
                                                    ${esMejor ? 
                                                        '<span class="badge bg-success">0%</span>' :
                                                        `<span class="badge bg-warning">+${diferencia.toFixed(1)}%</span>`
                                                    }
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            this.elements.productAccordion.appendChild(accordionItem);
        });
    },

    /**
     * Renderizar análisis y recomendaciones
     */
    renderAnalysis() {
        if (this.config.cotizaciones.length === 0) return;

        // Mejor precio
        const mejorPrecioCotizacion = this.config.cotizaciones.reduce((min, current) => 
            current.total_cotizado < min.total_cotizado ? current : min
        );

        document.getElementById('mejorPrecioProveedor').textContent = mejorPrecioCotizacion.proveedor;
        document.getElementById('mejorPrecioTotal').textContent = 
            `S/ ${mejorPrecioCotizacion.total_cotizado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

        // Mejor tiempo de entrega (simulado)
        const mejorTiempo = this.config.cotizaciones.find(c => c.tiempo_entrega) || this.config.cotizaciones[0];
        document.getElementById('entregaRapidaProveedor').textContent = mejorTiempo.proveedor;
        document.getElementById('entregaRapidaTiempo').textContent = mejorTiempo.tiempo_entrega || 'No especificado';

        // Mejor calificado (simulado)
        const mejorCalificado = this.config.cotizaciones[0]; // Simplificado
        document.getElementById('mejorCalificacionProveedor').textContent = mejorCalificado.proveedor;
        document.getElementById('mejorCalificacionRating').textContent = '⭐ 5';

        // Generar recomendaciones
        this.generateRecommendations();

        // Renderizar comparación detallada
        this.renderProductComparison();
    },

    /**
     * Generar recomendaciones automáticas
     */
    generateRecommendations() {
        const container = document.getElementById('recomendacionesContainer');
        if (!container) return;

        const recommendations = [];

        // Análisis de precios
        const precios = this.config.cotizaciones.map(c => c.total_cotizado);
        const precioPromedio = precios.reduce((a, b) => a + b, 0) / precios.length;
        const precioMenor = Math.min(...precios);
        const ahorroPotencial = precioPromedio - precioMenor;

        if (ahorroPotencial > 1000) {
            recommendations.push({
                type: 'success',
                icon: 'ri-money-dollar-circle-line',
                title: 'Oportunidad de Ahorro',
                text: `Seleccionando la mejor oferta puede ahorrar S/ ${ahorroPotencial.toFixed(2)} respecto al precio promedio.`
            });
        }

        // Análisis de cobertura
        const coberturaCompleta = this.config.cotizaciones.filter(c => 
            c.productos.length === this.config.productos.length
        );

        if (coberturaCompleta.length === 0) {
            recommendations.push({
                type: 'warning',
                icon: 'ri-alert-line',
                title: 'Cobertura Incompleta',
                text: 'Ningún proveedor cotizó todos los productos. Considere solicitar cotizaciones adicionales.'
            });
        }

        // Análisis de términos de pago
        const conTerminos = this.config.cotizaciones.filter(c => c.terminos_pago && c.terminos_pago.trim());
        if (conTerminos.length < this.config.cotizaciones.length / 2) {
            recommendations.push({
                type: 'info',
                icon: 'ri-information-line',
                title: 'Términos de Pago',
                text: 'Solicite clarificación de términos de pago a los proveedores que no los especificaron.'
            });
        }

        // Renderizar recomendaciones
        container.innerHTML = recommendations.map(rec => `
            <div class="alert alert-${rec.type} d-flex align-items-center" role="alert">
                <i class="${rec.icon} me-2"></i>
                <div>
                    <strong>${rec.title}:</strong> ${rec.text}
                </div>
            </div>
        `).join('');
    },

    /**
     * Obtener calificación del proveedor (simulado)
     */
    getSupplierRating(proveedor) {
        // En implementación real, esto vendría de la base de datos
        const ratings = {
            'Proveedor A': 5,
            'Proveedor B': 4,
            'Proveedor C': 3
        };
        return ratings[proveedor] || 4;
    },

    /**
     * Obtener clase CSS para badge de cobertura
     */
    getCoverageBadgeClass(cobertura) {
        if (cobertura === 100) return 'bg-success';
        if (cobertura >= 80) return 'bg-warning';
        return 'bg-danger';
    },

    /**
     * Obtener clase CSS para barra de progreso de cobertura
     */
    getCoverageProgressClass(cobertura) {
        if (cobertura === 100) return 'bg-success';
        if (cobertura >= 80) return 'bg-warning';
        return 'bg-danger';
    },

    /**
     * Toggle entre vista tabla y gráfico
     */
    toggleView(mode) {
        if (mode === 'table') {
            this.elements.tableView.style.display = 'block';
            this.elements.chartView.style.display = 'none';
        } else {
            this.elements.tableView.style.display = 'none';
            this.elements.chartView.style.display = 'block';
            this.renderCharts();
        }
    },

    /**
     * Renderizar gráficos
     */
    renderCharts() {
        this.renderPriceChart();
        this.renderCoverageChart();
    },

    /**
     * Renderizar gráfico de comparación de precios
     */
    renderPriceChart() {
        const ctx = document.getElementById('priceComparisonChart');
        if (!ctx) return;

        // Destruir gráfico anterior si existe
        if (this.charts.priceChart) {
            this.charts.priceChart.destroy();
        }

        const data = {
            labels: this.config.cotizaciones.map(c => c.proveedor),
            datasets: [{
                label: 'Total Cotizado (S/)',
                data: this.config.cotizaciones.map(c => c.total_cotizado),
                backgroundColor: [
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(255, 99, 132, 0.6)',
                    'rgba(255, 206, 86, 0.6)',
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(153, 102, 255, 0.6)'
                ],
                borderColor: [
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 99, 132, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)'
                ],
                borderWidth: 2
            }]
        };

        this.charts.priceChart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Comparación de Precios Totales'
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'S/ ' + value.toLocaleString('es-PE');
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Renderizar gráfico de cobertura
     */
    renderCoverageChart() {
        const ctx = document.getElementById('coverageChart');
        if (!ctx) return;

        // Destruir gráfico anterior si existe
        if (this.charts.coverageChart) {
            this.charts.coverageChart.destroy();
        }

        const totalProductos = this.config.productos.length;
        const coverageData = this.config.cotizaciones.map(c => {
            const cobertura = totalProductos > 0 ? (c.productos.length / totalProductos) * 100 : 0;
            return Math.round(cobertura);
        });

        const data = {
            labels: this.config.cotizaciones.map(c => c.proveedor),
            datasets: [{
                label: 'Cobertura (%)',
                data: coverageData,
                backgroundColor: coverageData.map(coverage => {
                    if (coverage === 100) return 'rgba(40, 167, 69, 0.6)';
                    if (coverage >= 80) return 'rgba(255, 193, 7, 0.6)';
                    return 'rgba(220, 53, 69, 0.6)';
                }),
                borderColor: coverageData.map(coverage => {
                    if (coverage === 100) return 'rgba(40, 167, 69, 1)';
                    if (coverage >= 80) return 'rgba(255, 193, 7, 1)';
                    return 'rgba(220, 53, 69, 1)';
                }),
                borderWidth: 2
            }]
        };

        this.charts.coverageChart = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Cobertura de Productos por Proveedor'
                    }
                }
            }
        });
    },

    /**
     * Mostrar detalle de cotización
     */
    showDetail(proveedor) {
        const cotizacion = this.config.cotizaciones.find(c => c.proveedor === proveedor);
        if (!cotizacion) return;

        document.getElementById('detalleModalTitle').textContent = `Detalle - ${proveedor}`;
        
        const content = document.getElementById('detalleModalContent');
        content.innerHTML = `
            <div class="row mb-4">
                <div class="col-md-6">
                    <h6>Información General</h6>
                    <table class="table table-borderless table-sm">
                        <tr>
                            <td><strong>Proveedor:</strong></td>
                            <td>${cotizacion.proveedor}</td>
                        </tr>
                        <tr>
                            <td><strong>Total:</strong></td>
                            <td class="text-success"><strong>S/ ${cotizacion.total_cotizado.toFixed(2)}</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Términos Pago:</strong></td>
                            <td>${cotizacion.terminos_pago || 'No especificado'}</td>
                        </tr>
                        <tr>
                            <td><strong>Tiempo Entrega:</strong></td>
                            <td>${cotizacion.tiempo_entrega || 'No especificado'}</td>
                        </tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6>Estadísticas</h6>
                    <table class="table table-borderless table-sm">
                        <tr>
                            <td><strong>Productos Cotizados:</strong></td>
                            <td>${cotizacion.productos.length}</td>
                        </tr>
                        <tr>
                            <td><strong>Cobertura:</strong></td>
                            <td>${Math.round((cotizacion.productos.length / this.config.productos.length) * 100)}%</td>
                        </tr>
                        <tr>
                            <td><strong>Precio Promedio:</strong></td>
                            <td>S/ ${(cotizacion.total_cotizado / cotizacion.productos.length).toFixed(2)}</td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <h6>Productos Cotizados</h6>
            <div class="table-responsive">
                <table class="table table-bordered table-sm">
                    <thead class="table-light">
                        <tr>
                            <th>Código</th>
                            <th>Producto</th>
                            <th class="text-center">Cantidad</th>
                            <th class="text-end">Precio Unit.</th>
                            <th class="text-end">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cotizacion.productos.map(p => `
                            <tr>
                                <td>${p.codigo}</td>
                                <td>${p.nombre}</td>
                                <td class="text-center">${p.cantidad}</td>
                                <td class="text-end">S/ ${p.precio_unitario.toFixed(2)}</td>
                                <td class="text-end">S/ ${p.subtotal.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot class="table-light">
                        <tr>
                            <th colspan="4" class="text-end">Total:</th>
                            <th class="text-end">S/ ${cotizacion.total_cotizado.toFixed(2)}</th>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        this.config.selectedSupplier = proveedor;
        this.elements.detalleModal.show();
    },

    /**
     * Seleccionar proveedor
     */
    selectSupplier(proveedor) {
        this.config.selectedSupplier = proveedor;
        this.showSelectSupplierModal();
    },

    /**
     * Mostrar modal de selección de proveedor
     */
    showSelectSupplierModal() {
        if (!this.config.selectedSupplier) return;

        const cotizacion = this.config.cotizaciones.find(c => c.proveedor === this.config.selectedSupplier);
        if (!cotizacion) return;

        const info = document.getElementById('selectedSupplierInfo');
        info.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${cotizacion.proveedor}</h6>
                    <p class="mb-0 text-muted">Total: S/ ${cotizacion.total_cotizado.toFixed(2)}</p>
                </div>
                <div class="text-end">
                    <div class="badge bg-label-success">${cotizacion.productos.length} productos</div>
                </div>
            </div>
        `;

        // Cerrar modal de detalle si está abierto
        this.elements.detalleModal.hide();
        
        // Mostrar modal de selección
        this.elements.selectSupplierModal.show();
    },

    /**
     * Confirmar selección de proveedor
     */
    async confirmSelectSupplier() {
        const form = document.getElementById('selectSupplierForm');
        const formData = new FormData(form);
        
        if (!formData.get('motivo')) {
            toastr.warning('Seleccione un motivo');
            return;
        }

        try {
            this.showLoading(true, 'Guardando selección...');

            // Aquí iría la llamada API para guardar la selección
            const response = await fetch(`/api/requirements/${this.config.requirementId}/select_supplier/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.config.csrfToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    proveedor: this.config.selectedSupplier,
                    motivo: formData.get('motivo'),
                    observaciones: formData.get('observaciones')
                })
            });

            if (response.ok) {
                const result = await response.json();
                
                Swal.fire({
                    title: '¡Proveedor Seleccionado!',
                    text: `${this.config.selectedSupplier} ha sido seleccionado como proveedor ganador.`,
                    icon: 'success',
                    confirmButtonText: 'Continuar',
                    customClass: {
                        confirmButton: 'btn btn-success'
                    },
                    buttonsStyling: false
                }).then(() => {
                    // Redirigir o actualizar vista
                    window.location.href = `/app/requirements/details/${this.config.requirementId}/`;
                });

                this.elements.selectSupplierModal.hide();
            } else {
                const error = await response.json();
                toastr.error(error.error || 'Error al guardar selección');
            }
        } catch (error) {
            console.error('Error confirming supplier:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Exportar a Excel
     */
    exportExcel() {
        window.open(`/api/requirements/${this.config.requirementId}/export_comparison_excel/`, '_blank');
    },

    /**
     * Exportar a PDF
     */
    exportPdf() {
        window.open(`/api/requirements/${this.config.requirementId}/export_comparison_pdf/`, '_blank');
    },

    /**
     * Generar reporte ejecutivo
     */
    generateReport() {
        // Implementar generación de reporte ejecutivo
        toastr.info('Funcionalidad en desarrollo');
    },

    /**
     * Mostrar loading
     */
    showLoading(show, text = 'Procesando...') {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.toggle('d-none', !show);
            if (show) {
                document.getElementById('loadingText').textContent = text;
            }
        }
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    CotizacionCompare.init();
});

// Hacer disponible globalmente
window.CotizacionCompare = CotizacionCompare;