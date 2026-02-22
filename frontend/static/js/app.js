// Configuración
const API_URL = window.location.origin;
const GEOJSON_PATH = '/data/mapas';

// Configuración fija
const NIVEL = 'ccaa';
let PERIODO = null; // Se carga dinámicamente desde la API (el más reciente)
const TIPOLOGIA = null; // Total criminalidad

// Variables globales
let map;
let capaActual;
let datosDelitos = {};
let umbralesToasa = null;

// Diccionario para mapear nombres del GeoJSON a nombres de la API
// Soporta tanto CCAA como provincias (para CCAA uniprovinciales)
const nombresGeoJSON = {
    // CCAA
    'Andalucía': 'ANDALUCÍA',
    'Aragón': 'ARAGÓN',
    'Principado de Asturias': 'ASTURIAS',
    'Asturias': 'ASTURIAS',
    'Illes Balears': 'BALEARES',
    'Canarias': 'CANARIAS',
    'Cantabria': 'CANTABRIA',
    'Castilla y León': 'CASTILLA Y LEÓN',
    'Castilla-La Mancha': 'CASTILLA LA MANCHA',
    'Cataluña/Catalunya': 'CATALUÑA',
    'Comunitat Valenciana': 'VALENCIA',
    'Extremadura': 'EXTREMADURA',
    'Galicia': 'GALICIA',
    'Comunidad de Madrid': 'MADRID',
    'Madrid': 'MADRID',
    'Región de Murcia': 'MURCIA',
    'Murcia': 'MURCIA',
    'Comunidad Foral de Navarra': 'NAVARRA',
    'Navarra': 'NAVARRA',
    'País Vasco/Euskadi': 'PAÍS VASCO',
    'La Rioja': 'LA RIOJA',
    'Ciudad Autónoma de Ceuta': 'CEUTA',
    'Ciudad de Ceuta': 'CEUTA',
    'Ceuta': 'CEUTA',
    'Ciudad Autónoma de Melilla': 'MELILLA',
    'Ciudad de Melilla': 'MELILLA',
    'Melilla': 'MELILLA',
    // Provincias con nombres diferentes
    'A Coruña': 'A CORUÑA',
    'Araba/Álava': 'ÁLAVA',
    'Bizkaia': 'VIZCAYA',
    'Gipuzkoa': 'GUIPUZCOA',
    'Alacant/Alicante': 'ALICANTE',
    'Castelló/Castellón': 'CASTELLÓN',
    'València/Valencia': 'VALENCIA',
    'Las Palmas': 'LAS PALMAS',
    'Santa Cruz de Tenerife': 'SANTA CRUZ DE TENERIFE'
};
// Alias para compatibilidad
const nombresCCAA = nombresGeoJSON;

// Inicializar mapa
map = L.map('map', {
    zoomControl: false
}).setView([40.4168, -3.7038], 6);

// Añadir capa base de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

// Cargar periodos desde la API
async function cargarPeriodos() {
    try {
        console.log('Intentando cargar periodos...');
        const response = await fetch(`${API_URL}/api/mapa/periodos`);
        const data = await response.json();

        const select = document.getElementById('periodo');
        if (!select) {
            console.error('No se encontró el select de periodo');
            return;
        }

        select.innerHTML = '';

        data.periodos.forEach((periodo, index) => {
            const option = document.createElement('option');
            option.value = periodo;
            const fecha = new Date(periodo);
            option.textContent = fecha.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long'
            });
            // Seleccionar el primer periodo (más reciente)
            if (index === 0) {
                option.selected = true;
                PERIODO = periodo;
            }
            select.appendChild(option);
        });

        console.log('Periodos cargados:', data.periodos.length, '- Periodo actual:', PERIODO);

    } catch (error) {
        console.error('Error cargando periodos:', error);
        console.error('Stack:', error.stack);
    }
}

// Cargar tipologías desde la API
async function cargarTipologias() {
    try {
        console.log('Intentando cargar tipologías...');
        const response = await fetch(`${API_URL}/api/mapa/tipologias`);
        const data = await response.json();
        
        const select = document.getElementById('tipologia');
        if (!select) {
            console.error('No se encontró el select de tipologia');
            return;
        }
        
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
        console.error('Stack:', error.stack);
    }
}

