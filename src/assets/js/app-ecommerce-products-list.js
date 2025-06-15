/**
 * App eCommerce Product List
 */

'use strict';
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(`${protocol}//${window.location.host}/ws/stock/`);
let urldata='/api/products/data/';

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

// DataTable initialization
$(function () {
  let borderColor, bodyBg, headingColor;

  if (typeof isDarkStyle !== 'undefined' && isDarkStyle) {
    borderColor = config.colors_dark.borderColor;
    bodyBg = config.colors_dark.bodyBg;
    headingColor = config.colors_dark.headingColor;
  } else {
    borderColor = config.colors.borderColor;
    bodyBg = config.colors.bodyBg;
    headingColor = config.colors.headingColor;
  }

  // Variable declaration for table
  var dt_products_table = $('.datatables-products'),
    statusObj = {
      true: { title: 'Publicado', class: 'bg-label-success' },
      false: { title: 'Inactivo', class: 'bg-label-danger' },
      '1': { title: 'Publicado', class: 'bg-label-success' },
      '0': { title: 'Inactivo', class: 'bg-label-danger' }
    },
    stockObj = {
      'in_stock': { title: 'En Stock', class: 'bg-label-success' },
      'low_stock': { title: 'Stock Bajo', class: 'bg-label-warning' },
      'out_of_stock': { title: 'Agotado', class: 'bg-label-danger' },
      'overstock': { title: 'Sobrestock', class: 'bg-label-info' }
    };

  // Initialize Select2 for filters
  var select2 = $('.select2');
  if (select2.length) {
    select2.each(function () {
      var $this = $(this);
      if (typeof select2Focus === 'function') {
        select2Focus($this);
      }
      $this.wrap('<div class="position-relative"></div>').select2({
        dropdownParent: $this.parent(),
        placeholder: $this.data('placeholder')
      });
    });
  }
  
  // Products List Datatable
if (dt_products_table.length) {
    var dt_products = dt_products_table.DataTable({
      ajax: {
        url: urldata,
        dataSrc: 'data'
      },
      columns: [
        { data: null }, // Control column for responsive
        { data: 'id' }, // Checkbox column
        { data: 'product_name' }, // Product
        { data: 'category_name' }, // Category
         { data: 'code' },  
        { data: 'is_active' }, // Status
        { data: 'current_stock' }, // Stock
        { data: 'minimum_stock' }, // Stock Mínimo
        { data: 'maximum_stock' }, // Stock Máximo
        { data: 'product_price' }, // Price
        { data: 'product_discounted_price' }, // Precio con Descuento
        { data: 'weight' }, // Peso
        { data: 'charge_tax' }, // Impuesto
        { data: 'is_fragile' }, // Frágil
        { data: 'is_frozen' }, // Congelado
        { data: 'expiry_date' }, // Fecha Caducidad
        { data: 'created_at' }, // Fecha Creación
        { data: null } // Actions
      ],
      columnDefs: [
        {
          // For Responsive
          className: 'control',
          searchable: false,
          orderable: false,
          targets: 0,
          render: function (data, type, full, meta) {
            return '';
          }
        },
        {
          // For Checkboxes
          targets: 1,
          orderable: false,
          searchable: false,
          responsivePriority: 4,
          checkboxes: true,
          render: function () {
            return '<input type="checkbox" class="dt-checkboxes form-check-input">';
          },
          checkboxes: {
            selectAllRender: '<input type="checkbox" class="form-check-input">'
          }
        },
        {
          // Product column
          targets: 2,
          responsivePriority: 2,
          render: function (data, type, full, meta) {
            var $name = full['product_name'];
            var $description = full['product_description'] || '';
            var $image = full['product_image'];
            var $id = full['id'];
            
            var $output;
            if ($image) {
              var imageUrl = $image;
              if (!imageUrl.startsWith('http') && !imageUrl.startsWith('/media/')) {
                imageUrl = '/media/products/' + $image;
              }
              $output = '<img src="' + imageUrl + '" alt="Product-' + $id + 
                       '" class="rounded" style="width: 38px; height: 38px; object-fit: cover;">';
            } else {
              var stateNum = Math.floor(Math.random() * 6);
              var states = ['success', 'danger', 'warning', 'info', 'dark', 'primary', 'secondary'];
              var $state = states[stateNum];
              var $initials = $name ? $name.match(/\b\w/g) || [] : [];
              $initials = (($initials.shift() || '') + ($initials.pop() || '')).toUpperCase();
              $output = '<span class="avatar-initial rounded-2 bg-label-' + $state + '">' + $initials + '</span>';
            }
            
            var cleanDescription = $description ? $description.replace(/<[^>]*>/g, '').substring(0, 50) + '...' : '';
            
            var $row_output =
              '<div class="d-flex align-items-center">' +
              '<div class="avatar-wrapper me-3 rounded bg-label-secondary">' +
              '<div class="avatar">' + $output + '</div>' +
              '</div>' +
              '<div class="d-flex flex-column justify-content-center">' +
              '<span class="text-heading fw-medium text-wrap">' + $name + '</span>' +
              '<small class="text-truncate mb-0 d-none d-sm-block">' + cleanDescription + '</small>' +
              '</div>' +
              '</div>';
            return $row_output;
          }
        },
        {
          // Category
          targets: 3,
          render: function (data, type, full, meta) {
            return '<span class="text-truncate">' + (data || '-') + '</span>';
          }
        },
{
  targets: 4,
  className: 'text-center', // Agregar esto
  render: function (data) {
    return data ? '<span class="badge bg-label-info">' + data + '</span>' : '-';
  }
},

 {
          // Status
          targets: 5,
          render: function (data, type, full, meta) {
            var $isActive = full['is_active'];
            
            return '<span class="badge rounded-pill ' + 
                   (statusObj[$isActive] ? statusObj[$isActive].class : 'bg-label-secondary') + 
                   '">' + 
                   (statusObj[$isActive] ? statusObj[$isActive].title : $isActive) + 
                   '</span>';
          }
        },
        {
          // Current Stock
          targets: 6,
          render: function (data, type, full, meta) {
            var stockStatus = full['stock_status_display'];
            var stockClass = stockObj[stockStatus] ? stockObj[stockStatus].class : 'bg-label-secondary';
            var stockTitle = stockObj[stockStatus] ? stockObj[stockStatus].title : 'Desconocido';
            
            return '<div class="d-flex align-items-center">' +
                   '<badge class="badge ' + stockClass + ' me-2">'  +
            '<a href="javascript:void(0);" class="dropdown-item btn-update-stock" data-id="' + full.id + '" data-current="' + full.current_stock + '">'+ stockTitle +'</a>'+

                    '</badge>' +
                   '<small class="text-muted">' + data + '</small>' +
                   '</div>';
          }
        },
        
        {
          // Minimum Stock
          targets: 7,
          render: function (data, type, full, meta) {
            return '<span class="text-nowrap">' + (data || '-') + '</span>';
          }
        },
        {
          // Maximum Stock
          targets: 8,
          render: function (data, type, full, meta) {
            return '<span class="text-nowrap">' + (data || '-') + '</span>';
          }
        },
        {
          // Price
          targets: 9,
          render: function (data, type, full, meta) {
            return '<span class="fw-medium">S/.' + parseFloat(data).toFixed(2) + '</span>';
          }
        },
        {
          // Discounted Price
          targets: 10,
          render: function (data, type, full, meta) {
            if (data && data < full['product_price']) {
              return '<span class="fw-medium text-success">S/.' + parseFloat(data).toFixed(2) + '</span>';
            }
            return '<span class="text-muted">-</span>';
          }
        },
        {
          // Weight
          targets: 11,
          render: function (data, type, full, meta) {
            return '<span class="text-nowrap">' + (data ? data + ' kg' : '-') + '</span>';
          }
        },
        {
          // Charge Tax
          targets: 12,
          render: function (data, type, full, meta) {
            return data ? 
              '<span class="badge rounded-pill bg-label-success">Sí</span>' : 
              '<span class="badge rounded-pill bg-label-secondary">No</span>';
          }
        },
        {
          // Is Fragile
          targets: 13,
          render: function (data, type, full, meta) {
            return data ? 
              '<span class="badge rounded-pill bg-label-warning">Frágil</span>' : 
              '<span class="badge rounded-pill bg-label-secondary">No</span>';
          }
        },
        {
          // Is Frozen
          targets: 14,
          render: function (data, type, full, meta) {
            return data ? 
              '<span class="badge rounded-pill bg-label-info">Congelado</span>' : 
              '<span class="badge rounded-pill bg-label-secondary">No</span>';
          }
        },
        {
          // Expiry Date
          targets: 15,
          render: function (data, type, full, meta) {
            if (!data) return '<span class="text-muted">-</span>';
            
            var date = new Date(data);
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            
            var diffTime = date - today;
            var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            var badgeClass = 'bg-label-secondary';
            if (diffDays < 0) {
              badgeClass = 'bg-label-danger';
            } else if (diffDays <= 7) {
              badgeClass = 'bg-label-warning';
            } else if (diffDays <= 30) {
              badgeClass = 'bg-label-info';
            }
            
            var formattedDate = date.toLocaleDateString();
            
            return '<div class="d-flex align-items-center">' +
                   '<span class="badge ' + badgeClass + ' me-2">' + diffDays + ' días</span>' +
                   '<small>' + formattedDate + '</small>' +
                   '</div>';
          }
        },
        {
          // Created At
          targets: 16,
          render: function (data, type, full, meta) {
            if (!data) return '<span class="text-muted">-</span>';
            var date = new Date(data);
            return '<span class="text-nowrap">' + date.toLocaleDateString() + '</span>';
          }
        },
       
        {
    // Actions
    targets: -1,
    title: 'Acciones',
    searchable: false,
    orderable: false,
    render: function (data, type, full, meta) {
        return (
            '<div class="d-flex align-items-center">' +
            '<a href="/app/ecommerce/product/add/?edit=' + full.id + '" class="btn btn-sm btn-icon btn-text-secondary waves-effect waves-light rounded-pill me-1" title="Editar">' +
            '<i class="ri-edit-box-line ri-20px"></i>' +
            '</a>' +
            '<button class="btn btn-sm btn-icon btn-text-secondary waves-effect waves-light rounded-pill dropdown-toggle hide-arrow" data-bs-toggle="dropdown">' +
            '<i class="ri-more-2-line ri-20px"></i>' +
            '</button>' +
            '<div class="dropdown-menu dropdown-menu-end m-0">' +
            '<a href="javascript:void(0);" class="dropdown-item btn-change-status" data-id="' + full.id + '" data-current-active="' + full.is_active + '">Cambiar Estado</a>' +
            '<a href="javascript:void(0);" class="dropdown-item btn-update-stock" data-id="' + full.id + '" data-current="' + full.current_stock + '">Actualizar Stock</a>' +
            '<div class="dropdown-divider"></div>' +
            '<a href="javascript:void(0);" class="dropdown-item text-danger btn-delete-product" data-id="' + full.id + '">Eliminar</a>' +
            '</div>' +
            '</div>'
        );
    }
}
      ],
      order: [2, 'asc'],
      dom:
        '<"card-header d-flex rounded-0 flex-wrap pb-md-0 pt-0"' +
        '<"me-5 ms-n2"f>' +
        '<"d-flex justify-content-start justify-content-md-end align-items-baseline"<"dt-action-buttons d-flex align-items-start align-items-md-center justify-content-sm-center mb-0 gap-4"lB>>' +
        '>t' +
        '<"row mx-1"' +
        '<"col-sm-12 col-md-6"i>' +
        '<"col-sm-12 col-md-6"p>' +
        '>',
      lengthMenu: [7, 10, 20, 50, 70, 100],
      language: {
        sLengthMenu: '_MENU_',
        search: '',
        searchPlaceholder: 'Buscar Producto',
        paginate: {
          next: '<i class="ri-arrow-right-s-line"></i>',
          previous: '<i class="ri-arrow-left-s-line"></i>'
        }
      },
      buttons: [
        {
          extend: 'collection',
          className: 'btn btn-outline-secondary dropdown-toggle me-4 waves-effect waves-light',
          text: '<i class="ri-upload-2-line me-1"></i> <span class="d-none d-sm-inline-block">Exportar</span>',
          buttons: [
            {
              extend: 'print',
              text: '<i class="ri-printer-line me-1"></i>Imprimir',
              className: 'dropdown-item',
              exportOptions: {
                columns: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
                format: {
                  body: function (inner, coldex, rowdex) {
                    if (inner.length <= 0) return inner;
                    var el = $.parseHTML(inner);
                    var result = '';
                    $.each(el, function (index, item) {
                      if (item.classList !== undefined && item.classList.contains('user-name')) {
                        result = result + item.lastChild.firstChild.textContent;
                      } else if (item.innerText === undefined) {
                        result = result + item.textContent;
                      } else result = result + item.innerText;
                    });
                    return result;
                  }
                }
              },
              customize: function (win) {
                $(win.document.body)
                  .css('color', headingColor)
                  .css('border-color', borderColor)
                  .css('background-color', bodyBg);
                $(win.document.body)
                  .find('table')
                  .addClass('compact')
                  .css('color', 'inherit')
                  .css('border-color', 'inherit')
                  .css('background-color', 'inherit');
              }
            },
            {
              extend: 'csv',
              text: '<i class="ri-file-text-line me-1"></i>CSV',
              className: 'dropdown-item',
              exportOptions: {
                columns: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
              }
            },
            {
              extend: 'excel',
              text: '<i class="ri-file-excel-line me-1"></i>Excel',
              className: 'dropdown-item',
              exportOptions: {
                columns: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
              }
            },
            {
              extend: 'pdf',
              text: '<i class="ri-file-pdf-line me-1"></i>PDF',
              className: 'dropdown-item',
              exportOptions: {
                columns: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
              }
            },
            {
              extend: 'copy',
              text: '<i class="ri-file-copy-line me-1"></i>Copiar',
              className: 'dropdown-item',
              exportOptions: {
                columns: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
              }
            }
          ]
        },
        {
          text: '<i class="ri-add-line ri-16px me-0 me-sm-1 align-baseline"></i><span class="d-none d-sm-inline-block">Agregar Producto</span>',
          className: 'add-new btn btn-primary waves-effect waves-light',
          action: function () {
            window.location.href = '/app/ecommerce/product/add/';
          }
        }
      ],
      responsive: {
        details: {
          display: $.fn.dataTable.Responsive.display.modal({
            header: function (row) {
              var data = row.data();
              return 'Detalles de ' + data['product_name'];
            }
          }),
          type: 'column',
          renderer: function (api, rowIdx, columns) {
            var data = $.map(columns, function (col, i) {
              return col.title !== ''
                ? '<tr data-dt-row="' +
                    col.rowIndex +
                    '" data-dt-column="' +
                    col.columnIndex +
                    '">' +
                    '<td>' +
                    col.title +
                    ':' +
                    '</td>' +
                    '<td class="ps-0">' +
                    col.data +
                    '</td>' +
                    '</tr>'
                : '';
            }).join('');

            return data ? $('<table class="table"/><tbody />').append(data) : false;
          }
        }
      }
    });

    // Store the DataTable instance globally
    window.dt_products = dt_products;
  }

  // Filter functionality
  $('.product_status, .product_category, .product_stock').on('change', function () {
    dt_products.draw();
  });

  // Event Handlers
  
  // Toggle product active status
// Change product status
$(document).on('click', '.btn-change-status', function () {
   var modal = $(this).closest('.modal');
    const id = $(this).data('id');
    const isActive = $(this).data('current-active') === true || $(this).data('current-active') === 'true';

    const nextStateText = isActive ? 'desactivar' : 'activar';

    Swal.fire({
        title: `¿Deseas ${nextStateText} este producto?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        cancelButtonText: 'No',
        customClass: {
            confirmButton: 'btn btn-danger me-2',
            cancelButton: 'btn btn-label-secondary'
        },
        buttonsStyling: false
    }).then((result) => {
        if (result.isConfirmed) {
            $.ajax({
                url: `/api/products/${id}/toggle_active/`,
                method: 'PATCH',
                headers: {
                    'X-CSRFToken': csrftoken,
                },
                success: function (response) {
                    Swal.fire({
                        title: '¡Éxito!',
                        text: response.message,
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    modal.modal('hide');
                    
                    dt_products.ajax.reload();
                    
                },
                error: function (xhr) {
                    const error = xhr.responseJSON ? xhr.responseJSON.error : 'Error al cambiar el estado';
    
 Swal.fire({
                title: 'Error',
                text: error,
                icon: 'error',
                customClass: {
                  confirmButton: 'btn btn-success waves-effect'
                }
              });

                }
            });
        }
    });
});


  // Update stock
 // Update stock
$(document).on('click', '.btn-update-stock', function () {
  var modal = $(this).closest('.modal');
    const id = $(this).data('id');
    const currentStock = $(this).data('current');
    
    Swal.fire({
        title: 'Actualizar Stock',
        html: `Stock actual: <strong>${currentStock}</strong><br><br>
              Ingrese el nuevo stock:`,
        input: 'number',
        inputValue: 0,
        showCancelButton: true,
        confirmButtonText: 'Actualizar',
        cancelButtonText: 'Cancelar',
        customClass: {
            confirmButton: 'btn btn-primary me-2',
            cancelButton: 'btn btn-label-secondary'
        },
        buttonsStyling: false,
        inputValidator: (value) => {
            if (value === '') {
                return 'Debe ingresar un valor';
            }
            if (isNaN(value)) {
                return 'Debe ingresar un número válido';
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const newStock = result.value;
            $.ajax({
                url: `/api/products/${id}/update_stock/`,
                method: 'PATCH',
                headers: {
                    'X-CSRFToken': csrftoken,
                },
                data: {
                    add_stock: parseInt(newStock)
                },
                success: function (response) {
                    Swal.fire({
                        title: '¡Éxito!',
                        text: response.message,
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    modal.modal('hide');

                    dt_products.ajax.reload();
                },
                error: function (xhr) {
                    const error = xhr.responseJSON ? xhr.responseJSON.error : 'Error al actualizar el stock';
                  Swal.fire({
                title: 'Error',
                text: error,
                icon: 'error',
                customClass: {
                  confirmButton: 'btn btn-success waves-effect'
                }
              });

                }
            });
        }
    });
});

  // Delete product
  $(document).on('click', '.btn-delete-product', function () {
    const id = $(this).data('id');
    
    Swal.fire({
        title: '¿Eliminar producto?',
        text: 'Esta acción no se puede deshacer. ¿Estás seguro?',
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
    }).then((result) => {
        if (result.isConfirmed) {
            $.ajax({
                url: `/api/products/${id}/`,
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': csrftoken
                },
                success: function () {
                    Swal.fire({
                        title: '¡Eliminado!',
                        text: 'Producto eliminado exitosamente',
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    dt_products.ajax.reload();
                },
                error: function () {
                   
                     Swal.fire({
                title: 'Error',
                text: 'Error al eliminar el producto',
                icon: 'error',
                customClass: {
                  confirmButton: 'btn btn-success waves-effect'
                }
              });
                }
            });
        }
    });
});

  // Initialize filters with data
function initializeFilters() {
  // Crear e insertar los <select> si no existen aún
  if ($('.product_status select').length === 0) {
    $('.product_status').html(`
      <select id="ProductStatus" class="form-select text-capitalize">
        <option value="">Todos los Estados</option>
        <option value="1">Publicado</option>
        <option value="0">Inactivo</option>
      </select>
    `);
    $('.product_status select').select2({
      placeholder: 'Filtrar por estado',
      allowClear: true
    });
  }

  if ($('.product_category select').length === 0) {
    $('.product_category').html(`
      <select id="ProductCategory" class="form-select text-capitalize">
        <option value=""></option>
      </select>
    `);
    $.get('/api/categories/active/', function (response) {
      var categorySelect = $('.product_category select');
      response.data.forEach(function (category) {
        categorySelect.append(`<option value="${category.id}">${category.name}</option>`);
      });
      categorySelect.select2({
        placeholder: 'Filtrar por categoría',
        allowClear: true
      });
    });
  }

  if ($('.product_stock select').length === 0) {
    $('.product_stock').html(`
      <select id="ProductStock" class="form-select text-capitalize">
        <option value=""></option>
        <option value="in_stock">En Stock</option>
        <option value="low_stock">Stock Bajo</option>
        <option value="out_of_stock">Agotado</option>
      </select>
    `);
    $('.product_stock select').select2({
      placeholder: 'Filtrar por stock',
      allowClear: true
    });
  }
}

  // Initialize filters
  initializeFilters();

  // Apply filters to DataTable
function buildProductFilterURL() {
    var stock = $("#ProductStock").val();
    var status = $("#ProductStatus").val();
    var category = $("#ProductCategory").val();

    var params = [];

    if (stock) params.push('stock=' + encodeURIComponent(stock));
    if (status) params.push('status=' + encodeURIComponent(status));
    if (category) params.push('category=' + encodeURIComponent(category));

    urldata = '/api/products/data/';
    if (params.length > 0) {
        urldata += '?' + params.join('&');
    }

   
}

// Reutilizar para los tres filtros
$('.product_status, .product_category, .product_stock').on('change', function () {
     buildProductFilterURL();
    dt_products.ajax.url(urldata).load();
});


  $('.dataTables_length').addClass('my-0');
  $('.dt-action-buttons').addClass('pt-0');
});