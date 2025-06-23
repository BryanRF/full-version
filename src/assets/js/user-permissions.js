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
        url: '/role-permissions/stats/',
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
        const activationRate = role.total_users > 0 ?
            ((role.active_users / role.total_users) * 100).toFixed(1) : 0;

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
        url: `/role-permissions/${roleCode}/`,
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
    const added = currentPermissions.filter(p => !initialPermissions.includes(p));
    const removed = initialPermissions.filter(p => !currentPermissions.includes(p));

    pendingChanges = { added, removed };

    // Habilitar/deshabilitar botón
    const hasChanges = added.length > 0 || removed.length > 0;
    $('#saveRolePermissionsBtn').prop('disabled', !hasChanges);

    // Actualizar badge del botón
    if (hasChanges) {
        const totalChanges = added.length + removed.length;
        $('#saveRolePermissionsBtn').html(`
            <i class="ri-save-line me-1"></i>
            Guardar Cambios <span class="badge bg-warning ms-1">${totalChanges}</span>
        `);
    } else {
        $('#saveRolePermissionsBtn').html(`
            <i class="ri-save-line me-1"></i>
            Guardar Cambios
        `);
    }
}

function updateChangesSummary() {
    if (!pendingChanges.added || !pendingChanges.removed) return;

    const totalChanges = pendingChanges.added.length + pendingChanges.removed.length;

    if (totalChanges > 0) {
        let summaryHtml = '<div class="list-group">';

        if (pendingChanges.added.length > 0) {
            summaryHtml += `
                <div class="list-group-item list-group-item-success">
                    <i class="ri-add-circle-line me-2"></i>
                    <strong>${pendingChanges.added.length}</strong> permisos serán agregados
                </div>
            `;
        }

        if (pendingChanges.removed.length > 0) {
            summaryHtml += `
                <div class="list-group-item list-group-item-danger">
                    <i class="ri-close-circle-line me-2"></i>
                    <strong>${pendingChanges.removed.length}</strong> permisos serán removidos
                </div>
            `;
        }

        summaryHtml += '</div>';

        $('#changesSummary').html(summaryHtml);
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

    // Datos a enviar
    const requestData = {
        role: currentRole,
        permission_ids: currentPermissions
    };

    console.log('Enviando datos:', requestData); // Para debug

    $.ajax({
        url: '/role-permissions/update/',
        method: 'POST',
        headers: {
            'X-CSRFToken': csrftoken,
            'Content-Type': 'application/json'
        },
        data: JSON.stringify(requestData),
        success: function(response) {
            console.log('Respuesta exitosa:', response); // Para debug

            if (response.success) {
                toastr['success']('', response.message || 'Permisos actualizados correctamente');

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
                toastr['error']('', response.error || 'Error al guardar permisos');
            }
        },
        error: function(xhr, status, error) {
            console.error('Error en la petición:', xhr.responseText); // Para debug
            console.error('Status:', status);
            console.error('Error:', error);

            let errorMessage = 'Error al guardar los permisos';

            if (xhr.responseJSON) {
                errorMessage = xhr.responseJSON.error || xhr.responseJSON.detail || errorMessage;
            } else if (xhr.responseText) {
                try {
                    const errorData = JSON.parse(xhr.responseText);
                    errorMessage = errorData.error || errorData.detail || errorMessage;
                } catch(e) {
                    errorMessage = `Error del servidor (${xhr.status})`;
                }
            }

            toastr['error']('', errorMessage);
        },
        complete: function() {
            saveBtn.prop('disabled', false).html(originalText);
        }
    });
}

function viewRoleUsers() {
    if (!currentRole) {
        toastr['error']('', 'Por favor seleccione un rol primero');
        return;
    }

    // Mostrar loading en el modal
    $('#roleUsersContent').html(`
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Cargando...</span>
            </div>
        </div>
    `);

    $('#roleUsersModal').modal('show');

    $.ajax({
        url: `/role-permissions/users/${currentRole}/`,  // CORREGIDA: URL correcta según auth/urls.py
        method: 'GET',
        headers: {
            'X-CSRFToken': csrftoken
        },
        success: function(response) {
            if (response.success) {
                displayRoleUsers(response.data);
            } else {
                $('#roleUsersContent').html(`
                    <div class="alert alert-danger">
                        <i class="ri-error-warning-line me-2"></i>
                        ${response.error || 'Error al cargar usuarios'}
                    </div>
                `);
            }
        },
        error: function(xhr) {
            console.error('Error loading role users:', xhr);
            $('#roleUsersContent').html(`
                <div class="alert alert-danger">
                    <i class="ri-error-warning-line me-2"></i>
                    Error al cargar los usuarios del rol
                </div>
            `);
        }
    });
}

function displayRoleUsers(users) {
    if (!users || users.length === 0) {
        $('#roleUsersContent').html(`
            <div class="alert alert-info">
                <i class="ri-information-line me-2"></i>
                No hay usuarios asignados a este rol
            </div>
        `);
        return;
    }

    let html = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Email</th>
                        <th>Estado</th>
                        <th>Último acceso</th>
                    </tr>
                </thead>
                <tbody>
    `;

    users.forEach(user => {
        const statusBadge = user.is_active ?
            '<span class="badge bg-success">Activo</span>' :
            '<span class="badge bg-secondary">Inactivo</span>';

        const lastLogin = user.last_login ?
            new Date(user.last_login).toLocaleDateString() :
            'Nunca';

        html += `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar avatar-sm me-2">
                            <span class="avatar-initial rounded-circle bg-label-primary">
                                ${user.username.substring(0, 2).toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <strong>${user.username}</strong>
                            <br><small class="text-muted">${user.full_name || ''}</small>
                        </div>
                    </div>
                </td>
                <td>${user.email}</td>
                <td>${statusBadge}</td>
                <td>${lastLogin}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
        <div class="mt-3">
            <small class="text-muted">Total: ${users.length} usuario(s)</small>
        </div>
    `;

    $('#roleUsersContent').html(html);
}

// Función para sincronizar todos los usuarios con sus roles
function syncAllUserRoles() {
    if (!confirm('¿Está seguro de sincronizar todos los usuarios con sus grupos de roles?')) {
        return;
    }

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sincronizando...';

    $.ajax({
        url: '/role-permissions/sync/',
        method: 'POST',
        headers: {
            'X-CSRFToken': csrftoken
        },
        success: function(response) {
            if (response.success) {
                toastr['success']('', response.message);
                // Recargar estadísticas
                loadRoleStats();
            } else {
                toastr['error']('', response.error || 'Error al sincronizar usuarios');
            }
        },
        error: function(xhr) {
            console.error('Error syncing users:', xhr);
            toastr['error']('', 'Error al sincronizar usuarios');
        },
        complete: function() {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });
}
