/**
 * App Suppliers Analytics
 */

'use strict';

const SUPPLIERS_API_BASE_URL = '/api/suppliers/';
const SUPPLIERS_ANALYTICS_ENDPOINT = `${SUPPLIERS_API_BASE_URL}dashboard_analytics/`;
const SUPPLIERS_DATA_ENDPOINT = `${SUPPLIERS_API_BASE_URL}data/`;

// Función para formatear números como moneda
function formatCurrency(amount) {
    // Asegurarse de que amount sea un número válido
    const numAmount = parseFloat(amount) || 0;
    return new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN',
        minimumFractionDigits: 2
    }).format(numAmount);
}

// Función para formatear números
function formatNumber(num) {
    // Asegurarse de que num sea un número válido
    const validNum = parseFloat(num) || 0;
    return new Intl.NumberFormat('es-PE').format(validNum);
}

// Función para animar números
function animateCountUp(element, target, duration = 1000, formatter = null) {
    const startTime = performance.now();
    const startValue = 0;
    
    // Asegurarse de que target sea un número válido
    const validTarget = parseFloat(target) || 0;
    
    function updateCount(currentTime) {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        
        // Easing function - easeOutQuad
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        
        const currentValue = Math.floor(startValue + (validTarget - startValue) * easedProgress);
        
        element.textContent = formatter 
            ? formatter(currentValue) 
            : currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(updateCount);
        } else {
            element.textContent = formatter 
                ? formatter(validTarget) 
                : validTarget;
        }
    }
    
    requestAnimationFrame(updateCount);
}

// Función para calcular analytics de los proveedores
function calculateSuppliersAnalytics(suppliers) {
    const totalSuppliers = suppliers.length || 0;
    const activeSuppliers = suppliers.filter(s => s.is_active).length || 0;
    const preferredSuppliers = suppliers.filter(s => s.is_preferred).length || 0;
    
    // Calcular límite de crédito total con manejo seguro de valores
    const totalCreditLimit = suppliers.reduce((sum, s) => {
        const creditLimit = parseFloat(s.credit_limit) || 0;
        return sum + creditLimit;
    }, 0);
    
    // Calcular calificación promedio con manejo seguro de valores
    const totalRating = suppliers.reduce((sum, s) => {
        const rating = parseFloat(s.rating) || 0;
        return sum + rating;
    }, 0);
    const averageRating = totalSuppliers > 0 ? (totalRating / totalSuppliers) : 0;
    
    // Análisis por categoría
    const categoryStats = suppliers.reduce((acc, s) => {
        const category = s.category || 'other';
        if (!acc[category]) {
            acc[category] = { count: 0, active: 0, preferred: 0 };
        }
        acc[category].count++;
        if (s.is_active) acc[category].active++;
        if (s.is_preferred) acc[category].preferred++;
        return acc;
    }, {});

    return {
        totalSuppliers,
        activeSuppliers,
        inactiveSuppliers: totalSuppliers - activeSuppliers,
        preferredSuppliers,
        totalCreditLimit,
        averageRating,
        categoryStats: Object.entries(categoryStats).map(([category, stats]) => ({
            category,
            ...stats
        }))
    };
}
// Función para actualizar la UI con los datos
function updateSuppliersAnalytics(analytics) {
    // Asegurarse de que analytics tenga valores válidos
    const safeAnalytics = {
        totalSuppliers: parseInt(analytics.total_suppliers || analytics.totalSuppliers) || 0,
        activeSuppliers: parseInt(analytics.active_suppliers || analytics.activeSuppliers) || 0,
        preferredSuppliers: parseInt(analytics.preferred_suppliers || analytics.preferredSuppliers) || 0,
        totalCreditLimit: parseFloat(analytics.total_credit_limit || analytics.totalCreditLimit) || 0,
        averageRating: parseFloat(analytics.average_rating || analytics.averageRating) || 0
    };

    // Total de proveedores con animación
    const totalElement = document.getElementById('totalSuppliers');
    if (totalElement) {
        animateCountUp(totalElement, safeAnalytics.totalSuppliers, 800, formatNumber);
    }
    
    // Proveedores preferidos con animación
    const preferredElement = document.getElementById('preferredSuppliers');
    if (preferredElement) {
        animateCountUp(preferredElement, safeAnalytics.preferredSuppliers, 600, formatNumber);
    }
    
    // Límite de crédito total con animación
    const creditElement = document.getElementById('totalCreditLimit');
    if (creditElement) {
        animateCountUp(creditElement, safeAnalytics.totalCreditLimit, 1000, 
            (value) => 'S/. ' + formatNumber(value));
    }
    
    // Calificación promedio
    const ratingElement = document.getElementById('averageRating');
    const ratingStarsElement = document.getElementById('ratingStars');
    if (ratingElement && ratingStarsElement) {
        const roundedRating = Math.round(safeAnalytics.averageRating * 10) / 10;
        ratingElement.textContent = roundedRating.toFixed(1);
        
        const fullStars = Math.floor(roundedRating);
        const stars = '⭐'.repeat(fullStars) + '☆'.repeat(5 - fullStars);
        ratingStarsElement.textContent = stars;
    }
    
    // Actualizar textos descriptivos
    const activeElement = document.getElementById('activeSuppliers');
    if (activeElement) {
        activeElement.textContent = `${safeAnalytics.activeSuppliers} activos`;
    }
    
    const preferredPercentageElement = document.getElementById('preferredPercentage');
    if (preferredPercentageElement && safeAnalytics.totalSuppliers > 0) {
        const percentage = Math.round((safeAnalytics.preferredSuppliers / safeAnalytics.totalSuppliers) * 100);
        preferredPercentageElement.textContent = `${percentage}% del total`;
    }
    
    const creditTextElement = document.getElementById('creditText');
    if (creditTextElement) {
        creditTextElement.textContent = safeAnalytics.totalCreditLimit > 0 ? 'Total disponible' : 'Sin límites';
    }
    
    // Actualizar badges con tendencias (simuladas)
    updateSupplierTrendBadges(safeAnalytics);
}
// Función para actualizar badges de tendencia
function updateSupplierTrendBadges(analytics) {
    const suppliersTrendBadge = document.getElementById('suppliersTrend');
    const preferredTrendBadge = document.getElementById('preferredTrend');
    const creditTrendBadge = document.getElementById('creditTrend');
    const ratingTrendBadge = document.getElementById('ratingTrend');
    
    if (suppliersTrendBadge) {
        // Simulamos tendencias (en producción, estas vendrían de datos históricos)
        const suppliersTrend = Math.floor(Math.random() * 20) - 10; // -10 a +10
        suppliersTrendBadge.textContent = `${suppliersTrend > 0 ? '+' : ''}${suppliersTrend}%`;
        suppliersTrendBadge.className = `badge rounded-pill ${suppliersTrend >= 0 ? 'bg-label-success' : 'bg-label-danger'}`;
    }
    
    if (preferredTrendBadge) {
        preferredTrendBadge.textContent = '⭐';
        preferredTrendBadge.className = 'badge rounded-pill bg-label-warning';
    }
    
    if (creditTrendBadge) {
        creditTrendBadge.textContent = '💳';
        creditTrendBadge.className = 'badge rounded-pill bg-label-info';
    }
    
    if (ratingTrendBadge) {
        ratingTrendBadge.textContent = '📊';
        ratingTrendBadge.className = 'badge rounded-pill bg-label-success';
    }
}

