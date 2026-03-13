// Configuración
const API_URL = window.location.origin;
const MAX_UBICACIONES = 5;
const COLORES = ['#2c3e50', '#e74c3c', '#3498db', '#9b59b6', '#f39c12'];

// Variables globales
let chart = null;
let ubicacionesDisponibles = {};  // Diccionario por nivel
let periodosDisponibles = [];
let ubicacionesActivas = 1;  // Contador de ubicaciones añadidas
let _tooltipOutsideHandler = null;  // Referencia al handler para poder eliminarlo

// Cargar tipologías desde la API
async function cargarTipologias() {
    try {
        const response = await fetch(`${API_URL}/api/mapa/tipologias`);
        const data = await response.json();

        const select = document.getElementById('tipologia');
        if (!select) return;

        select.innerHTML = '<option value="">Todos los delitos</option>';

        data.tipologias.forEach(tipologia => {
            const option = document.createElement('option');
            option.value = tipologia;
            option.textContent = tipologia;
            select.appendChild(option);
        });

        console.log('Tipologías cargadas:', data.tipologias.length);
    } catch (error) {
        console.error('Error cargando tipologías:', error);
    }
}

// Cargar periodos desde la API
async function cargarPeriodos() {
    try {
        const response = await fetch(`${API_URL}/api/mapa/periodos`);
        const data = await response.json();

        periodosDisponibles = data.periodos;

        const selectInicial = document.getElementById('periodo-inicial');
        const selectFinal = document.getElementById('periodo-final');

        if (!selectInicial || !selectFinal) return;

        selectInicial.innerHTML = '';
        selectFinal.innerHTML = '';

        // Ordenar periodos de más antiguo a más reciente para inicial
        const periodosOrdenados = [...periodosDisponibles].reverse();

        periodosOrdenados.forEach((periodo, index) => {
            const fecha = new Date(periodo);
            const textoFecha = fecha.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long'
            });

            const optionInicial = document.createElement('option');
            optionInicial.value = periodo;
            optionInicial.textContent = textoFecha;
            if (index === 0) optionInicial.selected = true;
            selectInicial.appendChild(optionInicial);

            const optionFinal = document.createElement('option');
            optionFinal.value = periodo;
            optionFinal.textContent = textoFecha;
            if (index === periodosOrdenados.length - 1) optionFinal.selected = true;
            selectFinal.appendChild(optionFinal);
        });

        console.log('Periodos cargados:', periodosDisponibles.length);
    } catch (error) {
        console.error('Error cargando periodos:', error);
    }
}

// Cargar ubicaciones para un nivel específico y cachearlas
async function cargarUbicacionesPorNivel(nivel) {
    // Si ya tenemos las ubicaciones cacheadas, retornarlas
    if (ubicacionesDisponibles[nivel]) {
        return ubicacionesDisponibles[nivel];
    }

    try {
        // Para nacional, no hay ubicaciones que seleccionar
        if (nivel === 'nacional') {
            ubicacionesDisponibles[nivel] = [{ geo: 'NACIONAL', nombre: 'España (Nacional)' }];
            return ubicacionesDisponibles[nivel];
        }

        // Usar el último periodo disponible para obtener la lista de ubicaciones
        const periodosResponse = await fetch(`${API_URL}/api/mapa/periodos`);
        const periodosData = await periodosResponse.json();
        const ultimoPeriodo = periodosData.periodos[0];

        const response = await fetch(`${API_URL}/api/mapa/delitos/agregado/${nivel}?periodo=${ultimoPeriodo}`);
        const data = await response.json();

        // Extraer ubicaciones únicas
        ubicacionesDisponibles[nivel] = data.datos.map(item => ({
            geo: item.geo,
            nombre: extraerNombreLegible(item.geo, nivel)
        })).sort((a, b) => a.nombre.localeCompare(b.nombre));

        console.log(`Ubicaciones ${nivel} cargadas:`, ubicacionesDisponibles[nivel].length);
        return ubicacionesDisponibles[nivel];
    } catch (error) {
        console.error('Error cargando ubicaciones:', error);
        return [];
    }
}

