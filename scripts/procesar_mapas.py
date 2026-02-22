#!/usr/bin/env python3
"""
Script para procesar shapefiles del CNIG y generar GeoJSON simplificados.

Este script combina los shapefiles de Península+Baleares y Canarias,
simplifica las geometrías para optimizar el rendimiento web, y genera
archivos GeoJSON listos para usar con Leaflet.

Uso:
    python procesar_mapas.py --input-dir ./shapefiles --output-dir ./geojson

Requisitos:
    pip install geopandas pandas shapely

Autor: Sergio Velayos
Fecha: 2025
"""

import argparse
import os
import sys
from pathlib import Path

try:
    import geopandas as gpd
    import pandas as pd
except ImportError:
    print("Error: Instala las dependencias con: pip install geopandas pandas")
    sys.exit(1)


# Configuración de archivos del CNIG
# Los nombres siguen el patrón: recintos_{tipo}_inspire_{zona}_{crs}.shp
ARCHIVOS_CNIG = {
    "ccaa": {
        "peninsula": "recintos_autonomicas_inspire_peninbal_etrs89.shp",
        "canarias": "recintos_autonomicas_inspire_canarias_regcan95.shp",
        "output": "comunidades.geojson",
        "tolerance": 0.01,  # Mayor simplificación para CCAA
    },
    "provincias": {
        "peninsula": "recintos_provinciales_inspire_peninbal_etrs89.shp",
        "canarias": "recintos_provinciales_inspire_canarias_regcan95.shp",
        "output": "provincias.geojson",
        "tolerance": 0.005,
    },
    "municipios": {
        "peninsula": "recintos_municipales_inspire_peninbal_etrs89.shp",
        "canarias": "recintos_municipales_inspire_canarias_regcan95.shp",
        "output": "municipios.geojson",
        "tolerance": 0.001,  # Menor simplificación para municipios
    },
}


def cargar_shapefile(filepath: str) -> gpd.GeoDataFrame:
    """Carga un shapefile y lo convierte a WGS84."""
    print(f"  Cargando: {filepath}")

    if not os.path.exists(filepath):
        raise FileNotFoundError(f"No se encontró el archivo: {filepath}")

    gdf = gpd.read_file(filepath)

    # Reproyectar a WGS84 (EPSG:4326) para compatibilidad con Leaflet
    if gdf.crs and gdf.crs != "EPSG:4326":
        print(f"  Reproyectando de {gdf.crs} a EPSG:4326...")
        gdf = gdf.to_crs("EPSG:4326")

    return gdf


def simplificar_geometrias(gdf: gpd.GeoDataFrame, tolerance: float) -> gpd.GeoDataFrame:
    """Simplifica las geometrías para reducir el tamaño del archivo."""
    print(f"  Simplificando geometrías (tolerance={tolerance})...")
    gdf_simplified = gdf.copy()
    gdf_simplified["geometry"] = gdf_simplified["geometry"].simplify(
        tolerance, preserve_topology=True
    )
    return gdf_simplified


def procesar_nivel(
    input_dir: str,
    output_dir: str,
    nivel: str,
    config: dict,
    solo_peninsula: bool = False,
) -> None:
    """
    Procesa un nivel geográfico (ccaa, provincias, municipios).

    Args:
        input_dir: Directorio con los shapefiles descargados
        output_dir: Directorio donde guardar los GeoJSON
        nivel: Tipo de nivel (ccaa, provincias, municipios)
        config: Configuración del nivel (archivos, tolerance)
        solo_peninsula: Si True, solo procesa península+baleares (sin Canarias)
    """
    print(f"\n{'='*60}")
    print(f"Procesando: {nivel.upper()}")
    print(f"{'='*60}")

    gdfs = []

    # Cargar Península + Baleares
    peninsula_path = os.path.join(input_dir, config["peninsula"])
    if os.path.exists(peninsula_path):
        gdf_peninsula = cargar_shapefile(peninsula_path)
        gdfs.append(gdf_peninsula)
        print(f"  Registros Península+Baleares: {len(gdf_peninsula)}")
    else:
        print(f"  AVISO: No se encontró {config['peninsula']}")

    # Cargar Canarias (si existe y no es solo_peninsula)
    if not solo_peninsula:
        canarias_path = os.path.join(input_dir, config["canarias"])
        if os.path.exists(canarias_path):
            gdf_canarias = cargar_shapefile(canarias_path)
            gdfs.append(gdf_canarias)
            print(f"  Registros Canarias: {len(gdf_canarias)}")
        else:
            print(f"  AVISO: No se encontró {config['canarias']} - Canarias no se incluirá")

    if not gdfs:
        print(f"  ERROR: No se encontraron archivos para {nivel}")
        return

    # Combinar DataFrames
    print("  Combinando datasets...")
    gdf_combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True))
    gdf_combined.set_crs("EPSG:4326", inplace=True)
    print(f"  Total registros combinados: {len(gdf_combined)}")

    # Simplificar geometrías
    gdf_simplified = simplificar_geometrias(gdf_combined, config["tolerance"])

    # Guardar GeoJSON
    output_path = os.path.join(output_dir, config["output"])
    os.makedirs(output_dir, exist_ok=True)

    print(f"  Guardando: {output_path}")
    gdf_simplified.to_file(output_path, driver="GeoJSON")

    # Mostrar tamaño del archivo
    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"  Tamaño del archivo: {size_mb:.2f} MB")

    # Mostrar columnas disponibles
    print(f"  Columnas: {list(gdf_simplified.columns)}")


