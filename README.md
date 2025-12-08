# Criminalidad España - Aplicación Web Interactiva

Aplicación web para visualización interactiva de datos de criminalidad en España a diferentes niveles geográficos (Nacional, CCAA, Provincias y Municipios).

## 🌐 Acceso

- **Producción**: https://delitos.hookponent.cc
- **Local**: http://192.168.0.100:8001
- **Documentación API**: https://delitos.hookponent.cc/docs

## 📋 Características

### Niveles Geográficos
- **Nacional**: Estadísticas agregadas de toda España
- **Comunidades Autónomas**: 19 CCAA con visualización coroplética
- **Provincias**: 51 provincias (incluye fallback para provincias uniprovinciales)
- **Municipios**: ~400 municipios con más de 20,000 habitantes

### Funcionalidades
- ✅ **Filtros dinámicos**:
  - Selección de nivel geográfico
  - Periodo temporal (2015-2025, datos trimestrales)
  - Tipología de delito (19 categorías)
  
- ✅ **Visualización**:
  - Mapa interactivo con Leaflet.js
  - Colores adaptativos según datos
  - Leyenda dinámica con valores reales
  - Panel informativo con estadísticas
  
- ✅ **Interacción**:
  - Hover: Resalta región y muestra datos
  - Click: Zoom a región
  - Responsive: Funciona en desktop y móvil

## 🏗️ Arquitectura

### Backend
- **Framework**: FastAPI 0.109.0
- **Base de datos**: PostgreSQL (Docker)
- **ORM**: psycopg2-binary 2.9.9
- **Puerto**: 8001

### Frontend
- **Mapa**: Leaflet.js 1.9.4
- **Estilos**: CSS vanilla
- **Geometrías**: GeoJSON (comunidades, provincias, municipios)

### Infraestructura
- **Servidor**: Ubuntu 24
- **Deployment**: Cloudflare Tunnel
- **Servicios**: systemd (auto-inicio)

## 📁 Estructura del Proyecto

```
/home/sergio/criminalidad_app/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # Aplicación FastAPI principal
│   │   ├── database.py             # Conexión PostgreSQL
│   │   └── routes/
│   │       ├── __init__.py
│   │       └── mapa.py             # Endpoints de datos
│   └── requirements.txt
├── frontend/
│   ├── index.html                  # Página principal
│   └── static/
│       ├── css/
│       └── js/
│           └── app.js              # Lógica de la aplicación
├── data/
│   └── mapas/
│       ├── comunidades.geojson     # 19 CCAA
│       ├── provincias.geojson      # 51 provincias
│       └── municipios.geojson      # ~8000 municipios
├── .env                            # Variables de entorno
└── .venv/                          # Entorno virtual Python
```

## 🗄️ Base de Datos

### Tabla Principal: `delitos_aux`