// Extraer nombre legible del campo geo
function extraerNombreLegible(geo, nivel) {
    if (!nivel) {
        if (geo.startsWith('CCAA')) {
            return geo.replace(/^CCAA \d+ /, '');
        } else if (geo.startsWith('Provincia')) {
            return geo.replace(/^Provincia \d+ /, '');
        } else if (geo === 'NACIONAL') {
            return 'España (Nacional)';
        } else if (/^\d+/.test(geo)) {
            return geo.replace(/^\d+ /, '');
        }
        return geo;
    }

    if (nivel === 'ccaa') {
        return geo.replace(/^CCAA \d+ /, '');
    } else if (nivel === 'provincia') {
        if (geo.startsWith('CCAA')) {
            return geo.replace(/^CCAA \d+ /, '');
        }
        return geo.replace(/^Provincia \d+ /, '');
    } else if (nivel === 'municipio') {
        return geo.replace(/^\d+ /, '');
    } else if (nivel === 'nacional') {
        return 'España (Nacional)';
    }
    return geo;
}

// Actualizar select de ubicación para un número dado
async function actualizarSelectUbicacion(numUbicacion) {
    const nivelSelect = document.getElementById(`nivel-geo-${numUbicacion}`);
    const ubicacionSelect = document.getElementById(`ubicacion${numUbicacion}`);

    if (!nivelSelect || !ubicacionSelect) return;

    const nivel = nivelSelect.value;
    const ubicaciones = await cargarUbicacionesPorNivel(nivel);

    // Limpiar select
    ubicacionSelect.innerHTML = '<option value="">Selecciona ubicación</option>';

    // Añadir opciones
    ubicaciones.forEach(ubicacion => {
        const option = document.createElement('option');
        option.value = ubicacion.geo;
        option.textContent = ubicacion.nombre;
        ubicacionSelect.appendChild(option);
    });
}

// Crear HTML para una nueva ubicación
function crearUbicacionHTML(numero) {
    const color = COLORES[numero - 1];
    const esOpcional = numero > 1;

    return `
        <div class="ubicacion-grupo" data-ubicacion="${numero}">
            <div class="ubicacion-header">
                <span class="ubicacion-numero" style="background: ${color};">${numero}</span>
                <span class="ubicacion-titulo">${esOpcional ? 'Comparar con' : 'Ubicación principal'}</span>
                ${esOpcional ? '<button type="button" class="btn-remove-ubicacion" onclick="eliminarUbicacion(' + numero + ')" title="Eliminar">✕</button>' : ''}
            </div>
            <div class="filtro-grupo">
                <label>Nivel geográfico:</label>
                <select id="nivel-geo-${numero}" class="nivel-select">
                    <option value="ccaa">Comunidades Autónomas</option>
                    <option value="provincia">Provincias</option>
                    <option value="municipio">Municipios</option>
                    <option value="nacional">Nacional</option>
                </select>
            </div>
            <div class="filtro-grupo">
                <select id="ubicacion${numero}" class="ubicacion-select">
                    <option value="">Selecciona ubicación</option>
                </select>
            </div>
        </div>
    `;
}

// Añadir nueva ubicación
async function agregarUbicacion() {
    if (ubicacionesActivas >= MAX_UBICACIONES) {
        return;
    }

    ubicacionesActivas++;
    const container = document.getElementById('ubicaciones-container');

    // Insertar nueva ubicación
    container.insertAdjacentHTML('beforeend', crearUbicacionHTML(ubicacionesActivas));

    // Configurar event listener para el nuevo selector de nivel
    const nivelSelect = document.getElementById(`nivel-geo-${ubicacionesActivas}`);
    const numActual = ubicacionesActivas;
    nivelSelect.addEventListener('change', function() {
        actualizarSelectUbicacion(numActual);
    });

    // Cargar ubicaciones para el nivel por defecto (ccaa)
    await actualizarSelectUbicacion(ubicacionesActivas);

    // Ocultar botón si llegamos al máximo
    if (ubicacionesActivas >= MAX_UBICACIONES) {
        document.getElementById('btn-add-ubicacion').classList.add('hidden');
    }

    console.log('Ubicaciones activas:', ubicacionesActivas);
}

// Eliminar una ubicación
function eliminarUbicacion(numero) {
    const grupo = document.querySelector(`.ubicacion-grupo[data-ubicacion="${numero}"]`);
    if (grupo) {
        grupo.remove();
    }

    // Renumerar las ubicaciones restantes
    renumerarUbicaciones();

    // Mostrar botón de añadir si estaba oculto
    document.getElementById('btn-add-ubicacion').classList.remove('hidden');
}