// Cargar datos de delitos
async function cargarDatos(nivel = 'ccaa', periodo = null, tipologia = null) {
    // Usar PERIODO global si no se especifica
    const periodoActual = periodo || PERIODO;
    try {
        let url = `${API_URL}/api/mapa/delitos/agregado/${nivel}?periodo=${periodoActual}`;
        if (tipologia) {
            url += `&tipologia=${encodeURIComponent(tipologia)}`;
        }
        
        console.log('Cargando datos desde:', url);
        const response = await fetch(url);
        const data = await response.json();
        
        // Crear mapa de datos
        const datosMap = {};
        data.datos.forEach(item => {
            let clave;
            
            if (nivel === 'ccaa') {
                // Para CCAA: "CCAA 01 Andalucía" -> "ANDALUCÍA"
                clave = item.geo.replace(/^CCAA \d+ /, '').toUpperCase();
            } else if (nivel === 'provincia') {
                // Para provincias: "Provincia 28 Madrid" -> "MADRID"
                // También manejar CCAA uniprovinciales: "CCAA 04 Baleares" -> "BALEARES"
                if (item.geo.startsWith('CCAA')) {
                    clave = item.geo.replace(/^CCAA \d+ /, '').toUpperCase();
                } else {
                    clave = item.geo.replace(/^Provincia \d+ /, '').toUpperCase();
                }
            } else if (nivel === 'municipio') {
                // Para municipios: "28079 Madrid" -> "MADRID"
                clave = item.geo.replace(/^\d+ /, '').toUpperCase();
            } else {
                // Nacional u otros
                clave = item.geo.toUpperCase();
            }
            
            datosMap[clave] = item;
        });
        
        console.log('Datos cargados:', Object.keys(datosMap).length, 'registros');
        return datosMap;
    } catch (error) {
        console.error('Error cargando datos:', error);
        return {};
    }
}

// Calcular umbrales dinámicos
function calcularUmbrales(datos) {
    const tasas = Object.values(datos)
        .map(d => d.tasa_por_mil)
        .filter(t => t > 0)
        .sort((a, b) => a - b);
    
    const n = tasas.length;
    if (n === 0) return null;
    
    return {
        min: tasas[0],
        q1: tasas[Math.floor(n * 0.2)],
        q2: tasas[Math.floor(n * 0.4)],
        q3: tasas[Math.floor(n * 0.6)],
        q4: tasas[Math.floor(n * 0.8)],
        max: tasas[n - 1]
    };
}

// Obtener color según tasa
function getColor(tasa) {
    if (!umbralesToasa || tasa === 0) return '#d3d3d3';
    
    return tasa >= umbralesToasa.q4 ? '#a50f15' :
           tasa >= umbralesToasa.q3 ? '#de2d26' :
           tasa >= umbralesToasa.q2 ? '#fb6a4a' :
           tasa >= umbralesToasa.q1 ? '#fcae91' :
                                      '#fee5d9';
}