// Función principal para cargar datos de proveedores
async function loadSuppliersData() {
    try {
        // Intentar cargar desde el endpoint de analytics primero
        let analytics;
        try {
            const analyticsResponse = await fetch(SUPPLIERS_ANALYTICS_ENDPOINT);
            if (analyticsResponse.ok) {
                analytics = await analyticsResponse.json();
                console.log('Analytics from endpoint:', analytics);
            } else {
                throw new Error('Analytics endpoint not available');
            }
        } catch (error) {
            console.log('Analytics endpoint not available, calculating from suppliers data...');
            
            // Si no existe el endpoint de analytics, cargar proveedores y calcular
            const suppliersResponse = await fetch(SUPPLIERS_DATA_ENDPOINT);
            if (!suppliersResponse.ok) {
                throw new Error(`Error al cargar proveedores: ${suppliersResponse.status}`);
            }
            
            const suppliersData = await suppliersResponse.json();
            const suppliers = suppliersData.data || suppliersData;
            analytics = calculateSuppliersAnalytics(suppliers);
            console.log('Calculated analytics:', analytics);
        }
        
        // Actualizar dashboard
        updateSuppliersAnalytics(analytics);
        
        console.log('Suppliers dashboard actualizado exitosamente', analytics);
        
    } catch (error) {
        console.error('Error al cargar datos de proveedores:', error);
        
        // Mostrar datos de ejemplo en caso de error
        const fallbackAnalytics = {
            totalSuppliers: 0,
            activeSuppliers: 0,
            preferredSuppliers: 0,
            totalCreditLimit: 0,
            averageRating: 0
        };
        updateSuppliersAnalytics(fallbackAnalytics);
    }
}

// Función para refrescar datos (puede ser llamada desde un botón)
function refreshSuppliersData() {
    loadSuppliersData();
}

// Función para obtener estadísticas por categoría
async function loadCategoryStatistics() {
    try {
        const response = await fetch(`${SUPPLIERS_API_BASE_URL}by_category/`);
        if (response.ok) {
            const data = await response.json();
            console.log('Category statistics:', data);
            // Aquí podrías actualizar un gráfico o tabla con las estadísticas por categoría
            return data;
        }
    } catch (error) {
        console.error('Error loading category statistics:', error);
    }
}

// Función para obtener estadísticas generales
async function loadSupplierStatistics() {
    try {
        const response = await fetch(`${SUPPLIERS_API_BASE_URL}statistics/`);
        if (response.ok) {
            const data = await response.json();
            console.log('Supplier statistics:', data);
            return data;
        }
    } catch (error) {
        console.error('Error loading supplier statistics:', error);
    }
}

// Cargar datos cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    // Esperar un poco para asegurar que los elementos del DOM estén listos
    setTimeout(() => {
        loadSuppliersData();
        loadCategoryStatistics();
        loadSupplierStatistics();
    }, 100);
    
    // Actualizar datos cada 5 minutos
    setInterval(loadSuppliersData, 5 * 60 * 1000);
});

// Funciones globales para usar en botones
window.refreshSuppliersData = refreshSuppliersData;
window.loadSuppliersData = loadSuppliersData;