// Renumerar ubicaciones después de eliminar una
function renumerarUbicaciones() {
    const grupos = document.querySelectorAll('.ubicacion-grupo');
    ubicacionesActivas = grupos.length;

    grupos.forEach((grupo, index) => {
        const nuevoNumero = index + 1;
        const numeroAnterior = parseInt(grupo.dataset.ubicacion);

        if (nuevoNumero !== numeroAnterior) {
            grupo.dataset.ubicacion = nuevoNumero;

            // Actualizar número visual
            const numeroSpan = grupo.querySelector('.ubicacion-numero');
            numeroSpan.textContent = nuevoNumero;
            numeroSpan.style.background = COLORES[nuevoNumero - 1];

            // Actualizar título
            const titulo = grupo.querySelector('.ubicacion-titulo');
            titulo.textContent = nuevoNumero === 1 ? 'Ubicación principal' : 'Comparar con';

            // Actualizar o añadir botón de eliminar
            let btnRemove = grupo.querySelector('.btn-remove-ubicacion');
            if (nuevoNumero === 1 && btnRemove) {
                btnRemove.remove();
            } else if (nuevoNumero > 1 && !btnRemove) {
                const header = grupo.querySelector('.ubicacion-header');
                header.insertAdjacentHTML('beforeend',
                    `<button type="button" class="btn-remove-ubicacion" onclick="eliminarUbicacion(${nuevoNumero})" title="Eliminar">✕</button>`);
            } else if (btnRemove) {
                btnRemove.setAttribute('onclick', `eliminarUbicacion(${nuevoNumero})`);
            }

            // Actualizar IDs de los selects
            const nivelSelect = grupo.querySelector('.nivel-select');
            const ubicacionSelect = grupo.querySelector('.ubicacion-select');

            if (nivelSelect) {
                nivelSelect.id = `nivel-geo-${nuevoNumero}`;
            }
            if (ubicacionSelect) {
                ubicacionSelect.id = `ubicacion${nuevoNumero}`;
            }
        }
    });

    console.log('Ubicaciones después de renumerar:', ubicacionesActivas);
}

// Obtener todas las ubicaciones seleccionadas
function obtenerUbicacionesSeleccionadas() {
    const ubicaciones = [];

    for (let i = 1; i <= ubicacionesActivas; i++) {
        // La primera ubicación usa 'nivel-geo' sin número
        const nivelSelectId = i === 1 ? 'nivel-geo' : `nivel-geo-${i}`;
        const nivelSelect = document.getElementById(nivelSelectId);
        const ubicacionSelect = document.getElementById(`ubicacion${i}`);

        if (nivelSelect && ubicacionSelect && ubicacionSelect.value) {
            ubicaciones.push({
                nivel: nivelSelect.value,
                geo: ubicacionSelect.value,
                nombre: ubicacionSelect.options[ubicacionSelect.selectedIndex].text
            });
        }
    }

    return ubicaciones;
}

// Cargar datos de evolución y dibujar gráfico
async function cargarEvolucion() {
    const ubicaciones = obtenerUbicacionesSeleccionadas();
    const tipologia = document.getElementById('tipologia').value;
    const metrica = document.getElementById('metrica').value;
    const periodoInicial = document.getElementById('periodo-inicial').value;
    const periodoFinal = document.getElementById('periodo-final').value;

    if (ubicaciones.length === 0) {
        mostrarMensaje('Selecciona al menos una ubicación');
        return;
    }

    if (periodoInicial > periodoFinal) {
        mostrarMensaje('El periodo inicial debe ser anterior al final');
        return;
    }

    mostrarMensaje('Cargando datos...');

    try {
        let todosLosDatos = [];

        // Cargar datos de todas las ubicaciones
        for (const ubicacion of ubicaciones) {
            let url = `${API_URL}/api/mapa/delitos/evolucion/${ubicacion.nivel}?geo1=${encodeURIComponent(ubicacion.geo)}`;
            if (tipologia) {
                url += `&tipologia=${encodeURIComponent(tipologia)}`;
            }

            console.log('Cargando evolución desde:', url);
            const response = await fetch(url);
            const data = await response.json();

            if (data.datos && data.datos.length > 0) {
                todosLosDatos.push(...data.datos);
            }
        }

        if (todosLosDatos.length > 0) {
            dibujarGrafico(todosLosDatos, null, periodoInicial, periodoFinal, metrica);
            ocultarMensaje();
        } else {
            mostrarMensaje('No hay datos disponibles para esta selección');
        }
    } catch (error) {
        console.error('Error cargando evolución:', error);
        mostrarMensaje('Error al cargar los datos');
    }
}