// Función auxiliar para normalizar texto (quitar acentos y mayúsculas)
function normalizarTexto(texto) {
    return texto
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

// Buscar datos para una geografía
function buscarDatosGeografia(nombreGeoJSON) {
    // 1. Buscar por diccionario de mapeo
    const claveMapeada = nombresGeoJSON[nombreGeoJSON];
    if (claveMapeada && datosDelitos[claveMapeada]) {
        return datosDelitos[claveMapeada];
    }

    // 2. Buscar por nombre directo (mayúsculas)
    const nombreUpper = nombreGeoJSON.toUpperCase();
    if (datosDelitos[nombreUpper]) {
        return datosDelitos[nombreUpper];
    }

    // 3. Buscar por coincidencia parcial
    const nombreNorm = normalizarTexto(nombreGeoJSON);
    for (const key of Object.keys(datosDelitos)) {
        const keyNorm = normalizarTexto(key);
        if (keyNorm.includes(nombreNorm) || nombreNorm.includes(keyNorm)) {
            return datosDelitos[key];
        }
    }

    // 4. Buscar por palabras clave (última opción)
    const palabras = nombreNorm.split(/[\s\/]+/).filter(p => p.length > 3);
    for (const key of Object.keys(datosDelitos)) {
        const keyNorm = normalizarTexto(key);
        for (const palabra of palabras) {
            if (keyNorm.includes(palabra)) {
                return datosDelitos[key];
            }
        }
    }

    return null;
}

// Estilo para las geometrías
function style(feature) {
    const nombreGeoJSON = feature.properties.NAMEUNIT;
    const datos = buscarDatosGeografia(nombreGeoJSON);
    const tasa = datos ? datos.tasa_por_mil : 0;
    
    return {
        fillColor: getColor(tasa),
        weight: 1,
        opacity: 1,
        color: 'white',
        fillOpacity: 0.7
    };
}

// Eventos de interacción
function highlightFeature(e) {
    const layer = e.target;
    layer.setStyle({
        weight: 3,
        color: '#666',
        fillOpacity: 0.9
    });
    layer.bringToFront();
    updateInfoPanel(layer.feature.properties);
}

function resetHighlight(e) {
    capaActual.resetStyle(e.target);
    updateInfoPanel();
}

function updateInfoPanel(props) {
    const infoContent = document.getElementById('info-content');
    const infoPanel = document.querySelector('.info-panel');

    if (props) {
        const nombreGeoJSON = props.NAMEUNIT;

        // Usar la función centralizada de búsqueda
        const datos = buscarDatosGeografia(nombreGeoJSON);

        // Mostrar panel
        if (infoPanel) {
            infoPanel.style.display = 'block';
        }

        if (datos) {
            // Obtener periodo seleccionado
            const periodoSelect = document.getElementById('periodo');
            const periodoTexto = periodoSelect ? periodoSelect.options[periodoSelect.selectedIndex].text : '';

            // Calcular nivel de criminalidad
            let nivelCriminalidad = '';
            let colorNivel = '';
            if (umbralesToasa && datos.tasa_por_mil) {
                if (datos.tasa_por_mil >= umbralesToasa.q4) {
                    nivelCriminalidad = 'Muy alto';
                    colorNivel = '#a50f15';
                } else if (datos.tasa_por_mil >= umbralesToasa.q3) {
                    nivelCriminalidad = 'Alto';
                    colorNivel = '#de2d26';
                } else if (datos.tasa_por_mil >= umbralesToasa.q2) {
                    nivelCriminalidad = 'Medio-alto';
                    colorNivel = '#fb6a4a';
                } else if (datos.tasa_por_mil >= umbralesToasa.q1) {
                    nivelCriminalidad = 'Medio';
                    colorNivel = '#fcae91';
                } else {
                    nivelCriminalidad = 'Bajo';
                    colorNivel = '#fee5d9';
                }
            }

            infoContent.innerHTML = `
                <h3>${nombreGeoJSON}</h3>
                <p style="font-size: 12px; color: #666; margin-bottom: 8px;">${periodoTexto}</p>
                <p><strong>Total delitos:</strong> ${datos.total_delitos ? datos.total_delitos.toLocaleString('es-ES') : 'N/A'}</p>
                <p><strong>Población:</strong> ${datos.poblacion ? datos.poblacion.toLocaleString('es-ES') : 'N/A'}</p>
                <p><strong>Tasa por 1000 hab:</strong> ${datos.tasa_por_mil ? datos.tasa_por_mil.toFixed(2) : 'N/A'}</p>
                ${nivelCriminalidad ? `<p style="margin-top: 8px;"><strong>Nivel:</strong> <span style="color: ${colorNivel}; font-weight: bold;">${nivelCriminalidad}</span></p>` : ''}
            `;
        } else {
            infoContent.innerHTML = `
                <h3>${nombreGeoJSON}</h3>
                <p style="color: #999;">Sin datos disponibles</p>
            `;
        }
    } else {
        // Ocultar panel cuando no hay props
        if (infoPanel && window.innerWidth <= 768) {
            infoPanel.style.display = 'none';
        } else if (infoPanel) {
            infoContent.innerHTML = '<p>Pasa el cursor sobre una región</p>';
        }
    }
}

function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight
    });
}

// Actualizar leyenda
function actualizarLeyenda() {
    if (!umbralesToasa) return;
    
    const leyenda = document.querySelector('.legend');
    const esMobile = window.innerWidth <= 768;
    
    leyenda.innerHTML = `
        <h4 id="legend-title" style="cursor: pointer; user-select: none; display: flex; justify-content: space-between; align-items: center;">
            <span>Tasa por 1000 hab.</span>
            <span class="legend-toggle ${esMobile ? 'collapsed' : ''}">▼</span>
        </h4>
        <div class="legend-content ${esMobile ? 'collapsed' : ''}" id="legend-content">
            <div class="legend-item">
                <div class="legend-color" style="background: #fee5d9;"></div>
                <span>< ${umbralesToasa.q1.toFixed(1)}</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #fcae91;"></div>
                <span>${umbralesToasa.q1.toFixed(1)} - ${umbralesToasa.q2.toFixed(1)}</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #fb6a4a;"></div>
                <span>${umbralesToasa.q2.toFixed(1)} - ${umbralesToasa.q3.toFixed(1)}</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #de2d26;"></div>
                <span>${umbralesToasa.q3.toFixed(1)} - ${umbralesToasa.q4.toFixed(1)}</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #a50f15;"></div>
                <span>> ${umbralesToasa.q4.toFixed(1)}</span>
            </div>
        </div>
    `;
    
    // Añadir evento de toggle
    setTimeout(() => {
        const legendTitle = document.getElementById('legend-title');
        if (legendTitle) {
            legendTitle.onclick = toggleLegend;
        }
    }, 10);
}

