// JavaScript para exportar PDF de requerimientos

function getCookie(name) {
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
}

const csrftoken = getCookie('csrftoken');

/**
 * Exportar requerimiento como PDF para descarga
 * @param {number} requirementId - ID del requerimiento
 * @param {boolean} viewInBrowser - Si es true, abre en el navegador; si es false, descarga
 */
function exportRequirementPDF(requirementId, viewInBrowser = false) {
    // Mostrar loading si existe
    const loadingElement = document.getElementById('loadingSpinner');
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }

    // Determinar endpoint
    const endpoint = viewInBrowser ? 'view_pdf' : 'export_pdf';
    const url = `/api/requirements/${requirementId}/${endpoint}/`;

    fetch(url, {
        method: 'GET',
        headers: {
            'X-CSRFToken': csrftoken,
            'Content-Type': 'application/json',
        },
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        return response.blob();
    })
    .then(blob => {
        // Crear URL del blob
        const url = window.URL.createObjectURL(blob);
        
        if (viewInBrowser) {
            // Abrir en nueva pestaña
            window.open(url, '_blank');
        } else {
            // Descargar archivo
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `Requerimiento_REQ-${String(requirementId).padStart(5, '0')}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
        
        // Limpiar URL del blob
        window.URL.revokeObjectURL(url);
        
        // Mostrar mensaje de éxito
        if (typeof toastr !== 'undefined') {
            toastr.success('', 'PDF generado exitosamente');
        } else if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: '¡Éxito!',
                text: 'PDF generado exitosamente',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        }
    })
    .catch(error => {
        console.error('Error al generar PDF:', error);
        
        // Mostrar mensaje de error
        if (typeof toastr !== 'undefined') {
            toastr.error('', 'Error al generar el PDF');
        } else if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Error',
                text: 'Error al generar el PDF',
                icon: 'error',
                customClass: {
                    confirmButton: 'btn btn-danger waves-effect'
                }
            });
        } else {
            alert('Error al generar el PDF');
        }
    })
    .finally(() => {
        // Ocultar loading
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    });
}

/**
 * Función usando jQuery Ajax (alternativa)
 */
function exportRequirementPDFjQuery(requirementId, viewInBrowser = false) {
    const endpoint = viewInBrowser ? 'view_pdf' : 'export_pdf';
    const url = `/api/requirements/${requirementId}/${endpoint}/`;

    $.ajax({
        url: url,
        type: 'GET',
        xhrFields: {
            responseType: 'blob'
        },
        headers: {
            'X-CSRFToken': csrftoken
        },
        beforeSend: function() {
            $('#loadingSpinner').show();
        },
        success: function(blob, status, xhr) {
            const url = window.URL.createObjectURL(blob);
            
            if (viewInBrowser) {
                window.open(url, '_blank');
            } else {
                const a = document.createElement('a');
                a.href = url;
                a.download = `Requerimiento_REQ-${String(requirementId).padStart(5, '0')}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
            
            window.URL.revokeObjectURL(url);
            
            if (typeof toastr !== 'undefined') {
                toastr.success('', 'PDF generado exitosamente');
            }
        },
        error: function(xhr, status, error) {
            console.error('Error:', error);
            if (typeof toastr !== 'undefined') {
                toastr.error('', 'Error al generar el PDF');
            }
        },
        complete: function() {
            $('#loadingSpinner').hide();
        }
    });
}

/**
 * Event listeners para botones de exportar PDF
 */
$(document).ready(function() {
    // Botón para descargar PDF
    $(document).on('click', '.btn-export-pdf', function() {
        const requirementId = $(this).data('requirement-id');
        if (requirementId) {
            exportRequirementPDF(requirementId, false);
        }
    });
    
    // Botón para ver PDF en navegador
    $(document).on('click', '.btn-view-pdf', function() {
        const requirementId = $(this).data('requirement-id');
        if (requirementId) {
            exportRequirementPDF(requirementId, true);
        }
    });
    
    // Función para agregar botones a las tablas dinámicamente
    window.addPDFButtons = function(requirementId) {
        return `
            <div class="dropdown">
                <button class="btn btn-sm btn-icon btn-text-secondary rounded-pill dropdown-toggle hide-arrow" 
                        data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="ri-file-pdf-line ri-20px"></i>
                </button>
                <div class="dropdown-menu dropdown-menu-end">
                    <a href="javascript:void(0);" class="dropdown-item btn-export-pdf" 
                       data-requirement-id="${requirementId}">
                        <i class="ri-download-line me-1"></i>
                        Descargar PDF
                    </a>
                    <a href="javascript:void(0);" class="dropdown-item btn-view-pdf" 
                       data-requirement-id="${requirementId}">
                        <i class="ri-eye-line me-1"></i>
                        Ver PDF
                    </a>
                </div>
            </div>
        `;
    };
});

/**
 * Función para mostrar modal de confirmación antes de exportar
 */
function confirmExportPDF(requirementId) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Exportar PDF',
            text: '¿Desea descargar el PDF del requerimiento para enviar al proveedor?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, descargar',
            cancelButtonText: 'Cancelar',
            customClass: {
                confirmButton: 'btn btn-primary me-2',
                cancelButton: 'btn btn-outline-secondary'
            },
            buttonsStyling: false
        }).then((result) => {
            if (result.isConfirmed) {
                exportRequirementPDF(requirementId, false);
            }
        });
    } else {
        if (confirm('¿Desea descargar el PDF del requerimiento?')) {
            exportRequirementPDF(requirementId, false);
        }
    }
}

// Ejemplo de uso en DataTables (si usas DataTables)
function addPDFColumnToDataTable() {
    return {
        targets: -1, // Última columna
        title: 'PDF',
        searchable: false,
        orderable: false,
        render: function (data, type, full, meta) {
            return `
                <button class="btn btn-sm btn-icon btn-text-secondary waves-effect waves-light rounded-pill btn-export-pdf" 
                        data-requirement-id="${full.id}" title="Exportar PDF">
                    <i class="ri-file-pdf-line ri-20px"></i>
                </button>
            `;
        }
    };
}