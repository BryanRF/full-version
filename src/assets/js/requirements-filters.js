/**
 * Requirements Filters Module
 * Maneja todos los filtros de la lista de requerimientos
 */

'use strict';

const RequirementsFilters = {
    // Configuración
    config: {
        baseUrl: '/api/requirements/data/',
        searchDelay: 500
    },

    // Elementos del DOM
    elements: {
        statusFilter: null,
        priorityFilter: null,
        userFilter: null,
        dateRangeFilter: null,
        searchInput: null
    },

    // Timers
    searchTimeout: null,

    /**
     * Inicializar el módulo de filtros
     */
    init() {
        this.initializeFilterElements();
        this.setupEventHandlers();
        this.loadUsers();
        console.log('Requirements Filters initialized');
    },

    /**
     * Inicializar elementos de filtros
     */
    initializeFilterElements() {
        // Filtro de estado
        this.createStatusFilter();
        
        // Filtro de prioridad
        this.createPriorityFilter();
        
        // Filtro de usuario
        this.createUserFilter();
        
        // Filtro de rango de fechas
        this.createDateRangeFilter();
        
        // Input de búsqueda
        this.elements.searchInput = document.getElementById('requirementSearch');
    },

    /**
     * Crear filtro de estado
     */
    createStatusFilter() {
        const container = $('.requirement_status');
        if (container.find('select').length === 0) {
            container.html(`
                <select id="RequirementStatus" class="form-select">
                    <option value="">Todos los Estados</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="aprobado">Aprobado</option>
                    <option value="rechazado">Rechazado</option>
                    <option value="en_proceso_cotizacion">En Proceso Cotización</option>
                    <option value="cotizado">Cotizado</option>
                    <option value="orden_generada">Orden Generada</option>
                    <option value="completado">Completado</option>
                    <option value="cancelado">Cancelado</option>
                </select>
            `);
            
            this.elements.statusFilter = $('#RequirementStatus');
            this.elements.statusFilter.select2({
                placeholder: 'Filtrar por estado',
                allowClear: true
            });
        }
    },

    /**
     * Crear filtro de prioridad
     */
    createPriorityFilter() {
        const container = $('.requirement_priority');
        if (container.find('select').length === 0) {
            container.html(`
                <select id="RequirementPriority" class="form-select">
                    <option value="">Todas las Prioridades</option>
                    <option value="alta">🔴 Alta</option>
                    <option value="media">🟡 Media</option>
                    <option value="baja">🟢 Baja</option>
                </select>
            `);
            
            this.elements.priorityFilter = $('#RequirementPriority');
            this.elements.priorityFilter.select2({
                placeholder: 'Filtrar por prioridad',
                allowClear: true
            });
        }
    },

    /**
     * Crear filtro de usuario
     */
    createUserFilter() {
        const container = $('.requirement_user');
        if (container.find('select').length === 0) {
            container.html(`
                <select id="RequirementUser" class="form-select">
                    <option value="">Todos los Usuarios</option>
                </select>
            `);
            
            this.elements.userFilter = $('#RequirementUser');
            this.elements.userFilter.select2({
                placeholder: 'Filtrar por usuario',
                allowClear: true
            });
        }
    },

    /**
     * Crear filtro de rango de fechas
     */
    createDateRangeFilter() {
        const container = $('.requirement_date_range');
        if (container.find('input').length === 0) {
            container.html(`
                <input type="text" id="RequirementDateRange" class="form-control" 
                       placeholder="Rango de fechas..." readonly />
            `);
            
            this.elements.dateRangeFilter = $('#RequirementDateRange');
            
            // Inicializar Flatpickr para rango de fechas
            if (typeof flatpickr !== 'undefined') {
                flatpickr("#RequirementDateRange", {
                    mode: "range",
                    dateFormat: "Y-m-d",
                    locale: "es",
                    allowInput: false,
                    onChange: () => {
                        this.applyFilters();
                    }
                });
            }
        }
    },

    /**
     * Configurar manejadores de eventos
     */
    setupEventHandlers() {
        // Filtros de select
        $(document).on('change', '#RequirementStatus, #RequirementPriority, #RequirementUser', () => {
            this.applyFilters();
        });

        // Búsqueda con debounce
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', () => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.applyFilters();
                }, this.config.searchDelay);
            });
        }

        // Botón para limpiar filtros
        this.addClearFiltersButton();
    },

    /**
     * Cargar usuarios para el filtro
     */
    async loadUsers() {
        try {
            // Obtener usuarios únicos de los requerimientos
            const response = await fetch('/api/requirements/data/');
            if (response.ok) {
                const data = await response.json();
                const uniqueUsers = new Map();
                
                data.data.forEach(requirement => {
                    if (requirement.usuario_solicitante && requirement.usuario_solicitante_name) {
                        uniqueUsers.set(requirement.usuario_solicitante, requirement.usuario_solicitante_name);
                    }
                });
                
                // Agregar opciones al select
                const userSelect = this.elements.userFilter;
                uniqueUsers.forEach((name, id) => {
                    userSelect.append(`<option value="${id}">${name}</option>`);
                });
            }
        } catch (error) {
            console.error('Error loading users for filter:', error);
        }
    },

    /**
     * Aplicar todos los filtros
     */
    applyFilters() {
        const filters = this.getActiveFilters();
        const url = this.buildFilterUrl(filters);
        
        // Actualizar la tabla
        if (window.RequirementsList) {
            RequirementsList.updateDataUrl(url);
        }
        
        console.log('Filters applied:', filters);
    },

    /**
     * Obtener filtros activos
     */
    getActiveFilters() {
        const filters = {};
        
        // Estado
        const status = this.elements.statusFilter?.val();
        if (status) filters.estado = status;
        
        // Prioridad
        const priority = this.elements.priorityFilter?.val();
        if (priority) filters.prioridad = priority;
        
        // Usuario
        const user = this.elements.userFilter?.val();
        if (user) filters.usuario = user;
        
        // Rango de fechas
        const dateRange = this.elements.dateRangeFilter?.val();
        if (dateRange && dateRange.includes(' to ')) {
            const [fechaDesde, fechaHasta] = dateRange.split(' to ');
            filters.fecha_desde = fechaDesde;
            filters.fecha_hasta = fechaHasta;
        }
        
        // Búsqueda
        const search = this.elements.searchInput?.value?.trim();
        if (search) filters.search = search;
        
        return filters;
    },

    /**
     * Construir URL con filtros
     */
    buildFilterUrl(filters) {
        const params = new URLSearchParams();
        
        Object.entries(filters).forEach(([key, value]) => {
            if (value) params.append(key, value);
        });
        
        const queryString = params.toString();
        return queryString ? `${this.config.baseUrl}?${queryString}` : this.config.baseUrl;
    },

    /**
     * Limpiar todos los filtros
     */
    clearAllFilters() {
        // Limpiar selects
        this.elements.statusFilter?.val('').trigger('change');
        this.elements.priorityFilter?.val('').trigger('change');
        this.elements.userFilter?.val('').trigger('change');
        
        // Limpiar rango de fechas
        if (this.elements.dateRangeFilter?.length && this.elements.dateRangeFilter[0]._flatpickr) {
            this.elements.dateRangeFilter[0]._flatpickr.clear();
        }
        
        // Limpiar búsqueda
        if (this.elements.searchInput) {
            this.elements.searchInput.value = '';
        }
        
        // Aplicar filtros vacíos
        this.applyFilters();
        
        toastr.info('Filtros limpiados');
    },

    /**
     * Agregar botón para limpiar filtros
     */
    addClearFiltersButton() {
        const cardHeader = $('.card-header').first();
        if (cardHeader.find('.clear-filters-btn').length === 0) {
            const clearButton = `
                <div class="col-md-12 mt-3">
                    <button type="button" class="btn btn-outline-secondary btn-sm clear-filters-btn">
                        <i class="ri-filter-off-line me-1"></i>Limpiar Filtros
                    </button>
                </div>
            `;
            cardHeader.find('.row').append(clearButton);
            
            // Event handler para limpiar filtros
            $(document).on('click', '.clear-filters-btn', () => {
                this.clearAllFilters();
            });
        }
    },

    /**
     * Establecer filtros por estado específico
     */
    setStatusFilter(status) {
        if (this.elements.statusFilter) {
            this.elements.statusFilter.val(status).trigger('change');
        }
    },

    /**
     * Establecer filtros por prioridad específica
     */
    setPriorityFilter(priority) {
        if (this.elements.priorityFilter) {
            this.elements.priorityFilter.val(priority).trigger('change');
        }
    },

    /**
     * Establecer filtros por usuario específico
     */
    setUserFilter(userId) {
        if (this.elements.userFilter) {
            this.elements.userFilter.val(userId).trigger('change');
        }
    },

    /**
     * Obtener filtros preestablecidos rápidos
     */
    getQuickFilters() {
        return {
            pending: () => this.setStatusFilter('pendiente'),
            approved: () => this.setStatusFilter('aprobado'),
            highPriority: () => this.setPriorityFilter('alta'),
            myRequirements: () => {
                // Aquí necesitarías el ID del usuario actual
                // this.setUserFilter(currentUserId);
            }
        };
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    RequirementsFilters.init();
});

// Hacer disponible globalmente
window.RequirementsFilters = RequirementsFilters;