// Dibujar gráfico con Chart.js
function dibujarGrafico(datos, nivel, periodoInicial, periodoFinal, metrica = 'tasa') {
    const ctx = document.getElementById('grafico-evolucion').getContext('2d');

    // Destruir gráfico anterior si existe
    if (chart) {
        chart.destroy();
    }

    // Filtrar datos por periodo
    const datosFiltrados = datos.map(serie => {
        const evolucionFiltrada = serie.evolucion.filter(item => {
            return item.periodo >= periodoInicial && item.periodo <= periodoFinal;
        });
        return {
            ...serie,
            evolucion: evolucionFiltrada
        };
    });

    // Preparar datasets
    const datasets = [];

    // Ocultar todas las leyendas primero
    for (let i = 1; i <= MAX_UBICACIONES; i++) {
        const container = document.getElementById(`leyenda-${i}-container`);
        if (container) {
            container.style.display = 'none';
        }
    }

    datosFiltrados.forEach((serie, index) => {
        if (index >= MAX_UBICACIONES) return;

        const nombreLegible = extraerNombreLegible(serie.geo, nivel);
        const color = COLORES[index];

        datasets.push({
            label: nombreLegible,
            data: serie.evolucion.map(item => ({
                x: item.periodo,
                y: metrica === 'tasa' ? item.tasa_por_mil : item.total_delitos,
                total: item.total_delitos,
                poblacion: item.poblacion,
                tasa: item.tasa_por_mil
            })),
            borderColor: color,
            backgroundColor: color + '20',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 3,
            pointHoverRadius: 6
        });

        // Actualizar leyenda
        const leyendaSpan = document.getElementById(`leyenda-${index + 1}`);
        const leyendaContainer = document.getElementById(`leyenda-${index + 1}-container`);
        if (leyendaSpan) {
            leyendaSpan.textContent = nombreLegible;
        }
        if (leyendaContainer) {
            leyendaContainer.style.display = 'flex';
        }
    });

    // Obtener todas las fechas para el eje X
    const todasFechas = datosFiltrados[0]?.evolucion.map(item => item.periodo) || [];

    // Calcular valor máximo de tasa para determinar decimales apropiados en el eje Y
    let maxTasa = 0;
    datosFiltrados.forEach(serie => {
        serie.evolucion.forEach(punto => {
            if (punto.tasa_por_mil > maxTasa) maxTasa = punto.tasa_por_mil;
        });
    });

    function decimalesTasa(maxVal) {
        if (maxVal >= 100) return 0;
        if (maxVal >= 10) return 1;
        if (maxVal >= 1) return 2;
        if (maxVal >= 0.1) return 3;
        return 4;
    }

    // Crear gráfico
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: todasFechas,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#333',
                    bodyColor: '#666',
                    borderColor: '#ddd',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        title: function(items) {
                            const fecha = new Date(items[0].label);
                            return fecha.toLocaleDateString('es-ES', {
                                year: 'numeric',
                                month: 'long'
                            });
                        },
                        label: function(context) {
                            const data = context.raw;
                            if (metrica === 'tasa') {
                                return [
                                    `${context.dataset.label}`,
                                    `Tasa: ${data.tasa.toFixed(2)} por 1000 hab`,
                                    `Total delitos: ${data.total.toLocaleString('es-ES')}`
                                ];
                            } else {
                                return [
                                    `${context.dataset.label}`,
                                    `Total delitos: ${data.total.toLocaleString('es-ES')}`,
                                    `Tasa: ${data.tasa.toFixed(2)} por 1000 hab`
                                ];
                            }
                        }
                    }
                }
            },
            onClick: function(event, elements) {
                // Hide tooltip when clicking on empty area inside chart
                if (elements.length === 0) {
                    chart.tooltip.setActiveElements([], { x: 0, y: 0 });
                    chart.update('none');
                }
            },
            scales: {
                x: {
                    type: 'category',
                    title: {
                        display: true,
                        text: 'Periodo'
                    },
                    ticks: {
                        callback: function(value, index) {
                            const fecha = new Date(this.getLabelForValue(value));
                            if (index % 4 === 0) {
                                return fecha.toLocaleDateString('es-ES', {
                                    year: '2-digit',
                                    month: 'short'
                                });
                            }
                            return '';
                        },
                        maxRotation: 45
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: metrica === 'tasa' ? 'Tasa por 1000 habitantes' : 'Total de delitos'
                    },
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            if (metrica === 'absoluto') {
                                return value.toLocaleString('es-ES');
                            }
                            const decimales = decimalesTasa(maxTasa);
                            return value.toLocaleString('es-ES', {
                                minimumFractionDigits: decimales,
                                maximumFractionDigits: decimales
                            });
                        }
                    }
                }
            }
        }
    });

    // Mostrar leyenda
    document.getElementById('leyenda-grafico').style.display = 'flex';

    // Llenar tabla de resumen con datos filtrados
    llenarTablaResumen(datosFiltrados, nivel, metrica);

    // Ocultar tooltip al hacer clic/touch fuera del canvas
    const _canvas = ctx.canvas;
    if (_tooltipOutsideHandler) {
        document.removeEventListener('click', _tooltipOutsideHandler);
        document.removeEventListener('touchstart', _tooltipOutsideHandler);
    }
    _tooltipOutsideHandler = function(e) {
        if (chart && !_canvas.contains(e.target)) {
            chart.tooltip.setActiveElements([], { x: 0, y: 0 });
            chart.update('none');
        }
    };
    document.addEventListener('click', _tooltipOutsideHandler);
    document.addEventListener('touchstart', _tooltipOutsideHandler, { passive: true });
}

