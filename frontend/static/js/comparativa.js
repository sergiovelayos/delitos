// Configuración
const API_URL = window.location.origin;

// Variables globales
let chart = null;
let ubicacionesDisponibles = [];

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

// Cargar ubicaciones según el nivel seleccionado
async function cargarUbicaciones(nivel) {
    try {
        // Para nacional, no hay ubicaciones que seleccionar
        if (nivel === 'nacional') {
            ubicacionesDisponibles = [{ geo: 'NACIONAL', nombre: 'España (Nacional)' }];
            actualizarSelectsUbicaciones();
            return;
        }

        // Usar el último periodo disponible para obtener la lista de ubicaciones
        const periodosResponse = await fetch(`${API_URL}/api/mapa/periodos`);
        const periodosData = await periodosResponse.json();
        const ultimoPeriodo = periodosData.periodos[0];

        const response = await fetch(`${API_URL}/api/mapa/delitos/agregado/${nivel}?periodo=${ultimoPeriodo}`);
        const data = await response.json();

        // Extraer ubicaciones únicas
        ubicacionesDisponibles = data.datos.map(item => ({
            geo: item.geo,
            nombre: extraerNombreLegible(item.geo, nivel)
        })).sort((a, b) => a.nombre.localeCompare(b.nombre));

        actualizarSelectsUbicaciones();
        console.log('Ubicaciones cargadas:', ubicacionesDisponibles.length);
    } catch (error) {
        console.error('Error cargando ubicaciones:', error);
    }
}

// Extraer nombre legible del campo geo
function extraerNombreLegible(geo, nivel) {
    if (nivel === 'ccaa') {
        // "CCAA 01 Andalucía" -> "Andalucía"
        return geo.replace(/^CCAA \d+ /, '');
    } else if (nivel === 'provincia') {
        // "Provincia 01 Álava" -> "Álava"
        return geo.replace(/^Provincia \d+ /, '');
    } else if (nivel === 'municipio') {
        // "28079 Madrid" -> "Madrid"
        return geo.replace(/^\d+ /, '');
    }
    return geo;
}

// Actualizar los selects de ubicaciones
function actualizarSelectsUbicaciones() {
    const select1 = document.getElementById('ubicacion1');
    const select2 = document.getElementById('ubicacion2');

    if (!select1 || !select2) return;

    // Limpiar selects
    select1.innerHTML = '<option value="">Selecciona ubicación</option>';
    select2.innerHTML = '<option value="">Sin comparar</option>';

    // Añadir opciones
    ubicacionesDisponibles.forEach(ubicacion => {
        const option1 = document.createElement('option');
        option1.value = ubicacion.geo;
        option1.textContent = ubicacion.nombre;
        select1.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = ubicacion.geo;
        option2.textContent = ubicacion.nombre;
        select2.appendChild(option2);
    });
}

// Cargar datos de evolución y dibujar gráfico
async function cargarEvolucion() {
    const nivel = document.getElementById('nivel-geo').value;
    const geo1 = document.getElementById('ubicacion1').value;
    const geo2 = document.getElementById('ubicacion2').value;
    const tipologia = document.getElementById('tipologia').value;

    if (!geo1) {
        mostrarMensaje('Selecciona al menos una ubicación');
        return;
    }

    mostrarMensaje('Cargando datos...');

    try {
        let url = `${API_URL}/api/mapa/delitos/evolucion/${nivel}?geo1=${encodeURIComponent(geo1)}`;
        if (geo2) {
            url += `&geo2=${encodeURIComponent(geo2)}`;
        }
        if (tipologia) {
            url += `&tipologia=${encodeURIComponent(tipologia)}`;
        }

        console.log('Cargando evolución desde:', url);
        const response = await fetch(url);
        const data = await response.json();

        if (data.datos && data.datos.length > 0) {
            dibujarGrafico(data.datos, nivel);
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
function dibujarGrafico(datos, nivel) {
    const ctx = document.getElementById('grafico-evolucion').getContext('2d');

    // Destruir gráfico anterior si existe
    if (chart) {
        chart.destroy();
    }

    // Preparar datasets
    const datasets = [];
    const colores = ['#2c3e50', '#e74c3c'];

    datos.forEach((serie, index) => {
        const nombreLegible = extraerNombreLegible(serie.geo, nivel);

        datasets.push({
            label: nombreLegible,
            data: serie.evolucion.map(item => ({
                x: item.periodo,
                y: item.tasa_por_mil,
                total: item.total_delitos,
                poblacion: item.poblacion,
                tasa: item.tasa_por_mil
            })),
            borderColor: colores[index],
            backgroundColor: colores[index] + '20',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 3,
            pointHoverRadius: 6
        });

        // Actualizar leyenda personalizada
        if (index === 0) {
            document.getElementById('leyenda-1').textContent = nombreLegible;
        } else if (index === 1) {
            document.getElementById('leyenda-2').textContent = nombreLegible;
            document.getElementById('leyenda-2-container').style.display = 'flex';
        }
    });

    // Si solo hay una ubicación, ocultar segunda leyenda
    if (datos.length === 1) {
        document.getElementById('leyenda-2-container').style.display = 'none';
    }

    // Obtener todas las fechas para el eje X
    const todasFechas = datos[0].evolucion.map(item => item.periodo);

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
                    display: false // Usamos leyenda personalizada
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
                            return [
                                `${context.dataset.label}`,
                                `Total delitos: ${data.total.toLocaleString('es-ES')}`,
                                `Tasa: ${data.tasa.toFixed(2)} por 1000 hab`
                            ];
                        }
                    }
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
                            // Mostrar solo algunas etiquetas para no saturar
                            const fecha = new Date(this.getLabelForValue(value));
                            if (index % 4 === 0) { // Mostrar cada 4 periodos
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
                        text: 'Tasa por 1000 habitantes'
                    },
                    beginAtZero: false
                }
            }
        }
    });

    // Mostrar leyenda
    document.getElementById('leyenda-grafico').style.display = 'flex';
}

// Mostrar mensaje de estado
function mostrarMensaje(texto) {
    const mensaje = document.getElementById('estado-mensaje');
    mensaje.textContent = texto;
    mensaje.style.display = 'block';

    // Ocultar canvas si hay mensaje
    const canvas = document.getElementById('grafico-evolucion');
    canvas.style.display = 'none';

    // Ocultar leyenda
    document.getElementById('leyenda-grafico').style.display = 'none';
}

// Ocultar mensaje de estado
function ocultarMensaje() {
    const mensaje = document.getElementById('estado-mensaje');
    mensaje.style.display = 'none';

    // Mostrar canvas
    const canvas = document.getElementById('grafico-evolucion');
    canvas.style.display = 'block';
}

// Inicializar aplicación
async function init() {
    console.log('Inicializando comparativa...');

    // Cargar tipologías
    await cargarTipologias();

    // Cargar ubicaciones del nivel por defecto (ccaa)
    await cargarUbicaciones('ccaa');

    // Event listener para cambio de nivel
    const nivelSelect = document.getElementById('nivel-geo');
    if (nivelSelect) {
        nivelSelect.addEventListener('change', function() {
            cargarUbicaciones(this.value);
        });
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