```sql
CREATE TABLE delitos_aux (
    id SERIAL PRIMARY KEY,
    periodo DATE,                   -- Fecha del periodo
    geo TEXT,                       -- Geografía (Nacional, CCAA, Provincia, Municipio)
    tipo TEXT,                      -- Tipo de delito
    valor_acumulado INTEGER,        -- Número de delitos
    valor NUMERIC,                  -- Valor específico
    pob INTEGER,                    -- Población
    tasa NUMERIC,                   -- Tasa por mil habitantes
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Formato de Geografía

- **Nacional**: `NACIONAL`
- **CCAA**: `CCAA 01 Andalucía`, `CCAA 09 Cataluña`, etc.
- **Provincia**: `Provincia 01 Álava`, `Provincia 28 Madrid`, etc.
- **Municipio**: `50297 Zaragoza`, `01059 Vitoria-Gasteiz`, etc.

### Tablas Auxiliares

- `pob_ccaa`: Población por comunidad autónoma
- `pob_provincias`: Población por provincia (código `cpro`)
- `pob_municipios`: Población por municipio
- `diccionario_municipios`: Mapeo de códigos de municipio

## 🔌 API Endpoints

### GET `/api/mapa/periodos`
Lista todos los periodos disponibles.

**Respuesta:**
```json
{
  "periodos": [
    "2025-06-01",
    "2025-03-01",
    "2024-12-01",
    ...
  ]
}
```

### GET `/api/mapa/tipologias`
Lista todas las tipologías de delitos disponibles.

**Respuesta:**
```json
{
  "tipologias": [
    "Total Criminalidad",
    "Homicidios dolosos y asesinatos consumados",
    "Hurtos",
    "Robos con violencia e intimidación",
    ...
  ]
}
```

### GET `/api/mapa/delitos/agregado/{nivel}`
Obtiene datos agregados por nivel geográfico.

**Parámetros:**
- `nivel`: `nacional`, `ccaa`, `provincia`, `municipio`
- `periodo`: Fecha en formato `YYYY-MM-DD` (ej: `2024-06-01`)
- `tipologia`: Tipo de delito específico (opcional)

**Ejemplo:**
```bash
curl "http://localhost:8001/api/mapa/delitos/agregado/ccaa?periodo=2024-06-01"
```

**Respuesta:**
```json
{
  "nivel": "ccaa",
  "periodo": "2024-06-01",
  "tipologia": null,
  "total_registros": 19,
  "datos": [
    {
      "geo": "CCAA 09 Cataluña",
      "total_delitos": 401234,
      "num_tipologias": 18,
      "poblacion": 8034743,
      "tasa_por_mil": 49.95
    },
    ...
  ]
}
```

## 🎨 Frontend - Detalles Técnicos

### Matching de Códigos Geográficos

#### CCAA
Usa diccionario de nombres:
```javascript
const nombresCCAA = {
    'Andalucía': 'ANDALUCÍA',
    'Cataluña/Catalunya': 'CATALUÑA',
    ...
};
```

#### Provincias
Extrae código de NATCODE (posiciones 4-5):
```javascript
// NATCODE: 34132800000 → Código: 28 (Madrid)
const codigoProvincia = natcode.substring(4, 6);
```

**Provincias uniprovinciales** (sin datos provinciales propios):
- Usan datos de CCAA como fallback
- Muestran mensaje informativo: "ℹ️ Datos a nivel de comunidad autónoma"
- Códigos: 07 (Baleares), 26 (La Rioja), 28 (Madrid), 30 (Murcia), 31 (Navarra), 33 (Asturias), 39 (Cantabria)

#### Municipios
Extrae código de NATCODE (posiciones 6-10):
```javascript
// NATCODE: 34025050297 → Código: 50297 (Zaragoza)
const codigoMunicipio = natcode.substring(6, 11);
```

**Nota**: Solo municipios con +20,000 habitantes tienen datos.

### Colores Dinámicos

Los umbrales de color se calculan automáticamente según los datos actuales:

```javascript
function calcularUmbrales(datos) {
    const tasas = Object.values(datos).map(d => d.tasa_por_mil).sort();
    return {
        min: tasas[0],
        q1: tasas[Math.floor(n * 0.2)],  // Percentil 20
        q2: tasas[Math.floor(n * 0.4)],  // Percentil 40
        q3: tasas[Math.floor(n * 0.6)],  // Percentil 60
        q4: tasas[Math.floor(n * 0.8)],  // Percentil 80
        max: tasas[n - 1]
    };
}
```

Escala de colores (de bajo a alto):
- `#fee5d9` → Bajo (<20%)
- `#fcae91` → Medio-bajo (20-40%)
- `#fb6a4a` → Medio (40-60%)
- `#de2d26` → Medio-alto (60-80%)
- `#a50f15` → Alto (>80%)

## 🚀 Instalación y Configuración

### Requisitos Previos
- Ubuntu 24 (servidor)
- Python 3.12+
- PostgreSQL (Docker)
- Cloudflare Tunnel

### 1. Clonar/Copiar el Proyecto

```bash
# La estructura debe estar en:
/home/sergio/criminalidad_app/
```

### 2. Configurar Entorno Virtual

```bash
cd /home/sergio/criminalidad_app
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 3. Configurar Variables de Entorno

Copiar el archivo de ejemplo y editar con tus credenciales:

```bash
cp .env.example .env
nano .env
```

Configurar las siguientes variables:

```bash
PG_USER=tu_usuario_postgres
PG_PASSWORD=tu_password_seguro
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=criminalidad
```

**⚠️ IMPORTANTE**: Nunca subas el archivo `.env` a GitHub. Está incluido en `.gitignore`.

### 4. Iniciar Base de Datos

```bash
# PostgreSQL en Docker
docker start postgres_db

# Verificar conexión
docker exec -it postgres_db psql -U sergio -d criminalidad -c "SELECT COUNT(*) FROM delitos_aux;"
```

### 5. Iniciar FastAPI (Manual)

```bash
cd /home/sergio/criminalidad_app/backend
source ../.venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### 6. Configurar como Servicio (Recomendado)

Crear `/etc/systemd/system/criminalidad.service`:

```ini
[Unit]
Description=Criminalidad España - FastAPI Application
After=network.target postgresql.service

[Service]
Type=simple
User=sergio
WorkingDirectory=/home/sergio/criminalidad_app/backend
Environment="PATH=/home/sergio/criminalidad_app/.venv/bin"
ExecStart=/home/sergio/criminalidad_app/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Activar:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable criminalidad
sudo systemctl start criminalidad
sudo systemctl status criminalidad
```

### 7. Configurar Cloudflare Tunnel

Editar `/etc/cloudflared/config.yml`:

```yaml
tunnel: 3175b2cb-0a3b-4e06-9ed7-3557b8b7c3e0
credentials-file: /home/sergio/.cloudflared/3175b2cb-0a3b-4e06-9ed7-3557b8b7c3e0.json

ingress:
  - hostname: energia.hookponent.cc
    service: http://127.0.0.1:3000
  - hostname: delitos.hookponent.cc
    service: http://127.0.0.1:8001
  - service: http_status:404
```

**Reiniciar:**
```bash
sudo systemctl restart cloudflared
```

### 8. Configurar DNS en Cloudflare

