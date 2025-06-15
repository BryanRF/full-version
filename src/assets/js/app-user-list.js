/**
 * App Users List
 */

'use strict';

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

function createOrUpdateUser() {
  const nombre = document.getElementById('user-nombre').value;
  const apellidos = document.getElementById('user-apellidos').value;
  const email = document.getElementById('user-email').value;
  const dni = document.getElementById('user-dni').value;
  const fechaNacimiento = document.getElementById('user-fecha-nacimiento').value;
  const genero = document.getElementById('user-genero').value;
  const role = document.getElementById('user-role').value;

  // Validación básica
  if (!nombre.trim()) {
    toastr['error']('', 'El nombre es requerido');
    return;
  }
  if (!apellidos.trim()) {
    toastr['error']('', 'Los apellidos son requeridos');
    return;
  }
  if (!email.trim() && !editingId) {
    toastr['error']('', 'El email es requerido');
    return;
  }
  if (!dni.trim()) {
    toastr['error']('', 'El DNI es requerido');
    return;
  }
  if (!fechaNacimiento) {
    toastr['error']('', 'La fecha de nacimiento es requerida');
    return;
  }
  if (!genero) {
    toastr['error']('', 'El género es requerido');
    return;
  }
  if (!role) {
    toastr['error']('', 'El rol es requerido');
    return;
  }

  const userData = {
    nombre: nombre,
    apellidos: apellidos,
    dni: dni,
    fecha_nacimiento: fechaNacimiento,
    genero: genero,
    role: role
  };

  // Solo incluir email si no estamos editando
  if (!editingId) {
    userData.email = email;
  }

  const url = editingId ? `/users/${editingId}/` : '/users/data/';
  const method = editingId ? 'PATCH' : 'POST';

  // Mostrar loading
  const submitBtn = document.querySelector('.btn-primary[onclick="createOrUpdateUser()"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Guardando...';

  fetch(url, {
    method,
    body: JSON.stringify(userData),
    headers: {
      'Content-Type': 'application/json',
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
      const message = editingId ? 'Usuario actualizado exitosamente' : 'Usuario creado exitosamente. Se ha enviado la contraseña al correo.';
      toastr['success']('', message);

      // Reset form and state
      resetForm();

      // Close offcanvas
      closeOffcanvas();

      // Reload table
      if (typeof window.dt_user !== 'undefined') {
        window.dt_user.ajax.reload();
      }
    })
    .catch(err => {
      console.error('Error:', err);
      let errorMessage = 'Error al guardar el usuario';

      // Manejar errores específicos del servidor
      if (err && typeof err === 'object') {
        if (err.errors) {
          // Mostrar el primer error encontrado
          const firstErrorKey = Object.keys(err.errors)[0];
          const firstError = err.errors[firstErrorKey];
          if (Array.isArray(firstError)) {
            errorMessage = `Error en ${firstErrorKey}: ${firstError[0]}`;
          } else {
            errorMessage = `Error en ${firstErrorKey}: ${firstError}`;
          }
        } else if (err.email && err.email[0]) {
          errorMessage = `Error en email: ${err.email[0]}`;
        } else if (err.dni && err.dni[0]) {
          errorMessage = `Error en DNI: ${err.dni[0]}`;
        } else if (err.detail) {
          errorMessage = err.detail;
        } else if (err.message) {
          errorMessage = err.message;
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
  document.getElementById('userListForm').reset();

  if (typeof $ !== 'undefined') {
    $('#user-genero').val('').trigger('change');
    $('#user-role').val('').trigger('change');
  }

  // Mostrar/ocultar campos según el modo
  toggleEmailField(false); // false = modo crear

  // Update button text and offcanvas title
  $('.btn-primary[onclick="createOrUpdateUser()"]').text('Agregar');
  $('#offcanvasUserListLabel').text('Agregar Usuario');
}

function toggleEmailField(isEditing) {
  const emailInput = document.getElementById('user-email');
  const emailHelpText = document.getElementById('email-help-text');
  const emailReadonlyText = document.getElementById('email-readonly-text');

  if (isEditing) {
    emailInput.disabled = true;
    emailInput.style.backgroundColor = '#f8f9fa';
    emailHelpText.classList.add('d-none');
    emailReadonlyText.classList.remove('d-none');
  } else {
    emailInput.disabled = false;
    emailInput.style.backgroundColor = '';
    emailHelpText.classList.remove('d-none');
    emailReadonlyText.classList.add('d-none');
  }
}

function closeOffcanvas() {
  const offcanvasElement = document.getElementById('offcanvasUserList');
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
    'PENDIENTE': { title: 'Pendiente', class: 'bg-label-warning' },
    'ACTIVO': { title: 'Activo', class: 'bg-label-success' },
    'INACTIVO': { title: 'Inactivo', class: 'bg-label-danger' }
  };

  // Role object for rendering
  const roleObj = {
    'ADMINISTRADOR_SISTEMA': { title: 'Admin. Sistema', class: 'bg-label-primary' },
    'GERENTE_COMPRAS': { title: 'Gerente Compras', class: 'bg-label-info' },
    'PLANIFICADOR_COMPRAS': { title: 'Planificador', class: 'bg-label-secondary' }
  };

  // Variable declaration for user list table
  var dt_user_list_table = $('.datatables-user-list');

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

  // Users List Datatable
  if (dt_user_list_table.length) {
    window.dt_user = dt_user_list_table.DataTable({
      ajax: '/users/data/',
      columns: [
        { data: null },
        { data: 'id' },
        { data: 'username' },
        { data: 'email' },
        { data: 'role' },
        { data: 'status' },
        { data: 'created_at' },
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
          // User info
          targets: 2,
          responsivePriority: 2,
          render: function (data, type, full, meta) {
            var $username = full['username'],
              $email = full['email'],
              $nombre_completo = full['nombre_completo'],
              $id = full['id'];

            // Create initials from name
            var $initials = $nombre_completo ? $nombre_completo.match(/\b\w/g) || [] : [];
            $initials = (($initials.shift() || '') + ($initials.pop() || '')).toUpperCase();
            if (!$initials) {
              $initials = $username ? $username.substring(0, 2).toUpperCase() : 'US';
            }

            var stateNum = Math.floor(Math.random() * 6);
            var states = ['success', 'danger', 'warning', 'info', 'dark', 'primary'];
            var $state = states[stateNum];

            var $output = '<span class="avatar-initial rounded-2 bg-label-' + $state + '">' + $initials + '</span>';

            // Creates full output for user info
            var $row_output =
              '<div class="d-flex align-items-center">' +
              '<div class="avatar-wrapper me-3 rounded bg-label-secondary user-name">' +
              '<div class="avatar">' +
              $output +
              '</div>' +
              '</div>' +
              '<div class="d-flex flex-column justify-content-center">' +
              '<span class="text-heading fw-medium text-wrap">' +
              ($nombre_completo || $username) +
              '</span>' +
              '<small class="text-truncate mb-0 d-none d-sm-block">@' +
              $username +
              '</small>' +
              '</div>' +
              '</div>';
            return $row_output;
          }
        },
        {
          // Email
          targets: 3,
          render: function (data, type, full, meta) {
            return '<span class="text-truncate">' + full['email'] + '</span>';
          }
        },
        {
          // Role
          targets: 4,
          render: function (data, type, full, meta) {
            var $role = full['role'] || 'ADMINISTRADOR_SISTEMA';
            var roleInfo = roleObj[$role] || { title: $role, class: 'bg-label-secondary' };
            return (
              '<span class="badge rounded-pill ' +
              roleInfo.class +
              '" text-capitalized>' +
              roleInfo.title +
              '</span>'
            );
          }
        },
        {
          // Status
          targets: 5,
          render: function (data, type, full, meta) {
            var $status = full['status'] || 'PENDIENTE';
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
          // Created date
          targets: 6,
          render: function (data, type, full, meta) {
            var createdDate = new Date(full['created_at']);
            return createdDate.toLocaleDateString('es-ES');
          }
        },
        {
          // Actions
          targets: -1,
          title: 'Acciones',
          searchable: false,
          orderable: false,
          data: null,
          render: function (data, type, full, meta) {
            var currentStatus = full['status'] || 'PENDIENTE';
            var toggleText = currentStatus === 'ACTIVO' ? 'Desactivar' : 'Activar';

            return (
              '<div class="d-flex align-items-sm-center justify-content-sm-center">' +
              '<button class="btn btn-sm btn-icon btn-text-secondary waves-effect waves-light rounded-pill btn-edit-user" data-id="' + full.id + '" title="Editar">' +
              '<i class="ri-edit-box-line ri-20px"></i>' +
              '</button>' +
              '<button class="btn btn-sm btn-icon btn-text-secondary waves-effect waves-light rounded-pill dropdown-toggle hide-arrow" data-bs-toggle="dropdown">' +
              '<i class="ri-more-2-line ri-20px"></i>' +
              '</button>' +
              '<div class="dropdown-menu dropdown-menu-end m-0">' +
              '<a href="javascript:void(0);" class="dropdown-item btn-toggle-status" data-id="' + full.id + '" data-status="' + currentStatus + '">' + toggleText + '</a>' +
              '<a href="javascript:void(0);" class="dropdown-item btn-reset-password" data-id="' + full.id + '">Resetear Contraseña</a>' +
              '<div class="dropdown-divider"></div>' +
              '<a href="javascript:void(0);" class="dropdown-item">Ver Detalles</a>' +
              '</div>' +
              '</div>'
            );
          }
        }
      ],
      order: [6, 'desc'],
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
        searchPlaceholder: 'Buscar Usuario',
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
                columns: [1, 2, 3, 4, 5, 6],
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
                columns: [1, 2, 3, 4, 5, 6],
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
                columns: [1, 2, 3, 4, 5, 6],
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
                columns: [1, 2, 3, 4, 5, 6],
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
                columns: [1, 2, 3, 4, 5, 6],
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
          text: '<i class="ri-add-line ri-16px me-0 me-sm-1 align-baseline"></i><span class="d-none d-sm-inline-block">Agregar Usuario</span>',
          className: 'add-new btn btn-primary waves-effect waves-light',
          attr: {
            'data-bs-toggle': 'offcanvas',
            'data-bs-target': '#offcanvasUserList'
          }
        }
      ],
      responsive: {
        details: {
          display: $.fn.dataTable.Responsive.display.modal({
            header: function (row) {
              var data = row.data();
              return 'Details of ' + (data['nombre_completo'] || data['username']);
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

  // Edit user event handler
  $(document).on('click', '.btn-edit-user', function () {
    const id = $(this).data('id');
    editingId = id;

    $.get(`/users/${id}/`, function (response) {
      const data = response.data || response;

      $('#user-nombre').val(data.first_name || '');
      $('#user-apellidos').val(data.last_name || '');
      $('#user-email').val(data.email || '');
      $('#user-dni').val(data.dni || '');
      $('#user-fecha-nacimiento').val(data.fecha_nacimiento || '');
      $('#user-genero').val(data.genero || '').trigger('change');
      $('#user-role').val(data.role || '').trigger('change');

      // Deshabilitar email en modo edición
      toggleEmailField(true);

      // Update button text and offcanvas title
      $('.btn-primary[onclick="createOrUpdateUser()"]').text('Actualizar');
      $('#offcanvasUserListLabel').text('Editar Usuario');

      // Open the offcanvas
      if (typeof bootstrap !== 'undefined') {
        const canvas = new bootstrap.Offcanvas('#offcanvasUserList');
        canvas.show();
      }
    }).fail(function(xhr) {
      console.error('Error loading user data:', xhr);
      toastr['error']('', 'Error al cargar los datos del usuario');
    });
  });

  // Toggle status event handler
  $(document).on('click', '.btn-toggle-status', function () {
    const id = $(this).data('id');
    const currentStatus = $(this).data('status');

    const nextStateText = currentStatus === 'ACTIVO' ? 'desactivar' : 'activar';

    Swal.fire({
        title: `¿Deseas ${nextStateText} este usuario?`,
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
                url: `/users/${id}/toggle_status/`,
                method: 'PATCH',
                headers: {
                    'X-CSRFToken': csrftoken
                },
                success: function (response) {
                    Swal.fire({
                        title: '¡Éxito!',
                        text: response.message || 'Estado del usuario actualizado',
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    dt_user.ajax.reload();
                },
                error: function (xhr) {
                    console.error('Toggle status error:', xhr);
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

  // Reset password event handler
  $(document).on('click', '.btn-reset-password', function () {
    const id = $(this).data('id');

    Swal.fire({
        title: '¿Resetear contraseña?',
        text: 'Se generará una nueva contraseña y se enviará al correo del usuario',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, resetear',
        cancelButtonText: 'Cancelar',
        customClass: {
            confirmButton: 'btn btn-warning me-2',
            cancelButton: 'btn btn-label-secondary'
        },
        buttonsStyling: false
    }).then((result) => {
        if (result.isConfirmed) {
            $.ajax({
                url: `/users/${id}/reset_password/`,
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrftoken
                },
                success: function (response) {
                    Swal.fire({
                        title: '¡Contraseña Reseteada!',
                        text: response.message || 'Nueva contraseña enviada al correo del usuario',
                        icon: 'success',
                        timer: 3000,
                        showConfirmButton: false
                    });
                },
                error: function (xhr) {
                    console.error('Reset password error:', xhr);
                    const error = xhr.responseJSON ? xhr.responseJSON.error : 'Error al resetear la contraseña';
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

  // Reset form when offcanvas is hidden
  $('#offcanvasUserList').on('hidden.bs.offcanvas', function () {
    resetForm();
  });
});

// Form validation
(function () {
  const userListForm = document.getElementById('userListForm');

  if (userListForm && typeof FormValidation !== 'undefined') {
    const fv = FormValidation.formValidation(userListForm, {
      fields: {
        userNombre: {
          validators: {
            notEmpty: {
              message: 'Por favor ingrese el nombre'
            }
          }
        },
        userApellidos: {
          validators: {
            notEmpty: {
              message: 'Por favor ingrese los apellidos'
            }
          }
        },
        userEmail: {
          validators: {
            notEmpty: {
              message: 'Por favor ingrese el email'
            },
            emailAddress: {
              message: 'Por favor ingrese un email válido'
            }
          }
        },
        userDni: {
          validators: {
            notEmpty: {
              message: 'Por favor ingrese el DNI'
            }
          }
        },
        userFechaNacimiento: {
          validators: {
            notEmpty: {
              message: 'Por favor seleccione la fecha de nacimiento'
            }
          }
        },
        userGenero: {
          validators: {
            notEmpty: {
              message: 'Por favor seleccione el género'
            }
          }
        },
        userRole: {
          validators: {
            notEmpty: {
              message: 'Por favor seleccione el rol'
            }
          }
        }
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
