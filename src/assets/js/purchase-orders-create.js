/**
 * Purchase Orders Create JavaScript
 * Funcionalidades para crear órdenes de compra
 */

$(document).ready(function() {
    'use strict';

    // Variables globales
    let currentSupplier = null;
    let selectedProducts = [];

    // URLs de la API
    const API_URLS = {
        suppliers: '/purchasing/api/suppliers/',
        products: '/purchasing/api/products/',
        createPO: '/purchasing/purchase-orders/',  // ✅ URL correcta del router
        supplierDetail: '/purchasing/api/suppliers/{id}/'
    };

    // Inicialización
    init();

    function init() {
        initializeSelect2();
        initializeDatePickers();
        bindEvents();
        validateForm();
    }

    function initializeSelect2() {
        // Inicializar Select2 para proveedores
        $('#supplier').select2({
            placeholder: 'Buscar proveedor por nombre...',
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
                            text: supplier.name,
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

        // Calcular subtotal en modal
        $('#quantity, #unitPrice').on('input', function() {
            calculateProductSubtotal();
        });

        // Reset modal cuando se cierra
        $('#addProductModal').on('hidden.bs.modal', function() {
            resetProductModal();
        });
    }

    function loadSupplierInfo(supplier) {
        $('#supplierContact').text(supplier.contact_person || '-');
        $('#supplierEmail').text(supplier.email || '-');
        $('#supplierPhone').text(supplier.phone || '-');
        $('#supplierPaymentTerms').text(supplier.payment_terms || '-');
        $('#supplierInfo').removeClass('d-none');

        // Limpiar select de productos para que se actualice con el nuevo proveedor
        $('#productSelect').val(null).trigger('change');
    }

    function clearSupplierInfo() {
        $('#supplierInfo').addClass('d-none');
    }

    function loadProductInfo(product) {
        $('#productCode').text(product.code || '-');
        $('#productStock').text(product.current_stock || '-');
        $('#productPrice').text(product.last_purchase_price ? `s/. ${product.last_purchase_price}` : '-');
        $('#productUnit').text(product.unit_of_measure || '-');
        $('#productInfo').removeClass('d-none');

        // Establecer precio sugerido
        if (product.last_purchase_price) {
            $('#unitPrice').val(product.last_purchase_price);
        }

        calculateProductSubtotal();
    }

    function calculateProductSubtotal() {
        const quantity = parseFloat($('#quantity').val()) || 0;
        const unitPrice = parseFloat($('#unitPrice').val()) || 0;
        const subtotal = quantity * unitPrice;

        $('#productSubtotal').text(`s/. ${subtotal.toLocaleString('es-PE', {minimumFractionDigits: 2})}`);
    }

    function addProductToOrder() {
        const productData = $('#productSelect').select2('data')[0];
        if (!productData) {
            toastr.error('Seleccione un producto');
            return;
        }

        const quantity = parseFloat($('#quantity').val());
        const unitPrice = parseFloat($('#unitPrice').val());
        const notes = $('#productNotes').val();

        if (!quantity || quantity <= 0) {
            toastr.error('La cantidad debe ser mayor a 0');
            return;
        }

        if (!unitPrice || unitPrice <= 0) {
            toastr.error('El precio unitario debe ser mayor a 0');
            return;
        }

        // Verificar si el producto ya existe
        const existingIndex = selectedProducts.findIndex(p => p.product_id === productData.product.id);

        if (existingIndex >= 0) {
            // Actualizar producto existente
            selectedProducts[existingIndex] = {
                ...selectedProducts[existingIndex],
                quantity: quantity,
                unit_price: unitPrice,
                subtotal: quantity * unitPrice,
                notes: notes
            };
            toastr.success('Producto actualizado');
        } else {
            // Agregar nuevo producto
            selectedProducts.push({
                product_id: productData.product.id,
                product_name: productData.product.name,
                product_code: productData.product.code,
                quantity: quantity,
                unit_price: unitPrice,
                subtotal: quantity * unitPrice,
                notes: notes
            });
            toastr.success('Producto agregado');
        }

        updateProductsTable();
        updateTotals();
        validateForm();
        $('#addProductModal').modal('hide');
    }

    function removeProduct(index) {
        Swal.fire({
            title: '¿Está seguro?',
            text: "Se eliminará este producto de la orden",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                selectedProducts.splice(index, 1);
                updateProductsTable();
                updateTotals();
                validateForm();
                toastr.success('Producto eliminado');
            }
        });
    }

    function editProduct(index) {
        const product = selectedProducts[index];

        // Cargar datos en el modal
        $('#productSelect').append(new Option(
            `${product.product_code} - ${product.product_name}`,
            product.product_id,
            true,
            true
        )).trigger('change');

        $('#quantity').val(product.quantity);
        $('#unitPrice').val(product.unit_price);
        $('#productNotes').val(product.notes);

        calculateProductSubtotal();
        $('#addProductModal').modal('show');

        // Marcar como edición para actualizar en lugar de agregar
        $('#addProductModal').data('editing-index', index);
    }

    function updateProductsTable() {
        const tbody = $('#productsTable tbody');

        if (selectedProducts.length === 0) {
            tbody.html(`
                <tr id="emptyProductsRow">
                    <td colspan="6" class="text-center py-5">
                        <div class="empty-state">
                            <i class="ri-shopping-bag-line ri-2x text-muted mb-3"></i>
                            <p class="text-muted mb-3">No hay productos agregados</p>
                            <button type="button" class="btn btn-outline-primary btn-sm" id="addFirstProductBtn">
                                <i class="ri-add-line me-1"></i>Agregar Primer Producto
                            </button>
                        </div>
                    </td>
                </tr>
            `);
            $('#totalsSection').hide();
            return;
        }

        const html = selectedProducts.map((item, index) => `
            <tr>
                <td>
                    <div class="d-flex flex-column">
                        <strong>${item.product_name}</strong>
                        <small class="text-muted">${item.product_code}</small>
                        ${item.notes ? `<small class="text-info">${item.notes}</small>` : ''}
                    </div>
                </td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-end">s/. ${item.unit_price.toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                <td class="text-end fw-bold">s/. ${item.subtotal.toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                <td class="text-center">${item.notes || '-'}</td>
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
        $('#totalsSection').show();
    }

    function updateTotals() {
        const subtotal = selectedProducts.reduce((sum, item) => sum + item.subtotal, 0);
        const tax = subtotal * 0.18; // IGV 18%
        const total = subtotal + tax;

        $('#orderSubtotal').text(`s/. ${subtotal.toLocaleString('es-PE', {minimumFractionDigits: 2})}`);
        $('#orderTax').text(`s/. ${tax.toLocaleString('es-PE', {minimumFractionDigits: 2})}`);
        $('#orderTotal').text(`s/. ${total.toLocaleString('es-PE', {minimumFractionDigits: 2})}`);
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
        $('#saveDraftBtn').prop('disabled', !isValid);
        $('#previewBtn').prop('disabled', !isValid);
    }

    function showPreview() {
        if (!validateFormData()) {
            return;
        }

        const formData = getFormData();
        const previewHtml = generatePreviewHTML(formData);

        $('#previewContent').html(previewHtml);
        $('#previewModal').modal('show');
    }

    function generatePreviewHTML(data) {
        const subtotal = selectedProducts.reduce((sum, item) => sum + item.subtotal, 0);
        const tax = subtotal * 0.18;
        const total = subtotal + tax;

        return `
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">Orden de Compra - Vista Previa</h5>
                </div>
                <div class="card-body">
                    <div class="row mb-4">
                        <div class="col-md-6">
                            <h6>Proveedor:</h6>
                            <p class="mb-0">${currentSupplier.name}</p>
                            <p class="mb-0">${currentSupplier.email || ''}</p>
                        </div>
                        <div class="col-md-6">
                            <h6>Detalles:</h6>
                            <p class="mb-0">Fecha de entrega: ${data.expected_delivery}</p>
                            <p class="mb-0">Prioridad: ${data.priority}</p>
                        </div>
                    </div>

                    <div class="table-responsive mb-4">
                        <table class="table table-bordered">
                            <thead class="table-light">
                                <tr>
                                    <th>Producto</th>
                                    <th>Cantidad</th>
                                    <th>Precio Unit.</th>
                                    <th>Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${selectedProducts.map(item => `
                                    <tr>
                                        <td>${item.product_name}</td>
                                        <td>${item.quantity}</td>
                                        <td>s/. ${item.unit_price.toFixed(2)}</td>
                                        <td>s/. ${item.subtotal.toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div class="row">
                        <div class="col-md-6 ms-auto">
                            <table class="table table-sm">
                                <tr>
                                    <td>Subtotal:</td>
                                    <td class="text-end">s/. ${subtotal.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td>IGV (18%):</td>
                                    <td class="text-end">s/. ${tax.toFixed(2)}</td>
                                </tr>
                                <tr class="table-primary">
                                    <td><strong>Total:</strong></td>
                                    <td class="text-end"><strong>s/. ${total.toFixed(2)}</strong></td>
                                </tr>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function validateFormData() {
        if (!currentSupplier) {
            toastr.error('Seleccione un proveedor');
            return false;
        }

        if (!$('#expectedDelivery').val()) {
            toastr.error('Seleccione una fecha de entrega');
            return false;
        }

        if (selectedProducts.length === 0) {
            toastr.error('Agregue al menos un producto');
            return false;
        }

        return true;
    }

    function getFormData() {
        return {
            supplier_id: currentSupplier.id,
            expected_delivery: $('#expectedDelivery').val().split('/').reverse().join('-'),
            priority: $('#priority').val(),
            payment_terms: $('#paymentTerms').val(),
            notes: $('#notes').val(),
            items: selectedProducts.map(product => ({
                product_id: product.product_id,
                quantity_ordered: product.quantity,
                unit_price: product.unit_price,
                notes: product.notes
            }))
        };
    }

    function createPurchaseOrder(isDraft = false) {
        if (!validateFormData()) {
            return;
        }

        const formData = getFormData();
        formData.status = isDraft ? 'draft' : 'sent';

        showLoading(isDraft ? 'Guardando borrador...' : 'Creando orden de compra...');

        // ✅ Enviar como JSON en lugar de form data
        $.ajax({
            url: API_URLS.createPO,
            method: 'POST',
            contentType: 'application/json',
            headers: {
                'X-CSRFToken': $('[name=csrfmiddlewaretoken]').val()
            },
            data: JSON.stringify(formData),
            success: function(response) {
                console.log('✅ Respuesta completa:', response); // ✅ Debug log

                // ✅ Manejar diferentes formatos de respuesta
                let orderId = null;
                if (response.id) {
                    orderId = response.id;
                } else if (response.data && response.data.id) {
                    orderId = response.data.id;
                } else if (response.purchase_order && response.purchase_order.id) {
                    orderId = response.purchase_order.id;
                }
             if (orderId) {
                    toastr.success(isDraft ? 'Borrador guardado correctamente' : 'Orden de compra creada correctamente');
                    setTimeout(() => {
                        window.location.href = `/app/purchase-orders/detail/${orderId}/`;
                    }, 1000);
                } else {
                    console.error('❌ No se pudo extraer el ID de la respuesta:', response);
                    toastr.error('Orden creada pero no se pudo obtener el ID para redireccionar');
                    // Fallback: ir a la lista
                    setTimeout(() => {
                        window.location.href = '/app/purchase-orders/list/';
                    }, 2000);
                }

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

    function resetProductModal() {
        $('#addProductForm')[0].reset();
        $('#productSelect').val(null).trigger('change');
        $('#productInfo').addClass('d-none');
        $('#productSubtotal').text('$0.00');
        $('#addProductModal').removeData('editing-index');
    }

    function showLoading(text = 'Cargando...') {
        $('#loadingText').text(text);
        $('#loadingOverlay').removeClass('d-none');
    }

    function hideLoading() {
        $('#loadingOverlay').addClass('d-none');
    }
});
