"""
Configuración de conexión a PostgreSQL
"""
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Configuración de PostgreSQL desde variables de entorno
DB_CONFIG = {
    'host': os.getenv('PG_HOST', 'localhost'),
    'port': int(os.getenv('PG_PORT', 5432)),
    'database': os.getenv('PG_DATABASE', 'criminalidad_espana'),
    'user': os.getenv('PG_USER'),
    'password': os.getenv('PG_PASSWORD')
}

def get_db_connection():
    """
    Crea y retorna una conexión a PostgreSQL
    """
    try:
        conn = psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)
        return conn
    except Exception as e:
        print(f"Error conectando a PostgreSQL: {e}")
        raise

def test_connection():
    """
    Prueba la conexión a la base de datos
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        cursor.close()
        conn.close()
        return True, version
    except Exception as e:
        return False, str(e)
