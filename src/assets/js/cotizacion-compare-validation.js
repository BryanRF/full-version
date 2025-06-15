/**
 * Excel Validation Service
 * Valida archivos Excel antes de subir al servidor
 */

'use strict';

const ExcelValidationService = {
    // Configuración de validación según template oficial
    config: {
        expectedColumns: [
            'CÓDIGO',           // A
            'PRODUCTO',         // B
            'CATEGORÍA',        // C
            'CANT. SOLICITADA', // D
            'UNIDAD',          // E
            'CANT. DISPONIBLE', // F
            'PRECIO U.',       // G - CRÍTICO
            'PRECIO TOTAL',    // H
            'OBSERVACIONES'    // I
        ],
        criticalColumns: ['CÓDIGO', 'PRECIO U.'],
        minValidRows: 1,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedExtensions: ['.xlsx', '.xls']
    },

    /**
     * Validar archivo Excel antes de subir
     */
    async validateExcelFile(file, productCodes = []) {
        const result = {
            valid: false,
            errors: [],
            warnings: [],
            suggestions: [],
            data: null,
            summary: {
                totalRows: 0,
                validRows: 0,
                invalidCodes: 0,
                missingPrices: 0,
                validPrices: 0
            }
        };

        try {
            // Validaciones básicas del archivo
            const basicValidation = this.validateBasicFile(file);
            if (!basicValidation.valid) {
                result.errors.push(...basicValidation.errors);
                return result;
            }

            // Leer archivo Excel
            const excelData = await this.readExcelFile(file);
            if (!excelData) {
                result.errors.push('No se pudo leer el archivo Excel');
                return result;
            }

            // Validar estructura
            const structureValidation = this.validateStructure(excelData);
            if (!structureValidation.valid) {
                result.errors.push(...structureValidation.errors);
                result.suggestions.push(...structureValidation.suggestions);
                return result;
            }

            // Validar contenido
            const contentValidation = this.validateContent(excelData, productCodes);
            result.errors.push(...contentValidation.errors);
            result.warnings.push(...contentValidation.warnings);
            result.summary = contentValidation.summary;

            // Determinar si es válido
            result.valid = result.errors.length === 0 && contentValidation.summary.validRows > 0;
            result.data = excelData;

            // Generar resumen
            if (result.valid) {
                result.suggestions.push(
                    `✅ Archivo válido: ${contentValidation.summary.validRows} productos listos para procesar`
                );
            }

            return result;

        } catch (error) {
            console.error('Error validating Excel:', error);
            result.errors.push(`Error leyendo archivo: ${error.message}`);
            return result;
        }
    },

    /**
     * Validaciones básicas del archivo
     */
    validateBasicFile(file) {
        const result = { valid: true, errors: [] };

        // Validar que existe el archivo
        if (!file) {
            result.errors.push('No se seleccionó ningún archivo');
            result.valid = false;
            return result;
        }

        // Validar tamaño
        if (file.size > this.config.maxFileSize) {
            result.errors.push(
                `Archivo muy grande (${(file.size / 1024 / 1024).toFixed(1)}MB). ` +
                `Tamaño máximo: ${this.config.maxFileSize / 1024 / 1024}MB`
            );
            result.valid = false;
        }

        // Validar extensión
        const fileName = file.name.toLowerCase();
        const hasValidExtension = this.config.allowedExtensions.some(ext => 
            fileName.endsWith(ext)
        );

        if (!hasValidExtension) {
            result.errors.push(
                `Formato no válido. Solo se permiten: ${this.config.allowedExtensions.join(', ')}`
            );
            result.valid = false;
        }

        return result;
    },

    /**
     * Leer archivo Excel usando SheetJS
     */
    async readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // Tomar la primera hoja
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    
                    // Convertir a JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                        header: 1,
                        defval: '',
                        raw: false
                    });
                    
                    resolve({
                        headers: jsonData[0] || [],
                        rows: jsonData.slice(1) || []
                    });
                    
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Error leyendo archivo'));
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Validar estructura de columnas
     */
    async loadProductCodes() {
    try {
        const response = await fetch(`/api/cotizacion/envios/${this.config.envioId}/get_requirement_products/`);
        if (response.ok) {
            const data = await response.json();
            this.config.productCodes = data.products.map(p => p.code);
            console.log('Product codes loaded:', this.config.productCodes);
        }
    } catch (error) {
        console.error('Error loading product codes:', error);
    }
},

    validateStructure(excelData) {
        const result = { 
            valid: true, 
            errors: [], 
            suggestions: []
        };

        const { headers } = excelData;

        // Verificar cantidad de columnas
        if (headers.length < this.config.expectedColumns.length) {
            result.errors.push(
                `Faltan columnas. Se esperan ${this.config.expectedColumns.length}, ` +
                `se encontraron ${headers.length}`
            );
            result.valid = false;
        }

        // Validar cada columna en su posición
        const missingColumns = [];
        const wrongPositions = [];

        this.config.expectedColumns.forEach((expectedCol, index) => {
            if (index < headers.length) {
                const actualCol = this.cleanColumnName(headers[index]);
                const expectedClean = this.cleanColumnName(expectedCol);

                if (!this.columnsMatch(expectedClean, actualCol)) {
                    // Buscar si está en otra posición
                    const foundIndex = headers.findIndex(h => 
                        this.columnsMatch(expectedClean, this.cleanColumnName(h))
                    );

                    if (foundIndex !== -1) {
                        wrongPositions.push(
                            `'${expectedCol}' está en columna ${this.getColumnLetter(foundIndex)} ` +
                            `pero debería estar en ${this.getColumnLetter(index)}`
                        );
                    } else {
                        missingColumns.push(expectedCol);
                    }
                }
            } else {
                missingColumns.push(expectedCol);
            }
        });

        // Reportar errores
        if (missingColumns.length > 0) {
            result.errors.push(`Columnas faltantes: ${missingColumns.join(', ')}`);
            result.valid = false;
        }

        if (wrongPositions.length > 0) {
            result.errors.push(`Columnas en posición incorrecta: ${wrongPositions.join('; ')}`);
            result.valid = false;
        }

        // Validar columnas críticas específicamente
        this.config.criticalColumns.forEach((criticalCol, index) => {
            const expectedIndex = this.config.expectedColumns.indexOf(criticalCol);
            if (expectedIndex < headers.length) {
                const actualCol = this.cleanColumnName(headers[expectedIndex]);
                const expectedClean = this.cleanColumnName(criticalCol);

                if (!this.columnsMatch(expectedClean, actualCol)) {
                    result.errors.push(
                        `CRÍTICO: Columna '${criticalCol}' no encontrada en posición ${this.getColumnLetter(expectedIndex)} `+
                        `(${expectedIndex + 1}). Encontrada: '${headers[expectedIndex]}'`
                    );
                    result.valid = false;
                }
            }
        });

        // Agregar sugerencias
        if (!result.valid) {
            result.suggestions.push('Estructura esperada del Excel:');
            this.config.expectedColumns.forEach((col, index) => {
                result.suggestions.push(`  ${this.getColumnLetter(index)} (${index + 1}): ${col}`);
            });
        }

        return result;
    },

    /**
     * Validar contenido de las filas
     */
    validateContent(excelData, productCodes = []) {
        const result = {
            errors: [],
            warnings: [],
            summary: {
                totalRows: 0,
                validRows: 0,
                invalidCodes: 0,
                missingPrices: 0,
                validPrices: 0
            }
        };

        const { rows } = excelData;
        const codigoIndex = 0; // Columna A
        const precioIndex = 6; // Columna G

        // Crear set de códigos válidos para búsqueda rápida
        const validCodes = new Set(productCodes.map(code => code.toUpperCase()));
        if (validCodes.size === 0) {
            console.warn('No product codes available for validation');
            // Skip code validation if no codes available
        }
        let validRowCount = 0;
        let invalidCodeCount = 0;
        let missingPriceCount = 0;
        let validPriceCount = 0;

        rows.forEach((row, index) => {
    const rowNum = index + 2;
    let isValidRow = true;

    // Validar código
    const codigo = this.cleanValue(row[codigoIndex]);
    
    // SALTAR filas completamente vacías
    if (!codigo && !this.cleanValue(row[precioIndex])) {
        return; // Skip empty rows
    }
    
    if (!codigo) {
        result.warnings.push(`Fila ${rowNum}: Código vacío`);
        isValidRow = false;
    } else if (validCodes.size > 0 && !validCodes.has(codigo.toUpperCase())) {
    console.log(`Checking code: '${codigo}', Valid codes:`, Array.from(validCodes));
                result.warnings.push(`Fila ${rowNum}: Código '${codigo}' no encontrado en el sistema`);
                invalidCodeCount++;
                isValidRow = false;
            }

            // Validar precio
            const precioRaw = this.cleanValue(row[precioIndex]);
            if (!precioRaw) {
                result.warnings.push(`Fila ${rowNum}: Precio vacío`);
                missingPriceCount++;
                isValidRow = false;
            } else {
                const precio = this.parsePrice(precioRaw);
                if (precio === null || precio <= 0) {
                    result.warnings.push(`Fila ${rowNum}: Precio inválido '${precioRaw}'`);
                    isValidRow = false;
                } else {
                    validPriceCount++;
                }
            }

            if (isValidRow) {
                validRowCount++;
            }
        });

        // Actualizar resumen
        const nonEmptyRows = rows.filter(row => {
            const codigo = this.cleanValue(row[codigoIndex]);
            const precio = this.cleanValue(row[precioIndex]);
            return codigo || precio; // Si tiene código O precio, contar
        });

        result.summary.totalRows = nonEmptyRows.length;
        result.summary.validRows = validRowCount;
        result.summary.invalidCodes = invalidCodeCount;
        result.summary.missingPrices = missingPriceCount;
        result.summary.validPrices = validPriceCount;

        // Validaciones críticas
        if (result.summary.totalRows === 0) {
            result.errors.push('El archivo no contiene filas de datos');
        } else if (result.summary.validRows === 0) {
            result.errors.push('No hay filas válidas para procesar');
        } else if (result.summary.validRows < result.summary.totalRows * 0.5) {
            result.warnings.push(
                `Solo ${result.summary.validRows} de ${result.summary.totalRows} filas son válidas (${Math.round((result.summary.validRows / result.summary.totalRows) * 100)}%)`
            );
        }

        return result;
    },

    /**
     * Utilidades auxiliares
     */
    cleanColumnName(name) {
        if (!name) return '';
        return String(name).trim().toUpperCase();
    },

    cleanValue(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim();
    },

    columnsMatch(expected, actual) {
        if (!expected || !actual) return false;
        
        const expectedClean = expected.replace(/[^\w]/g, '');
        const actualClean = actual.replace(/[^\w]/g, '');
        
        return expectedClean === actualClean;
    },

    getColumnLetter(index) {
        return String.fromCharCode(65 + index); // A, B, C, etc.
    },

    parsePrice(priceStr) {
        if (!priceStr) return null;
        
        try {
            // Limpiar formato
            const cleaned = String(priceStr)
                .replace(/[S\/\.\s,]/g, '')
                .replace(/[^\d\.]/g, '');
            
            const price = parseFloat(cleaned);
            return isNaN(price) ? null : price;
        } catch {
            return null;
        }
    },

    /**
     * Obtener códigos de productos desde el backend
     */
    async fetchProductCodes() {
        try {
            const response = await fetch('/api/products/data/?status=1');
            if (response.ok) {
                const data = await response.json();
                return data.data.map(product => product.code);
            }
            return [];
        } catch (error) {
            console.error('Error fetching product codes:', error);
            return [];
        }
    },

    /**
     * Generar reporte de validación HTML
     */
    generateValidationReport(validationResult) {
        const { valid, errors, warnings, suggestions, summary } = validationResult;
        
        let html = '<div class="validation-report">';
        
        // Estado general
        html += `<div class="alert alert-${valid ? 'success' : 'danger'} mb-3">`;
        html += `<h6><i class="ri-${valid ? 'check' : 'close'}-circle-line me-2"></i>`;
        html += `${valid ? 'Archivo Válido' : 'Archivo No Válido'}</h6>`;
        html += '</div>';

        // Resumen
        if (summary && summary.totalRows > 0) {
            html += '<div class="card mb-3"><div class="card-body">';
            html += '<h6>Resumen:</h6>';
            html += '<div class="row">';
            html += `<div class="col-md-3 text-center">
                        <div class="text-primary"><strong>${summary.totalRows}</strong></div>
                        <small>Total Filas</small>
                     </div>`;
            html += `<div class="col-md-3 text-center">
                        <div class="text-success"><strong>${summary.validRows}</strong></div>
                        <small>Filas Válidas</small>
                     </div>`;
            html += `<div class="col-md-3 text-center">
                        <div class="text-info"><strong>${summary.validPrices}</strong></div>
                        <small>Precios Válidos</small>
                     </div>`;
            html += `<div class="col-md-3 text-center">
                        <div class="text-warning"><strong>${summary.invalidCodes}</strong></div>
                        <small>Códigos Inválidos</small>
                     </div>`;
            html += '</div></div></div>';
        }

        // Errores
        if (errors.length > 0) {
            html += '<div class="card mb-3"><div class="card-body">';
            html += '<h6 class="text-danger"><i class="ri-error-warning-line me-2"></i>Errores:</h6>';
            html += '<ul class="mb-0">';
            errors.forEach(error => {
                html += `<li class="text-danger">${error}</li>`;
            });
            html += '</ul></div></div>';
        }

        // Advertencias
        if (warnings.length > 0) {
            html += '<div class="card mb-3"><div class="card-body">';
            html += '<h6 class="text-warning"><i class="ri-alert-line me-2"></i>Advertencias:</h6>';
            html += '<ul class="mb-0">';
            warnings.slice(0, 10).forEach(warning => { // Mostrar solo primeras 10
                html += `<li class="text-warning">${warning}</li>`;
            });
            if (warnings.length > 10) {
                html += `<li class="text-muted">... y ${warnings.length - 10} más</li>`;
            }
            html += '</ul></div></div>';
        }

        // Sugerencias
        if (suggestions.length > 0) {
            html += '<div class="card"><div class="card-body">';
            html += '<h6 class="text-info"><i class="ri-information-line me-2"></i>Sugerencias:</h6>';
            html += '<ul class="mb-0">';
            suggestions.forEach(suggestion => {
                html += `<li class="text-info">${suggestion}</li>`;
            });
            html += '</ul></div></div>';
        }

        html += '</div>';
        return html;
    }
};

// Hacer disponible globalmente
window.ExcelValidationService = ExcelValidationService;