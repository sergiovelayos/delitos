"""
FastAPI - Aplicación principal
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.database import test_connection
from app.routes import mapa
import os

# Crear aplicación FastAPI
app = FastAPI(
    title="Criminalidad España API",
    description="API para datos de criminalidad en España",
    version="1.0.0"
)

# Configurar CORS para permitir peticiones desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especifica dominios concretos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montar archivos estáticos - Rutas absolutas
frontend_path = "/home/sergio/criminalidad_app/frontend"
data_path = "/home/sergio/criminalidad_app/data"

app.mount("/static", StaticFiles(directory=f"{frontend_path}/static"), name="static")
app.mount("/data", StaticFiles(directory=data_path), name="data")

# Incluir routers
app.include_router(mapa.router)

@app.get("/")
async def root():
    """
    Servir página principal
    """
    return FileResponse("/home/sergio/criminalidad_app/frontend/index.html")

@app.get("/health")
async def health_check():
    """
    Verificar estado de la API y conexión a base de datos
    """
    db_ok, db_info = test_connection()
    
    return {
        "api": "ok",
        "database": "ok" if db_ok else "error",
        "database_info": db_info
    }