def listar_archivos_disponibles(input_dir: str) -> None:
    """Lista los archivos shapefile disponibles en el directorio."""
    print("\nArchivos .shp encontrados en el directorio:")
    print("-" * 50)

    shapefiles = list(Path(input_dir).rglob("*.shp"))

    if not shapefiles:
        print("  No se encontraron archivos .shp")
        print("\n  Descarga los shapefiles del CNIG:")
        print("  https://centrodedescargas.cnig.es/CentroDescargas/")
        print("  Buscar: 'Límites municipales, provinciales y autonómicos'")
    else:
        for shp in sorted(shapefiles):
            print(f"  {shp.name}")


def main():
    parser = argparse.ArgumentParser(
        description="Procesa shapefiles del CNIG y genera GeoJSON simplificados",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos de uso:
  %(prog)s --input-dir ./shapefiles --output-dir ./geojson
  %(prog)s --input-dir ./shapefiles --output-dir ./geojson --nivel provincias
  %(prog)s --listar --input-dir ./shapefiles

Descarga de shapefiles:
  1. Ir a https://centrodedescargas.cnig.es/CentroDescargas/
  2. Buscar "Límites municipales, provinciales y autonómicos"
  3. Descargar los archivos de Península+Baleares Y Canarias
  4. Extraer los ZIP en el directorio de entrada
        """,
    )

    parser.add_argument(
        "--input-dir",
        default="./shapefiles",
        help="Directorio con los shapefiles del CNIG (default: ./shapefiles)",
    )

    parser.add_argument(
        "--output-dir",
        default="./geojson",
        help="Directorio donde guardar los GeoJSON (default: ./geojson)",
    )

    parser.add_argument(
        "--nivel",
        choices=["ccaa", "provincias", "municipios", "todos"],
        default="todos",
        help="Nivel geográfico a procesar (default: todos)",
    )

    parser.add_argument(
        "--solo-peninsula",
        action="store_true",
        help="Procesar solo Península+Baleares (sin Canarias)",
    )

    parser.add_argument(
        "--listar",
        action="store_true",
        help="Listar archivos .shp disponibles en el directorio de entrada",
    )

    parser.add_argument(
        "--tolerance",
        type=float,
        help="Override de tolerancia de simplificación (default: varía por nivel)",
    )

    args = parser.parse_args()

    # Listar archivos disponibles
    if args.listar:
        listar_archivos_disponibles(args.input_dir)
        return

    print("=" * 60)
    print("PROCESADOR DE MAPAS CNIG -> GeoJSON")
    print("=" * 60)
    print(f"Directorio entrada: {args.input_dir}")
    print(f"Directorio salida:  {args.output_dir}")
    print(f"Nivel:              {args.nivel}")
    print(f"Solo península:     {args.solo_peninsula}")

    # Procesar niveles
    niveles = (
        list(ARCHIVOS_CNIG.keys()) if args.nivel == "todos" else [args.nivel]
    )

    for nivel in niveles:
        config = ARCHIVOS_CNIG[nivel].copy()

        # Override de tolerancia si se especificó
        if args.tolerance:
            config["tolerance"] = args.tolerance

        try:
            procesar_nivel(
                args.input_dir,
                args.output_dir,
                nivel,
                config,
                args.solo_peninsula,
            )
        except Exception as e:
            print(f"  ERROR procesando {nivel}: {e}")

    print("\n" + "=" * 60)
    print("PROCESAMIENTO COMPLETADO")
    print("=" * 60)


if __name__ == "__main__":
    main()
