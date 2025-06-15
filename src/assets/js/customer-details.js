/**
 * Customer Details Module
 * Manejo completo de detalles del cliente
 */

'use strict';

const CustomerDetails = {
    config: {
        customerId: null,
        customer: null,
        salesData: null,
        charts: {},
        tables: {}
    },

    /**
     * Inicializar módulo
     */
    init() {
        this.config.customerId = this.getCustomerIdFromURL();
        if (!this.config.customerId) {
            window.location.href = '/app/customers/list/';
            return;
        }

        this.setupEventHandlers();
        this.loadCustomerData();
    },

    /**
     * Obtener ID del cliente desde URL
     */
    getCustomerIdFromURL() {
        const path = window.location.pathname;
        const matches = path.match(/\/customers\/details\/(\d+)\//);
        return matches ? parseInt(matches[1]) : null;
    },

    /**
     * Configurar event handlers
     */
    setupEventHandlers() {
        // Tabs
        document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                const target = e.target.getAttribute('data-bs-target');
                this.handleTabChange(target);
            });
        });

        // Forms
        document.getElementById('editCustomerForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCustomer();
        });

        document.getElementById('addContactForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveContact();
        });
    },

    /**
     * Cargar datos del cliente
     */
    async loadCustomerData() {
        try {
            this.showLoading(true);
            
            // Cargar datos básicos del cliente
            const response = await fetch(`/api/customers/${this.config.customerId}/`);
            if (!response.ok) throw new Error('Cliente no encontrado');
            
            this.config.customer = await response.json();
            this.renderCustomerInfo();
            
            // Cargar estadísticas de ventas
            await this.loadSalesAnalytics();
            
            // Cargar historial de ventas
            await this.loadSalesHistory();
            
            // Cargar contactos
            await this.loadContacts();
            
        } catch (error) {
            console.error('Error loading customer:', error);
            toastr.error('Error cargando datos del cliente');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Renderizar información del cliente
     */
    renderCustomerInfo() {
        const customer = this.config.customer;
        
        // Header principal
        document.getElementById('customerName').textContent = customer.display_name;
        document.getElementById('customerDocument').textContent = 
            `${customer.document_type_display}: ${customer.document_number}`;
        document.getElementById('customerType').textContent = 
            customer.customer_type === 'persona_juridica' ? 'Empresa' : 'Persona Natural';
        document.getElementById('customerStatus').textContent = 
            customer.is_active ? 'Activo' : 'Inactivo';
        document.getElementById('customerEmail').textContent = customer.email || 'No registrado';
        document.getElementById('customerPhone').textContent = 
            customer.mobile_phone || customer.phone || 'No registrado';

        // Estadísticas
        document.getElementById('totalSales').textContent = customer.total_sales || 0;
        document.getElementById('totalAmount').textContent = 
            `S/.${parseFloat(customer.total_sales_amount || 0).toFixed(2)}`;
        
        const avgAmount = customer.total_sales > 0 ? 
            customer.total_sales_amount / customer.total_sales : 0;
        document.getElementById('avgSale').textContent = `S/.${avgAmount.toFixed(2)}`;
        
        document.getElementById('lastSaleDate').textContent = customer.last_sale_date ? 
            new Date(customer.last_sale_date).toLocaleDateString('es-PE') : 'Nunca';

        // Sidebar información
        document.getElementById('sidebarCustomerType').textContent = 
            customer.customer_type === 'persona_juridica' ? 'Persona Jurídica' : 'Persona Natural';
        document.getElementById('sidebarDocument').textContent = 
            `${customer.document_type_display}: ${customer.document_number}`;
        document.getElementById('sidebarEmail').textContent = customer.email || '-';
        
        const phones = [];
        if (customer.phone) phones.push(customer.phone);
        if (customer.mobile_phone) phones.push(customer.mobile_phone);
        document.getElementById('sidebarPhones').textContent = phones.length ? phones.join(', ') : '-';
        
        document.getElementById('sidebarAddress').textContent = customer.address || '-';
        document.getElementById('sidebarDistrict').textContent = 
            [customer.district, customer.province, customer.department].filter(Boolean).join(', ') || '-';
        document.getElementById('sidebarCreditLimit').textContent = 
            `S/.${parseFloat(customer.credit_limit || 0).toFixed(2)}`;
        document.getElementById('sidebarSunatStatus').textContent = customer.sunat_status || '-';
        document.getElementById('sidebarCreatedAt').textContent = 
            new Date(customer.created_at).toLocaleDateString('es-PE');
    },

    /**
     * Cargar analíticas de ventas
     */
    async loadSalesAnalytics() {
        try {
            const response = await fetch(`/api/customers/${this.config.customerId}/sales_analytics/`);
            if (response.ok) {
                this.config.salesData = await response.json();
            }
        } catch (error) {
            console.error('Error loading sales analytics:', error);
        }
    },

    /**
     * Cargar historial de ventas
     */
    async loadSalesHistory() {
        try {
            const response = await fetch(`/api/customers/${this.config.customerId}/sales_history/`);
            if (response.ok) {
                const data = await response.json();
                this.renderSalesTable(data.data || []);
            }
        } catch (error) {
            console.error('Error loading sales history:', error);
        }
    },

    /**
     * Renderizar tabla de ventas
     */
    renderSalesTable(sales) {
        const tbody = document.querySelector('#salesTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (sales.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        No hay ventas registradas
                    </td>
                </tr>
            `;
            return;
        }

        sales.forEach(sale => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <span class="fw-medium">${sale.sale_number}</span>
                </td>
                <td>${new Date(sale.sale_date).toLocaleDateString('es-PE')}</td>
                <td class="fw-medium text-success">S/.${parseFloat(sale.total_amount).toFixed(2)}</td>
                <td>
                    <span class="badge bg-label-info">${sale.payment_method_display}</span>
                </td>
                <td>
                    <span class="badge bg-label-${sale.status_color}">${sale.status_display}</span>
                </td>
                <td>
                    <div class="dropdown">
                        <button type="button" class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">
                            Acciones
                        </button>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="/app/sales/details/${sale.id}/">
                                <i class="ri-eye-line me-2"></i>Ver Detalles
                            </a></li>
                            <li><a class="dropdown-item" href="#" onclick="CustomerDetails.printSale(${sale.id})">
                                <i class="ri-printer-line me-2"></i>Imprimir
                            </a></li>
                            ${sale.can_edit ? `
                                <li><a class="dropdown-item" href="#" onclick="CustomerDetails.editSale(${sale.id})">
                                    <i class="ri-edit-line me-2"></i>Editar
                                </a></li>
                            ` : ''}
                        </ul>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Inicializar DataTable si no existe
        if (!this.config.tables.salesTable) {
            this.config.tables.salesTable = new DataTable('#salesTable', {
                language: {
                    url: '/static/vendor/libs/datatables-bs5/es-ES.json'
                },
                order: [[1, 'desc']],
                pageLength: 10,
                responsive: true
            });
        }
    },

    /**
     * Cargar contactos
     */
    async loadContacts() {
        try {
            const response = await fetch(`/api/customer-contacts/?customer=${this.config.customerId}`);
            if (response.ok) {
                const data = await response.json();
                this.renderContacts(data.results || data.data || []);
            }
        } catch (error) {
            console.error('Error loading contacts:', error);
        }
    },

    /**
     * Renderizar contactos
     */
    renderContacts(contacts) {
        const container = document.getElementById('contactsList');
        if (!container) return;

        if (contacts.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="ri-contacts-line ri-48px mb-3 d-block"></i>
                    <p>No hay contactos registrados</p>
                </div>
            `;
            return;
        }

        container.innerHTML = contacts.map(contact => `
            <div class="contact-card p-3 border rounded mb-3 ${contact.is_primary ? 'primary' : ''}">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">
                            ${contact.name}
                            ${contact.is_primary ? '<span class="badge bg-success ms-2">Principal</span>' : ''}
                        </h6>
                        ${contact.position ? `<p class="mb-1 text-muted">${contact.position}</p>` : ''}
                        <div class="contact-info">
                            ${contact.email ? `<div><i class="ri-mail-line me-1"></i>${contact.email}</div>` : ''}
                            ${contact.phone ? `<div><i class="ri-phone-line me-1"></i>${contact.phone}</div>` : ''}
                        </div>
                    </div>
                    <div class="dropdown">
                        <button type="button" class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">
                            <i class="ri-more-2-line"></i>
                        </button>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="#" onclick="CustomerDetails.editContact(${contact.id})">
                                <i class="ri-edit-line me-2"></i>Editar
                            </a></li>
                            ${!contact.is_primary ? `
                                <li><a class="dropdown-item" href="#" onclick="CustomerDetails.setPrimaryContact(${contact.id})">
                                    <i class="ri-star-line me-2"></i>Marcar Principal
                                </a></li>
                            ` : ''}
                            <li><a class="dropdown-item text-danger" href="#" onclick="CustomerDetails.deleteContact(${contact.id})">
                                <i class="ri-delete-bin-line me-2"></i>Eliminar
                            </a></li>
                        </ul>
                    </div>
                </div>
            </div>
        `).join('');
    },

    /**
     * Manejar cambio de tab
     */
    handleTabChange(target) {
        switch (target) {
            case '#analytics-tab':
                this.loadAnalytics();
                break;
            case '#activity-tab':
                this.loadActivity();
                break;
        }
    },

    /**
     * Cargar gráficos de analíticas
     */
    loadAnalytics() {
        if (!this.config.salesData) return;

        // Gráfico de ventas mensuales
        this.createMonthlyChart();
        
        // Gráfico de métodos de pago
        this.createPaymentMethodChart();
        
        // Lista de productos favoritos
        this.renderTopProducts();
    },

    /**
     * Crear gráfico de ventas mensuales
     */
    createMonthlyChart() {
        const chartElement = document.querySelector('#monthlyChart');
        if (!chartElement || this.config.charts.monthlyChart) return;

        const salesData = this.config.salesData?.monthly_sales || [];
        
        const options = {
            series: [{
                name: 'Ventas',
                data: salesData.map(item => item.count)
            }, {
                name: 'Monto',
                data: salesData.map(item => item.total)
            }],
            chart: {
                type: 'line',
                height: 300,
                toolbar: { show: false }
            },
            colors: ['#696cff', '#03c3ec'],
            xaxis: {
                categories: salesData.map(item => item.month_name)
            },
            yaxis: [{
                title: { text: 'Número de Ventas' }
            }, {
                opposite: true,
                title: { text: 'Monto (S/)' }
            }],
            stroke: {
                width: 3,
                curve: 'smooth'
            },
            grid: {
                borderColor: '#e7e7e7'
            }
        };

        this.config.charts.monthlyChart = new ApexCharts(chartElement, options);
        this.config.charts.monthlyChart.render();
    },

    /**
     * Crear gráfico de métodos de pago
     */
    createPaymentMethodChart() {
        const chartElement = document.querySelector('#paymentMethodChart');
        if (!chartElement || this.config.charts.paymentChart) return;

        const paymentData = this.config.salesData?.sales_by_payment_method || [];
        
        const options = {
            series: paymentData.map(item => item.total),
            labels: paymentData.map(item => item.method_display),
            chart: {
                type: 'donut',
                height: 300
            },
            colors: ['#696cff', '#03c3ec', '#8592a3', '#71dd37', '#ffab00'],
            legend: {
                position: 'bottom'
            }
        };

        this.config.charts.paymentChart = new ApexCharts(chartElement, options);
        this.config.charts.paymentChart.render();
    },

    /**
     * Renderizar productos favoritos
     */
    renderTopProducts() {
        const container = document.getElementById('topProductsList');
        if (!container) return;

        const products = this.config.salesData?.top_products || [];

        if (products.length === 0) {
            container.innerHTML = '<p class="text-muted">No hay datos de productos</p>';
            return;
        }

        container.innerHTML = products.map((product, index) => `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div class="d-flex align-items-center">
                    <span class="badge bg-primary me-3">${index + 1}</span>
                    <div>
                        <h6 class="mb-0">${product.product_name}</h6>
                        <small class="text-muted">${product.product_code}</small>
                    </div>
                </div>
                <div class="text-end">
                    <div class="fw-medium">${product.total_quantity} unidades</div>
                    <small class="text-muted">S/.${parseFloat(product.total_amount).toFixed(2)}</small>
                </div>
            </div>
        `).join('');
    },

    /**
     * Cargar actividad
     */
    async loadActivity() {
        const container = document.getElementById('activityTimeline');
        if (!container) return;

        try {
            // Simular datos de actividad (puedes implementar un endpoint real)
            const activities = [
                {
                    type: 'sale',
                    description: 'Realizó una compra por S/.150.00',
                    date: new Date(),
                    icon: 'ri-shopping-cart-line',
                    color: 'success'
                },
                {
                    type: 'contact',
                    description: 'Se agregó nuevo contacto',
                    date: new Date(Date.now() - 86400000),
                    icon: 'ri-user-add-line',
                    color: 'info'
                },
                {
                    type: 'update',
                    description: 'Se actualizó información del cliente',
                    date: new Date(Date.now() - 172800000),
                    icon: 'ri-edit-line',
                    color: 'warning'
                }
            ];

            container.innerHTML = activities.map(activity => `
                <div class="timeline-item">
                    <div class="d-flex align-items-start">
                        <div class="avatar avatar-sm me-3">
                            <span class="avatar-initial bg-label-${activity.color} rounded">
                                <i class="${activity.icon}"></i>
                            </span>
                        </div>
                        <div class="flex-grow-1">
                            <p class="mb-1">${activity.description}</p>
                            <small class="text-muted">${activity.date.toLocaleString('es-PE')}</small>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error loading activity:', error);
            container.innerHTML = '<p class="text-muted">Error cargando actividad</p>';
        }
    },

    /**
     * Mostrar modal de edición
     */
    showEditModal() {
        const customer = this.config.customer;
        if (!customer) return;

        // Llenar formulario
        document.getElementById('editFirstName').value = customer.first_name || '';
        document.getElementById('editLastName').value = customer.last_name || '';
        document.getElementById('editEmail').value = customer.email || '';
        document.getElementById('editPhone').value = customer.phone || '';
        document.getElementById('editAddress').value = customer.address || '';
        document.getElementById('editDistrict').value = customer.district || '';
        document.getElementById('editProvince').value = customer.province || '';
        document.getElementById('editDepartment').value = customer.department || '';
        document.getElementById('editCreditLimit').value = customer.credit_limit || 0;
        document.getElementById('editIsActive').checked = customer.is_active;
        document.getElementById('editIsFrequent').checked = customer.is_frequent;
        document.getElementById('editNotes').value = customer.notes || '';

        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('editCustomerModal'));
        modal.show();
    },

    /**
     * Guardar cambios del cliente
     */
    async saveCustomer() {
        const form = document.getElementById('editCustomerForm');
        const formData = new FormData(form);
        
        const data = {};
        for (let [key, value] of formData.entries()) {
            if (key === 'is_active' || key === 'is_frequent') {
                data[key] = document.getElementById(`edit${key.charAt(0).toUpperCase() + key.slice(1)}`).checked;
            } else {
                data[key] = value;
            }
        }

        try {
            const response = await fetch(`/api/customers/${this.config.customerId}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCookie('csrftoken')
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                const updatedCustomer = await response.json();
                this.config.customer = updatedCustomer;
                this.renderCustomerInfo();
                
                // Cerrar modal
                bootstrap.Modal.getInstance(document.getElementById('editCustomerModal')).hide();
                
                toastr.success('Cliente actualizado correctamente');
            } else {
                const error = await response.json();
                toastr.error('Error actualizando cliente: ' + JSON.stringify(error));
            }
        } catch (error) {
            console.error('Error saving customer:', error);
            toastr.error('Error de conexión');
        }
    },

    /**
     * Mostrar modal de agregar contacto
     */
    showAddContactModal() {
        // Limpiar formulario
        document.getElementById('addContactForm').reset();
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('addContactModal'));
        modal.show();
    },

    /**
     * Guardar contacto
     */
    async saveContact() {
        const form = document.getElementById('addContactForm');
        const formData = new FormData(form);
        
        const data = {
            customer: this.config.customerId
        };
        
        for (let [key, value] of formData.entries()) {
            if (key === 'is_primary') {
                data[key] = document.getElementById('contactIsPrimary').checked;
            } else {
                data[key] = value;
            }
        }

        try {
            const response = await fetch('/api/customer-contacts/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCookie('csrftoken')
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                // Recargar contactos
                await this.loadContacts();
                
                // Cerrar modal
                bootstrap.Modal.getInstance(document.getElementById('addContactModal')).hide();
                
                toastr.success('Contacto agregado correctamente');
            } else {
                const error = await response.json();
                toastr.error('Error agregando contacto');
            }
        } catch (error) {
            console.error('Error saving contact:', error);
            toastr.error('Error de conexión');
        }
    },

    /**
     * Acciones rápidas
     */
    async updateFromAPI() {
        try {
            const response = await fetch(`/api/customers/${this.config.customerId}/update_from_api/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.getCookie('csrftoken')
                }
            });

            if (response.ok) {
                await this.loadCustomerData();
                toastr.success('Datos actualizados desde API');
            } else {
                toastr.error('Error actualizando desde API');
            }
        } catch (error) {
            console.error('Error updating from API:', error);
            toastr.error('Error de conexión');
        }
    },

    async toggleStatus() {
        try {
            const response = await fetch(`/api/customers/${this.config.customerId}/toggle_active/`, {
                method: 'PATCH',
                headers: {
                    'X-CSRFToken': this.getCookie('csrftoken')
                }
            });

            if (response.ok) {
                const result = await response.json();
                this.config.customer.is_active = result.is_active;
                this.renderCustomerInfo();
                toastr.success(result.message);
            }
        } catch (error) {
            console.error('Error toggling status:', error);
            toastr.error('Error cambiando estado');
        }
    },

    async toggleFrequent() {
        try {
            const response = await fetch(`/api/customers/${this.config.customerId}/toggle_frequent/`, {
                method: 'PATCH',
                headers: {
                    'X-CSRFToken': this.getCookie('csrftoken')
                }
            });

            if (response.ok) {
                const result = await response.json();
                this.config.customer.is_frequent = result.is_frequent;
                this.renderCustomerInfo();
                toastr.success(result.message);
            }
        } catch (error) {
            console.error('Error toggling frequent:', error);
            toastr.error('Error cambiando estado frecuente');
        }
    },

    createSale() {
        window.location.href = `/app/sales/pos/?customer=${this.config.customerId}`;
    },

    sendEmail() {
        if (this.config.customer.email) {
            window.location.href = `mailto:${this.config.customer.email}`;
        } else {
            toastr.warning('Cliente no tiene email registrado');
        }
    },

    exportData() {
        // Implementar exportación de datos
        toastr.info('Función de exportación en desarrollo');
    },

    viewFullHistory() {
        window.location.href = `/app/sales/list/?customer=${this.config.customerId}`;
    },

    /**
     * Utilidades
     */
    showLoading(show) {
        const indicators = document.querySelectorAll('.loading-indicator');
        indicators.forEach(indicator => {
            indicator.style.display = show ? 'block' : 'none';
        });
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
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    CustomerDetails.init();
});

// Hacer disponible globalmente
window.CustomerDetails = CustomerDetails;