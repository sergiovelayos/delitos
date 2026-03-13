-- Esquema para datos geográficos y demográficos del INE

-- Tabla de Comunidades Autónomas
CREATE TABLE IF NOT EXISTS comunidades (
    id VARCHAR(2) PRIMARY KEY, -- CODAUTO
    nombre VARCHAR(100) NOT NULL
);

-- Tabla de Provincias
CREATE TABLE IF NOT EXISTS provincias (
    id VARCHAR(2) PRIMARY KEY, -- CPRO
    nombre VARCHAR(100) NOT NULL,
    comunidad_id VARCHAR(2) REFERENCES comunidades(id)
);

-- Tabla de Municipios
CREATE TABLE IF NOT EXISTS municipios (
    id VARCHAR(5) PRIMARY KEY, -- Código INE completo (CPRO + CMUN)
    nombre VARCHAR(150) NOT NULL,
    cod_municipio_corto VARCHAR(3) NOT NULL, -- CMUN
    dc VARCHAR(1), -- Dígito de control
    provincia_id VARCHAR(2) REFERENCES provincias(id),
    comunidad_id VARCHAR(2) REFERENCES comunidades(id) -- Desnormalizado para consultas rápidas
);

-- Tabla de Población
CREATE TABLE IF NOT EXISTS poblacion (
    id SERIAL PRIMARY KEY,
    municipio_id VARCHAR(5) REFERENCES municipios(id),
    anio INTEGER NOT NULL,
    sexo VARCHAR(10) NOT NULL, -- 'Total', 'Hombres', 'Mujeres'
    valor INTEGER NOT NULL,
    UNIQUE(municipio_id, anio, sexo)
);

-- Índices para mejorar el rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_municipios_provincia ON municipios(provincia_id);
CREATE INDEX IF NOT EXISTS idx_municipios_comunidad ON municipios(comunidad_id);
CREATE INDEX IF NOT EXISTS idx_poblacion_municipio ON poblacion(municipio_id);
CREATE INDEX IF NOT EXISTS idx_poblacion_anio ON poblacion(anio);
