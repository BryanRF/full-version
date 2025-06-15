/**
 * POS System con búsqueda inteligente de clientes
 */

'use strict';

const POSSystem = {
    config: {
        csrfToken: null,
        cart: [],
        customer: null,
        total: 0,
        tax: 0,
        subtotal: 0,
        discount: 0,
        searchTimeout: null
    },
    configImpresion: {
        csrfToken: null,
        cart: [],
        customer: null,
        total: 0,
        tax: 0,
        subtotal: 0,
        discount: 0,
        searchTimeout: null
    },

    elements: {
        productSearch: null,
        customerSearch: null,
        cartItems: null,
        totals: null,
        paymentMethod: null,
        checkoutButton: null,
        customerResults: null
    },

    init() {
        this.config.csrfToken = this.getCookie('csrftoken');
        this.initializeElements();
        this.setupEventHandlers();
        this.loadProducts();
        console.log('POS System initialized');
    },

    initializeElements() {
        this.elements.productSearch = document.getElementById('productSearch');
        this.elements.customerSearch = document.getElementById('customerSearch');
        this.elements.cartItems = document.getElementById('cartItems');
        this.elements.totals = document.getElementById('cartTotals');
        this.elements.paymentMethod = document.getElementById('paymentMethod');
        this.elements.checkoutButton = document.getElementById('checkoutButton');
        this.elements.customerResults = document.getElementById('customerSearchResults');
    },

    setupEventHandlers() {
        // Búsqueda de productos
        if (this.elements.productSearch) {
            this.elements.productSearch.addEventListener('input', (e) => {
                this.searchProducts(e.target.value);
            });
        }

        // Búsqueda de clientes con timeout
        if (this.elements.customerSearch) {
            this.elements.customerSearch.addEventListener('input', (e) => {
                clearTimeout(this.config.searchTimeout);
                const query = e.target.value.trim();
                
                if (query.length >= 8) {
                    this.config.searchTimeout = setTimeout(() => {
                        this.searchCustomerByDocument(query);
                    }, 500);
                } else if (query.length === 0) {
                    this.clearCustomerSearch();
                }
            });
        }

        // Checkout
        if (this.elements.checkoutButton) {
            this.elements.checkoutButton.addEventListener('click', () => {
                this.processCheckout();
            });
        }

        // Teclas rápidas
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Campos de efectivo
        if (this.elements.paymentMethod) {
            this.elements.paymentMethod.addEventListener('change', (e) => {
                this.toggleCashFields(e.target.value);
            });
        }

        // Campo de efectivo recibido
        const cashReceived = document.getElementById('cashReceived');
        if (cashReceived) {
            cashReceived.addEventListener('input', () => {
                this.calculateChange();
            });
        }
    },

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

    async loadProducts() {
        try {
            const response = await fetch('/api/products/data/?status=1');
            if (response.ok) {
                const data = await response.json();
                this.renderProductGrid(data.data || []);
            }
        } catch (error) {
            console.error('Error loading products:', error);
        }
    },

    async searchProducts(query) {
        if (query.length < 2) {
            this.loadProducts();
            return;
        }

        try {
            const response = await fetch(`/api/products/data/?search=${encodeURIComponent(query)}&status=1`);
            if (response.ok) {
                const data = await response.json();
                this.renderProductGrid(data.data || []);
            }
        } catch (error) {
            console.error('Error searching products:', error);
        }
    },

    async searchCustomerByDocument(document) {
        if (!document || document.length < 8) return;

        try {
            this.showCustomerSearchLoading(true);
            
            const response = await fetch(`/api/customers/search_document/?document=${encodeURIComponent(document)}`);
            
            if (response.ok) {
                toastr.success('Persona encontrada');
                const data = await response.json();
                this.showCustomerSearchResult(data, document);
            } else {
                const error = await response.json();
                this.showCustomerSearchError(error, document);
            }
        } catch (error) {
            console.error('Error searching customer:', error);
            this.showCustomerSearchError({error: 'Error de conexión'}, document);
        } finally {
            this.showCustomerSearchLoading(false);
        }
    },

    showCustomerSearchLoading(show) {
        if (!this.elements.customerResults) return;
        
        if (show) {
            this.elements.customerResults.innerHTML = `
                <div class="search-result-item p-3 border rounded">
                    <div class="d-flex align-items-center">
                        <div class="spinner-border spinner-border-sm me-2" role="status">
                            <span class="visually-hidden">Buscando...</span>
                        </div>
                        <span>Buscando documento...</span>
                    </div>
                </div>
            `;
            this.elements.customerResults.style.display = 'block';
        }
    },

    showCustomerSearchResult(data, document) {
        // if (!this.elements.customerResults) return;
        console.log(data.customer);
        const customer = data.customer;
        const source = data.source;
        const foundInDb = data.found_in_database;

        this.elements.customerResults.innerHTML = `
            <div class="search-result-item p-3 border rounded mb-2 bg-light">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${customer.display_name}</h6>
                        <small class="text-muted">
                            ${customer.document_type_display}: ${customer.document_number}
                        </small>
                        <br>
                        <small class="text-${foundInDb ? 'success' : 'info'}">
                            ${foundInDb ? '📋 Encontrado en base de datos' : '🌐 Consultado en registros oficiales'}
                        </small>
                        ${customer.email ? `<br><small class="text-muted">${customer.email}</small>` : ''}
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="POSSystem.selectSearchedCustomer(${customer.id})">
                        ➕
                    </button>
                </div>
            </div>
        `;
        this.elements.customerResults.style.display = 'block';
    },

    showCustomerSearchError(error, document) {
        if (!this.elements.customerResults) return;

        const canCreateBasic = error.can_create_basic;
        
        this.elements.customerResults.innerHTML = `
            <div class="search-result-item p-3 border rounded border-warning bg-warning-subtle">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1 text-warning">⚠️ Documento no encontrado</h6>
                        <small class="text-muted">${error.error || 'No se encontró información'}</small>
                        <br>
                        <small class="text-muted">Documento: ${document}</small>
                        ${canCreateBasic ? '<br><small class="text-info">Se puede crear cliente básico en la venta</small>' : ''}
                    </div>
                    ${canCreateBasic ? `
                        <button class="btn btn-sm btn-outline-warning" onclick="POSSystem.createBasicCustomer('${document}')">
                            Usar igual
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        this.elements.customerResults.style.display = 'block';
    },

    async selectSearchedCustomer(customerId) {
        try {
            const response = await fetch(`/api/customers/${customerId}/`);
            if (response.ok) {
                this.config.customer = await response.json();
                this.updateCustomerDisplay();
                this.clearCustomerSearch();
                
                // Limpiar campo de búsqueda
                if (this.elements.customerSearch) {
                    this.elements.customerSearch.value = this.config.customer.display_name;
                }
                
                toastr.success(`Cliente seleccionado: ${this.config.customer.display_name}`);
            }
        } catch (error) {
            console.error('Error selecting customer:', error);
        }
    },

    createBasicCustomer(document) {
        // Marcar que se usará este documento para crear cliente básico
        this.config.customer = {
            id: null,
            document_number: document,
            display_name: `Cliente ${document}`,
            is_guest: true
        };
        
        this.updateCustomerDisplay();
        this.clearCustomerSearch();
        
        if (this.elements.customerSearch) {
            this.elements.customerSearch.value = `Cliente ${document}`;
        }
        
        toastr.info('Se creará cliente automáticamente en la venta');
    },

    clearCustomerSearch() {
        if (this.elements.customerResults) {
            this.elements.customerResults.style.display = 'none';
            this.elements.customerResults.innerHTML = '';
        }
    },

    renderProductGrid(products) {
        const container = document.getElementById('productGrid');
        if (!container) return;

        container.innerHTML = '';

        products.forEach(product => {
            const productCard = this.createProductCard(product);
            container.appendChild(productCard);
        });
    },

    createProductCard(product) {
        const card = document.createElement('div');
        card.className = 'col-md-3 col-sm-4 col-6 mb-3';
        
        const stockStatus = product.stock_current <= 0 ? 'out-of-stock' : 
                           product.stock_current <= product.stock_minimum ? 'low-stock' : 'in-stock';
        
        card.innerHTML = `
            <div class="card product-card h-100 ${stockStatus === 'out-of-stock' ? 'disabled' : ''}" 
                 data-product-id="${product.id}">
                <div class="card-body p-3">
                    ${product.image ? 
                        `<img src="${product.image}" alt="${product.name}" class="product-image mb-2">` : 
                        `<div class="product-placeholder mb-2">${product.name.charAt(0)}</div>`
                    }
                    <h6 class="card-title">${product.name}</h6>
                    <p class="text-muted small">${product.category_name || 'Sin categoría'}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <strong class="text-primary">S/.${parseFloat(product.price).toFixed(2)}</strong>
                        <span class="badge bg-label-${stockStatus === 'in-stock' ? 'success' : stockStatus === 'low-stock' ? 'warning' : 'danger'}">
                            ${product.stock_current}
                        </span>
                    </div>
                    ${stockStatus !== 'out-of-stock' ? 
                        `<button class="btn btn-primary btn-sm w-100 mt-2 add-to-cart" 
                                data-product='${JSON.stringify(product)}'>
                            Agregar
                        </button>` : 
                        `<button class="btn btn-secondary btn-sm w-100 mt-2" disabled>
                            Sin Stock
                        </button>`
                    }
                </div>
            </div>
        `;

        // Event listener para agregar al carrito
        const addButton = card.querySelector('.add-to-cart');
        if (addButton) {
            addButton.addEventListener('click', (e) => {
                e.preventDefault();
                const productData = JSON.parse(e.target.dataset.product);
                this.addToCart(productData);
            });
        }

        return card;
    },

    addToCart(product) {
        const existingItem = this.config.cart.find(item => item.product.id === product.id);
        
        if (existingItem) {
            if (existingItem.quantity < product.stock_current) {
                existingItem.quantity += 1;
            } else {
                toastr.warning('Stock insuficiente');
                return;
            }
        } else {
            this.config.cart.push({
                product: product,
                quantity: 1,
                unit_price: parseFloat(product.price)
            });
        }

        this.updateCartDisplay();
        this.calculateTotals();
        toastr.success(`${product.name} agregado al carrito`);
    },

    removeFromCart(productId) {
        this.config.cart = this.config.cart.filter(item => item.product.id !== productId);
        this.updateCartDisplay();
        this.calculateTotals();
    },

    updateCartQuantity(productId, quantity) {
        const item = this.config.cart.find(item => item.product.id === productId);
        if (item) {
            if (quantity <= 0) {
                this.removeFromCart(productId);
            } else if (quantity <= item.product.stock_current) {
                item.quantity = quantity;
                this.updateCartDisplay();
                this.calculateTotals();
            } else {
                toastr.warning('Stock insuficiente');
            }
        }
    },

    updateCartDisplay() {
        if (!this.elements.cartItems) return;

        if (this.config.cart.length === 0) {
            this.elements.cartItems.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="ri-shopping-cart-line ri-48px mb-3 d-block"></i>
                    <p>Carrito vacío</p>
                </div>
            `;
            return;
        }

        this.elements.cartItems.innerHTML = this.config.cart.map(item => `
            <div class="cart-item d-flex align-items-center justify-content-between p-3 border-bottom">
                <div class="flex-grow-1">
                    <h6 class="mb-1">${item.product.name}</h6>
                    <small class="text-muted">${item.product.code}</small>
                    <div class="text-primary fw-medium">
                        S/.${item.unit_price.toFixed(2)} x ${item.quantity}
                    </div>
                    <div class="text-secondary">
                        SubTotal: S/.${(item.unit_price * item.quantity).toFixed(2)}
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <div class="input-group" style="width: auto;">
                        <button class="btn btn-outline-secondary btn-sm" type="button" 
                                onclick="POSSystem.updateCartQuantity(${item.product.id}, ${item.quantity - 1})">
                            -
                        </button>
                        <input type="number" 
                               class="form-control form-control-sm text-center" 
                               value="${item.quantity}" 
                               min="1" 
                               max="${item.product.stock_current}"
                               onchange="POSSystem.updateCartQuantity(${item.product.id}, parseInt(this.value))"
                               style="color: white; height: 32px; width: 80px; padding: 0 6px;" />
                        <button class="btn btn-outline-secondary btn-sm" type="button"
                                onclick="POSSystem.updateCartQuantity(${item.product.id}, ${item.quantity + 1})">
                            +
                        </button>
                    </div>
                    <button class="btn btn-danger btn-sm" 
                            onclick="POSSystem.removeFromCart(${item.product.id})">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    calculateTotals() {
        this.config.subtotal = this.config.cart.reduce((total, item) => {
            return total + (item.quantity * item.unit_price);
        }, 0);

        this.config.tax = this.config.subtotal * 0.18; // IGV 18%
        this.config.total = this.config.subtotal + this.config.tax - this.config.discount;

        this.updateTotalsDisplay();
        this.calculateChange();
    },

    toggleCashFields(paymentMethod) {
        const cashFields = document.getElementById('cashPaymentFields');
        if (cashFields) {
            cashFields.style.display = paymentMethod === 'efectivo' ? 'block' : 'none';
                 
            if (paymentMethod !== 'efectivo') {
                
                document.getElementById('cashReceived').value = '';
                document.getElementById('changeAmount').value = '';
                
            }else{
                document.getElementById('cashReceived').focus();
            }

        }
    },

    calculateChange() {
        const cashReceived = parseFloat(document.getElementById('cashReceived')?.value) || 0;
        const total = this.config.total;
        const change = cashReceived - total;
        
        const changeField = document.getElementById('changeAmount');
        if (changeField) {
            changeField.value = change >= 0 ? change.toFixed(2) : '0.00';
            
            const cashReceivedField = document.getElementById('cashReceived');
            if (cashReceived < total && cashReceived > 0) {
                cashReceivedField.classList.add('is-invalid');
            } else {
                cashReceivedField.classList.remove('is-invalid');
            }
        }
    },

    updateTotalsDisplay() {
        if (!this.elements.totals) return;

        this.elements.totals.innerHTML = `
            <div class="d-flex justify-content-between mb-2">
                <span>Subtotal:</span>
                <span>S/.${this.config.subtotal.toFixed(2)}</span>
            </div>
            <div class="d-flex justify-content-between mb-2">
                <span>IGV (18%):</span>
                <span>S/.${this.config.tax.toFixed(2)}</span>
            </div>
            <div class="d-flex justify-content-between mb-2">
                <span>Descuento:</span>
                <span>S/.${this.config.discount.toFixed(2)}</span>
            </div>
            <hr>
            <div class="d-flex justify-content-between fw-bold">
                <span>Total:</span>
                <span class="text-primary">S/.${this.config.total.toFixed(2)}</span>
            </div>
        `;

        if (this.elements.checkoutButton) {
            this.elements.checkoutButton.disabled = this.config.cart.length === 0;
        }
    },

    updateCustomerDisplay() {
        const container = document.getElementById('selectedCustomer');
        if (!container) return;

        if (this.config.customer) {
            const isGuest = this.config.customer.is_guest || !this.config.customer.id;
            
            container.innerHTML = `
                <div class="selected-customer p-3 border rounded bg-light">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="mb-1">${this.config.customer.display_name}</h6>
                            <small class="text-muted">
                                ${isGuest ? 
                                    `Documento: ${this.config.customer.document_number}` :
                                    `${this.config.customer.document_type_display}: ${this.config.customer.document_number}`
                                }
                            </small>
                            ${isGuest ? 
                                '<br><small class="text-info">Se creará automáticamente</small>' :
                                (this.config.customer.email ? `<br><small>${this.config.customer.email}</small>` : '')
                            }
                        </div>
                        <button class="btn btn-sm btn-outline-secondary" onclick="POSSystem.clearCustomer()">
                            <i class="ri-close-line"></i>
                        </button>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="text-center text-muted py-3">
                    <i class="ri-user-line ri-24px mb-2 d-block"></i>
                    <small>Cliente no seleccionado</small>
                </div>
            `;
        }
    },

    clearCustomer() {
        this.config.customer = null;
        this.updateCustomerDisplay();
        this.clearCustomerSearch();
        
        if (this.elements.customerSearch) {
            this.elements.customerSearch.value = '';
        }
    },

    async processCheckout() {
        

        if (this.config.cart.length === 0) {
            toastr.error('El carrito está vacío');
            return;
        }

        const paymentMethod = this.elements.paymentMethod?.value;
        if (!paymentMethod) {
            toastr.error('Seleccione un método de pago');
            return;
        }

        // Validar efectivo si es necesario
        if (paymentMethod === 'efectivo') {
            const cashReceived = parseFloat(document.getElementById('cashReceived')?.value) || 0;
            if (cashReceived < this.config.total) {
                toastr.error('Monto recibido insuficiente');
                return;
            }
        }

        const saleData = {
        items: this.config.cart.map(item => ({
            product_id: parseInt(item.product.id),
            quantity: parseInt(item.quantity),
            unit_price: parseFloat(item.unit_price).toFixed(2) // Convertir a string con 2 decimales
        })),
        payment_method: paymentMethod,
        discount_amount: parseFloat(this.config.discount).toFixed(2), // Convertir a string
        notes: document.getElementById('saleNotes')?.value || ''
    };

        // Agregar datos del cliente
        if (this.config.customer) {
            if (this.config.customer.id) {
                // Cliente existente
                saleData.customer_id = this.config.customer.id;
            } else {
                // Cliente nuevo (documento encontrado)
                saleData.customer_document = this.config.customer.document_number;
                saleData.customer_name = this.config.customer.display_name;
            }
        }

        this.showLoading(true);

        try {
            const response = await fetch('/api/sales/quick_sale/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.config.csrfToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(saleData)
            });

            if (response.ok) {
            this.configImpresion = {
                    cart: JSON.parse(JSON.stringify(this.config.cart)),
                    customer: this.config.customer ? JSON.parse(JSON.stringify(this.config.customer)) : null,
                    total: this.config.total,
                    tax: this.config.tax,
                    subtotal: this.config.subtotal,
                    discount: this.config.discount
                };
                const result = await response.json();
                this.showSuccessModal(result.sale);
                this.resetPOS();
            } else {
                const error = await response.json();
                toastr.error(error.error || 'Error procesando venta');
            }
        } catch (error) {
            console.error('Error in checkout:', error);
            toastr.error('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    },

    showSuccessModal(sale) {
        const modal = document.getElementById('saleSuccessModal');
        if (modal) {
            document.getElementById('saleNumber').textContent = sale.sale_number;
            document.getElementById('saleTotal').textContent = `S/.${parseFloat(sale.total_amount).toFixed(2)}`;
            document.getElementById('saleCustomer').textContent = sale.customer_display_name;
            
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        }
    }
    
    
    
    ,
printReceipt() {
    const modal = document.getElementById('saleSuccessModal');
    const saleNumber = document.getElementById('saleNumber')?.textContent;
    
    if (!saleNumber || saleNumber === '-') {
        toastr.error('No hay venta para imprimir');
        return;
    }
    
    // Abrir en nueva ventana para imprimir
    const printWindow = window.open('', '_blank');
    console.log('this.configImpresion');
    console.log(this.configImpresion);
    console.log(this.configImpresion);
    console.log(this.configImpresion);
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Recibo de Venta ${saleNumber}</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    font-size: 12px; 
                    margin: 20px;
                    line-height: 1.4;
                }
                .header { 
                    text-align: center; 
                    border-bottom: 2px solid #000; 
                    padding-bottom: 10px; 
                    margin-bottom: 15px;
                }
                .company-name { 
                    font-size: 16px; 
                    font-weight: bold; 
                    margin-bottom: 5px;
                }
                .receipt-title { 
                    font-size: 14px; 
                    font-weight: bold; 
                    margin: 10px 0;
                }
                .info-row { 
                    display: flex; 
                    justify-content: space-between; 
                    margin: 5px 0;
                }
                .items-table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin: 15px 0;
                }
                .items-table th, .items-table td { 
                    border: 1px solid #000; 
                    padding: 8px; 
                    text-align: left;
                }
                .items-table th { 
                    background-color: #f0f0f0; 
                    font-weight: bold;
                }
                .totals { 
                    margin-top: 15px; 
                    padding-top: 10px; 
                    border-top: 1px solid #000;
                }
                .total-row { 
                    display: flex; 
                    justify-content: space-between; 
                    margin: 3px 0;
                }
                .final-total { 
                    font-weight: bold; 
                    font-size: 14px; 
                    border-top: 1px solid #000; 
                    padding-top: 5px; 
                    margin-top: 5px;
                }
                .footer { 
                    text-align: center; 
                    margin-top: 20px; 
                    font-size: 10px; 
                    color: #666;
                }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="company-name">TU EMPRESA S.A.C.</div>
                <div>RUC: 20123456789</div>
                <div>Dirección de tu empresa</div>
                <div>Teléfono: (01) 123-4567</div>
            </div>
            
            <div class="receipt-title">RECIBO DE VENTA</div>
            
            <div class="info-row">
                <span><strong>Número:</strong> ${saleNumber}</span>
                <span><strong>Fecha:</strong> ${new Date().toLocaleString('es-PE')}</span>
            </div>
            
            <div class="info-row">
                <span><strong>Cliente:</strong> ${this.configImpresion.customer ? this.configImpresion.customer.display_name : 'Cliente General'}</span>
            </div>
            
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cant.</th>
                        <th>P.Unit.</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.configImpresion.cart.map(item => `
                        <tr>
                            <td>${item.product.name}</td>
                            <td>${item.quantity}</td>
                            <td>S/.${item.unit_price.toFixed(2)}</td>
                            <td>S/.${(item.quantity * item.unit_price).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="totals">
                <div class="total-row">
                    <span>Subtotal:</span>
                    <span>S/.${this.configImpresion.subtotal.toFixed(2)}</span>
                </div>
                <div class="total-row">
                    <span>IGV (18%):</span>
                    <span>S/.${this.configImpresion.tax.toFixed(2)}</span>
                </div>
                <div class="total-row">
                    <span>Descuento:</span>
                    <span>S/.${this.configImpresion.discount.toFixed(2)}</span>
                </div>
                <div class="total-row final-total">
                    <span>TOTAL:</span>
                    <span>S/.${this.configImpresion.total.toFixed(2)}</span>
                </div>
            </div>
            
            <div class="footer">
                <div>¡Gracias por su compra!</div>
                <div>Este documento no tiene valor tributario</div>
                <div class="no-print">
                    <br>
                    <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Imprimir
                    </button>
                    <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">
                        Cerrar
                    </button>
                </div>
            </div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    
    // Auto-imprimir después de cargar
    printWindow.onload = function() {
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };
},
    resetPOS() {
        


        this.config.cart = [];
        this.config.customer = null;
        this.config.discount = 0;
        
        this.updateCartDisplay();
        this.updateCustomerDisplay();
        this.calculateTotals();
        this.clearCustomerSearch();
        
        if (this.elements.paymentMethod) this.elements.paymentMethod.value = '';
        if (this.elements.customerSearch) this.elements.customerSearch.value = '';
      
        const notesField = document.getElementById('saleNotes');
        if (notesField) notesField.value = '';
        document.getElementById('paymentMethod').value = '';
        
        const discountField = document.getElementById('discountAmount');
        if (discountField) discountField.value = '';
        
        toastr.success('POS resetado');
    },

    showLoading(show) {
        if (this.elements.checkoutButton) {
            this.elements.checkoutButton.disabled = show;
            this.elements.checkoutButton.innerHTML = show ? 
                '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...' : 
                '<i class="ri-check-line me-1"></i>Procesar Venta (F3)';
        }
    },

    handleKeyboardShortcuts(e) {
        if (e.key === 'F1') {
            e.preventDefault();
            this.elements.productSearch?.focus();
        }
        
        if (e.key === 'F2') {
            e.preventDefault();
            this.elements.customerSearch?.focus();
        }
        
        if (e.key === 'F3') {
            e.preventDefault();
            this.processCheckout();
        }
        
        if (e.key === 'Escape') {
            e.preventDefault();
           document.getElementById('cashPaymentFields').style.display = paymentMethod === 'efectivo' ? 'block' : 'none';
            
            if (this.config.cart.length > 0) {
                if (confirm('¿Limpiar carrito?')) {
                    this.resetPOS();
           document.getElementById('cashPaymentFields').style.display = paymentMethod === 'efectivo' ? 'block' : 'none';

                }
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {
    POSSystem.init();
});

window.POSSystem = POSSystem;