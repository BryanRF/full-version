/**
 * App Suppliers List
 */

'use strict';

let urldata = '/api/suppliers/data/';
let editingId = null;

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

function createOrUpdateSupplier() {
  const formData = new FormData();
  
  // Campos requeridos
  const companyName = document.getElementById('supplier-company-name').value;
  const taxId = document.getElementById('supplier-tax-id').value;
  const contactPerson = document.getElementById('supplier-contact-person').value;
  const phonePrimary = document.getElementById('supplier-phone-primary').value;
  const address = document.getElementById('supplier-address').value;
  const city = document.getElementById('supplier-city').value;
  const state = document.getElementById('supplier-state').value;

  // Validación básica
  if (!companyName.trim()) {
    toastr['error']('', 'El nombre de la empresa es requerido');
    return;
  }
  
  if (!taxId.trim()) {
    toastr['error']('', 'El RUC/NIT es requerido');
    return;
  }
  
  if (!contactPerson.trim()) {
    toastr['error']('', 'La persona de contacto es requerida');
    return;
  }

  if (!phonePrimary.trim()) {
    toastr['error']('', 'El teléfono principal es requerido');
    return;
  }

  // Agregar campos al FormData
  formData.append('company_name', companyName);
  formData.append('legal_name', document.getElementById('supplier-legal-name').value);
  formData.append('tax_id', taxId);
  formData.append('contact_person', contactPerson);
  formData.append('email', document.getElementById('supplier-email').value);
  formData.append('phone_primary', phonePrimary);
  formData.append('phone_secondary', document.getElementById('supplier-phone-secondary').value);
  formData.append('website', document.getElementById('supplier-website').value);
  formData.append('address_line1', address);
  formData.append('city', city);
  formData.append('state', state);
  formData.append('country', 'Perú');
  formData.append('category', document.getElementById('supplier-category').value);
  formData.append('payment_terms', document.getElementById('supplier-payment-terms').value || '30 días');
  formData.append('credit_limit', document.getElementById('supplier-credit-limit').value || '0');
  formData.append('rating', document.getElementById('supplier-rating').value);
  formData.append('notes', document.getElementById('supplier-notes').value);
  formData.append('is_active', document.getElementById('supplier-is-active').checked);
  formData.append('is_preferred', document.getElementById('supplier-is-preferred').checked);

  const url = editingId ? `/api/suppliers/${editingId}/` : '/api/suppliers/';
  const method = editingId ? 'PUT' : 'POST';

  // Mostrar loading
  const submitBtn = document.querySelector('.data-submit');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Guardando...';

  fetch(url, {
    method,
    body: formData,
    headers: {
      'X-CSRFToken': csrftoken
    },
  })
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => Promise.reject(err));
      }
      return res.json();
    })
    .then(() => {
      const message = editingId ? 'Proveedor actualizado exitosamente' : 'Proveedor creado exitosamente';
      toastr['success']('', message);
      
      // Reset form and state
      resetForm();
      
      // Close offcanvas
      closeOffcanvas();
      
      // Reload table
      if (typeof window.dt_suppliers !== 'undefined') {
        window.dt_suppliers.ajax.reload();
      }
      
      // Reload analytics
      if (typeof loadSuppliersData === 'function') {
        loadSuppliersData();
      }
    })
    .catch(err => {
      console.error('Error:', err);
      let errorMessage = 'Error al guardar el proveedor';
      
      if (err && typeof err === 'object') {
        if (err.company_name && err.company_name[0]) {
          errorMessage = `Error en nombre: ${err.company_name[0]}`;
        } else if (err.tax_id && err.tax_id[0]) {
          errorMessage = `Error en RUC/NIT: ${err.tax_id[0]}`;
        } else if (err.email && err.email[0]) {
          errorMessage = `Error en email: ${err.email[0]}`;
        } else if (err.detail) {
          errorMessage = err.detail;
        } else if (err.non_field_errors) {
          errorMessage = err.non_field_errors[0];
        }
      }
      
      toastr['error']('', errorMessage);
    })
    .finally(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    });
}

function resetForm() {
  editingId = null;
  document.getElementById('addSupplierForm').reset();
  
  // Update button text and offcanvas title
  $('.data-submit').text('Agregar');
  $('#offcanvasSupplierAddLabel').text('Agregar Proveedor');
}