// Toggle leyenda
function toggleLegend() {
    const content = document.getElementById('legend-content');
    const toggle = document.querySelector('.legend-toggle');
    
    if (content && toggle) {
        content.classList.toggle('collapsed');
        toggle.classList.toggle('collapsed');
    }
}
// Cargar mapa
async function cargarMapa(nivel = 'ccaa') {
    try {
        let geoJsonFile;
        
        if (nivel === 'ccaa') {
            geoJsonFile = 'comunidades.geojson';
        } else if (nivel === 'provincia') {
            geoJsonFile = 'provincias.geojson';
        } else if (nivel === 'municipio') {
            geoJsonFile = 'municipios.geojson';
        } else if (nivel === 'nacional') {
            console.log('Nivel nacional - sin mapa geográfico');
            if (capaActual) {
                map.removeLayer(capaActual);
                capaActual = null;
            }
            return;
        }
        
        const response = await fetch(`${GEOJSON_PATH}/${geoJsonFile}?v=2`);
        const geojson = await response.json();

        // Debug: mostrar features cargados
        console.log('GeoJSON features:', geojson.features.length);
        const canarias = geojson.features.filter(f =>
            f.properties.NAMEUNIT && f.properties.NAMEUNIT.toLowerCase().includes('canarias')
        );
        console.log('Canarias en GeoJSON:', canarias.length > 0 ? 'SÍ' : 'NO');

        if (capaActual) {
            map.removeLayer(capaActual);
        }

        capaActual = L.geoJSON(geojson, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);

        console.log('Mapa cargado correctamente:', geoJsonFile);
    } catch (error) {
        console.error('Error cargando GeoJSON:', error);
    }
}

// Aplicar filtros seleccionados
async function aplicarFiltros() {
    console.log('Aplicando filtros...');
    
    // Obtener valores seleccionados
    const nivelSeleccionado = document.getElementById('nivel-geo').value;
    const periodoSeleccionado = document.getElementById('periodo').value;
    const tipologiaSeleccionada = document.getElementById('tipologia').value || null;
    
    console.log('Filtros:', {
        nivel: nivelSeleccionado,
        periodo: periodoSeleccionado,
        tipologia: tipologiaSeleccionada
    });
    
    // Cargar nuevos datos
    datosDelitos = await cargarDatos(nivelSeleccionado, periodoSeleccionado, tipologiaSeleccionada);
    
    // Calcular umbrales
    umbralesToasa = calcularUmbrales(datosDelitos);
    
    // Actualizar leyenda
    actualizarLeyenda();
    
    // Recargar mapa
    await cargarMapa(nivelSeleccionado);
    
    // Cerrar panel en móvil
    if (window.innerWidth <= 768) {
        const details = document.getElementById('filtros-details');
        if (details) {
            details.removeAttribute('open');
        }
    }
    
    console.log('Filtros aplicados correctamente');
}

// Inicializar aplicación
async function init() {
    console.log('Inicializando aplicación...');
    // Cargar filtros
    await cargarPeriodos();
    await cargarTipologias();
    
    // Cargar datos
    datosDelitos = await cargarDatos();
    console.log('Datos cargados:', Object.keys(datosDelitos).length, 'CCAA');
    
    // Calcular umbrales
    umbralesToasa = calcularUmbrales(datosDelitos);
    
    // Actualizar leyenda
    actualizarLeyenda();
    
    // Cargar mapa
    await cargarMapa();
    
    // Inicializar leyenda colapsada en móvil
    if (window.innerWidth <= 768) {
        setTimeout(() => {
            const content = document.getElementById('legend-content');
            const toggle = document.querySelector('.legend-toggle');
            if (content && toggle) {
                content.classList.add('collapsed');
                toggle.classList.add('collapsed');
            }
        }, 200);
    }
    
    // Event listener para botón aplicar
    const btnAplicar = document.getElementById('btn-aplicar');
    if (btnAplicar) {
        btnAplicar.addEventListener('click', aplicarFiltros);
        console.log('Listener de aplicar filtros añadido');
    } else {
        console.error('No se encontró el botón aplicar filtros');
    }
    
    console.log('Aplicación inicializada');
}

// Ejecutar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar aplicación
    init();
    

});

