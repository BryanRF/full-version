/**
 * App eCommerce Add Product Script
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
let isEditMode = false;
let editingProductId = null;
let quillDescription;

// Check if we're in edit mode
function checkEditMode() {
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('edit');
  
  if (editId) {
    isEditMode = true;
    editingProductId = editId;
    loadProductData(editId);
    updateUIForEditMode();
  }
}

function updateUIForEditMode() {
  document.querySelector('h4').textContent = 'Editar Producto';
  document.querySelector('p').textContent = 'Actualizar información del producto';
  document.querySelector('.btn-primary').textContent = 'Actualizar producto';
}

function loadProductData(productId) {
  fetch(`/api/products/${productId}/`)
    .then(response => response.json())
    .then(product => {
      // Basic information
      document.getElementById('ecommerce-product-name').value = product.name || '';
      
      // Description
      if (quillDescription && product.description) {
        quillDescription.root.innerHTML = product.description;
      }
      
      // Pricing
      document.getElementById('ecommerce-product-price').value = product.price || '';
      document.getElementById('ecommerce-product-discount-price').value = product.discounted_price || '';
      document.getElementById('price-charge-tax').checked = product.charge_tax;
      
      // Inventory
      document.getElementById('ecommerce-product-stock').value = product.stock_current || '';
      document.getElementById('ecommerce-product-stock-min').value = product.stock_minimum || '';
      document.getElementById('ecommerce-product-stock-max').value = product.stock_maximum || '';
      
      // Organization
      $('#category-org').val(product.category || '').trigger('change');
 
      
      // Tags
      if (product.tags && window.TagifyBasic) {
        window.TagifyBasic.removeAllTags();
        window.TagifyBasic.addTags(product.tags.split(','));
      }
      
      // Weight and dimensions
      document.getElementById('product-weight').value = product.weight || '';
      document.getElementById('product-dimensions').value = product.dimensions || '';
      
      // Attributes
      document.getElementById('fragile').checked = product.is_fragile || false;
      document.getElementById('biodegradable').checked = product.is_biodegradable || false;
      document.getElementById('frozen').checked = product.is_frozen || false;
      document.getElementById('temp').value = product.max_temperature || '';
      
      if (product.expiry_date) {
        document.getElementById('flatpickr-date').value = product.expiry_date;
        document.getElementById('expDate').checked = true;
      }
      
      
      document.getElementById('is-active').checked = product.is_active;
     
    })
    .catch(error => {
      console.error('Error loading product:', error);
      showError('Error al cargar los datos del producto');
    });
}

function saveProduct() {
  // Clear all previous validation states
  clearValidationErrors();
  
  // Gather form data
  const formData = new FormData();
  
  // Basic information
  const productName = document.getElementById('ecommerce-product-name').value.trim();
  if (!productName) {
    showFieldError('ecommerce-product-name', 'El nombre del producto es requerido');
    return;
  }
  formData.append('name', productName);
  
  // Description
  if (quillDescription) {
    formData.append('description', quillDescription.root.innerHTML);
  }
  
  // Pricing
  const price = document.getElementById('ecommerce-product-price').value;
  if (!price || parseFloat(price) <= 0) {
    showFieldError('ecommerce-product-price', 'El precio es requerido y debe ser mayor a 0');
    return;
  }
  formData.append('price', price);
  
  const discountPrice = document.getElementById('ecommerce-product-discount-price').value;
  if (discountPrice) {
    if (parseFloat(discountPrice) >= parseFloat(price)) {
      showFieldError('ecommerce-product-discount-price', 'El precio con descuento debe ser menor al precio regular');
      return;
    }
    formData.append('discounted_price', discountPrice);
  }
  formData.append('charge_tax', document.getElementById('price-charge-tax').checked);
  
  // Inventory
  const stockCurrent = document.getElementById('ecommerce-product-stock').value || '0';
  const stockMin = document.getElementById('ecommerce-product-stock-min').value || '0';
  const stockMax = document.getElementById('ecommerce-product-stock-max').value || '100';
  
  if (parseInt(stockMin) > parseInt(stockMax)) {
    showFieldError('ecommerce-product-stock-max', 'El stock mínimo no puede ser mayor al stock máximo');
    return;
  }
  
  formData.append('stock_current', stockCurrent);
  formData.append('stock_minimum', stockMin);
  formData.append('stock_maximum', stockMax);
  
  // Organization
  const category = $('#category-org').val();
  if (!category) {
    showFieldError('category-org', 'La categoría es requerida');
    return;
  }
  formData.append('category', category);
  formData.append('status', $('#status-org').val() || 'draft');
  
  // Tags
  const tags = window.TagifyBasic ? window.TagifyBasic.value.map(tag => tag.value).join(',') : '';
  formData.append('tags', tags);
  
  // Weight and dimensions
  const weight = document.getElementById('product-weight').value;
  if (weight) {
    formData.append('weight', weight);
  }
  const dimensions = document.getElementById('product-dimensions').value;
  if (dimensions) {
    formData.append('dimensions', dimensions);
  }
  
  // Attributes
  formData.append('is_fragile', document.getElementById('fragile').checked);
  formData.append('is_biodegradable', document.getElementById('biodegradable').checked);
  formData.append('is_frozen', document.getElementById('frozen').checked);
  
  const maxTemp = document.getElementById('temp').value;
  if (maxTemp && document.getElementById('frozen').checked) {
    formData.append('max_temperature', maxTemp);
  }
  
  const expiryDate = document.getElementById('flatpickr-date').value;
  if (expiryDate && document.getElementById('expDate').checked) {
    formData.append('expiry_date', expiryDate);
  }
  
  // Active status

  formData.append('is_active', document.getElementById('is-active').checked);
  
  // Handle image upload
  const imageInput = document.getElementById('ecommerce-category-image');
  if (imageInput && imageInput.files.length > 0) {
    formData.append('image', imageInput.files[0]);
  }
  
  // Show loading
  showLoading(true);
  
  // API call
  const url = isEditMode ? `/api/products/${editingProductId}/` : '/api/products/';
  const method = isEditMode ? 'PUT' : 'POST';
  
  fetch(url, {
    method: method,
    body: formData,
    headers: {
      'X-CSRFToken': csrftoken
    }
  })
  .then(response => {
    if (!response.ok) {
      return response.json().then(err => Promise.reject(err));
    }
    return response.json();
  })
  .then(data => {
    const message = isEditMode ? 'Producto actualizado exitosamente' : 'Producto creado exitosamente';
    showSuccess(message);
    
    // Redirect to product list
    setTimeout(() => {
      window.location.href = '/app/ecommerce/product/list/';
    }, 1500);
  })
  .catch(error => {
    console.error('Error:', error);
    handleApiError(error);
  })
  .finally(() => {
    showLoading(false);
  });
}

function showError(message) {
  if (typeof toastr !== 'undefined') {
    toastr.error('', message);
  } else {
      Swal.fire({
                title: 'Error',
                text: error,
                icon: 'error',
                customClass: {
                  confirmButton: 'btn btn-success waves-effect'
                }
              });
  }
}

function showSuccess(message) {
  if (typeof toastr !== 'undefined') {
    toastr.success('', message);
  } else {

                    Swal.fire({
                title: 'Error',
                text: error,
                icon: 'error',
                customClass: {
                  confirmButton: 'btn btn-success waves-effect'
                }
              });
  }
}

function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (field) {
    field.classList.add('is-invalid');
    
    // Remove existing feedback
    const existingFeedback = field.parentNode.querySelector('.invalid-feedback');
    if (existingFeedback) {
      existingFeedback.textContent = message;
    } else {
      const feedback = document.createElement('div');
      feedback.className = 'invalid-feedback';
      feedback.textContent = message;
      field.parentNode.appendChild(feedback);
    }
    
    // Scroll to field
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  showError(message);
}

function clearValidationErrors() {
  // Remove all invalid classes and feedback messages
  document.querySelectorAll('.is-invalid').forEach(field => {
    field.classList.remove('is-invalid');
  });
  document.querySelectorAll('.invalid-feedback').forEach(feedback => {
    if (!feedback.textContent.includes('La categoría es requerida')) {
      feedback.remove();
    }
  });
}

function showLoading(show) {
  const overlay = document.getElementById('loading-overlay');
  const submitBtn = document.querySelector('.btn-primary');
  
  if (show) {
    if (overlay) overlay.style.display = 'block';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
    }
  } else {
    if (overlay) overlay.style.display = 'none';
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = isEditMode ? 'Actualizar producto' : 'Publicar producto';
    }
  }
}

function handleApiError(error) {
  let errorMessage = 'Error al guardar el producto';
  
  if (error && typeof error === 'object') {
    // Manejar errores específicos del servidor
    const errorFields = {
      'name': 'nombre',
      'price': 'precio', 
      'category': 'categoría',
      'stock_current': 'stock actual',
      'stock_minimum': 'stock mínimo',
      'stock_maximum': 'stock máximo',
      'weight': 'peso',
      'dimensions': 'dimensiones',
      'max_temperature': 'temperatura máxima',
      'expiry_date': 'fecha de vencimiento'
    };
    
    // Mostrar errores específicos en los campos
    for (const [field, fieldName] of Object.entries(errorFields)) {
      if (error[field] && Array.isArray(error[field])) {
        const fieldId = {
          'name': 'ecommerce-product-name',
          'price': 'ecommerce-product-price',
          'category': 'category-org',
          'stock_current': 'ecommerce-product-stock',
          'stock_minimum': 'ecommerce-product-stock-min',
          'stock_maximum': 'ecommerce-product-stock-max',
          'weight': 'product-weight',
          'dimensions': 'product-dimensions',
          'max_temperature': 'temp',
          'expiry_date': 'flatpickr-date'
        }[field];
        
        if (fieldId) {
          showFieldError(fieldId, error[field][0]);
          return; // Show only the first error
        }
      }
    }
    
    // Errores generales
    if (error.non_field_errors && Array.isArray(error.non_field_errors)) {
      errorMessage = error.non_field_errors[0];
    } else if (error.detail) {
      errorMessage = error.detail;
    }
  }
  
  showError(errorMessage);
}

// Initialize everything when DOM is ready
(function () {
  // Comment editor
  const commentEditor = document.querySelector('.comment-editor');
  if (commentEditor) {
    quillDescription = new Quill(commentEditor, {
      modules: {
        toolbar: '.comment-toolbar'
      },
      placeholder: 'Descripción del producto',
      theme: 'snow'
    });
  }

  // Basic Tags
  const tagifyBasicEl = document.querySelector('#ecommerce-product-tags');
  if (tagifyBasicEl) {
    window.TagifyBasic = new Tagify(tagifyBasicEl);
  }

  // Flatpickr
  const productDate = document.querySelector('.product-date');
  if (productDate) {
    productDate.flatpickr({
      monthSelectorType: 'static',
      defaultDate: new Date()
    });
  }

  // Check if we're in edit mode
  checkEditMode();
})();

// jQuery initialization
$(function () {
  // Select2
  var select2 = $('.select2');
  if (select2.length) {
    select2.each(function () {
      var $this = $(this);
      select2Focus($this);
      $this.wrap('<div class="position-relative"></div>').select2({
        dropdownParent: $this.parent(),
        placeholder: $this.data('placeholder')
      });
    });
  }

  // Load categories for the category dropdown
  let categorySelect = $('#category-org');
  categorySelect.find('option:not(:first)').remove();
  
  $.get('/api/categories/active/', function (response) {
    if (response.data) {
      response.data.forEach(function (category) {
        categorySelect.append(`<option value="${category.id}">${category.name}</option>`);
      });
      categorySelect.select2({
        placeholder: 'Seleccionar Categoría',
        allowClear: true
      });
      
      // If we're in edit mode and have a product loaded, reselect the category
      if (isEditMode && editingProductId) {
        setTimeout(() => {
          fetch(`/api/products/${editingProductId}/`)
            .then(response => response.json())
            .then(product => {
              if (product.category) {
                categorySelect.val(product.category).trigger('change');
              }
            })
            .catch(error => console.error('Error loading product for category:', error));
        }, 500);
      }
    }
  }).fail(function() {
    showError('Error al cargar las categorías');
  });

  // Event handler for the publish button
  $('.btn-primary').on('click', function (e) {
    e.preventDefault();
    saveProduct();
  });

  // Event handlers for other action buttons
$('.btn-outline-secondary').on('click', function (e) {
  e.preventDefault();
 Swal.fire({
  title: '¿Estás seguro?',
  text: 'Se descartarán los cambios.',
  icon: 'warning',
  showCancelButton: true,
  confirmButtonText: 'Sí, descartar',
  cancelButtonText: 'No, mantener',
  customClass: {
    confirmButton: 'btn btn-danger me-2 waves-effect waves-light',
    cancelButton: 'btn btn-outline-secondary waves-effect waves-light'
  },
  buttonsStyling: false
  }).then((result) => {
    if (result.isConfirmed) {
      window.location.href = '/app/ecommerce/product/list/';
    }
  });
});




  // Real-time form validation
  $('#ecommerce-product-name').on('input blur', function() {
    const field = $(this);
    if (!field.val().trim()) {
      field.addClass('is-invalid');
      if (!field.siblings('.invalid-feedback').length) {
        field.after('<div class="invalid-feedback">El nombre del producto es requerido</div>');
      }
    } else {
      field.removeClass('is-invalid');
      field.siblings('.invalid-feedback').remove();
    }
  });

  $('#ecommerce-product-price').on('input blur', function() {
    const field = $(this);
    const price = parseFloat(field.val());
    if (!price || price <= 0) {
      field.addClass('is-invalid');
      if (!field.siblings('.invalid-feedback').length) {
        field.after('<div class="invalid-feedback">El precio debe ser mayor a 0</div>');
      }
    } else {
      field.removeClass('is-invalid');
      field.siblings('.invalid-feedback').remove();
    }
  });

  $('#ecommerce-product-discount-price').on('input blur', function() {
    const field = $(this);
    const regularPrice = parseFloat($('#ecommerce-product-price').val());
    const discountPrice = parseFloat(field.val());
    
    if (discountPrice && regularPrice && discountPrice >= regularPrice) {
      field.addClass('is-invalid');
      if (!field.siblings('.invalid-feedback').length) {
        field.after('<div class="invalid-feedback">El precio con descuento debe ser menor al precio regular</div>');
      }
    } else {
      field.removeClass('is-invalid');
      field.siblings('.invalid-feedback').remove();
    }
  });

  // Stock validation
  $('#ecommerce-product-stock-min, #ecommerce-product-stock-max').on('input blur', function() {
    const minField = $('#ecommerce-product-stock-min');
    const maxField = $('#ecommerce-product-stock-max');
    const minStock = parseInt(minField.val()) || 0;
    const maxStock = parseInt(maxField.val()) || 100;
    
    if (minStock > maxStock) {
      maxField.addClass('is-invalid');
      if (!maxField.siblings('.invalid-feedback').length) {
        maxField.after('<div class="invalid-feedback">El stock mínimo no puede ser mayor al máximo</div>');
      }
    } else {
      minField.removeClass('is-invalid');
      maxField.removeClass('is-invalid');
      minField.siblings('.invalid-feedback').remove();
      maxField.siblings('.invalid-feedback').remove();
    }
  });

  // Category validation
  $('#category-org').on('change', function() {
    const field = $(this);
    if (!field.val()) {
      field.addClass('is-invalid');
    } else {
      field.removeClass('is-invalid');
    }
  });
});