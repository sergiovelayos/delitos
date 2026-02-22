import os
import csv
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# Cargar variables de entorno desde el directorio backend
# Asumimos que el script se ejecuta desde la raíz del proyecto o desde scripts/
backend_env_path = os.path.join(os.path.dirname(__file__), '../backend/.env')
if os.path.exists(backend_env_path):
    load_dotenv(backend_env_path)
else:
    load_dotenv() # Intenta cargar desde el directorio actual si no encuentra el otro

# Configuración de base de datos
DB_CONFIG = {
    'host': os.getenv('PG_HOST', 'localhost'),
    'port': int(os.getenv('PG_PORT', 5432)),
    'database': os.getenv('PG_DATABASE', 'criminalidad_espana'),
    'user': os.getenv('PG_USER'),
    'password': os.getenv('PG_PASSWORD')
}

def get_db_connection():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"Error conectando a la base de datos: {e}")
        return None

def ejecutar_schema(conn):
    print("Ejecutando esquema de base de datos...")
    schema_path = os.path.join(os.path.dirname(__file__), '../backend/app/schemas/schema_ine.sql')
    try:
        with open(schema_path, 'r') as f:
            schema_sql = f.read()
        
        with conn.cursor() as cur:
            cur.execute(schema_sql)
        conn.commit()
        print("Esquema ejecutado correctamente.")
    except Exception as e:
        print(f"Error ejecutando esquema: {e}")
        conn.rollback()

def importar_geografia(conn):
    print("Importando datos geográficos...")
    ccaa_prov_path = 'data/diccionario_geografia/ccaa_provincia.csv'
    municipios_path = 'data/diccionario_geografia/municipios.csv'
    
    # 1. Importar Comunidades y Provincias
    comunidades = {} # id -> nombre
    provincias = {} # id -> (nombre, comunidad_id)
    
    try:
        with open(ccaa_prov_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f, delimiter=';')
            print(f"Columnas detectadas en CCAA/Prov: {reader.fieldnames}")
            for row in reader:
                comunidades[row['CODAUTO']] = row['NOMBRE_CCAA']
                provincias[row['CPRO']] = (row['NOMBRE_PROVINCIA'], row['CODAUTO'])
        
        with conn.cursor() as cur:
            # Insertar Comunidades
            print(f"Insertando {len(comunidades)} Comunidades Autónomas...")
            execute_values(cur, 
                "INSERT INTO comunidades (id, nombre) VALUES %s ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre",
                list(comunidades.items())
            )
            
            # Insertar Provincias
            print(f"Insertando {len(provincias)} Provincias...")
            prov_data = [(k, v[0], v[1]) for k, v in provincias.items()]
            execute_values(cur,
                "INSERT INTO provincias (id, nombre, comunidad_id) VALUES %s ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, comunidad_id = EXCLUDED.comunidad_id",
                prov_data
            )
        conn.commit()
            
    except Exception as e:
        print(f"Error importando CCAA/Provincias: {e}")
        conn.rollback()
        return

    # 2. Importar Municipios
    municipios_data = []
    
    try:
        with open(municipios_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f, delimiter=';')
            print(f"Columnas detectadas en Municipios: {reader.fieldnames}")
            for row in reader:
                # Construir ID completo: CPRO + CMUN
                # Asegurar padding con ceros si es necesario (aunque el CSV parece tenerlo)
                cpro = row['CPRO'].zfill(2)
                cmun = row['CMUN'].zfill(3)
                municipio_id = cpro + cmun
                
                municipios_data.append((
                    municipio_id,
                    row['NOMBRE_MUNICIPIO'],
                    cmun,
                    row['DC'],
                    cpro,
                    row['CODAUTO']
                ))
        
        with conn.cursor() as cur:
            print(f"Insertando {len(municipios_data)} Municipios...")
            execute_values(cur,
                """
                INSERT INTO municipios (id, nombre, cod_municipio_corto, dc, provincia_id, comunidad_id) 
                VALUES %s 
                ON CONFLICT (id) DO UPDATE SET 
                    nombre = EXCLUDED.nombre,
                    cod_municipio_corto = EXCLUDED.cod_municipio_corto,
                    dc = EXCLUDED.dc,
                    provincia_id = EXCLUDED.provincia_id,
                    comunidad_id = EXCLUDED.comunidad_id
                """,
                municipios_data
            )
        conn.commit()
        print("Datos geográficos importados correctamente.")
        
    except Exception as e:
        print(f"Error importando Municipios: {e}")
        conn.rollback()

def importar_poblacion(conn):
    print("Importando datos de población...")
    poblacion_path = 'data/poblacion/pob21_25_municipios_spain.csv'
    
    datos_poblacion = []
    
    try:
        with open(poblacion_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f, delimiter=';')
            print(f"Columnas detectadas en Población: {reader.fieldnames}")
            for row in reader:
                municipio_raw = row['Municipios']
                
                # Saltar filas de resumen nacional o autonómico si no tienen código numérico al inicio
                if not municipio_raw or not municipio_raw[0].isdigit():
                    continue
                
                # Extraer código INE (primeros 5 dígitos)
                # Formato esperado: "01001 Alegría-Dulantzi"
                parts = municipio_raw.split(' ', 1)
                if len(parts) < 2:
                    continue
                    
                municipio_id = parts[0]
                if len(municipio_id) != 5:
                     # Intentar limpiar o validar si es necesario
                     continue

                sexo = row['Sexo']
                periodo = int(row['Periodo'])
                # Limpiar el valor (quitar puntos de miles)
                valor_str = row['Total'].replace('.', '')
                try:
                    valor = int(valor_str)
                except ValueError:
                    continue
                
                datos_poblacion.append((
                    municipio_id,
                    periodo,
                    sexo,
                    valor
                ))
        
        with conn.cursor() as cur:
            print(f"Insertando {len(datos_poblacion)} registros de población...")
            # Usamos executemany con lotes para eficiencia, pero execute_values es mejor
            # Dividir en lotes de 1000 si es muy grande, execute_values maneja bien esto
            execute_values(cur,
                """
                INSERT INTO poblacion (municipio_id, anio, sexo, valor) 
                VALUES %s 
                ON CONFLICT (municipio_id, anio, sexo) DO UPDATE SET valor = EXCLUDED.valor
                """,
                datos_poblacion
            )
        conn.commit()
        print("Datos de población importados correctamente.")
        
    except Exception as e:
        print(f"Error importando Población: {e}")
        conn.rollback()

def main():
    conn = get_db_connection()
    if not conn:
        return
    
    try:
        ejecutar_schema(conn)
        importar_geografia(conn)
        importar_poblacion(conn)
    finally:
        conn.close()
        print("Conexión cerrada.")

if __name__ == "__main__":
    main()
