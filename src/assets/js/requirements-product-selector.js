/**
 * Requirements Product Selector Module
 * Maneja la selección de productos en el modal
 */

'use strict';

const RequirementsProductSelector = {
    // Configuración
    config: {
        apiEndpoint: '/api/products/data/',
        selectedProducts: new Map(),
        allProducts: [],
        filteredProducts: []
    },

    // Elementos del DOM
    elements: {
        modal: null,
        categoryFilter: null,
        stockFilter: null,
        searchInput: null,
        productsTable: null,
        tableBody: null,
        selectAllCheckbox: null,
        selectedCount: null,
        addButton: null
    },

    /**
     * Inicializar el módulo
     */
    init() {
        this.initializeElements();
        this.setupEventHandlers();
        this.loadCategories();
        console.log('Requirements Product Selector initialized');
    },

    /**
     * Inicializar elementos del DOM
     */
    initializeElements() {
        this.elements.modal = document.getElementById('productSelectorModal');
        this.elements.categoryFilter = document.getElementById('filterCategory');
        this.elements.stockFilter = document.getElementById('filterStock');
        this.elements.searchInput = document.getElementById('searchProduct');
        this.elements.productsTable = document.getElementById('productsTable');
        this.elements.tableBody = document.getElementById('productsTableBody');
        this.elements.selectAllCheckbox = document.getElementById('selectAllProducts');
        this.elements.selectedCount = document.getElementById('selectedCount');
        this.elements.addButton = document.getElementById('addSelectedProducts');
    },

    /**
     * Configurar manejadores de eventos
     */
    setupEventHandlers() {
        // Modal events
        if (this.elements.modal) {
            this.elements.modal.addEventListener('shown.bs.modal', () => {
                this.loadProducts();
            });

            this.elements.modal.addEventListener('hidden.bs.modal', () => {
                this.resetModal();
            });
        }

        // Filtros
        if (this.elements.categoryFilter) {
            this.elements.categoryFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        if (this.elements.stockFilter) {
            this.elements.stockFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        // Búsqueda con debounce
        if (this.elements.searchInput) {
            let searchTimeout;
            this.elements.searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.applyFilters();
                }, 300);
            });
        }

        // Seleccionar todos
        if (this.elements.selectAllCheckbox) {
            this.elements.selectAllCheckbox.addEventListener('change', (e) => {
                this.toggleSelectAll(e.target.checked);
            });
        }

        // Agregar productos seleccionados
        if (this.elements.addButton) {
            this.elements.addButton.addEventListener('click', () => {
                this.addSelectedProducts();
            });
        }
    },

    /**
     * Cargar categorías para el filtro
     */
    async loadCategories() {
        try {
            const response = await fetch('/api/categories/active/');
            if (response.ok) {
                const data = await response.json();
                this.populateCategoryFilter(data.data);
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    },

    /**
     * Poblar filtro de categorías
     */
    populateCategoryFilter(categories) {
        if (!this.elements.categoryFilter) return;

        // Limpiar opciones existentes (excepto la primera)
        const firstOption = this.elements.categoryFilter.firstElementChild;
        this.elements.categoryFilter.innerHTML = '';
        this.elements.categoryFilter.appendChild(firstOption);

        // Agregar categorías
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            this.elements.categoryFilter.appendChild(option);
        });
    },

    /**
     * Cargar productos
     */
    async loadProducts() {
        try {
            const response = await fetch(this.config.apiEndpoint);
            if (response.ok) {
                const data = await response.json();
                this.config.allProducts = data.data || [];
                this.applyFilters();
            }
        } catch (error) {
            console.error('Error loading products:', error);
            this.showError('Error al cargar productos');
        }
    },

    /**
     * Aplicar filtros
     */
    applyFilters() {
        let filtered = [...this.config.allProducts];

        // Filtro por categoría
        const categoryId = this.elements.categoryFilter?.value;
        if (categoryId) {
            filtered = filtered.filter(product => 
                product.category && product.category.toString() === categoryId
            );
        }

        // Filtro por stock
        const stockFilter = this.elements.stockFilter?.value;
        if (stockFilter) {
            switch (stockFilter) {
                case 'available':
                    filtered = filtered.filter(product => 
                        product.current_stock && product.current_stock > 0
                    );
                    break;
                case 'low':
                    filtered = filtered.filter(product => 
                        product.current_stock > 0 && 
                        product.current_stock <= (product.minimum_stock || 0)
                    );
                    break;
                case 'out':
                    filtered = filtered.filter(product => 
                        !product.current_stock || product.current_stock === 0
                    );
                    break;
            }
        }

        // Filtro por búsqueda
        const searchTerm = this.elements.searchInput?.value?.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(product => 
                product.product_name?.toLowerCase().includes(searchTerm) ||
                product.name?.toLowerCase().includes(searchTerm)
            );
        }

        this.config.filteredProducts = filtered;
        this.renderProductsTable();
    },

    /**
     * Renderizar tabla de productos
     */
    renderProductsTable() {
        if (!this.elements.tableBody) return;

        // Limpiar tabla
        this.elements.tableBody.innerHTML = '';

        if (this.config.filteredProducts.length === 0) {
            this.elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <i class="ri-search-line ri-48px mb-2 d-block text-muted"></i>
                        No se encontraron productos
                    </td>
                </tr>
            `;
            return;
        }

        // Renderizar productos
        this.config.filteredProducts.forEach(product => {
            const row = this.createProductRow(product);
            this.elements.tableBody.appendChild(row);
        });

        this.updateSelectAllState();
    },

    /**
     * Crear fila de producto
     */
    createProductRow(product) {
        const row = document.createElement('tr');
        const productName = product.product_name || product.name || 'Sin nombre';
        const categoryName = product.category_name || 'Sin categoría';
        const stock = product.current_stock || 0;
        const price = product.product_price || product.price || 0;
        
        row.innerHTML = `
            <td>
                <input type="checkbox" class="form-check-input product-checkbox" 
                       data-product-id="${product.id}" 
                       ${this.config.selectedProducts.has(product.id) ? 'checked' : ''}>
            </td>
            <td>
                <div class="d-flex align-items-center">
                    ${product.product_image ? 
                        `<img src="/media/products/${product.product_image}" alt="${productName}" 
                              class="rounded me-2" style="width: 30px; height: 30px; object-fit: cover;">` : 
                        `<div class="avatar avatar-sm me-2">
                            <span class="avatar-initial rounded bg-label-secondary">${productName.charAt(0)}</span>
                        </div>`
                    }
                    <div>
                        <div class="fw-medium">${productName}</div>
                        <small class="text-muted">${product.description || ''}</small>
                    </div>
                </div>
            </td>
            <td>${categoryName}</td>
            <td>
                <span class="badge ${this.getStockBadgeClass(stock)}">
                    ${stock}
                </span>
            </td>
            <td>S/. ${parseFloat(price).toFixed(2)}</td>
            <td>
                <input type="number" class="form-control form-control-sm quantity-input" 
                       value="1" min="1" max="${stock || 999}" 
                       data-product-id="${product.id}" 
                       style="width: 80px;">
            </td>
            <td>
                <input type="text" class="form-control form-control-sm unit-input" 
                       value="unidad" 
                       data-product-id="${product.id}" 
                       style="width: 80px;">
            </td>
        `;

        // Event listeners para la fila
        const checkbox = row.querySelector('.product-checkbox');
        const quantityInput = row.querySelector('.quantity-input');
        const unitInput = row.querySelector('.unit-input');

        checkbox.addEventListener('change', (e) => {
            this.toggleProductSelection(product, e.target.checked);
        });

        quantityInput.addEventListener('change', (e) => {
            this.updateProductQuantity(product.id, parseInt(e.target.value) || 1);
        });

        unitInput.addEventListener('change', (e) => {
            this.updateProductUnit(product.id, e.target.value);
        });

        return row;
    },

    /**
     * Obtener clase de badge para stock
     */
    getStockBadgeClass(stock) {
        if (stock === 0) return 'bg-label-danger';
        if (stock <= 10) return 'bg-label-warning';
        return 'bg-label-success';
    },

    /**
     * Toggle selección de producto
     */
    toggleProductSelection(product, selected) {
        if (selected) {
            const quantityInput = document.querySelector(`input.quantity-input[data-product-id="${product.id}"]`);
            const unitInput = document.querySelector(`input.unit-input[data-product-id="${product.id}"]`);
            
            this.config.selectedProducts.set(product.id, {
                ...product,
                cantidad_solicitada: parseInt(quantityInput?.value) || 1,
                unidad_medida: unitInput?.value || 'unidad'
            });
        } else {
            this.config.selectedProducts.delete(product.id);
        }

        this.updateSelectedCount();
        this.updateSelectAllState();
    },

    /**
     * Actualizar cantidad de producto
     */
    updateProductQuantity(productId, quantity) {
        if (this.config.selectedProducts.has(productId)) {
            const product = this.config.selectedProducts.get(productId);
            product.cantidad_solicitada = quantity;
            this.config.selectedProducts.set(productId, product);
        }
    },

    /**
     * Actualizar unidad de producto
     */
    updateProductUnit(productId, unit) {
        if (this.config.selectedProducts.has(productId)) {
            const product = this.config.selectedProducts.get(productId);
            product.unidad_medida = unit;
            this.config.selectedProducts.set(productId, product);
        }
    },

    /**
     * Toggle seleccionar todos
     */
    toggleSelectAll(selectAll) {
        const checkboxes = document.querySelectorAll('.product-checkbox');
        
        checkboxes.forEach(checkbox => {
            const productId = parseInt(checkbox.dataset.productId);
            const product = this.config.filteredProducts.find(p => p.id === productId);
            
            if (product) {
                checkbox.checked = selectAll;
                this.toggleProductSelection(product, selectAll);
            }
        });
    },

    /**
     * Actualizar estado de seleccionar todos
     */
    updateSelectAllState() {
        if (!this.elements.selectAllCheckbox) return;

        const checkboxes = document.querySelectorAll('.product-checkbox');
        const checkedBoxes = document.querySelectorAll('.product-checkbox:checked');
        
        if (checkboxes.length === 0) {
            this.elements.selectAllCheckbox.checked = false;
            this.elements.selectAllCheckbox.indeterminate = false;
        } else if (checkedBoxes.length === checkboxes.length) {
            this.elements.selectAllCheckbox.checked = true;
            this.elements.selectAllCheckbox.indeterminate = false;
        } else if (checkedBoxes.length > 0) {
            this.elements.selectAllCheckbox.checked = false;
            this.elements.selectAllCheckbox.indeterminate = true;
        } else {
            this.elements.selectAllCheckbox.checked = false;
            this.elements.selectAllCheckbox.indeterminate = false;
        }
    },

    /**
     * Actualizar contador de seleccionados
     */
    updateSelectedCount() {
        if (this.elements.selectedCount) {
            this.elements.selectedCount.textContent = this.config.selectedProducts.size;
        }

        if (this.elements.addButton) {
            this.elements.addButton.disabled = this.config.selectedProducts.size === 0;
        }
    },

    /**
     * Agregar productos seleccionados
     */
    addSelectedProducts() {
        if (this.config.selectedProducts.size === 0) {
            toastr.warning('No hay productos seleccionados');
            return;
        }

        // Agregar productos al formulario principal
        this.config.selectedProducts.forEach(product => {
            if (window.RequirementsAddForm) {
                RequirementsAddForm.addProduct(product);
            }
        });

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(this.elements.modal);
        if (modal) {
            modal.hide();
        }

        toastr.success(`${this.config.selectedProducts.size} productos agregados`);
    },

    /**
     * Resetear modal
     */
    resetModal() {
        this.config.selectedProducts.clear();
        
        // Limpiar filtros
        if (this.elements.categoryFilter) this.elements.categoryFilter.value = '';
        if (this.elements.stockFilter) this.elements.stockFilter.value = '';
        if (this.elements.searchInput) this.elements.searchInput.value = '';
        
        // Limpiar selecciones
        if (this.elements.selectAllCheckbox) {
            this.elements.selectAllCheckbox.checked = false;
            this.elements.selectAllCheckbox.indeterminate = false;
        }

        this.updateSelectedCount();
    },

    /**
     * Mostrar error
     */
    showError(message) {
        if (typeof toastr !== 'undefined') {
            toastr.error(message);
        } else {
            alert(message);
        }
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    RequirementsProductSelector.init();
});

// Hacer disponible globalmente
window.RequirementsProductSelector = RequirementsProductSelector;