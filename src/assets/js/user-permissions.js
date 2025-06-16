/**
 * Role-Based Permissions Management
 */

'use strict';

// Variables globales
let currentRole = null;
let currentRolePermissions = [];
let initialPermissions = [];
let pendingChanges = [];

// Función para obtener CSRF token
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

// Inicialización
$(document).ready(function() {
    loadRoleStats();
    setupEventListeners();
});

function setupEventListeners() {
    // Búsqueda de permisos
    $('#permissionSearch').on('input', function() {
        const searchTerm = $(this).val().toLowerCase();
        $('.permission-item').each(function() {
            const permissionName = $(this).find('label strong').text().toLowerCase();
            const permissionCode = $(this).find('label small').text().toLowerCase();

            if (permissionName.includes(searchTerm) || permissionCode.includes(searchTerm)) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    });

    // Filtro por módulo
    $('#moduleFilter').on('change', function() {
        const selectedModule = $(this).val();
        if (selectedModule === '') {
            $('.permission-module-item').show();
        } else {
            $('.permission-module-item').hide();
            $(`.permission-module-item[data-module="${selectedModule}"]`).show();
        }
    });

    // Detectar cambios en permisos
    $(document).on('change', '.permission-checkbox', function() {
        updateModuleCounter($(this).data('module'));
        updateSaveButton();
        updateChangesSummary();
    });

    // Guardar cambios
    $('#saveRolePermissionsBtn').on('click', function() {
        showConfirmationModal();
    });

    // Ver usuarios del rol
    $('#viewRoleUsersBtn').on('click', function() {
        viewRoleUsers();
    });
}

function loadRoleStats() {
    $.ajax({
        url: '/auth/role-permissions/stats/',
        method: 'GET',
        headers: {
            'X-CSRFToken': csrftoken
        },
        success: function(response) {
            if (response.success) {
                displayRoleStats(response.data);
                updateRoleCards(response.data);
            }
        },
        error: function(xhr) {
            console.error('Error loading role stats:', xhr);
        }
    });
}

function displayRoleStats(stats) {
    let html = '';

    Object.keys(stats).forEach(roleCode => {
        const role = stats[roleCode];
        const activationRate = role.total_users > 0 ? ((role.active_users / role.total_users) * 100).toFixed(1) : 0;

        html += `
            <div class="col-md-4 mb-3">
                <div class="card border-start border-4 border-primary">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h6 class="card-title mb-1">${role.name}</h6>
                                <p class="text-muted mb-0">${role.total_users} usuarios total</p>
                                <small class="text-success">${role.active_users} activos (${activationRate}%)</small>
                            </div>
                            <div class="text-end">
                                <span class="badge bg-label-info">${role.permissions_count} permisos</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    $('#roleStatsContainer').html(html);
}

function updateRoleCards(stats) {
    Object.keys(stats).forEach(roleCode => {
        const role = stats[roleCode];
        $(`#users-count-${roleCode}`).text(`${role.total_users} usuarios`);
        $(`#permissions-count-${roleCode}`).text(`${role.permissions_count} permisos`);
    });
}

function selectRole(roleCode) {
    // Remover selección anterior
    $('.role-card').removeClass('active');

    // Seleccionar nuevo rol
    $(`.role-card[data-role="${roleCode}"]`).addClass('active');

    currentRole = roleCode;
    loadRolePermissions(roleCode);

    // Mostrar controles
    $('#noRoleSelected').addClass('d-none');
    $('#permissionsContainer').removeClass('d-none');
    $('#saveRolePermissionsBtn').prop('disabled', false);
    $('#viewRoleUsersBtn').prop('disabled', false);

    // Limpiar cambios pendientes
    pendingChanges = [];
    initialPermissions = [];
    updateSaveButton();
    $('#changesCard').addClass('d-none');
}

function loadRolePermissions(roleCode) {
    // Mostrar loading
    $('#selectedRoleName').html(`
        <div class="spinner-border spinner-border-sm me-2" role="status"></div>
        Cargando...
    `);

    $.ajax({
        url: `/auth/role-permissions/${roleCode}/`,
        method: 'GET',
        headers: {
            'X-CSRFToken': csrftoken
        },
        success: function(response) {
            if (response.success) {
                currentRolePermissions = response.data.permissions;
                initialPermissions = response.data.permissions.map(p => p.id);

                // Actualizar información del rol
                $('#selectedRoleName').text(response.data.role_display);
                $('#affectedUsersCount').text(response.data.users_count);

                // Actualizar checkboxes
                updatePermissionCheckboxes();
                updateAllModuleCounters();
            } else {
                toastr['error']('', response.error || 'Error al cargar permisos del rol');
            }
        },
        error: function(xhr) {
            console.error('Error loading role permissions:', xhr);
            toastr['error']('', 'Error al cargar los permisos del rol');
        }
    });
}

function updatePermissionCheckboxes() {
    // Limpiar todas las casillas
    $('.permission-checkbox').prop('checked', false);

    // Marcar permisos activos del rol
    const permissionIds = currentRolePermissions.map(p => p.id);
    permissionIds.forEach(permissionId => {
        $(`#perm_${permissionId}`).prop('checked', true);
    });
}

function updateModuleCounter(moduleKey) {
    const totalCheckboxes = $(`.permission-checkbox[data-module="${moduleKey}"]`).length;
    const checkedCheckboxes = $(`.permission-checkbox[data-module="${moduleKey}"]:checked`).length;

    $(`#selected-${moduleKey}`).text(`${checkedCheckboxes} seleccionados`);

    // Cambiar color del badge según el estado
    const badge = $(`#selected-${moduleKey}`);
    badge.removeClass('bg-success bg-warning bg-secondary');

    if (checkedCheckboxes === 0) {
        badge.addClass('bg-secondary');
    } else if (checkedCheckboxes === totalCheckboxes) {
        badge.addClass('bg-success');
    } else {
        badge.addClass('bg-warning');
    }
}

function updateAllModuleCounters() {
    // Actualizar contadores para todos los módulos
    $('.permission-module-item').each(function() {
        const moduleKey = $(this).data('module');
        updateModuleCounter(moduleKey);
    });
}

function updateSaveButton() {
    const currentPermissions = [];
    $('.permission-checkbox:checked').each(function() {
        currentPermissions.push(parseInt($(this).data('permission-id')));
    });

    // Calcular cambios
    const added = currentPermissions.filter(id => !initialPermissions.includes(id));
    const removed = initialPermissions.filter(id => !currentPermissions.includes(id));

    const hasChanges = added.length > 0 || removed.length > 0;

    const saveBtn = $('#saveRolePermissionsBtn');
    if (hasChanges) {
        saveBtn.removeClass('btn-outline-success').addClass('btn-success');
        saveBtn.html(`<i class="ri-save-line me-1"></i>Guardar Cambios (${added.length + removed.length})`);
    } else {
        saveBtn.removeClass('btn-success').addClass('btn-outline-success');
        saveBtn.html('<i class="ri-save-line me-1"></i>Guardar Cambios');
    }

    // Guardar cambios para usar en confirmación
    pendingChanges = { added, removed };
}

function updateChangesSummary() {
    if (pendingChanges.added && pendingChanges.removed &&
        (pendingChanges.added.length > 0 || pendingChanges.removed.length > 0)) {

        let html = '<div class="row">';

        if (pendingChanges.added.length > 0) {
            html += '<div class="col-md-6"><h6 class="text-success">Permisos a Agregar:</h6><ul class="list-unstyled">';
            pendingChanges.added.forEach(permissionId => {
                const checkbox = $(`#perm_${permissionId}`);
                const name = checkbox.data('permission-name');
                html += `<li><i class="ri-add-line text-success me-1"></i>${name}</li>`;
            });
            html += '</ul></div>';
        }

        if (pendingChanges.removed.length > 0) {
            html += '<div class="col-md-6"><h6 class="text-danger">Permisos a Remover:</h6><ul class="list-unstyled">';
            pendingChanges.removed.forEach(permissionId => {
                const permission = currentRolePermissions.find(p => p.id === permissionId);
                if (permission) {
                    html += `<li><i class="ri-subtract-line text-danger me-1"></i>${permission.name}</li>`;
                }
            });
            html += '</ul></div>';
        }

        html += '</div>';

        $('#changesSummary').html(html);
        $('#changesCard').removeClass('d-none');
    } else {
        $('#changesCard').addClass('d-none');
    }
}

function selectAllModulePermissions(moduleKey) {
    $(`.permission-checkbox[data-module="${moduleKey}"]`).each(function() {
        if (!$(this).is(':checked')) {
            $(this).prop('checked', true);
        }
    });
    updateModuleCounter(moduleKey);
    updateSaveButton();
    updateChangesSummary();
}

function deselectAllModulePermissions(moduleKey) {
    $(`.permission-checkbox[data-module="${moduleKey}"]`).each(function() {
        if ($(this).is(':checked')) {
            $(this).prop('checked', false);
        }
    });
    updateModuleCounter(moduleKey);
    updateSaveButton();
    updateChangesSummary();
}

function showConfirmationModal() {
    if (!pendingChanges.added || !pendingChanges.removed ||
        (pendingChanges.added.length === 0 && pendingChanges.removed.length === 0)) {
        toastr['info']('', 'No hay cambios para guardar');
        return;
    }

    const totalChanges = pendingChanges.added.length + pendingChanges.removed.length;
    const affectedUsers = $('#affectedUsersCount').text();

    let confirmationHtml = `
        <p><strong>Rol:</strong> ${$('#selectedRoleName').text()}</p>
        <p><strong>Usuarios afectados:</strong> ${affectedUsers}</p>
        <p><strong>Total de cambios:</strong> ${totalChanges}</p>
    `;

    if (pendingChanges.added.length > 0) {
        confirmationHtml += `<p><span class="badge bg-success">${pendingChanges.added.length}</span> permisos serán agregados</p>`;
    }

    if (pendingChanges.removed.length > 0) {
        confirmationHtml += `<p><span class="badge bg-danger">${pendingChanges.removed.length}</span> permisos serán removidos</p>`;
    }

    $('#confirmationDetails').html(confirmationHtml);
    $('#confirmChangesModal').modal('show');
}

function confirmSaveChanges() {
    const currentPermissions = [];
    $('.permission-checkbox:checked').each(function() {
        currentPermissions.push(parseInt($(this).data('permission-id')));
    });

    const saveBtn = $('#saveRolePermissionsBtn');
    const originalText = saveBtn.html();
    saveBtn.prop('disabled', true).html('<div class="spinner-border spinner-border-sm me-2"></div>Guardando...');

    $.ajax({
        url: '/auth/role-permissions/update/',
        method: 'PUT',
        headers: {
            'X-CSRFToken': csrftoken,
            'Content-Type': 'application/json'
        },
        data: JSON.stringify({
            role: currentRole,
            permission_ids: currentPermissions
        }),
        success: function(response) {
            if (response.success) {
                toastr['success']('', response.message);

                // Actualizar estado inicial
                initialPermissions = currentPermissions.slice();
                pendingChanges = { added: [], removed: [] };

                // Recargar datos
                loadRolePermissions(currentRole);
                loadRoleStats();

                // Ocultar modal y tarjeta de cambios
                $('#confirmChangesModal').modal('hide');
                $('#changesCard').addClass('d-none');

                updateSaveButton();
            } else {
                toastr['error']('', response.error);
            }
        },
        error: function(xhr) {
            console.error('Error saving role permissions:', xhr);
            toastr['error']('', 'Error al guardar los permisos');
        },
        complete: function() {
            saveBtn.prop('disabled', false).html(originalText);
        }
    });
}

function viewRoleUsers() {
    if (!currentRole) {
        toastr['error']('', 'Selecciona un rol primero');
        return;
    }

    $('#roleUsersModal').modal('show');
    $('#roleUsersContent').html(`
        <div class="text-center">
            <div class="spinner-border" role="status"></div>
            <p class="mt-2">Cargando usuarios...</p>
        </div>
    `);

    $.ajax({
        url: `/auth/role-permissions/users/${currentRole}/`,
        method: 'GET',
        headers: {
            'X-CSRFToken': csrftoken
        },
        success: function(response) {
            if (response.success) {
                displayRoleUsers(response.data);
            } else {
                $('#roleUsersContent').html(`
                    <div class="text-center text-danger">
                        <i class="ri-error-warning-line ri-24px mb-2"></i>
                        <p>Error al cargar usuarios</p>
                    </div>
                `);
            }
        },
        error: function(xhr) {
            console.error('Error loading role users:', xhr);
            $('#roleUsersContent').html(`
                <div class="text-center text-danger">
                    <i class="ri-error-warning-line ri-24px mb-2"></i>
                    <p>Error al cargar usuarios</p>
                </div>
            `);
        }
    });
}

function displayRoleUsers(data) {
    if (data.users.length === 0) {
        $('#roleUsersContent').html(`
            <div class="text-center text-muted py-4">
                <i class="ri-user-line ri-24px mb-2"></i>
                <p>No hay usuarios con el rol ${data.role_display}</p>
            </div>
        `);
        return;
    }

    let html = `
        <div class="alert alert-info">
            <strong>${data.role_display}</strong> - ${data.count} usuarios encontrados
        </div>
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Email</th>
                        <th>Estado</th>
                        <th>Fecha Registro</th>
                    </tr>
                </thead>
                <tbody>
    `;

    data.users.forEach(user => {
        const fullName = user.first_name && user.last_name ?
            `${user.first_name} ${user.last_name}` : user.username;

        const statusClass = user.profile__status === 'ACTIVO' ? 'success' :
                           user.profile__status === 'PENDIENTE' ? 'warning' : 'danger';

        const date = new Date(user.date_joined).toLocaleDateString('es-ES');

        html += `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar avatar-sm me-2">
                            <span class="avatar-initial rounded-circle bg-label-primary">
                                ${fullName.substring(0, 2).toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <h6 class="mb-0">${fullName}</h6>
                            <small class="text-muted">@${user.username}</small>
                        </div>
                    </div>
                </td>
                <td>${user.email}</td>
                <td>
                    <span class="badge bg-${statusClass}">${user.profile__status || 'PENDIENTE'}</span>
                </td>
                <td>${date}</td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    $('#roleUsersContent').html(html);
}

function syncAllUserRoles() {
    Swal.fire({
        title: '¿Sincronizar usuarios?',
        text: 'Esto actualizará los grupos de todos los usuarios según sus roles actuales',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, sincronizar',
        cancelButtonText: 'Cancelar',
        customClass: {
            confirmButton: 'btn btn-primary me-2',
            cancelButton: 'btn btn-secondary'
        },
        buttonsStyling: false
    }).then((result) => {
        if (result.isConfirmed) {
            performUserRoleSync();
        }
    });
}

function performUserRoleSync() {
    $.ajax({
        url: '/auth/role-permissions/sync/',
        method: 'POST',
        headers: {
            'X-CSRFToken': csrftoken
        },
        success: function(response) {
            if (response.success) {
                toastr['success']('', response.message);
                loadRoleStats();
            } else {
                toastr['error']('', response.error);
            }
        },
        error: function(xhr) {
            console.error('Error syncing user roles:', xhr);
            toastr['error']('', 'Error al sincronizar usuarios');
        }
    });
}
