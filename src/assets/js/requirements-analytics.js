/**
 * Requirements Analytics Module
 * Maneja las analíticas y estadísticas de requerimientos
 */

'use strict';

const RequirementsAnalytics = {
  // Configuración
  config: {
    apiEndpoint: '/api/requirements/dashboard_analytics/',
    refreshInterval: 5 * 60 * 1000, // 5 minutos
    animationDuration: 1000
  },

  // Elementos del DOM
  elements: {
    totalRequirements: document.getElementById('totalRequirements'),
    pendingRequirements: document.getElementById('pendingRequirements'),
    approvedRequirements: document.getElementById('approvedRequirements'),
    completedRequirements: document.getElementById('completedRequirements'),
    activeRequirements: document.getElementById('activeRequirements'),
    pendingPercentage: document.getElementById('pendingPercentage'),
    approvedText: document.getElementById('approvedText'),
    completedText: document.getElementById('completedText')
  },

  /**
   * Inicializar el módulo de analíticas
   */
  init() {
    this.loadAnalytics();
    this.setupRefreshInterval();
    console.log('Requirements Analytics initialized');
  },

  /**
   * Cargar datos de analíticas
   */
  async loadAnalytics() {
    try {
      const response = await fetch(this.config.apiEndpoint);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const analytics = await response.json();
      this.updateUI(analytics);
      console.log('Analytics loaded:', analytics);
    } catch (error) {
      console.error('Error loading requirements analytics:', error);
      this.showFallbackData();
    }
  },

  /**
   * Actualizar la interfaz con los datos de analíticas
   */
  updateUI(analytics) {
    // Animar contadores principales
    this.animateCounter(this.elements.totalRequirements, analytics.total_requirements);
    this.animateCounter(this.elements.pendingRequirements, analytics.pending_requirements);
    this.animateCounter(this.elements.approvedRequirements, analytics.approved_requirements);
    this.animateCounter(this.elements.completedRequirements, analytics.completed_requirements);

    // Actualizar textos descriptivos
    this.updateDescriptiveTexts(analytics);

    // Actualizar badges de tendencias
    this.updateTrendBadges(analytics);
  },

  /**
   * Animar contador con efecto de incremento
   */
  animateCounter(element, target, duration = this.config.animationDuration) {
    if (!element) return;

    const startTime = performance.now();
    const startValue = 0;

    const updateCount = currentTime => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);

      // Easing function - easeOutQuart
      const easedProgress = 1 - Math.pow(1 - progress, 4);

      const currentValue = Math.floor(startValue + (target - startValue) * easedProgress);
      element.textContent = this.formatNumber(currentValue);

      if (progress < 1) {
        requestAnimationFrame(updateCount);
      } else {
        element.textContent = this.formatNumber(target);
      }
    };

    requestAnimationFrame(updateCount);
  },

  /**
   * Actualizar textos descriptivos
   */
  updateDescriptiveTexts(analytics) {
    const total = analytics.total_requirements || 0;
    const active = analytics.pending_requirements + analytics.approved_requirements;

    if (this.elements.activeRequirements) {
      this.elements.activeRequirements.textContent = `${active} activos`;
    }

    if (this.elements.pendingPercentage && total > 0) {
      const percentage = Math.round((analytics.pending_requirements / total) * 100);
      this.elements.pendingPercentage.textContent = `${percentage}% del total`;
    }

    if (this.elements.approvedText) {
      this.elements.approvedText.textContent = analytics.approved_requirements > 0 ? 'En proceso' : 'Sin aprobar';
    }

    if (this.elements.completedText) {
      this.elements.completedText.textContent = analytics.completed_requirements > 0 ? 'Finalizados' : 'Sin completar';
    }
  },

  /**
   * Actualizar badges de tendencias
   */
  updateTrendBadges(analytics) {
    // Aquí puedes agregar lógica para mostrar tendencias
    // Por ejemplo, comparar con datos anteriores si están disponibles
    const badges = {
      requirementsTrend: document.getElementById('requirementsTrend'),
      pendingTrend: document.getElementById('pendingTrend'),
      approvedTrend: document.getElementById('approvedTrend'),
      completedTrend: document.getElementById('completedTrend')
    };

    // Simular tendencias (en producción usarías datos históricos)
    if (badges.requirementsTrend) {
      badges.requirementsTrend.textContent = '📋';
      badges.requirementsTrend.className = 'badge rounded-pill bg-label-info';
    }

    if (badges.pendingTrend) {
      badges.pendingTrend.textContent = '⏳';
      badges.pendingTrend.className = `badge rounded-pill ${
        analytics.pending_requirements > 0 ? 'bg-label-warning' : 'bg-label-success'
      }`;
    }

    if (badges.approvedTrend) {
      badges.approvedTrend.textContent = '✅';
      badges.approvedTrend.className = 'badge rounded-pill bg-label-success';
    }

    if (badges.completedTrend) {
      badges.completedTrend.textContent = '🎯';
      badges.completedTrend.className = 'badge rounded-pill bg-label-success';
    }
  },

  /**
   * Mostrar datos de respaldo en caso de error
   */
  showFallbackData() {
    const fallbackData = {
      total_requirements: 0,
      pending_requirements: 0,
      approved_requirements: 0,
      completed_requirements: 0
    };

    this.updateUI(fallbackData);
  },

  /**
   * Formatear números para mostrar
   */
  formatNumber(num) {
    return new Intl.NumberFormat('es-PE').format(num);
  },

  /**
   * Configurar intervalo de actualización automática
   */
  setupRefreshInterval() {
    setInterval(() => {
      this.loadAnalytics();
    }, this.config.refreshInterval);
  },

  /**
   * Refrescar datos manualmente
   */
  refresh() {
    console.log('Refreshing requirements analytics...');
    this.loadAnalytics();
  },

  /**
   * Obtener estadísticas específicas por estado
   */
  async getStatusStatistics() {
    try {
      const response = await fetch('/api/requirements/by_status/');
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error('Error loading status statistics:', error);
    }
    return null;
  },

  /**
   * Obtener mis requerimientos (usuario actual)
   */
  async getMyRequirements() {
    try {
      const response = await fetch('/api/requirements/my_requirements/');
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error('Error loading my requirements:', error);
    }
    return null;
  }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
  RequirementsAnalytics.init();
});

// Hacer el módulo disponible globalmente
window.RequirementsAnalytics = RequirementsAnalytics;
