#!/usr/bin/env python3
"""
Script para probar la configuración inicial de FastAPI
Ejecutar: python test_api.py
"""
import sys
import os

# Agregar el directorio backend al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.database import test_connection

def main():
    print("=" * 80)
    print("  TEST DE CONFIGURACIÓN INICIAL")
    print("=" * 80 + "\n")
    
    # Test 1: Verificar variables de entorno
    print("📋 Test 1: Variables de entorno")
    from dotenv import load_dotenv
    load_dotenv()
    
    required_vars = ['PG_USER', 'PG_PASSWORD', 'PG_HOST', 'PG_PORT', 'PG_DATABASE']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        print(f"   ❌ Faltan variables: {', '.join(missing_vars)}")
        print("   Crea el archivo .env con tus credenciales")
        return False
    else:
        print("   ✅ Todas las variables configuradas\n")
    
    # Test 2: Conexión a base de datos
    print("📋 Test 2: Conexión a PostgreSQL")
    db_ok, db_info = test_connection()
    
    if db_ok:
        print("   ✅ Conexión exitosa")
        print(f"   📊 {db_info}\n")
    else:
        print(f"   ❌ Error: {db_info}\n")
        return False
    
    print("=" * 80)
    print("✅ CONFIGURACIÓN CORRECTA")
    print("=" * 80 + "\n")
    
    print("Siguiente paso:")
    print("  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
    print("\nLuego visita:")
    print("  http://localhost:8000")
    print("  http://localhost:8000/health")
    print("  http://localhost:8000/docs  (documentación automática)")
    print()
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
