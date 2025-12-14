# 🗺️ Criminalidad España - Visualización Interactiva

Aplicación web para la visualización interactiva de datos de criminalidad en España con soporte multi-nivel (Nacional, CCAA, Provincias, Municipios).

**🌐 Demo en producción:** https://delitos.hookponent.cc

---

## 📋 Características

### ✅ Versión 2.0 - Actual

- **Visualización multi-nivel:** Nacional, Comunidades Autónomas, Provincias y Municipios
- **Filtros dinámicos:** Periodo (2015-2025) y Tipo de delito cargados desde API
- **Mapa interactivo:** Colores dinámicos basados en percentiles calculados por nivel
- **Leyenda adaptativa:** Umbrales actualizados automáticamente según filtros
- **Leyenda colapsable:** Expandible/contraíble en todas las plataformas
- **Panel de información:** Datos detallados al hacer hover/click en regiones
- **Responsive:** Panel lateral en desktop, colapsable superior en móvil
- **Datos actualizados:** Hasta junio 2025

---

## 🏗️ Arquitectura

### Backend - FastAPI + PostgreSQL

```
backend/
├── app/
│   ├── main.py          # Aplicación FastAPI principal
│   ├── database.py      # Conexión PostgreSQL
│   └── routes/
│       └── mapa.py      # Endpoints de datos geográficos
└── requirements.txt
```

**Endpoints principales:**
- `GET /api/mapa/periodos` - Lista de periodos disponibles
- `GET /api/mapa/tipologias` - Tipos de delitos disponibles
- `GET /api/mapa/delitos/agregado/{nivel}` - Datos agregados por nivel geográfico

### Frontend - Leaflet.js + HTML5 nativo

```
frontend/
├── index.html           # Interfaz principal
├── static/
│   └── js/
│       └── app.js      # Lógica de la aplicación
└── data/
    └── mapas/          # GeoJSON files
        ├── comunidades.geojson
        ├── provincias.geojson
        └── municipios.geojson
```

---

## 🚀 Instalación y Configuración

### Requisitos previos

- Python 3.8+
- PostgreSQL 13+
- Datos de criminalidad cargados en PostgreSQL

### 1. Clonar repositorio

```bash
git clone https://github.com/sergiovelayos/delitos.git
cd delitos
```

### 2. Configurar backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # En Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Variables de entorno

Crear `.env` en la raíz:

```bash
PG_USER=tu_usuario
PG_PASSWORD=tu_contraseña
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=criminalidad
```

### 4. Ejecutar localmente

```bash
# Backend
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

# Frontend (servir archivos estáticos)
cd frontend
python -m http.server 8000
```

Acceder a: http://localhost:8000

---

## 🔧 Despliegue en Producción

### Servicio systemd

Crear `/etc/systemd/system/criminalidad.service`:

```ini
[Unit]
Description=Criminalidad España - FastAPI Application
After=network.target postgresql.service

[Service]
Type=simple
User=tu_usuario
WorkingDirectory=/ruta/a/criminalidad_app/backend
Environment="PATH=/ruta/a/criminalidad_app/.venv/bin"
ExecStart=/ruta/a/criminalidad_app/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable criminalidad
sudo systemctl start criminalidad
```

### Cloudflare Tunnel (Recomendado)

Configuración en `/etc/cloudflared/config.yml`:

```yaml
tunnel: tu-tunnel-id
credentials-file: /ruta/a/credentials.json

ingress:
  - hostname: delitos.tudominio.com
    service: http://127.0.0.1:8001
  - service: http_status:404
```

---

## 🛠️ Resolución de Problemas Técnicos

### Problema 1: Dropdowns no se llenaban en móvil

**Causa:** `DOMContentLoaded` se ejecutaba antes de que los elementos `<select>` existieran en el DOM.

**Solución:**
- Consolidar todos los event listeners en un único `DOMContentLoaded`
- Añadir verificaciones `if (element)` antes de manipular elementos
- Usar `<details>` HTML5 nativo en lugar de JavaScript para el menú colapsable

```javascript
document.addEventListener('DOMContentLoaded', function() {
    init();  // Inicializa toda la app cuando el DOM está listo
});
```

### Problema 2: Filtros no actualizaban el mapa

**Causa:** La función `cargarDatos()` aceptaba parámetros pero usaba constantes fijas.

**Solución antes:**
```javascript
async function cargarDatos(nivel, periodo, tipologia) {
    let url = `${API_URL}/api/mapa/delitos/agregado/${NIVEL}?periodo=${PERIODO}`;
    // ❌ Usaba NIVEL, PERIODO, TIPOLOGIA (constantes)
}
```

