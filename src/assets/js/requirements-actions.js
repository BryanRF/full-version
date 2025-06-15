/**
 * Requirements Actions Module
 * Maneja todas las acciones sobre los requerimientos
 */

'use strict';

const RequirementsActions = {
    // Configuración
    config: {
        csrfToken: null,
        currentRequirementId: null
    },

    // Elementos del DOM
    elements: {
        changeStatusModal: null,
        changeStatusForm: null,
        confirmButton: null
    },

    /**
     * Inicializar el módulo de acciones
     */
    init() {
        this.config.csrfToken = this.getCookie('csrftoken');
        this.elements.changeStatusModal = document.getElementById('changeStatusModal');
        this.elements.changeStatusForm = document.getElementById('changeStatusForm');
        this.elements.confirmButton = document.getElementById('confirmStatusChange');
        
        this.setupEventHandlers();
        console.log('Requirements Actions initialized');
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
     * Configurar manejadores de eventos
     */
    setupEventHandlers() {
        // Confirmar cambio de estado
        if (this.elements.confirmButton) {
            this.elements.confirmButton.addEventListener('click', () => {
                this.confirmStatusChange();
            });
        }

        // Reset del modal cuando se cierra
        if (this.elements.changeStatusModal) {
            this.elements.changeStatusModal.addEventListener('hidden.bs.modal', () => {
                this.resetStatusModal();
            });
        }
    },

    /**
     * Mostrar modal para cambiar estado
     */
    showChangeStatusModal(requirementId) {
        this.config.currentRequirementId = requirementId;
        
        if (this.elements.changeStatusModal) {
            const modal = new bootstrap.Modal(this.elements.changeStatusModal);
            modal.show();
        }
    },

    /**
     * Confirmar cambio de estado
     */
    async confirmStatusChange() {
        if (!this.config.currentRequirementId) {
            toastr.error('Error: ID de requerimiento no válido');
            return;
        }

        const formData = new FormData(this.elements.changeStatusForm);
        const newStatus = formData.get('estado');
        const notes = formData.get('notas');

        if (!newStatus) {
            toastr.error('Debe seleccionar un estado');
            return;
        }

        // Mostrar loading
        this.setButtonLoading(this.elements.confirmButton, true);

        try {
            const response = await fetch(`/api/requirements/${this.config.currentRequirementId}/update_status/`, {
                method: 'PATCH',
                headers: {
                    'X-CSRFToken': this.config.csrfToken,
                     'Content-Type': 'application/json',
                },
                
                body: JSON.stringify({
                    estado: newStatus,
                    notas: notes
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || errorData.error || 'Error al cambiar estado');
            }

            const result = await response.json();
            
            // Cerrar modal
            bootstrap.Modal.getInstance(this.elements.changeStatusModal).hide();
            
            // Mostrar mensaje de éxito
            toastr.success(result.message || 'Estado actualizado correctamente');
            
            // Recargar tabla y analytics
            this.reloadData();

        } catch (error) {
            console.error('Error changing status:', error);
            toastr.error(error.message || 'Error al cambiar el estado');
        } finally {
            this.setButtonLoading(this.elements.confirmButton, false);
        }
    },

    /**
     * Aprobar requerimiento
     */
    async approveRequirement(requirementId) {
        const result = await Swal.fire({
            title: '¿Aprobar requerimiento?',
            text: 'Esta acción cambiará el estado a "Aprobado"',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, aprobar',
            cancelButtonText: 'Cancelar',
            customClass: {
                confirmButton: 'btn btn-success me-2',
                cancelButton: 'btn btn-outline-secondary'
            },
            buttonsStyling: false
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/requirements/${requirementId}/approve/`, {
                    method: 'PATCH',
                    headers: {
                        'X-CSRFToken': this.config.csrfToken,
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Error al aprobar');
                }

                const result = await response.json();
                
                Swal.fire({
                    title: '¡Aprobado!',
                    text: result.message,
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });

                this.reloadData();

            } catch (error) {
                console.error('Error approving requirement:', error);
                Swal.fire({
                    title: 'Error',
                    text: error.message,
                    icon: 'error',
                    customClass: {
                        confirmButton: 'btn btn-success'
                    }
                });
            }
        }
    },

    /**
     * Rechazar requerimiento
     */
    async rejectRequirement(requirementId) {
        const { value: motivo } = await Swal.fire({
            title: '¿Rechazar requerimiento?',
            text: 'Proporcione un motivo para el rechazo:',
            input: 'textarea',
            inputPlaceholder: 'Motivo del rechazo...',
            showCancelButton: true,
            confirmButtonText: 'Rechazar',
            cancelButtonText: 'Cancelar',
            customClass: {
                confirmButton: 'btn btn-danger me-2',
                cancelButton: 'btn btn-outline-secondary'
            },
            buttonsStyling: false,
            inputValidator: (value) => {
                if (!value) {
                    return 'Debe proporcionar un motivo';
                }
            }
        });

        if (motivo) {
            try {
                const response = await fetch(`/api/requirements/${requirementId}/reject/`, {
                    method: 'PATCH',
                    headers: {
                        'X-CSRFToken': this.config.csrfToken,
                    },
                    body: JSON.stringify({ motivo })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Error al rechazar');
                }

                const result = await response.json();
                
                Swal.fire({
                    title: 'Rechazado',
                    text: result.message,
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });

                this.reloadData();

            } catch (error) {
                console.error('Error rejecting requirement:', error);
                Swal.fire({
                    title: 'Error',
                    text: error.message,
                    icon: 'error',
                    customClass: {
                        confirmButton: 'btn btn-success'
                    }
                });
            }
        }
    },

    /**
     * Eliminar requerimiento
     */
    async deleteRequirement(requirementId) {
        const result = await Swal.fire({
            title: '¿Eliminar requerimiento?',
            text: 'Esta acción no se puede deshacer. ¿Está seguro?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#ff3e1d',
            customClass: {
                confirmButton: 'btn btn-danger me-2',
                cancelButton: 'btn btn-outline-secondary'
            },
            buttonsStyling: false
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/requirements/${requirementId}/`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRFToken': this.config.csrfToken
                    }
                });

                if (!response.ok) {
                    throw new Error('Error al eliminar el requerimiento');
                }

                Swal.fire({
                    title: '¡Eliminado!',
                    text: 'Requerimiento eliminado exitosamente',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });

                this.reloadData();

            } catch (error) {
                console.error('Error deleting requirement:', error);
                Swal.fire({
                    title: 'Error',
                    text: 'Error al eliminar el requerimiento',
                    icon: 'error',
                    customClass: {
                        confirmButton: 'btn btn-success'
                    }
                });
            }
        }
    },

    /**
     * Generar orden de compra (para requerimientos cotizados)
     */
    async generatePurchaseOrder(requirementId) {
        const result = await Swal.fire({
            title: '¿Generar orden de compra?',
            text: 'Se creará una orden de compra basada en este requerimiento',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Generar Orden',
            cancelButtonText: 'Cancelar',
            customClass: {
                confirmButton: 'btn btn-primary me-2',
                cancelButton: 'btn btn-outline-secondary'
            },
            buttonsStyling: false
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/requirements/${requirementId}/generate_order/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': this.config.csrfToken,
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Error al generar orden');
                }

                const result = await response.json();
                
                Swal.fire({
                    title: '¡Orden Generada!',
                    text: `Orden ${result.order_number} creada exitosamente`,
                    icon: 'success',
                    confirmButtonText: 'Ver Orden',
                    showCancelButton: true,
                    cancelButtonText: 'Cerrar',
                    customClass: {
                        confirmButton: 'btn btn-primary me-2',
                        cancelButton: 'btn btn-outline-secondary'
                    },
                    buttonsStyling: false
                }).then((result) => {
                    if (result.isConfirmed && result.order_id) {
                        // Redirigir a la vista de la orden
                        window.location.href = `/app/purchase-orders/details/${result.order_id}/`;
                    }
                });

                this.reloadData();

            } catch (error) {
                console.error('Error generating purchase order:', error);
                Swal.fire({
                    title: 'Error',
                    text: error.message,
                    icon: 'error',
                    customClass: {
                        confirmButton: 'btn btn-success'
                    }
                });
            }
        }
    },

    /**
     * Duplicar requerimiento
     */
    async duplicateRequirement(requirementId) {
        const result = await Swal.fire({
            title: '¿Duplicar requerimiento?',
            text: 'Se creará una copia exacta de este requerimiento',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Duplicar',
            cancelButtonText: 'Cancelar',
            customClass: {
                confirmButton: 'btn btn-info me-2',
                cancelButton: 'btn btn-outline-secondary'
            },
            buttonsStyling: false
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/requirements/${requirementId}/duplicate/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': this.config.csrfToken,
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Error al duplicar');
                }

                const result = await response.json();
                
                Swal.fire({
                    title: '¡Duplicado!',
                    text: `Nuevo requerimiento ${result.numero_requerimiento} creado`,
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });

                this.reloadData();

            } catch (error) {
                console.error('Error duplicating requirement:', error);
                Swal.fire({
                    title: 'Error',
                    text: error.message,
                    icon: 'error',
                    customClass: {
                        confirmButton: 'btn btn-success'
                    }
                });
            }
        }
    },

    /**
     * Exportar requerimiento a PDF
     */
    async exportToPDF(requirementId) {
        try {
            const response = await fetch(`/api/requirements/${requirementId}/export_pdf/`, {
                method: 'GET',
                headers: {
                    'X-CSRFToken': this.config.csrfToken,
                }
            });

            if (!response.ok) {
                throw new Error('Error al generar PDF');
            }

            // Descargar el archivo
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `requerimiento_${requirementId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);

            toastr.success('PDF generado exitosamente');

        } catch (error) {
            console.error('Error exporting to PDF:', error);
            toastr.error('Error al generar PDF');
        }
    },

    /**
     * Configurar estado de loading en botón
     */
    setButtonLoading(button, loading) {
        if (!button) return;

        if (loading) {
            button.disabled = true;
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...';
        } else {
            button.disabled = false;
            button.innerHTML = 'Cambiar Estado';
        }
    },

    /**
     * Resetear modal de cambio de estado
     */
    resetStatusModal() {
        if (this.elements.changeStatusForm) {
            this.elements.changeStatusForm.reset();
        }
        this.config.currentRequirementId = null;
    },

    /**
     * Recargar datos después de una acción
     */
    reloadData() {
        // Recargar tabla
        if (window.RequirementsList) {
            RequirementsList.reload();
        }
        
        // Recargar analytics
        if (window.RequirementsAnalytics) {
            RequirementsAnalytics.refresh();
        }
    },

    /**
     * Obtener acciones disponibles según el estado
     */
    getAvailableActions(requirement) {
        const actions = [];
        
        // Acciones básicas siempre disponibles
        actions.push({
            text: 'Ver Detalles',
            icon: 'ri-eye-line',
            action: () => RequirementsList.showRequirementDetails(requirement.id)
        });
        
        actions.push({
            text: 'Exportar PDF',
            icon: 'ri-file-pdf-line',
            action: () => this.exportToPDF(requirement.id)
        });

        // Acciones según estado
        if (requirement.can_approve) {
            actions.push({
                text: 'Aprobar',
                icon: 'ri-check-line',
                class: 'text-success',
                action: () => this.approveRequirement(requirement.id)
            });
        }

        if (requirement.can_reject) {
            actions.push({
                text: 'Rechazar',
                icon: 'ri-close-line',
                class: 'text-danger',
                action: () => this.rejectRequirement(requirement.id)
            });
        }

        if (requirement.estado === 'cotizado') {
            actions.push({
                text: 'Generar Orden',
                icon: 'ri-shopping-cart-line',
                class: 'text-primary',
                action: () => this.generatePurchaseOrder(requirement.id)
            });
        }

        // Duplicar (siempre disponible)
        actions.push({
            text: 'Duplicar',
            icon: 'ri-file-copy-line',
            action: () => this.duplicateRequirement(requirement.id)
        });

        // Eliminar (solo si puede editarse)
        if (requirement.can_edit) {
            actions.push({
                text: 'Eliminar',
                icon: 'ri-delete-bin-line',
                class: 'text-danger',
                action: () => this.deleteRequirement(requirement.id)
            });
        }

        return actions;
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    RequirementsActions.init();
});

// Hacer disponible globalmente
window.RequirementsActions = RequirementsActions;