function closeOffcanvas() {
  const offcanvasElement = document.getElementById('offcanvasSupplierAdd');
  if (typeof bootstrap !== 'undefined') {
    const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasElement);
    if (offcanvas) {
      offcanvas.hide();
    }
  }
}

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

  // Status object for rendering
  const statusObj = {
    true: { title: 'Activo', class: 'bg-label-success' },
    false: { title: 'Inactivo', class: 'bg-label-danger' }
  };

  const categoryObj = {
    'products': { title: 'Productos', class: 'bg-label-primary' },
    'services': { title: 'Servicios', class: 'bg-label-info' },
    'materials': { title: 'Materiales', class: 'bg-label-warning' },
    'equipment': { title: 'Equipos', class: 'bg-label-secondary' },
    'logistics': { title: 'Logística', class: 'bg-label-success' },
    'other': { title: 'Otros', class: 'bg-label-dark' }
  };

  // Variable declaration for suppliers list table
  var dt_suppliers_table = $('.datatables-suppliers');

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

  // Suppliers List Datatable
  if (dt_suppliers_table.length) {
    window.dt_suppliers = dt_suppliers_table.DataTable({
      ajax: {
        url: urldata,
        dataSrc: 'data'
      },
      columns: [
        { data: null }, // Control column for responsive
        { data: 'id' }, // Checkbox column
        { data: 'company_name' }, // Company
        { data: 'contact_person' }, // Contact Person
        { data: 'email' }, // Email
        { data: 'phone_primary' }, // Phone
        { data: 'city' }, // City
        { data: 'category' }, // Category
        { data: 'rating' }, // Rating
        { data: 'is_active' }, // Status
        { data: 'credit_limit' }, // Credit Limit
        { data: 'created_at' }, // Created Date
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
          // Company name with logo
          targets: 2,
          responsivePriority: 2,
          render: function (data, type, full, meta) {
            var $name = full['company_name'];
            var $legalName = full['legal_name'] || '';
            var $logo = full['logo'];
            var $id = full['id'];
            
            var $output;
            if ($logo) {
              var logoUrl = $logo;
              if (!logoUrl.startsWith('http') && !logoUrl.startsWith('/media/')) {
                logoUrl = '/media/suppliers/logos/' + $logo;
              }
              $output = '<img src="' + logoUrl + '" alt="Supplier-' + $id + 
                       '" class="rounded" style="width: 38px; height: 38px; object-fit: cover;">';
            } else {
              var stateNum = Math.floor(Math.random() * 6);
              var states = ['success', 'danger', 'warning', 'info', 'dark', 'primary', 'secondary'];
              var $state = states[stateNum];
              var $initials = $name ? $name.match(/\b\w/g) || [] : [];
              $initials = (($initials.shift() || '') + ($initials.pop() || '')).toUpperCase();
              $output = '<span class="avatar-initial rounded-2 bg-label-' + $state + '">' + $initials + '</span>';
            }
            
            var $row_output =
              '<div class="d-flex align-items-center">' +
              '<div class="avatar-wrapper me-3 rounded bg-label-secondary">' +
              '<div class="avatar">' + $output + '</div>' +
              '</div>' +
              '<div class="d-flex flex-column justify-content-center">' +
              '<span class="text-heading fw-medium text-wrap">' + $name + '</span>' +
              '<small class="text-truncate mb-0 d-none d-sm-block">' + $legalName + '</small>' +
              '</div>' +
              '</div>';
            return $row_output;
          }
        },
        {
          // Contact Person
          targets: 3,
          render: function (data, type, full, meta) {
            return '<span class="text-truncate">' + (data || '-') + '</span>';
          }
        },
        {
          // Email
          targets: 4,
          render: function (data, type, full, meta) {
            if (!data) return '<span class="text-muted">-</span>';
            return '<a href="mailto:' + data + '" class="text-body">' + data + '</a>';
          }
        },
        {
          // Phone
          targets: 5,
          render: function (data, type, full, meta) {
            if (!data) return '<span class="text-muted">-</span>';
            return '<a href="tel:' + data + '" class="text-body">' + data + '</a>';
          }
        },
        {
          // City
          targets: 6,
          render: function (data, type, full, meta) {
            return '<span class="text-truncate">' + (data || '-') + '</span>';
          }
        },
        {
          // Category
          targets: 7,
          render: function (data, type, full, meta) {
            var $category = full['category'];
            var categoryInfo = categoryObj[$category] || { title: $category, class: 'bg-label-secondary' };
            
            return '<span class="badge rounded-pill ' + categoryInfo.class + '">' + 
                   categoryInfo.title + '</span>';
          }
        },
        {
          // Rating
          targets: 8,
          render: function (data, type, full, meta) {
            var rating = data || 0;
            var stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
            return '<div class="d-flex align-items-center">' +
                   '<span class="me-2">' + stars + '</span>' +
                   '<small class="text-muted">(' + rating + ')</small>' +
                   '</div>';
          }
        },
        {
          // Status
          targets: 9,
          render: function (data, type, full, meta) {
            var $isActive = full['is_active'];
            var $isPreferred = full['is_preferred'];
            
            if ($isPreferred && $isActive) {
              return '<span class="badge rounded-pill bg-label-warning">⭐ Preferido</span>';
            }
            
            return '<span class="badge rounded-pill ' + 
                   statusObj[$isActive].class + '">' + 
                   statusObj[$isActive].title + '</span>';
          }
        },
        {
          // Credit Limit
          targets: 10,
          render: function (data, type, full, meta) {
            var creditLimit = parseFloat(data || 0);
            if (creditLimit > 0) {
              return '<span class="fw-medium">S/. ' + creditLimit.toLocaleString() + '</span>';
            }
            return '<span class="text-muted">Sin límite</span>';
          }
        },
        {
          // Created Date
          targets: 11,
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
              '<button class="btn btn-sm btn-icon btn-text-secondary waves-effect waves-light rounded-pill me-1 btn-edit-supplier" data-id="' + full.id + '" title="Editar">' +
              '<i class="ri-edit-box-line ri-20px"></i>' +
              '</button>' +
              '<button class="btn btn-sm btn-icon btn-text-secondary waves-effect waves-light rounded-pill dropdown-toggle hide-arrow" data-bs-toggle="dropdown">' +
              '<i class="ri-more-2-line ri-20px"></i>' +
              '</button>' +
              '<div class="dropdown-menu dropdown-menu-end m-0">' +
              '<a href="javascript:void(0);" class="dropdown-item btn-toggle-status" data-id="' + full.id + '" data-active="' + full.is_active + '">Cambiar Estado</a>' +
              '<a href="javascript:void(0);" class="dropdown-item btn-toggle-preferred" data-id="' + full.id + '" data-preferred="' + full.is_preferred + '">Marcar Preferido</a>' +
              '<a href="javascript:void(0);" class="dropdown-item btn-update-rating" data-id="' + full.id + '" data-rating="' + full.rating + '">Actualizar Calificación</a>' +
              '<div class="dropdown-divider"></div>' +
              '<a href="javascript:void(0);" class="dropdown-item text-danger btn-delete-supplier" data-id="' + full.id + '">Eliminar</a>' +
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
        searchPlaceholder: 'Buscar Proveedor',
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
                columns: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
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
                columns: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
              }
            },
            {
              extend: 'excel',
              text: '<i class="ri-file-excel-line me-1"></i>Excel',
              className: 'dropdown-item',
              exportOptions: {
                columns: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
              }
            },
            {
              extend: 'pdf',
              text: '<i class="ri-file-pdf-line me-1"></i>PDF',
              className: 'dropdown-item',
              exportOptions: {
                columns: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
              }
            },
            {
              extend: 'copy',
              text: '<i class="ri-file-copy-line me-1"></i>Copiar',
              className: 'dropdown-item',
              exportOptions: {
                columns: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
              }
            }
          ]
        },
        {
          text: '<i class="ri-add-line ri-16px me-0 me-sm-1 align-baseline"></i><span class="d-none d-sm-inline-block">Agregar Proveedor</span>',
          className: 'add-new btn btn-primary waves-effect waves-light',
          attr: {
            'data-bs-toggle': 'offcanvas',
            'data-bs-target': '#offcanvasSupplierAdd'
          }
        }
      ],
      responsive: {
        details: {
          display: $.fn.dataTable.Responsive.display.modal({
            header: function (row) {
              var data = row.data();
              return 'Detalles de ' + data['company_name'];
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

    $('.dataTables_length').addClass('my-0');
    $('.dt-action-buttons').addClass('pt-0');
  }

  // Event Handlers
  
  // Edit supplier event handler
  $(document).on('click', '.btn-edit-supplier', function () {
    const id = $(this).data('id');
    editingId = id;
      var modal = $(this).closest('.modal');
       modal.modal('hide');
    $.get(`/api/suppliers/${id}/`, function (data) {
      $('#supplier-company-name').val(data.company_name);
      $('#supplier-legal-name').val(data.legal_name);
      $('#supplier-tax-id').val(data.tax_id);
      $('#supplier-contact-person').val(data.contact_person);
      $('#supplier-email').val(data.email);
      $('#supplier-phone-primary').val(data.phone_primary);
      $('#supplier-phone-secondary').val(data.phone_secondary);
      $('#supplier-website').val(data.website);
      $('#supplier-address').val(data.address_line1);
      $('#supplier-city').val(data.city);
      $('#supplier-state').val(data.state);
      $('#supplier-category').val(data.category);
      $('#supplier-payment-terms').val(data.payment_terms);
      $('#supplier-credit-limit').val(data.credit_limit);
      $('#supplier-rating').val(data.rating);
      $('#supplier-notes').val(data.notes);
      $('#supplier-is-active').prop('checked', data.is_active);
      $('#supplier-is-preferred').prop('checked', data.is_preferred);
      
      // Update button text and offcanvas title
      $('.data-submit').text('Actualizar');
      $('#offcanvasSupplierAddLabel').text('Editar Proveedor');
      
      // Open the offcanvas
      if (typeof bootstrap !== 'undefined') {
        const canvas = new bootstrap.Offcanvas('#offcanvasSupplierAdd');
        canvas.show();
      }
    }).fail(function() {
      toastr['error']('', 'Error al cargar los datos del proveedor');
    });
  });

  // Toggle supplier status
  $(document).on('click', '.btn-toggle-status', function () {
    var modal = $(this).closest('.modal');
    const id = $(this).data('id');
    const isActive = $(this).data('active') === true || $(this).data('active') === 'true';

    const nextStateText = isActive ? 'desactivar' : 'activar';

    Swal.fire({
        title: `¿Deseas ${nextStateText} este proveedor?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        cancelButtonText: 'No',
        customClass: {
            confirmButton: 'btn btn-primary me-2',
            cancelButton: 'btn btn-label-secondary'
        },
        buttonsStyling: false
    }).then((result) => {
        if (result.isConfirmed) {
            $.ajax({
                url: `/api/suppliers/${id}/toggle_active/`,
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
                    dt_suppliers.ajax.reload();
                    if (typeof loadSuppliersData === 'function') {
                      loadSuppliersData();
                    }
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

  // Toggle preferred status
  $(document).on('click', '.btn-toggle-preferred', function () {
    var modal = $(this).closest('.modal');
    const id = $(this).data('id');
    const isPreferred = $(this).data('preferred') === true || $(this).data('preferred') === 'true';

    const nextStateText = isPreferred ? 'quitar de preferidos' : 'marcar como preferido';

    Swal.fire({
        title: `¿Deseas ${nextStateText} este proveedor?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        cancelButtonText: 'No',
        customClass: {
            confirmButton: 'btn btn-warning me-2',
            cancelButton: 'btn btn-label-secondary'
        },
        buttonsStyling: false
    }).then((result) => {
        if (result.isConfirmed) {
            $.ajax({
                url: `/api/suppliers/${id}/toggle_preferred/`,
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
                    dt_suppliers.ajax.reload();
                    if (typeof loadSuppliersData === 'function') {
                      loadSuppliersData();
                    }
                },
                error: function (xhr) {
                    const error = xhr.responseJSON ? xhr.responseJSON.error : 'Error al cambiar el estado preferido';
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

  // Update rating
  $(document).on('click', '.btn-update-rating', function () {
    var modal = $(this).closest('.modal');
    const id = $(this).data('id');
    const currentRating = $(this).data('rating');
    
    Swal.fire({
        title: 'Actualizar Calificación',
        html: `Calificación actual: <strong>${'⭐'.repeat(currentRating)}${'☆'.repeat(5-currentRating)}</strong><br><br>
              <select id="new-rating" class="form-select">
                <option value="1">⭐ - Muy Malo</option>
                <option value="2">⭐⭐ - Malo</option>
                <option value="3">⭐⭐⭐ - Regular</option>
                <option value="4">⭐⭐⭐⭐ - Bueno</option>
                <option value="5">⭐⭐⭐⭐⭐ - Excelente</option>
              </select>`,
        showCancelButton: true,
        confirmButtonText: 'Actualizar',
        cancelButtonText: 'Cancelar',
        customClass: {
            confirmButton: 'btn btn-primary me-2',
            cancelButton: 'btn btn-label-secondary'
        },
        buttonsStyling: false,
        didOpen: () => {
          document.getElementById('new-rating').value = currentRating;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const newRating = document.getElementById('new-rating').value;
            $.ajax({
                url: `/api/suppliers/${id}/update_rating/`,
                method: 'PATCH',
                headers: {
                    'X-CSRFToken': csrftoken,
                },
                data: {
                    rating: parseInt(newRating)
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
                    dt_suppliers.ajax.reload();
                    if (typeof loadSuppliersData === 'function') {
                      loadSuppliersData();
                    }
                },
                error: function (xhr) {
                    const error = xhr.responseJSON ? xhr.responseJSON.error : 'Error al actualizar la calificación';
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

  // Delete supplier
  $(document).on('click', '.btn-delete-supplier', function () {
    const id = $(this).data('id');
    
    Swal.fire({
        title: '¿Eliminar proveedor?',
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
                url: `/api/suppliers/${id}/`,
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': csrftoken
                },
                success: function () {
                    Swal.fire({
                        title: '¡Eliminado!',
                        text: 'Proveedor eliminado exitosamente',
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    dt_suppliers.ajax.reload();
                    if (typeof loadSuppliersData === 'function') {
                      loadSuppliersData();
                    }
                },
                error: function () {
                    Swal.fire({
                        title: 'Error',
                        text: 'Error al eliminar el proveedor',
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

  // Form submission
  $('#addSupplierForm').on('submit', function (e) {
    e.preventDefault();
    createOrUpdateSupplier();
  });

  // Reset form when offcanvas is hidden
  $('#offcanvasSupplierAdd').on('hidden.bs.offcanvas', function () {
    resetForm();
  });

  // Initialize filters
  initializeFilters();
  
  function initializeFilters() {
    // Status filter
    if ($('.supplier_status select').length === 0) {
      $('.supplier_status').html(`
        <select id="SupplierStatus" class="form-select text-capitalize">
          <option value="">Todos los Estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="preferred">Preferidos</option>
        </select>
      `);
      $('.supplier_status select').select2({
        placeholder: 'Filtrar por estado',
        allowClear: true
      });
    }

    // Category filter
    if ($('.supplier_category select').length === 0) {
      $('.supplier_category').html(`
        <select id="SupplierCategory" class="form-select text-capitalize">
          <option value="">Todas las Categorías</option>
          <option value="products">Productos</option>
          <option value="services">Servicios</option>
          <option value="materials">Materiales</option>
          <option value="equipment">Equipos</option>
          <option value="logistics">Logística</option>
          <option value="other">Otros</option>
        </select>
      `);
      $('.supplier_category select').select2({
        placeholder: 'Filtrar por categoría',
        allowClear: true
      });
    }

    // Rating filter
    if ($('.supplier_rating select').length === 0) {
      $('.supplier_rating').html(`
        <select id="SupplierRating" class="form-select text-capitalize">
          <option value="">Todas las Calificaciones</option>
          <option value="5">⭐⭐⭐⭐⭐ - Excelente</option>
          <option value="4">⭐⭐⭐⭐ - Bueno</option>
          <option value="3">⭐⭐⭐ - Regular</option>
          <option value="2">⭐⭐ - Malo</option>
          <option value="1">⭐ - Muy Malo</option>
        </select>
      `);
      $('.supplier_rating select').select2({
        placeholder: 'Filtrar por calificación',
        allowClear: true
      });
    }
  }

  // Apply filters to DataTable
  function buildSupplierFilterURL() {
    var status = $("#SupplierStatus").val();
    var category = $("#SupplierCategory").val();
    var rating = $("#SupplierRating").val();
    var search = $("#supplierSearch").val();

    var params = [];

    if (status) params.push('status=' + encodeURIComponent(status));
    if (category) params.push('category=' + encodeURIComponent(category));
    if (rating) params.push('rating=' + encodeURIComponent(rating));
    if (search) params.push('search=' + encodeURIComponent(search));

    urldata = '/api/suppliers/data/';
    if (params.length > 0) {
        urldata += '?' + params.join('&');
    }
  }

  // Filter change events
  $('.supplier_status, .supplier_category, .supplier_rating').on('change', function () {
    buildSupplierFilterURL();
    dt_suppliers.ajax.url(urldata).load();
  });

  // Search input with debounce
  let searchTimeout;
  $('#supplierSearch').on('input', function () {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function() {
      buildSupplierFilterURL();
      dt_suppliers.ajax.url(urldata).load();
    }, 500);
  });
});