**Solución después:**
```javascript
async function cargarDatos(nivel, periodo, tipologia) {
    let url = `${API_URL}/api/mapa/delitos/agregado/${nivel}?periodo=${periodo}`;
    // ✅ Usa los parámetros recibidos
    if (tipologia) {
        url += `&tipologia=${encodeURIComponent(tipologia)}`;
    }
}
```

### Problema 3: Panel de información no coincidía con datos filtrados

**Causa:** La función `updateInfoPanel()` solo buscaba en el diccionario `nombresCCAA`, que no funcionaba para provincias/municipios.

**Solución:**
```javascript
function updateInfoPanel(props) {
    const nombreGeoJSON = props.NAMEUNIT;
    
    // Primero intentar diccionario CCAA
    let clave = nombresCCAA[nombreGeoJSON];
    let datos = datosDelitos[clave];
    
    // Si no encuentra, buscar por nombre directo
    if (!datos) {
        const nombreBusqueda = nombreGeoJSON.toUpperCase();
        datos = datosDelitos[nombreBusqueda];
        
        // Si aún no encuentra, buscar por coincidencia parcial
        if (!datos) {
            Object.keys(datosDelitos).forEach(key => {
                if (key.includes(nombreBusqueda)) {
                    datos = datosDelitos[key];
                }
            });
        }
    }
    // ... mostrar datos
}
```

### Problema 4: Incompatibilidad con Safari/Brave móvil

**Causa:** Eventos `click` no se disparaban correctamente en iOS.

**Solución:** Usar elementos HTML5 nativos (`<details>` y `<summary>`) en lugar de JavaScript:

```html
<details class="filtros-details" open>
    <summary class="filtros-summary">
        <h2>Filtros</h2>
        <span class="toggle-arrow">▼</span>
    </summary>
    <div class="filtros-content">
        <!-- Contenido -->
    </div>
</details>
```

**CSS para desktop vs móvil:**
```css
/* Desktop: Siempre abierto */
@media (min-width: 769px) {
    .filtros-summary {
        display: none;
    }
}

/* Móvil: Colapsable nativo */
@media (max-width: 768px) {
    .filtros-summary {
        display: flex;
    }
}
```

### Problema 5: Caché del navegador no actualizaba JavaScript

**Causa:** El navegador cachea agresivamente los archivos `.js`.

**Solución:** Versionado de archivos estáticos:

```html
<!-- Incrementar versión en cada deploy -->
<script src="/static/js/app.js?v=5"></script>
```

### Problema 6: Normalización de claves entre API y GeoJSON

**Causa:** La API devuelve claves como `"CCAA 01 Andalucía"` pero necesitamos `"ANDALUCÍA"` para hacer match con GeoJSON.

**Solución:** Procesamiento diferenciado por nivel:

```javascript
data.datos.forEach(item => {
    let clave;
    
    if (nivel === 'ccaa') {
        clave = item.geo.replace(/^CCAA \d+ /, '').toUpperCase();
    } else if (nivel === 'provincia') {
        clave = item.geo.replace(/^Provincia \d+ /, '').toUpperCase();
    } else if (nivel === 'municipio') {
        clave = item.geo.replace(/^\d+ /, '').toUpperCase();
    }
    
    datosMap[clave] = item;
});
```

---

## 📊 Fuente de Datos

Los datos provienen de los **Balances Trimestrales de Criminalidad** publicados por el Ministerio del Interior de España.

**Fuente oficial:** https://estadisticasdecriminalidad.ses.mir.es/publico/portalestadistico/balances

**Periodo disponible:** 2015 - Junio 2025

---

## 🔮 Roadmap

### Próximas funcionalidades
- [ ] Gráficos de evolución temporal
- [ ] Comparativas entre regiones
- [ ] Exportación de datos (CSV/Excel)
- [ ] Búsqueda de municipios
- [ ] Soporte offline con Service Workers
- [ ] Mapa de calor (heatmap)
- [ ] Análisis de tendencias

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Añadir nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

## 📝 Licencia

Este proyecto es de código abierto. Los datos de criminalidad son propiedad del Ministerio del Interior de España.

---

## 👤 Autor

**Sergio Velayos Fernández**

- LinkedIn: https://www.linkedin.com/in/sergiovelayos/
- GitHub: https://github.com/sergiovelayos

---

## 🙏 Agradecimientos

- Ministerio del Interior de España por los datos públicos
- OpenStreetMap por los mapas base
- Leaflet.js por la biblioteca de mapas
- FastAPI por el framework backend
