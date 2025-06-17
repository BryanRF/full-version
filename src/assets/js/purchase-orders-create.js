/**
 * Purchase Orders Create JavaScript
 * Funcionalidades para crear órdenes de compra
 */

$(document).ready(function() {
    'use strict';

    let selectedProducts = [];
    let currentSupplier = null;
    // URLs de la API
    const API_URLS = {
        suppliers: '/api/suppliers/active/',
        products: '/api/products/active/',
        createPO: '/purchasing/purchase-orders/',
        supplierDetails: '/purchasing/suppliers/{id}/',
        productDetails: '/api/products/{id}/'
    };

    // Inicialización
    init();

    function init() {
        initializeSelects();
        initializeDatePickers();
        bindEvents();
        validateForm();
    }

    function initializeSelects() {
        // Inicializar Select2 para proveedores
        $('#supplier').select2({
            placeholder: 'Seleccionar proveedor...',
            allowClear: true,
            ajax: {
                url: API_URLS.suppliers,
                dataType: 'json',
                delay: 250,
                data: function(params) {
                    return {
                        search: params.term,
                        page: params.page || 1
                    };
                },
                processResults: function(data, params) {
                    params.page = params.page || 1;
                    return {
                        results: data.results.map(supplier => ({
                            id: supplier.id,
                            text: `${supplier.company_name} - ${supplier.contact_person || 'Sin contacto'}`,
                            supplier: supplier
                        })),
                        pagination: {
                            more: data.next !== null
                        }
                    };
                },
                cache: true
            }
        });

        // Inicializar Select2 para productos en modal
        $('#productSelect').select2({
            placeholder: 'Buscar producto por código o nombre...',
            allowClear: true,
            dropdownParent: $('#addProductModal'),
            ajax: {
                url: API_URLS.products,
                dataType: 'json',
                delay: 250,
                data: function(params) {
                    return {
                        search: params.term,
                        page: params.page || 1,
                        supplier: currentSupplier?.id || null
                    };
                },
                processResults: function(data, params) {
                    params.page = params.page || 1;
                    return {
                        results: data.results.map(product => ({
                            id: product.id,
                            text: `${product.code} - ${product.name}`,
                            product: product
                        })),
                        pagination: {
                            more: data.next !== null
                        }
                    };
                },
                cache: true
            }
        });
    }

    function initializeDatePickers() {
        // Configurar flatpickr para fecha de entrega
        $('#expectedDelivery').flatpickr({
            dateFormat: 'd/m/Y',
            minDate: 'today',
            locale: 'es',
            defaultDate: moment().add(7, 'days').toDate()
        });
    }

    function bindEvents() {
        // Cambio de proveedor
        $('#supplier').on('select2:select', function(e) {
            const data = e.params.data;
            currentSupplier = data.supplier;
            loadSupplierInfo(data.supplier);
            validateForm();
        });

        $('#supplier').on('select2:clear', function() {
            currentSupplier = null;
            clearSupplierInfo();
            validateForm();
        });

        // Cambio de fecha
        $('#expectedDelivery').on('change', function() {
            validateForm();
        });

        // Botones para agregar productos
        $('#addProductBtn, #addFirstProductBtn').on('click', function() {
            if (!currentSupplier) {
                toastr.warning('Seleccione un proveedor primero');
                return;
            }
            $('#addProductModal').modal('show');
        });

        // Selección de producto en modal
        $('#productSelect').on('select2:select', function(e) {
            const data = e.params.data;
            loadProductInfo(data.product);
        });

        // Formulario de agregar producto
        $('#addProductForm').on('submit', function(e) {
            e.preventDefault();
            addProductToOrder();
        });

        // Botones de acción
        $('#createOrderBtn').on('click', function(e) {
            e.preventDefault();
            createPurchaseOrder();
        });

        $('#saveDraftBtn').on('click', function(e) {
            e.preventDefault();
            createPurchaseOrder(true);
        });

        $('#previewBtn').on('click', function() {
            showPreview();
        });

        $('#confirmCreateBtn').on('click', function() {
            $('#previewModal').modal('hide');
            createPurchaseOrder();
        });

        // Eliminar producto
        $(document).on('click', '.remove-product', function() {
            const index = $(this).data('index');
            removeProduct(index);
        });

        // Editar producto
        $(document).on('click', '.edit-product', function() {
            const index = $(this).data('index');
            editProduct(index);
        });
    }

    function loadSupplierInfo(supplier) {
        const html = `
            <div class="text-center mb-3">
                <div class="avatar avatar-lg mx-auto mb-3">
                    <span class="avatar-initial rounded bg-label-primary fs-2">
                        ${supplier.company_name.charAt(0).toUpperCase()}
                    </span>
                </div>
                <h6 class="mb-1">${supplier.company_name}</h6>
                <p class="text-muted mb-0">${supplier.contact_person || 'Sin contacto'}</p>
            </div>
            
            <hr>
            
            <div class="info-item mb-3">
                <i class="ri-mail-line me-2 text-muted"></i>
                <span>${supplier.email || 'Sin email'}</span>
            </div>
            
            <div class="info-item mb-3">
                <i class="ri-phone-line me-2 text-muted"></i>
                <span>${supplier.phone || 'Sin teléfono'}</span>
            </div>
            
            <div class="info-item mb-3">
                <i class="ri-map-pin-line me-2 text-muted"></i>
                <span>${supplier.address || 'Sin dirección'}</span>
            </div>
            
            ${supplier.payment_terms ? `
                <div class="info-item mb-3">
                    <i class="ri-credit-card-line me-2 text-muted"></i>
                    <span>${supplier.payment_terms}</span>
                </div>
            ` : ''}
        `;
        
        $('#supplierInfo').html(html);
    }

    function clearSupplierInfo() {
        $('#supplierInfo').html(`
            <div class="text-center text-muted py-4">
                <i class="ri-user-line ri-48px mb-3"></i>
                <p class="mb-0">Seleccione un proveedor para ver su información</p>
            </div>
        `);
    }

    function loadProductInfo(product) {
        $('#productCode').text(product.code || '-');
        $('#productCategory').text(product.category?.name || '-');
        $('#productStock').text(product.stock || '0');
        $('#productUnit').text(product.unit_of_measure || '-');
        
        // Sugerir precio si está disponible
        if (product.price) {
            $('#productPrice').val(product.price);
        }
        
        $('#selectedProductInfo').removeClass('d-none');
    }

    function addProductToOrder() {
        const productSelect = $('#productSelect');
        const quantity = parseInt($('#productQuantity').val());
        const price = parseFloat($('#productPrice').val());
        const notes = $('#productNotes').val();

        if (!productSelect.val() || !quantity || !price) {
            toastr.error('Complete todos los campos requeridos');
            return;
        }

        const selectedData = productSelect.select2('data')[0];
        const product = selectedData.product;

        // Verificar si el producto ya existe
        const existingIndex = selectedProducts.findIndex(p => p.product.id === product.id);
        if (existingIndex !== -1) {
            toastr.warning('Este producto ya está agregado');
            return;
        }

        const productItem = {
            product: product,
            quantity: quantity,
            unit_price: price,
            notes: notes,
            subtotal: quantity * price
        };

        selectedProducts.push(productItem);
        updateProductsTable();
        updateSummary();
        validateForm();

        // Cerrar modal y limpiar formulario
        $('#addProductModal').modal('hide');
        $('#addProductForm')[0].reset();
        $('#productSelect').val(null).trigger('change');
        $('#selectedProductInfo').addClass('d-none');

        toastr.success('Producto agregado correctamente');
    }

    function removeProduct(index) {
        Swal.fire({
            title: '¿Eliminar producto?',
            text: 'Esta acción no se puede deshacer',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                selectedProducts.splice(index, 1);
                updateProductsTable();
                updateSummary();
                validateForm();
                toastr.success('Producto eliminado');
            }
        });
    }

    function editProduct(index) {
        const product = selectedProducts[index];
        
        // Cargar datos en el modal
        $('#productSelect').empty().append(new Option(
            `${product.product.code} - ${product.product.name}`,
            product.product.id,
            true,
            true
        )).trigger('change');
        
        $('#productQuantity').val(product.quantity);
        $('#productPrice').val(product.unit_price);
        $('#productNotes').val(product.notes);
        
        // Remover producto temporal
        selectedProducts.splice(index, 1);
        updateProductsTable();
        updateSummary();
        
        $('#addProductModal').modal('show');
    }

    function updateProductsTable() {
        const tbody = $('#productsTableBody');
        
        if (selectedProducts.length === 0) {
            tbody.empty();
            $('#emptyProductsState').show();
            $('#productsTable').hide();
            return;
        }

        $('#emptyProductsState').hide();
        $('#productsTable').show();

        const html = selectedProducts.map((item, index) => `
            <tr>
                <td>
                    <div>
                        <strong>${item.product.name}</strong>
                        <br><small class="text-muted">${item.product.code}</small>
                        ${item.notes ? `<br><small class="text-info">${item.notes}</small>` : ''}
                    </div>
                </td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-end">S/.${item.unit_price.toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                <td class="text-end fw-bold">S/.${item.subtotal.toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                <td class="text-center">
                    <div class="btn-group btn-group-sm">
                        <button type="button" class="btn btn-outline-info edit-product" data-index="${index}" title="Editar">
                            <i class="ri-edit-line"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger remove-product" data-index="${index}" title="Eliminar">
                            <i class="ri-delete-bin-line"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        tbody.html(html);
    }

    function updateSummary() {
        const totalProducts = selectedProducts.length;
        const totalQuantity = selectedProducts.reduce((sum, item) => sum + item.quantity, 0);
        const totalAmount = selectedProducts.reduce((sum, item) => sum + item.subtotal, 0);

        $('#summaryTotalProducts').text(totalProducts);
        $('#summaryTotalQuantity').text(totalQuantity);
        $('#summaryTotalAmount').text(`S/.${totalAmount.toLocaleString('es-PE', {minimumFractionDigits: 2})}`);
        $('#totalAmount').text(`S/.${totalAmount.toLocaleString('es-PE', {minimumFractionDigits: 2})}`);
    }

    function validateForm() {
        let isValid = true;

        // Validar proveedor
        if (currentSupplier) {
            $('#supplierIcon').removeClass('ri-close-circle-line text-danger').addClass('ri-check-circle-line text-success');
        } else {
            $('#supplierIcon').removeClass('ri-check-circle-line text-success').addClass('ri-close-circle-line text-danger');
            isValid = false;
        }

        // Validar fecha
        if ($('#expectedDelivery').val()) {
            $('#dateIcon').removeClass('ri-close-circle-line text-danger').addClass('ri-check-circle-line text-success');
        } else {
            $('#dateIcon').removeClass('ri-check-circle-line text-success').addClass('ri-close-circle-line text-danger');
            isValid = false;
        }

        // Validar productos
        if (selectedProducts.length > 0) {
            $('#productsIcon').removeClass('ri-close-circle-line text-danger').addClass('ri-check-circle-line text-success');
        } else {
            $('#productsIcon').removeClass('ri-check-circle-line text-success').addClass('ri-close-circle-line text-danger');
            isValid = false;
        }

        // Habilitar/deshabilitar botones
        $('#createOrderBtn').prop('disabled', !isValid);
        $('#previewBtn').prop('disabled', !isValid);
    }

    function showPreview() {
        const formData = getFormData();
        
        const html = `
            <div class="invoice-preview">
                <div class="row mb-4">
                    <div class="col-md-6">
                        <h5>Orden de Compra</h5>
                        <p class="mb-1"><strong>Proveedor:</strong> ${currentSupplier.company_name}</p>
                        <p class="mb-1"><strong>Contacto:</strong> ${currentSupplier.contact_person || '-'}</p>
                        <p class="mb-1"><strong>Email:</strong> ${currentSupplier.email || '-'}</p>
                    </div>
                    <div class="col-md-6 text-md-end">
                        <p class="mb-1"><strong>Fecha Entrega:</strong> ${formData.expected_delivery}</p>
                        <p class="mb-1"><strong>Prioridad:</strong> ${$('#priority option:selected').text()}</p>
                        <p class="mb-1"><strong>Términos Pago:</strong> ${formData.payment_terms || '-'}</p>
                    </div>
                </div>
                
                <div class="table-responsive">
                    <table class="table table-bordered">
                        <thead class="table-light">
                            <tr>
                                <th>Producto</th>
                                <th class="text-center">Cantidad</th>
                                <th class="text-end">P. Unitario</th>
                                <th class="text-end">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${selectedProducts.map(item => `
                                <tr>
                                    <td>
                                        <strong>${item.product.name}</strong><br>
                                        <small class="text-muted">${item.product.code}</small>
                                        ${item.notes ? `<br><small class="text-info">${item.notes}</small>` : ''}
                                    </td>
                                    <td class="text-center">${item.quantity}</td>
                                    <td class="text-end">S/.${item.unit_price.toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                                    <td class="text-end">S/.${item.subtotal.toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot class="table-secondary">
                            <tr>
                                <th colspan="3" class="text-end">Total:</th>
                                <th class="text-end">S/.${selectedProducts.reduce((sum, item) => sum + item.subtotal, 0).toLocaleString('es-PE', {minimumFractionDigits: 2})}</th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                
                ${formData.notes ? `
                    <div class="mt-4">
                        <strong>Notas:</strong><br>
                        <p class="mb-0">${formData.notes}</p>
                    </div>
                ` : ''}
            </div>
        `;
        
        $('#previewContent').html(html);
    }

    function getFormData() {
        return {
            supplier: currentSupplier.id,
            expected_delivery: $('#expectedDelivery').val(),
            priority: $('#priority').val(),
            payment_terms: $('#paymentTerms').val(),
            notes: $('#notes').val(),
            items: selectedProducts.map(item => ({
                product: item.product.id,
                quantity_ordered: item.quantity,
                unit_price: item.unit_price,
                notes: item.notes
            }))
        };
    }

    function createPurchaseOrder(isDraft = false) {
        const formData = getFormData();
        formData.status = isDraft ? 'draft' : 'sent';
        
        showLoading(isDraft ? 'Guardando borrador...' : 'Creando orden de compra...');
        
        $.ajax({
            url: API_URLS.createPO,
            method: 'POST',
            data: {
                ...formData,
                items: JSON.stringify(formData.items),
                csrfmiddlewaretoken: $('[name=csrfmiddlewaretoken]').val()
            },
            success: function(response) {
                toastr.success(isDraft ? 'Borrador guardado correctamente' : 'Orden de compra creada correctamente');
                setTimeout(() => {
                    window.location.href = `/purchasing/app/purchase-orders/detail/${response.id}/`;
                }, 1000);
            },
            error: function(xhr) {
                console.error('Error creating purchase order:', xhr);
                let errorMessage = 'Error al crear la orden de compra';
                
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    errorMessage = xhr.responseJSON.error;
                } else if (xhr.responseJSON && xhr.responseJSON.errors) {
                    errorMessage = Object.values(xhr.responseJSON.errors).flat().join(', ');
                }
                
                toastr.error(errorMessage);
            },
            complete: function() {
                hideLoading();
            }
        });
    }

    function showLoading(text = 'Cargando...') {
        $('#loadingText').text(text);
        $('#loadingOverlay').removeClass('d-none');
    }

    function hideLoading() {
        $('#loadingOverlay').addClass('d-none');
    }
});