// Llenar tabla de resumen con variaciones (formato pivotado: ubicaciones como columnas)
function llenarTablaResumen(datos, nivel, metrica = 'tasa') {
    const thead = document.getElementById('tabla-thead');
    const tbody = document.getElementById('tabla-body');
    const container = document.getElementById('tabla-container');

    if (!thead || !tbody || !container) return;

    // Filtrar series con suficientes datos
    const series = datos.filter((s, i) => i < MAX_UBICACIONES && s.evolucion.length >= 2);
    if (series.length === 0) return;

    // ── Cabecera dinámica ──────────────────────────────────────────────
    const trHead = document.createElement('tr');
    trHead.innerHTML = '<th class="col-ubicacion"></th>';
    series.forEach((serie, i) => {
        const nombre = extraerNombreLegible(serie.geo, nivel);
        trHead.innerHTML += `
            <th class="col-metrica">
                <span class="ubicacion-color" style="background:${COLORES[i]};display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:middle;"></span>
                ${nombre}
            </th>`;
    });
    thead.innerHTML = '';
    thead.appendChild(trHead);

    // ── Calcular métricas por serie ────────────────────────────────────
    const calcSerie = (serie) => {
        const ev = serie.evolucion;
        const primer = ev[0];
        const ultimo = ev[ev.length - 1];
        const getVal = (p) => metrica === 'tasa' ? p.tasa_por_mil : p.total_delitos;
        const valorInicial = getVal(primer);
        const valorFinal   = getVal(ultimo);
        const valores      = ev.map(getVal);
        const promedio     = valores.reduce((s, v) => s + v, 0) / valores.length;
        const varAbs       = valorFinal - valorInicial;
        const varRel       = valorInicial !== 0 ? (varAbs / valorInicial) * 100 : 0;

        const fmt = (v) => metrica === 'tasa'
            ? v.toFixed(2)
            : Math.round(v).toLocaleString('es-ES');
        const fmtSgn = (v) => (v >= 0 ? '+' : '') + fmt(v);

        return {
            periodoInicial: primer.periodo,
            periodoFinal:   ultimo.periodo,
            valorInicial,
            valorFinal,
            promedio,
            varAbs,
            varRel,
            fmt,
            fmtSgn
        };
    };

    const metricas = series.map(calcSerie);

    // Helper: formato de periodo trimestral
    const fmtPeriodo = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        const mes = d.getUTCMonth() + 1;
        const anyo = d.getUTCFullYear();
        const rangos = { 3: 'ene-mar', 6: 'abr-jun', 9: 'jul-sep', 12: 'oct-dic' };
        return (rangos[mes] || iso) + ' ' + anyo;
    };

    // ── Filas pivotadas ────────────────────────────────────────────────
    tbody.innerHTML = '';

    const buildRow = (label, cells, extraClass = '') => {
        const tr = document.createElement('tr');
        if (extraClass) tr.classList.add(extraClass);
        tr.innerHTML = `<td class="tabla-row-label">${label}</td>` +
            cells.map(c => `<td class="tabla-data-cell">${c}</td>`).join('');
        tbody.appendChild(tr);
    };

    // Periodo (shared info — shown once if all equal, else per column)
    const mismoInicio = metricas.every(m => m.periodoInicial === metricas[0].periodoInicial);
    const mismoFin    = metricas.every(m => m.periodoFinal   === metricas[0].periodoFinal);

    if (mismoInicio) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="tabla-row-label">Periodo</td>
            <td class="tabla-data-cell" colspan="${series.length}">
                ${fmtPeriodo(metricas[0].periodoInicial)} → ${mismoFin ? fmtPeriodo(metricas[0].periodoFinal) : ''}
            </td>`;
        tbody.appendChild(tr);
        if (!mismoFin) {
            buildRow('Periodo final', metricas.map(m => fmtPeriodo(m.periodoFinal)));
        }
    } else {
        buildRow('Periodo inicial', metricas.map(m => fmtPeriodo(m.periodoInicial)));
        buildRow('Periodo final',   metricas.map(m => fmtPeriodo(m.periodoFinal)));
    }

    buildRow('Valor inicial', metricas.map(m => m.fmt(m.valorInicial)));
    buildRow('Valor final',   metricas.map(m => m.fmt(m.valorFinal)));
    buildRow('Promedio',      metricas.map(m => m.fmt(m.promedio)), 'tabla-promedio');
    buildRow('Var. absoluta', metricas.map(m => {
        const cls = m.varAbs >= 0 ? 'variacion-positiva' : 'variacion-negativa';
        return `<span class="${cls}">${m.fmtSgn(m.varAbs)}</span>`;
    }));
    buildRow('Var. %', metricas.map(m => {
        const cls = m.varAbs >= 0 ? 'variacion-positiva' : 'variacion-negativa';
        return `<span class="${cls}">${(m.varRel >= 0 ? '+' : '')}${m.varRel.toFixed(1)}%</span>`;
    }));

    container.style.display = 'block';
}

// Mostrar mensaje de estado
function mostrarMensaje(texto) {
    const mensaje = document.getElementById('estado-mensaje');
    mensaje.textContent = texto;
    mensaje.style.display = 'block';

    const canvas = document.getElementById('grafico-evolucion');
    canvas.style.display = 'none';

    document.getElementById('leyenda-grafico').style.display = 'none';
    document.getElementById('tabla-container').style.display = 'none';
}

// Ocultar mensaje de estado
function ocultarMensaje() {
    const mensaje = document.getElementById('estado-mensaje');
    mensaje.style.display = 'none';

    const canvas = document.getElementById('grafico-evolucion');
    canvas.style.display = 'block';
}

// Inicializar aplicación
async function init() {
    console.log('Inicializando comparativa...');

    // Cargar tipologías y periodos en paralelo
    await Promise.all([
        cargarTipologias(),
        cargarPeriodos()
    ]);

    // Cargar ubicaciones del nivel por defecto (ccaa) para ubicación 1
    await cargarUbicacionesPorNivel('ccaa');

    // Actualizar select de ubicación 1
    const ubicacion1Select = document.getElementById('ubicacion1');
    if (ubicacion1Select) {
        ubicacion1Select.innerHTML = '<option value="">Selecciona ubicación</option>';
        ubicacionesDisponibles['ccaa'].forEach(ubicacion => {
            const option = document.createElement('option');
            option.value = ubicacion.geo;
            option.textContent = ubicacion.nombre;
            ubicacion1Select.appendChild(option);
        });
    }

    // Event listener para cambio de nivel 1
    const nivelSelect = document.getElementById('nivel-geo');
    if (nivelSelect) {
        nivelSelect.addEventListener('change', async function() {
            const nivel = this.value;
            const ubicaciones = await cargarUbicacionesPorNivel(nivel);

            const ubicacion1Select = document.getElementById('ubicacion1');
            ubicacion1Select.innerHTML = '<option value="">Selecciona ubicación</option>';
            ubicaciones.forEach(ubicacion => {
                const option = document.createElement('option');
                option.value = ubicacion.geo;
                option.textContent = ubicacion.nombre;
                ubicacion1Select.appendChild(option);
            });
        });
    }

    // Event listener para botón añadir ubicación
    const btnAdd = document.getElementById('btn-add-ubicacion');
    if (btnAdd) {
        btnAdd.addEventListener('click', agregarUbicacion);
    }

    // Event listener para botón comparar
    const btnComparar = document.getElementById('btn-comparar');
    if (btnComparar) {
        btnComparar.addEventListener('click', cargarEvolucion);
    }

    console.log('Comparativa inicializada');
}

// Ejecutar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    init();
});
