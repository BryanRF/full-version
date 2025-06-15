

'use strict';
const API_BASE_URL = '/api/products/'; // Cambia esta URL por tu endpoint real
const ANALYTICS_ENDPOINT = `${API_BASE_URL}dashboard_analytics/`; // Endpoint para analytics
const PRODUCTS_ENDPOINT = `${API_BASE_URL}data/`; // Endpoint para todos los productos

// Función para formatear números como moneda
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN',
        minimumFractionDigits: 2
    }).format(amount);
}

// Configuración del WebSocket
// 

socket.onmessage = function(event) {
    const message = JSON.parse(event.data); // El objeto con "type" y "data"
    console.log("Stock update:", message);

    // Accedemos a la info dentro de message.data
    const stockData = message.data;

    toastr.options = {
    "closeButton": false,
    "debug": false,
    "newestOnTop": true,
    "progressBar": false,
    "positionClass": "toast-top-right",
    "preventDuplicates": true,
    "showDuration": "300",
    "hideDuration": "1000",
    "timeOut": "4000",
    "extendedTimeOut": "1000",
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",  // Toastr default (we'll override with animate.css)
    "hideMethod": "fadeOut"
};

    toastr.info(`El producto ${stockData.name} ahora tiene ${stockData.current_stock} 📦 unidades.`, 'Actualización de Stock');

    dt_products.ajax.url(urldata).load();

    // Recargar datos analíticos cuando llega actualización
    loadInventoryData();
};


// Función para formatear números
function formatNumber(num) {
    return new Intl.NumberFormat('es-PE').format(num);
}

// Función para calcular analytics de los productos
function calculateAnalytics(products) {
    const totalProducts = products.length;
    const activeProducts = products.filter(p => p.is_active).length;
    const inactiveProducts = totalProducts - activeProducts;
    
    // Análisis de stock
    const lowStockProducts = products.filter(p => 
        p.stock_current > 0 && p.stock_current <= p.stock_minimum
    );
    const outOfStockProducts = products.filter(p => p.stock_current === 0);
    const inStockProducts = products.filter(p => 
        p.stock_current > p.stock_minimum
    );
    
    // Análisis financiero
    const totalInventoryValue = products.reduce((sum, p) => 
        sum + (parseFloat(p.price || 0) * (p.stock_current || 0)), 0
    );
    
    // Análisis por categoría
    const categoryStats = products.reduce((acc, p) => {
        const catName = p.category_name || 'Sin categoría';
        if (!acc[catName]) {
            acc[catName] = {
                name: catName,
                count: 0,
                totalValue: 0,
                lowStock: 0,
                outOfStock: 0
            };
        }
        acc[catName].count++;
        acc[catName].totalValue += parseFloat(p.price || 0) * (p.stock_current || 0);
        if (p.stock_current === 0) acc[catName].outOfStock++;
        if (p.stock_current > 0 && p.stock_current <= p.stock_minimum) acc[catName].lowStock++;
        return acc;
    }, {});

    return {
        totalProducts,
        activeProducts,
        inactiveProducts,
        lowStockProducts: lowStockProducts.length,
        outOfStockProducts: outOfStockProducts.length,
        inStockProducts: inStockProducts.length,
        totalInventoryValue,
        categoryStats: Object.values(categoryStats),
        lowStockItems: lowStockProducts,
        outOfStockItems: outOfStockProducts
    };
}

// Función para animar números
function animateCountUp(element, target, duration = 1000, formatter = null) {
    const startTime = performance.now();
    const startValue = 0;
    
    function updateCount(currentTime) {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        
        // Easing function - easeOutQuad
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        
        const currentValue = Math.floor(startValue + (target - startValue) * easedProgress);
        
        element.textContent = formatter 
            ? formatter(currentValue) 
            : currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(updateCount);
        } else {
            element.textContent = formatter 
                ? formatter(target) 
                : target;
        }
    }
    
    requestAnimationFrame(updateCount);
}

// Función para actualizar la UI con los datos
function updateDashboard(analytics) {
    // Total de productos con animación
    animateCountUp(
        document.getElementById('totalProducts'), 
        analytics.totalProducts, 
        800, 
        formatNumber
    );
    
    // Valor del inventario con animación
    animateCountUp(
        document.getElementById('inventoryValue'), 
        analytics.totalInventoryValue, 
        1000, 
        formatCurrency
    );
    
    // Stock bajo con animación
    animateCountUp(
        document.getElementById('lowStockCount'), 
        analytics.lowStockProducts, 
        600, 
        formatNumber
    );
    
    // Sin stock con animación
    animateCountUp(
        document.getElementById('outOfStockCount'), 
        analytics.outOfStockProducts, 
        600, 
        formatNumber
    );
    
    // Los textos que no son números pueden quedarse igual
    document.getElementById('activeProducts').textContent = `${analytics.activeProducts} activos`;
    document.getElementById('inventoryCount').textContent = `${analytics.totalProducts} productos`;
    document.getElementById('lowStockText').textContent = analytics.lowStockProducts === 1 ? 'producto' : 'productos';
    document.getElementById('outOfStockText').textContent = analytics.outOfStockProducts === 1 ? 'producto' : 'productos';
    
    // Actualizar badges con tendencias (simuladas)
    updateTrendBadges(analytics);
}

