/**
 * Cotización Details Module
 * Maneja la vista de detalles de cotización
 */

'use strict';

const CotizacionDetails = {
    // Configuración
    config: {
        envioId: null,
        csrfToken: null,
        data: null
    },

    // Referencias a elementos
    elements: {
        estadoEnvio: null,
        productosTableBody: null,
        respuestaCard: null,
        respuestaDetallesBody: null,
        timelineProgreso: null,
        archivoRespuesta: null,
        uploadModal: null,
        confirmManualModal: null,
        loadingOverlay: null
    },

    /**
     * Inicializar el módulo
     */
    init() {
        this.config.envioId = window.ENVIO_ID;
        this.config.csrfToken = this.getCookie('csrftoken');
        this.initializeElements();
        this.setupEventHandlers();
        this.loadDetails();
        this.loadProductCodes();
        console.log('Cotización Details initialized');
    },

    /**
     * Inicializar elementos del DOM
     */
    initializeElements() {
        this.elements.estadoEnvio = document.getElementById('estadoEnvio');
        this.elements.productosTableBody = document.getElementById('productosTableBody');
        this.elements.respuestaCard = document.getElementById('respuestaCard');
        this.elements.respuestaDetallesBody = document.getElementById('respuestaDetallesBody');
        this.elements.timelineProgreso = document.getElementById('timelineProgreso');
        this.elements.archivoRespuesta = document.getElementById('archivoRespuesta');
        this.elements.uploadModal = new bootstrap.Modal(document.getElementById('uploadResponseModal'));
        this.elements.confirmManualModal = new bootstrap.Modal(document.getElementById('confirmManualModal'));
        this.elements.loadingOverlay = document.getElementById('loadingOverlay');

        // Crear modal de validación si no existe
        this.createValidationModal();
    },
 createValidationModal() {
        const modalHTML = `
            <div class="modal fade" id="validationModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Validación de Archivo Excel</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div id="validationResults">
                                <!-- Resultados de validación -->
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cerrar</button>
                            <button type="button" class="btn btn-success d-none" id="proceedUploadBtn">
                                <i class="ri-upload-line me-1"></i>Procesar Archivo
                            </button>
                            <button type="button" class="btn btn-primary" id="downloadTemplateFromValidation">
                                <i class="ri-download-line me-1"></i>Descargar Template
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.elements.validationModal = new bootstrap.Modal(document.getElementById('validationModal'));
    },
    /**
     * Configurar manejadores de eventos
     */
     setupEventHandlers() {
        // Botones de acción principales
        document.getElementById('generateExcelBtn')?.addEventListener('click', () => {
            this.generateExcel();
        });

        document.getElementById('resendEmailBtn')?.addEventListener('click', () => {
            this.resendEmail();
        });

        document.getElementById('uploadResponseBtn')?.addEventListener('click', () => {
            this.elements.uploadModal.show();
        });

        // Botones de descarga
        document.getElementById('downloadTemplateBtn')?.addEventListener('click', () => {
            this.downloadTemplate();
        });

        document.getElementById('downloadPdfBtn')?.addEventListener('click', () => {
            this.downloadPdf();
        });

        // Validación de archivo antes de subir
        document.getElementById('archivoRespuestaModal')?.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.validateExcelFile(e.target.files[0]);
            }
        });

        // Subir archivo (botón simple)
        document.getElementById('subirArchivoBtn')?.addEventListener('click', () => {
            this.uploadFileSimple();
        });

        // Modal de subida de archivo con validación
        document.getElementById('processUploadBtn')?.addEventListener('click', () => {
            this.validateAndUpload();
        });

        // Proceder con upload después de validación
      

        // Descargar template desde modal de validación
        document.getElementById('downloadTemplateFromValidation')?.addEventListener('click', () => {
            this.downloadTemplate();
        });

        // Confirmar envío manual
        document.getElementById('confirmManualBtn')?.addEventListener('click', () => {
            this.elements.confirmManualModal.show();
        });

        document.getElementById('saveConfirmManualBtn')?.addEventListener('click', () => {
            this.saveConfirmManual();
        });

        // Reprocesar
        document.getElementById('reprocessBtn')?.addEventListener('click', () => {
            this.reprocessResponse();
        });

        // Comparar
        document.getElementById('compareBtn')?.addEventListener('click', () => {
            this.compareQuotations();
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
  async loadProductCodes() {
    try {
        const response = await fetch(`/api/cotizacion/envios/${this.config.envioId}/get_requirement_products/`);
        if (response.ok) {
            const data = await response.json();
            this.config.productCodes = data.products.map(p => p.code);
            console.log('Product codes loaded:', this.config.productCodes);
        }
    } catch (error) {
        console.error('Error loading product codes:', error);
    }
},
    /**
     * Cargar detalles del envío
     */

    async loadDetails() {
        try {
            const response = await fetch(`/api/cotizacion/envios/${this.config.envioId}/details/`);
            if (response.ok) {
                this.config.data = await response.json();
                this.renderDetails();
            } else {
                toastr.error('Error al cargar detalles');
            }
        } catch (error) {
            console.error('Error loading details:', error);
            toastr.error('Error de conexión');
        }
    },
 /**
     * Validar archivo Excel antes de subir
     */
    async validateExcelFile(file) {
        try {
            this.showLoading(true, 'Validando archivo Excel...');

            // Usar el servicio de validación frontend
            if (typeof ExcelValidationService !== 'undefined') {
               
                const validationResult = await ExcelValidationService.validateExcelFile(
                    file, 
                    this.config.productCodes
                );

                this.showValidationResults(validationResult, file);
            } else {
                // Fallback: validación en servidor
                await this.validateExcelOnServer(file);
            }

        } catch (error) {
            console.error('Error validating Excel:', error);
            toastr.error('Error validando archivo');
        } finally {
            this.showLoading(false);
        }
    },
  

       /**
     * Validar Excel en servidor
     */
    async validateExcelOnServer(file) {
        const formData = new FormData();
        formData.append('excel_file', file);

        const response = await fetch(`/api/cotizacion/envios/${this.config.envioId}/validate_excel/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': this.config.csrfToken
            },
            body: formData
        });

        if (response.ok) {
            const validationResult = await response.json();
            this.showValidationResults(validationResult, file);
        } else {
            const error = await response.json();
            toastr.error(error.error || 'Error validando archivo');
        }
    },
      /**
     * Mostrar resultados de validación
     */
    showValidationResults(validationResult, file) {
        const resultsContainer = document.getElementById('validationResults');
        const proceedBtn = document.getElementById('proceedUploadBtn');

        // Generar HTML de resultados
        let html = this.generateValidationHTML(validationResult);

        resultsContainer.innerHTML = html;

        // Configurar botón de proceder
        if (validationResult.valid) {
            proceedBtn.classList.remove('d-none');
            proceedBtn.onclick = () => this.proceedWithUpload(file);
        } else {
            proceedBtn.classList.add('d-none');
        }

        // Mostrar modal
        this.elements.validationModal.show();
    },
 /**
     * Generar HTML de resultados de validación
     */
    generateValidationHTML(validationResult) {
        const { valid, errors, warnings, suggestions, analysis } = validationResult;
        
        let html = '<div class="validation-report">';
        
        // Estado general
        html += `<div class="alert alert-${valid ? 'success' : 'danger'} mb-3">`;
        html += `<h6><i class="ri-${valid ? 'check' : 'close'}-circle-line me-2"></i>`;
        html += `${valid ? 'Archivo Válido ✅' : 'Archivo No Válido ❌'}</h6>`;
        if (valid) {
            html += '<p class="mb-0">El archivo cumple con la estructura requerida y puede ser procesado.</p>';
        } else {
            html += '<p class="mb-0">El archivo tiene errores que deben corregirse antes de procesarlo.</p>';
        }
        html += '</div>';

        // Análisis de cobertura (si está disponible)
        if (analysis) {
            html += '<div class="card mb-3"><div class="card-body">';
            html += '<h6>Análisis de Cobertura:</h6>';
            html += '<div class="row text-center">';
            html += `<div class="col-md-3">
                        <div class="text-primary"><strong>${analysis.total_rows}</strong></div>
                        <small>Filas en Excel</small>
                     </div>`;
            html += `<div class="col-md-3">
                        <div class="text-success"><strong>${analysis.codes_found}</strong></div>
                        <small>Productos Encontrados</small>
                     </div>`;
            html += `<div class="col-md-3">
                        <div class="text-warning"><strong>${analysis.codes_missing}</strong></div>
                        <small>Productos Faltantes</small>
                     </div>`;
            html += `<div class="col-md-3">
                        <div class="text-info"><strong>${analysis.coverage_percentage}%</strong></div>
                        <small>Cobertura</small>
                     </div>`;
            html += '</div>';

            // Productos faltantes
            if (analysis.missing_products && analysis.missing_products.length > 0) {
                html += '<div class="mt-3">';
                html += '<h6 class="text-warning">Productos Faltantes:</h6>';
                html += '<div class="d-flex flex-wrap gap-1">';
                analysis.missing_products.forEach(code => {
                    html += `<span class="badge bg-label-warning">${code}</span>`;
                });
                html += '</div></div>';
            }

            html += '</div></div>';
        }

        // Errores
        if (errors && errors.length > 0) {
            html += '<div class="card mb-3"><div class="card-body">';
            html += '<h6 class="text-danger"><i class="ri-error-warning-line me-2"></i>Errores Críticos:</h6>';
            html += '<ul class="mb-0 text-danger">';
            errors.forEach(error => {
                html += `<li>${error}</li>`;
            });
            html += '</ul></div></div>';
        }

        // Advertencias
        if (warnings && warnings.length > 0) {
            html += '<div class="card mb-3"><div class="card-body">';
            html += '<h6 class="text-warning"><i class="ri-alert-line me-2"></i>Advertencias:</h6>';
            html += '<ul class="mb-0 text-warning">';
            warnings.slice(0, 10).forEach(warning => {
                html += `<li>${warning}</li>`;
            });
            if (warnings.length > 10) {
                html += `<li class="text-muted">... y ${warnings.length - 10} advertencias más</li>`;
            }
            html += '</ul></div></div>';
        }

        // Sugerencias
        if (suggestions && suggestions.length > 0) {
            html += '<div class="card"><div class="card-body">';
            html += '<h6 class="text-info"><i class="ri-information-line me-2"></i>Información:</h6>';
            html += '<ul class="mb-0 text-info">';
            suggestions.forEach(suggestion => {
                html += `<li>${suggestion}</li>`;
            });
            html += '</ul></div></div>';
        }

        html += '</div>';
        return html;
    },
     /**
     * Proceder con la subida después de validación exitosa
     */
    proceedWithUpload(file) {
        this.elements.validationModal.hide();
        this.elements.uploadModal.hide();
        this.uploadFile(file || document.getElementById('archivoRespuestaModal').files[0]);
    },
     async validateAndUpload() {
        const fileInput = document.getElementById('archivoRespuestaModal');
        if (!fileInput.files[0]) {
            toastr.warning('Seleccione un archivo');
            return;
        }

        await this.validateExcelFile(fileInput.files[0]);
    },
     /**
     * Renderizar detalles en la UI
     */
    renderDetails() {
        const { envio, requerimiento, respuesta, archivos } = this.config.data;

        // Actualizar estado
        this.updateEstado(envio);

        // Renderizar productos
        this.renderProductos(requerimiento, respuesta);

        // Renderizar respuesta si existe
        if (respuesta) {
            this.renderRespuesta(respuesta);
        }

        // Actualizar timeline
        this.renderTimeline(envio);

        // Actualizar sección de archivos
        this.updateArchivosSection(archivos);

        // Mostrar/ocultar botones según estado
        this.updateActionButtons(envio);
    },
    /**
     * Actualizar estado del envío
     */
    updateEstado(envio) {
        if (this.elements.estadoEnvio) {
            this.elements.estadoEnvio.textContent = envio.estado_display;
            this.elements.estadoEnvio.className = `badge bg-label-${envio.estado_color} fs-6`;
        }

        // Actualizar días restantes
        const diasRestantesEl = document.getElementById('diasRestantes');
        if (diasRestantesEl) {
            const dias = envio.dias_hasta_respuesta;
            let badgeClass = 'badge bg-label-info';
            let text = `${dias} días`;

            if (dias < 0) {
                badgeClass = 'badge bg-label-danger';
                text = `${Math.abs(dias)} días vencido`;
            } else if (dias <= 1) {
                badgeClass = 'badge bg-label-warning';
                text = dias === 0 ? 'Hoy' : '1 día';
            }

            diasRestantesEl.className = badgeClass;
            diasRestantesEl.textContent = text;
        }
    },

    /**
     * Renderizar productos
     */
    renderProductos(requerimiento, respuesta) {
        if (!this.elements.productosTableBody) return;

        this.elements.productosTableBody.innerHTML = '';

        requerimiento.detalles.forEach(detalle => {
            // Buscar si hay respuesta para este producto
            let detalleRespuesta = null;
            if (respuesta) {
                detalleRespuesta = respuesta.detalles.find(d => 
                    d.producto_code === detalle.producto.code
                );
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${detalle.producto.code}</td>
                <td>
                    <div class="d-flex align-items-center">
                        ${detalle.producto.image ? 
                            `<img src="${detalle.producto.image}" alt="${detalle.producto.name}" 
                                  class="rounded me-2" style="width: 30px; height: 30px; object-fit: cover;">` : 
                            `<div class="avatar avatar-sm me-2">
                                <span class="avatar-initial rounded bg-label-secondary">${detalle.producto.name.charAt(0)}</span>
                            </div>`
                        }
                        <div>
                            <div class="fw-medium">${detalle.producto.name}</div>
                            <small class="text-muted">${detalle.producto.category || 'Sin categoría'}</small>
                        </div>
                    </div>
                </td>
                <td class="text-center">${detalle.cantidad_solicitada}</td>
                <td class="text-center">${detalle.unidad_medida}</td>
                <td class="text-center">
                    <span class="badge ${this.getStockBadgeClass(detalle.producto.stock_current, detalle.cantidad_solicitada)}">
                        ${detalle.producto.stock_current}
                    </span>
                </td>
                <td class="text-center">
                    ${detalleRespuesta ? 
                        `<strong>S/ ${parseFloat(detalleRespuesta.precio_unitario).toFixed(2)}</strong>` : 
                        '<span class="text-muted">-</span>'
                    }
                </td>
                <td class="text-center">
                    ${this.getProductoEstadoBadge(detalle, detalleRespuesta)}
                </td>
            `;

            this.elements.productosTableBody.appendChild(row);
        });
    },

    /**
     * Obtener clase CSS para badge de stock
     */
    getStockBadgeClass(stockActual, stockSolicitado) {
        if (stockActual >= stockSolicitado) {
            return 'bg-label-success';
        } else if (stockActual > 0) {
            return 'bg-label-warning';
        } else {
            return 'bg-label-danger';
        }
    },

    /**
     * Obtener badge de estado del producto
     */
    getProductoEstadoBadge(detalle, detalleRespuesta) {
        if (detalleRespuesta) {
            return '<span class="badge bg-label-success">✅ Cotizado</span>';
        } else {
            return '<span class="badge bg-label-warning">⏳ Pendiente</span>';
        }
    },

    /**
     * Renderizar respuesta de cotización
     */
    renderRespuesta(respuesta) {
        if (!this.elements.respuestaCard) return;

        // Mostrar card de respuesta
        this.elements.respuestaCard.style.display = 'block';

        // Actualizar información general
        document.getElementById('fechaRespuesta').textContent = 
            new Date(respuesta.fecha_respuesta).toLocaleDateString();
        document.getElementById('terminosPago').textContent = respuesta.terminos_pago || '-';
        document.getElementById('tiempoEntrega').textContent = respuesta.tiempo_entrega || '-';
        document.getElementById('validezCotizacion').textContent = respuesta.validez_cotizacion || '-';
        document.getElementById('incluyeIgv').textContent = respuesta.incluye_igv ? 'SÍ' : 'NO';
        document.getElementById('totalCotizado').textContent = `S/ ${respuesta.total_cotizado.toFixed(2)}`;

        // Mostrar observaciones si existen
        if (respuesta.observaciones) {
            document.getElementById('observacionesRespuesta').style.display = 'block';
            document.getElementById('observacionesTexto').textContent = respuesta.observaciones;
        }

        // Renderizar detalles de respuesta
        this.renderRespuestaDetalles(respuesta.detalles);
    },

    /**
     * Renderizar detalles de respuesta
     */
    renderRespuestaDetalles(detalles) {
        if (!this.elements.respuestaDetallesBody) return;

        this.elements.respuestaDetallesBody.innerHTML = '';

        detalles.forEach(detalle => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${detalle.producto_code}</td>
                <td>
                    <div>
                        <div class="fw-medium">${detalle.producto_name}</div>
                        ${detalle.nombre_producto_proveedor && detalle.nombre_producto_proveedor !== detalle.producto_name ? 
                            `<small class="text-muted">Proveedor: ${detalle.nombre_producto_proveedor}</small>` : ''
                        }
                    </div>
                </td>
                <td class="text-center">${detalle.cantidad_cotizada}</td>
                <td class="text-end">S/ ${parseFloat(detalle.precio_unitario).toFixed(2)}</td>
                <td class="text-end"><strong>S/ ${parseFloat(detalle.subtotal).toFixed(2)}</strong></td>
                <td class="text-center">${detalle.tiempo_entrega_especifico || '-'}</td>
                <td>${detalle.observaciones || '-'}</td>
            `;

            this.elements.respuestaDetallesBody.appendChild(row);
        });
    },

    /**
     * Renderizar timeline de progreso
     */
    renderTimeline(envio) {
        if (!this.elements.timelineProgreso) return;

        const timeline = [];

        // Estados del timeline
        timeline.push({
            icon: '📝',
            title: 'Cotización Creada',
            date: new Date(envio.fecha_creacion),
            completed: true,
            color: 'success'
        });

        if (envio.fecha_envio) {
            timeline.push({
                icon: envio.metodo_envio === 'email' ? '📧' : '📞',
                title: `Enviada por ${envio.metodo_envio_display}`,
                date: new Date(envio.fecha_envio),
                completed: true,
                color: 'info'
            });
        }

        if (envio.estado === 'respondido') {
            timeline.push({
                icon: '✅',
                title: 'Respuesta Recibida',
                date: envio.fecha_procesamiento ? new Date(envio.fecha_procesamiento) : null,
                completed: true,
                color: 'success'
            });
        }

        // Renderizar timeline
        let timelineHtml = '';
        timeline.forEach((item, index) => {
            timelineHtml += `
                <div class="timeline-item ${item.completed ? 'timeline-item-completed' : ''}">
                    <div class="timeline-indicator text-${item.color}">
                        ${item.icon}
                    </div>
                    <div class="timeline-content">
                        <h6 class="mb-1">${item.title}</h6>
                        ${item.date ? `<small class="text-muted">${item.date.toLocaleDateString()} ${item.date.toLocaleTimeString()}</small>` : ''}
                    </div>
                </div>
            `;
        });

        this.elements.timelineProgreso.innerHTML = timelineHtml;
    },

    /**
     * Actualizar sección de archivos
     */
    updateArchivosSection(archivos) {
        const estadoArchivo = document.getElementById('estadoArchivo');
        const archivoInfo = document.getElementById('archivoInfo');
        const archivoInfoTexto = document.getElementById('archivoInfoTexto');

        if (archivos.tiene_respuesta_cliente) {
            estadoArchivo.textContent = archivos.respuesta_procesada ? 'Procesado' : 'Subido';
            estadoArchivo.className = `badge bg-label-${archivos.respuesta_procesada ? 'success' : 'warning'}`;
            
            if (archivos.fecha_procesamiento) {
                archivoInfo.style.display = 'block';
                archivoInfoTexto.textContent = `Procesado: ${new Date(archivos.fecha_procesamiento).toLocaleString()}`;
            }
        } else {
            estadoArchivo.textContent = 'No subido';
            estadoArchivo.className = 'badge bg-label-secondary';
        }
    },

    /**
     * Actualizar botones de acción
     */
    updateActionButtons(envio) {
        // Mostrar/ocultar botones según estado
        const confirmManualBtn = document.getElementById('confirmManualBtn');
        const reprocessBtn = document.getElementById('reprocessBtn');
        const compareBtn = document.getElementById('compareBtn');

        if (confirmManualBtn) {
            confirmManualBtn.style.display = 
                (envio.estado === 'pendiente' && !envio.proveedor_email) ? 'block' : 'none';
        }

        if (reprocessBtn) {
            reprocessBtn.style.display = 
                (envio.archivo_respuesta_cliente && envio.respuesta_procesada) ? 'block' : 'none';
        }

        if (compareBtn) {
            compareBtn.style.display = 
                (envio.estado === 'respondido') ? 'block' : 'none';
        }
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
    },

    /**
     * Generar Excel
     */
    generateExcel() {
        window.open(`/api/cotizacion/envios/${this.config.envioId}/generate_excel/`, '_blank');
    },

    /**
     * Reenviar email
     */
    async resendEmail() {
        try {
            toastr.info('Enviando email...', 'Sistema', {
                    timeOut: 3000,
                    closeButton: true,
                    progressBar: true,
            });

            const response = await fetch(`/api/cotizacion/envios/${this.config.envioId}/reenviar_email/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.config.csrfToken,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                toastr.success('Email reenviado exitosamente');
                this.loadDetails(); // Recargar detalles
            } else {
                const error = await response.json();
                toastr.error(error.error || 'Error al reenviar email');
            }
        } catch (error) {
            console.error('Error resending email:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Descargar template
     */
    downloadTemplate() {
        console.log(this.config.data)
        window.open(`/api/requirements/${this.config.data.requerimiento.id}/export_cotizacion_excel/`, '_blank');
    },

    /**
     * Descargar PDF
     */
    downloadPdf() {
        window.open(`/api/requirements/${this.config.data.requerimiento.id}/export_pdf/`, '_blank');
    },

    /**
     * Subir archivo simple
     */
    uploadFileSimple() {
        const fileInput = this.elements.archivoRespuesta;
        if (!fileInput.files[0]) {
            toastr.warning('Seleccione un archivo');
            return;
        }

        this.uploadFile(fileInput.files[0]);
    },

    /**
     * Procesar upload desde modal
     */
    processUpload() {
        const fileInput = document.getElementById('archivoRespuestaModal');
        if (!fileInput.files[0]) {
            toastr.warning('Seleccione un archivo');
            return;
        }

        this.elements.uploadModal.hide();
        this.uploadFile(fileInput.files[0]);
    },

    /**
     * Subir archivo
     */
    async uploadFile(file) {
        try {
            this.showLoading(true, 'Subiendo y procesando archivo...');

            const formData = new FormData();
            formData.append('archivo', file);

            const response = await fetch(`/api/cotizacion/envios/${this.config.envioId}/upload_response/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.config.csrfToken
                },
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                toastr.success(result.message);
                this.loadDetails(); // Recargar detalles
            } else {
                const error = await response.json();
                toastr.error(error.message || 'Error al procesar archivo');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Guardar confirmación manual
     */
    async saveConfirmManual() {
        const form = document.getElementById('confirmManualForm');
        const formData = new FormData(form);

        try {
            this.showLoading(true, 'Confirmando envío...');

            const response = await fetch(`/api/cotizacion/envios/${this.config.envioId}/confirmar_envio_manual/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.config.csrfToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    metodo_envio: formData.get('metodo_envio'),
                    notas: formData.get('notas')
                })
            });

            if (response.ok) {
                const result = await response.json();
                toastr.success(result.message);
                this.elements.confirmManualModal.hide();
                this.loadDetails(); // Recargar detalles
            } else {
                const error = await response.json();
                toastr.error(error.error || 'Error al confirmar envío');
            }
        } catch (error) {
            console.error('Error confirming manual send:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Reprocesar respuesta
     */
    async reprocessResponse() {
        const confirm = await Swal.fire({
            title: '¿Reprocesar Respuesta?',
            text: 'Esto eliminará la respuesta actual y volverá a procesar el archivo',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#ff3e1d',
            customClass: {
            confirmButton: 'btn btn-danger me-2',
            cancelButton: 'btn btn-label-secondary'
        },
        buttonsStyling: false
        });

        if (!confirm.isConfirmed) return;

        try {
            this.showLoading(true, 'Reprocesando...');

            const response = await fetch(`/api/cotizacion/envios/${this.config.envioId}/reprocess_response/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.config.csrfToken,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                toastr.success(result.message);
                this.loadDetails(); // Recargar detalles
            } else {
                const error = await response.json();
                toastr.error(error.error || 'Error al reprocesar');
            }
        } catch (error) {
            console.error('Error reprocessing:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Comparar cotizaciones
     */
    compareQuotations() {
        window.location.href = `/app/cotizacion/compare/${this.config.data.requerimiento.id}/`;
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    CotizacionDetails.init();
});

// Hacer disponible globalmente
window.CotizacionDetails = CotizacionDetails;