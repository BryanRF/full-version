/**
 * App eCommerce Category List
 */

'use strict';

// Comment editor
const commentEditor = document.querySelector('.comment-editor');

const quillDescription = new Quill('#ecommerce-category-description', {
  modules: { toolbar: '.comment-toolbar' },
  theme: 'snow'
});

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
let editingId = null;

function createOrUpdateCategory() {
  const title = document.getElementById('ecommerce-category-title').value;
  const status = document.getElementById('ecommerce-category-status').value;
  const description = quillDescription.root.innerHTML;
  const imageInput = document.getElementById('ecommerce-category-image');
  const imageFile = imageInput.files[0];

  // Validación básica
  if (!title.trim()) {
    toastr['error']('', 'El nombre de la categoría es requerido');
    return;
  }

  const formData = new FormData();
  
  // CORREGIDO: Usar los nombres correctos de campos del modelo Django
  formData.append('name', title);  // Cambio de 'categories' a 'name'
  formData.append('detail', description);  // Cambio de 'category_detail' a 'detail'
  formData.append('is_active', status === '1');
  
  if (imageFile) {
    formData.append('image', imageFile);
  }

  const url = editingId ? `/api/categories/${editingId}/` : '/api/categories/';
  const method = editingId ? 'PUT' : 'POST';

  // Mostrar loading
  const submitBtn = document.querySelector('.btn-primary[onclick="createOrUpdateCategory()"]');
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
      const message = editingId ? 'Categoría actualizada exitosamente' : 'Categoría creada exitosamente';
      toastr['success']('', message);
      
      // Reset form and state
      resetForm();
      
      // Close offcanvas
      closeOffcanvas();
      
      // Reload table
      if (typeof window.dt_category !== 'undefined') {
        window.dt_category.ajax.reload();
      }
    })
    .catch(err => {
      console.error('Error:', err);
      let errorMessage = 'Error al guardar la categoría';
      
      // Manejar errores específicos del servidor
      if (err && typeof err === 'object') {
        if (err.name && err.name[0]) {
          errorMessage = `Error en nombre: ${err.name[0]}`;
        } else if (err.detail) {
          errorMessage = err.detail;
        } else if (err.non_field_errors) {
          errorMessage = err.non_field_errors[0];
        }
      }
      
      toastr['error']('', errorMessage);
    })
    .finally(() => {
      // Restaurar botón
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    });
}

function resetForm() {
  editingId = null;
  document.getElementById('eCommerceCategoryListForm').reset();
  quillDescription.setContents([]);
  
  if (typeof $ !== 'undefined') {
    $('#ecommerce-category-status').val('').trigger('change');
  }
  
  // Update button text and offcanvas title
  $('.btn-primary[onclick="createOrUpdateCategory()"]').text('Agregar');
  $('#offcanvasEcommerceCategoryListLabel').text('Agregar Categoria');
}