// Función para actualizar badges de tendencia
function updateTrendBadges(analytics) {
    const productsTrendBadge = document.getElementById('productsTrend');
    const valueTrendBadge = document.getElementById('valueTrend');
    const lowStockBadge = document.getElementById('lowStockTrend');
    const outOfStockBadge = document.getElementById('outOfStockTrend');
    
    // Simulamos tendencias (en producción, estas vendrían de datos históricos)
    const productsTrend = Math.floor(Math.random() * 20) - 10; // -10 a +10
    const valueTrend = Math.floor(Math.random() * 30) - 15; // -15 a +15
    
    // Actualizar badge de productos
    productsTrendBadge.textContent = `${productsTrend > 0 ? '+' : ''}${productsTrend}%`;
    productsTrendBadge.className = `badge rounded-pill ${productsTrend >= 0 ? 'bg-label-success' : 'bg-label-danger'}`;
    
    // Actualizar badge de valor
    valueTrendBadge.textContent = `${valueTrend > 0 ? '+' : ''}${valueTrend}%`;
    valueTrendBadge.className = `badge rounded-pill ${valueTrend >= 0 ? 'bg-label-success' : 'bg-label-danger'}`;
    
    // Actualizar badge de stock bajo
    if (analytics.lowStockProducts === 0) {
        lowStockBadge.textContent = 'OK';
        lowStockBadge.className = 'badge rounded-pill bg-label-success';
    } else {
        lowStockBadge.textContent = 'Alerta';
        lowStockBadge.className = 'badge rounded-pill bg-label-warning';
    }
    
    // Actualizar badge de sin stock
    if (analytics.outOfStockProducts === 0) {
        outOfStockBadge.textContent = 'OK';
        outOfStockBadge.className = 'badge rounded-pill bg-label-success';
    } else {
        outOfStockBadge.textContent = 'Crítico';
        outOfStockBadge.className = 'badge rounded-pill bg-label-danger';
    }
}

// Función principal para cargar datos
async function loadInventoryData() {
    try {
        // Intentar cargar desde el endpoint de analytics primero
        let analytics;
        try {
            const analyticsResponse = await fetch(ANALYTICS_ENDPOINT);
            if (analyticsResponse.ok) {
                analytics = await analyticsResponse.json();
            } else {
                throw new Error('Analytics endpoint not available');
            }
        } catch (error) {
            console.log('Analytics endpoint not available, calculating from products data...');
            
            // Si no existe el endpoint de analytics, cargar productos y calcular
            const productsResponse = await fetch(PRODUCTS_ENDPOINT);
            if (!productsResponse.ok) {
                throw new Error(`Error al cargar productos: ${productsResponse.status}`);
            }
            
            const productsData = await productsResponse.json();
            const products = productsData.data || productsData; // Manejar diferentes estructuras de respuesta
            analytics = calculateAnalytics(products);
        }
        
        // Actualizar dashboard
        updateDashboard(analytics);
        
        console.log('Dashboard actualizado exitosamente', analytics);
        
    } catch (error) {
        console.error('Error al cargar datos del inventario:', error);
        
        // Mostrar datos de ejemplo en caso de error
        const fallbackAnalytics = {
            totalProducts: 5,
            activeProducts: 3,
            lowStockProducts: 2,
            outOfStockProducts: 1,
            totalInventoryValue: 15000
        };
        updateDashboard(fallbackAnalytics);
    }
}

// Función para refrescar datos (puede ser llamada desde un botón)
function refreshInventoryData() {
    loadInventoryData();
}

// Cargar datos cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    loadInventoryData();
    
    // Actualizar datos cada 5 minutos
    setInterval(loadInventoryData, 5 * 60 * 1000);
});

// Función global para refrescar (para usar en botones)
window.refreshInventoryData = refreshInventoryData;

// Agregar estilos CSS adicionales
// const additionalStyles = `
// <style>
// .bg-label-success {
//     background-color: rgba(40, 167, 69, 0.1) !important;
//     color: #28a745 !important;
// }

// .bg-label-danger {
//     background-color: rgba(220, 53, 69, 0.1) !important;
//     color: #dc3545 !important;
// }

// .bg-label-warning {
//     background-color: rgba(255, 193, 7, 0.1) !important;
//     color: #ffc107 !important;
// }

// .bg-label-info {
//     background-color: rgba(23, 162, 184, 0.1) !important;
//     color: #17a2b8 !important;
// }
// </style>
// `;

// Insertar estilos adicionales
// document.head.insertAdjacentHTML('beforeend', additionalStyles);