En [Cloudflare Dashboard](https://dash.cloudflare.com):

- **Type**: CNAME
- **Name**: delitos
- **Target**: `3175b2cb-0a3b-4e06-9ed7-3557b8b7c3e0.cfargotunnel.com`
- **Proxy status**: Proxied ☁️

## 🔧 Comandos Útiles

### Ver Logs del Servicio
```bash
sudo journalctl -u criminalidad -f
```

### Reiniciar Servicio
```bash
sudo systemctl restart criminalidad
```

### Ver Estado del Puerto
```bash
sudo lsof -i :8001
```

### Probar API
```bash
# Health check
curl http://localhost:8001/health

# Listar periodos
curl http://localhost:8001/api/mapa/periodos

# Datos de CCAA
curl "http://localhost:8001/api/mapa/delitos/agregado/ccaa?periodo=2024-06-01"
```

### Base de Datos
```bash
# Conectar a PostgreSQL
docker exec -it postgres_db psql -U sergio -d criminalidad

# Ver registros
SELECT COUNT(*) FROM delitos_aux;
SELECT DISTINCT periodo FROM delitos_aux ORDER BY periodo DESC LIMIT 10;
SELECT DISTINCT tipo FROM delitos_aux ORDER BY tipo;
```

## 📊 Datos

### Fuente
Datos de criminalidad del Ministerio del Interior de España.

### Periodicidad
- Datos trimestrales (marzo, junio, septiembre, diciembre)
- Rango: 2015-2025

### Cobertura Geográfica
- **Nacional**: Agregado de toda España
- **CCAA**: 19 comunidades autónomas
- **Provincias**: 51 provincias + Ceuta + Melilla
- **Municipios**: Solo municipios con población >20,000 habitantes (~400)

### Tipologías de Delitos
1. Total Criminalidad
2. Homicidios dolosos y asesinatos consumados
3. Homicidios dolosos y asesinatos en grado tentativa
4. Agresión sexual con penetración
5. Resto de delitos contra la libertad sexual
6. Delitos contra la libertad e indemnidad sexual
7. Delitos graves y menos graves de lesiones y riña tumultuaria
8. Secuestro
9. Robos con violencia e intimidación
10. Robos con fuerza en domicilios, establecimientos y otras instalaciones
11. Sustracciones de vehículos
12. Hurtos
13. Daños
14. Estafas informáticas
15. Otros ciberdelitos
16. Subtotal Cibercriminalidad
17. Subtotal Criminalidad Convencional
18. Tráfico de drogas
19. Resto de infracciones penales

## 🐛 Troubleshooting

### El mapa no carga
1. Verificar que FastAPI está corriendo: `sudo systemctl status criminalidad`
2. Ver logs: `sudo journalctl -u criminalidad -f`
3. Probar API localmente: `curl http://localhost:8001/health`

### No aparecen datos
1. Verificar que PostgreSQL está corriendo: `docker ps | grep postgres`
2. Probar query: `docker exec -it postgres_db psql -U sergio -d criminalidad -c "SELECT COUNT(*) FROM delitos_aux;"`
3. Ver logs de FastAPI para errores de conexión

### Cloudflare Tunnel no funciona
1. Ver estado: `sudo systemctl status cloudflared`
2. Ver logs: `sudo journalctl -u cloudflared -f`
3. Verificar DNS en Cloudflare Dashboard

### Provincias sin datos (Madrid, Navarra, etc.)
**Esperado**: Estas provincias uniprovinciales obtienen datos a nivel de CCAA automáticamente y muestran el mensaje informativo.

### Municipios transparentes
**Esperado**: Solo municipios con +20,000 habitantes tienen datos. Los demás aparecen transparentes.

## 📈 Futuras Mejoras

- [ ] Tabla exportable con todos los datos (CSV/Excel)
- [ ] Gráficos de evolución temporal (Chart.js)
- [ ] Comparativas entre regiones
- [ ] Heatmap temporal
- [ ] Búsqueda de municipios
- [ ] Modo oscuro
- [ ] Más páginas informativas (metodología, fuentes)

## 👨‍💻 Desarrollo

### Añadir Nuevas Páginas

La aplicación está preparada para múltiples páginas. Para añadir nuevas rutas:

1. Crear HTML en `/home/sergio/criminalidad_app/frontend/`
2. Actualizar `main.py` para servir la nueva ruta
3. Ejemplo:

```python
@app.get("/metodologia")
async def metodologia():
    return FileResponse("/home/sergio/criminalidad_app/frontend/metodologia.html")
```

### Actualizar Datos

Para actualizar con nuevos datos del Ministerio del Interior:

1. Procesar datos nuevos al formato de `delitos_aux`
2. Insertar en PostgreSQL
3. La aplicación detectará automáticamente nuevos periodos

## 📝 Licencia

Proyecto interno - Datos públicos del Ministerio del Interior de España.

## 🙋 Autor

**Sergio** - Desarrollo completo de la aplicación
- Backend: FastAPI + PostgreSQL
- Frontend: Leaflet.js + JavaScript vanilla
- Deployment: Cloudflare Tunnel + systemd

---

**Última actualización**: Diciembre 2025
**Versión**: 1.0.0