function closeOffcanvas() {
  const offcanvasElement = document.getElementById('offcanvasEcommerceCategoryList');
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

  // Variable declaration for category list table
  var dt_category_list_table = $('.datatables-category-list');

  // Select2 for dropdowns in offcanvas
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

  // Categories List Datatable
  if (dt_category_list_table.length) {
    window.dt_category = dt_category_list_table.DataTable({
      ajax: '/api/categories/data/',
      columns: [
        { data: null },
        { data: 'id' },
        { data: 'name' },  // CORREGIDO: Usar 'name' en lugar de 'categories'
        { data: 'is_active' },
        { data: null }
      ],
      columnDefs: [
        {
          // For Responsive
          className: 'control',
          searchable: false,
          orderable: false,
          targets: 0,
          data: null,
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
          // Categories and Category Detail
          targets: 2,
          responsivePriority: 2,
          render: function (data, type, full, meta) {
            // CORREGIDO: Usar los nombres correctos de campos
            var $name = full['name'],  // Cambio de 'categories' a 'name'
              $category_detail = full['detail'],  // Cambio de 'category_detail' a 'detail'
              $image = full['image'],  // Usar 'image' directamente
              $id = full['id'];
            
            var $output;
            if ($image) {
              // For Product image - construir URL correcta
              var imageUrl = $image;
              if (!imageUrl.startsWith('http') && !imageUrl.startsWith('/media/')) {
                imageUrl = '/media/' + $image;
              }
              
              $output =
                '<img src="' + imageUrl + '" alt="Category-' + $id + 
                '" class="rounded" style="width: 38px; height: 38px; object-fit: cover;">';
            } else {
              // For Product badge
              var stateNum = Math.floor(Math.random() * 6);
              var states = ['success', 'danger', 'warning', 'info', 'dark', 'primary', 'secondary'];
              var $state = states[stateNum];
              var $initials = $name ? $name.match(/\b\w/g) || [] : [];
              $initials = (($initials.shift() || '') + ($initials.pop() || '')).toUpperCase();
              $output = '<span class="avatar-initial rounded-2 bg-label-' + $state + '">' + $initials + '</span>';
            }
            
            // Clean category detail for display
            var cleanDetail = $category_detail ? $category_detail.replace(/<[^>]*>/g, '') : '';
            
            // Creates full output for Categories and Category Detail
            var $row_output =
              '<div class="d-flex align-items-center">' +
              '<div class="avatar-wrapper me-3 rounded bg-label-secondary user-name">' +
              '<div class="avatar">' +
              $output +
              '</div>' +
              '</div>' +
              '<div class="d-flex flex-column justify-content-center">' +
              '<span class="text-heading fw-medium text-wrap">' +
              $name +
              '</span>' +
              '<small class="text-truncate mb-0 d-none d-sm-block">' +
              cleanDetail +
              '</small>' +
              '</div>' +
              '</div>';
            return $row_output;
          }
        },
        {
          // Status
          targets: 3,
          render: function (data, type, full, meta) {
            var $status = full['is_active'];
            return (
              '<span class="badge rounded-pill ' +
              statusObj[$status].class +
              '" text-capitalized>' +
              statusObj[$status].title +
              '</span>'
            );
          }
        },
        {
          // Actions
          targets: -1,
          title: 'Actions',
          searchable: false,
          orderable: false,
          data: null,
          render: function (data, type, full, meta) {
            return (
              '<div class="d-flex align-items-sm-center justify-content-sm-center">' +
              '<button class="btn btn-sm btn-icon btn-text-secondary waves-effect waves-light rounded-pill btn-edit-category" data-id="' + full.id + '" title="Editar">' +
              '<i class="ri-edit-box-line ri-20px"></i>' +
              '</button>' +
              '<button class="btn btn-sm btn-icon btn-text-secondary waves-effect waves-light rounded-pill dropdown-toggle hide-arrow" data-bs-toggle="dropdown">' +
              '<i class="ri-more-2-line ri-20px"></i>' +
              '</button>' +
              '<div class="dropdown-menu dropdown-menu-end m-0">' +
              '<a href="javascript:void(0);" class="dropdown-item btn-disable-category" data-id="' + full.id + '">Deshabilitar</a>' +
              '<a href="javascript:void(0);" class="dropdown-item">Ver</a>' +
              '</div>' +
              '</div>'
            );
          }
        }
      ],
      order: [2, 'desc'],
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
        searchPlaceholder: 'Search Category',
        paginate: {
          next: '<i class="ri-arrow-right-s-line"></i>',
          previous: '<i class="ri-arrow-left-s-line"></i>'
        }
      },
      buttons: [
        {
          extend: 'collection',
          className: 'btn btn-outline-secondary dropdown-toggle me-4 waves-effect waves-light',
          text: '<i class="ri-upload-2-line me-1"></i> <span class="d-none d-sm-inline-block">Export</span>',
          buttons: [
            {
              extend: 'print',
              text: '<i class="ri-printer-line me-1"></i>Print',
              className: 'dropdown-item',
              exportOptions: {
                columns: [1, 2, 3, 4],
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
              text: '<i class="ri-file-text-line me-1" ></i>Csv',
              className: 'dropdown-item',
              exportOptions: {
                columns: [1, 2, 3, 4],
                format: {
                  body: function (inner, coldex, rowdex) {
                    if (inner.length <= 0) return inner;
                    var el = $.parseHTML(inner);
                    var result = '';
                    $.each(el, function (index, item) {
                      if (item.classList !== undefined && item.classList.contains('user-name')) {
                        result = result  +' '+ item.lastChild.firstChild.textContent;
                      } else if (item.innerText === undefined) {
                        result = result +' '+ item.textContent;
                      } else result = result +' '+ item.innerText;
                    });
                    return result;
                  }
                }
              }
            },
            {
              extend: 'excel',
              text: '<i class="ri-file-excel-line me-1"></i>Excel',
              className: 'dropdown-item',
              exportOptions: {
                columns: [1, 2, 3, 4],
                format: {
                  body: function (inner, coldex, rowdex) {
                    if (inner.length <= 0) return inner;
                    var el = $.parseHTML(inner);
                    var result = '';
                    $.each(el, function (index, item) {
                      if (item.classList !== undefined && item.classList.contains('user-name')) {
                        result = result +' '+ item.lastChild.firstChild.textContent;
                      } else if (item.innerText === undefined) {
                        result = result +' '+ item.textContent;
                      } else result = result  +' '+ item.innerText;
                    });
                    return result;
                  }
                }
              }
            },
            {
              extend: 'pdf',
              text: '<i class="ri-file-pdf-line me-1"></i>Pdf',
              className: 'dropdown-item',
              exportOptions: {
                columns: [1, 2, 3, 4],
                format: {
                  body: function (inner, coldex, rowdex) {
                    if (inner.length <= 0) return inner;
                    var el = $.parseHTML(inner);
                    var result = '';
                    $.each(el, function (index, item) {
                      if (item.classList !== undefined && item.classList.contains('user-name')) {
                        result = result +' '+ item.lastChild.firstChild.textContent;
                      } else if (item.innerText === undefined) {
                        result = result +' '+ item.textContent;
                      } else result = result +' '+item.innerText;
                    });
                    return result;
                  }
                }
              }
            },
            {
              extend: 'copy',
              text: '<i class="ri-file-copy-line me-1"></i>Copy',
              className: 'dropdown-item',
              exportOptions: {
                columns: [1, 2, 3, 4],
                format: {
                  body: function (inner, coldex, rowdex) {
                    if (inner.length <= 0) return inner;
                    var el = $.parseHTML(inner);
                    var result = '';
                    $.each(el, function (index, item) {
                      if (item.classList !== undefined && item.classList.contains('user-name')) {
                        result = result +' '+ item.lastChild.firstChild.textContent;
                      } else if (item.innerText === undefined) {
                        result = result +' '+ item.textContent;
                      } else result = result +' '+ item.innerText;
                    });
                    return result;
                  }
                }
              }
            }
          ]
        },
        {
          text: '<i class="ri-add-line ri-16px me-0 me-sm-1 align-baseline"></i><span class="d-none d-sm-inline-block">Agregar Categoria</span>',
          className: 'add-new btn btn-primary waves-effect waves-light',
          attr: {
            'data-bs-toggle': 'offcanvas',
            'data-bs-target': '#offcanvasEcommerceCategoryList'
          }
        }
      ],
      responsive: {
        details: {
          display: $.fn.dataTable.Responsive.display.modal({
            header: function (row) {
              var data = row.data();
              return 'Details of ' + data['name'];  // CORREGIDO: usar 'name'
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
                    '<td> ' +
                    col.title +
                    ':' +
                    '</td> ' +
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

  // Edit category event handler
  $(document).on('click', '.btn-edit-category', function () {
    const id = $(this).data('id');
    editingId = id;

    $.get(`/api/categories/${id}/`, function (data) {
      // CORREGIDO: Usar los nombres correctos de campos
      $('#ecommerce-category-title').val(data.name);  // Cambio de 'categories' a 'name'
      $('#ecommerce-category-status').val(data.is_active ? '1' : '0').trigger('change');
      quillDescription.root.innerHTML = data.detail || '';  // Cambio de 'category_detail' a 'detail'
      
      // Update button text and offcanvas title
      $('.btn-primary[onclick="createOrUpdateCategory()"]').text('Actualizar');
      $('#offcanvasEcommerceCategoryListLabel').text('Editar Categoria');
      
      // Open the offcanvas
      if (typeof bootstrap !== 'undefined') {
        const canvas = new bootstrap.Offcanvas('#offcanvasEcommerceCategoryList');
        canvas.show();
      }
    }).fail(function() {
      toastr['error']('', 'Error al cargar los datos de la categoría');
    });
  });

  // Disable category event handler
  $(document).on('click', '.btn-disable-category', function () {
    const id = $(this).data('id');

    if (confirm('¿Estás seguro de deshabilitar esta categoría?')) {
      $.ajax({
        url: `/api/categories/${id}/toggle_active/`,
        method: 'PATCH',
        headers: {
          'X-CSRFToken': csrftoken
        },
        success: function () {
            toastr['success']('', 'Categoría actualizada');
            dt_category.ajax.reload();
        },
        error: function () {
            toastr['error']('', 'Error al deshabilitar');
        }
      });
    }
  });

  // Reset form when offcanvas is hidden
  $('#offcanvasEcommerceCategoryList').on('hidden.bs.offcanvas', function () {
    resetForm();
  });
});

// Form validation
(function () {
  const eCommerceCategoryListForm = document.getElementById('eCommerceCategoryListForm');

  if (eCommerceCategoryListForm && typeof FormValidation !== 'undefined') {
    const fv = FormValidation.formValidation(eCommerceCategoryListForm, {
      fields: {
        categoryTitle: {
          validators: {
            notEmpty: {
              message: 'Por favor ingrese un nombre válido'
            }
          }
        },
      },
      plugins: {
        trigger: new FormValidation.plugins.Trigger(),
        bootstrap5: new FormValidation.plugins.Bootstrap5({
          eleValidClass: 'is-valid',
          rowSelector: function (field, ele) {
            return '.mb-5';
          }
        }),
        submitButton: new FormValidation.plugins.SubmitButton(),
        autoFocus: new FormValidation.plugins.AutoFocus()
      }
    });
  }
})();