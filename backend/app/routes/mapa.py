"""
Router para endpoints de datos de mapas
"""
from fastapi import APIRouter, HTTPException
from app.database import get_db_connection

router = APIRouter(prefix="/api/mapa", tags=["mapa"])


@router.get("/delitos/{nivel}")
async def get_delitos_por_geografia(
    nivel: str,
    tipologia: str = None,
    periodo: str = None
):
    """
    Obtiene datos de delitos agregados por nivel geográfico
    
    Parámetros:
    - nivel: 'municipio', 'provincia', 'ccaa', 'nacional'
    - tipologia: Filtro opcional por tipo de delito
    - periodo: Filtro opcional por periodo
    """
    
    # Validar nivel
    if nivel not in ['municipio', 'provincia', 'ccaa', 'nacional']:
        raise HTTPException(status_code=400, detail="Nivel debe ser: municipio, provincia, ccaa o nacional")
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Query simple para testing
        query = """
            SELECT 
                geografia,
                tipologia_penal,
                periodo,
                total
            FROM delitos
            WHERE periodo NOT LIKE 'Variación%%'
            LIMIT 10
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        # Convertir a lista de diccionarios
        datos = []
        if rows:
            for row in rows:
                datos.append(dict(row))
        
        cursor.close()
        conn.close()
        
        return {
            "nivel": nivel,
            "total_registros": len(datos),
            "datos": datos
        }
        
    except Exception as e:
        import traceback
        raise HTTPException(
            status_code=500, 
            detail=f"Error: {str(e)}\nTraceback: {traceback.format_exc()}"
        )


@router.get("/delitos/agregado/{nivel}")
async def get_delitos_agregado(
    nivel: str,
    periodo: str = "2024-06-01",
    tipologia: str = None
):
    """
    Obtiene datos de delitos AGREGADOS por nivel geográfico desde delitos_aux
    Suma todos los delitos por geografía
    
    Parámetros:
    - nivel: 'ccaa', 'provincia', 'municipio', 'nacional'
    - periodo: Fecha en formato YYYY-MM-DD (default: 2024-06-01)
    - tipologia: Tipo de delito específico (opcional)
    """
    
    if nivel not in ['ccaa', 'provincia', 'municipio', 'nacional']:
        raise HTTPException(status_code=400, detail="Nivel debe ser: ccaa, provincia, municipio o nacional")
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Filtro según nivel
        if nivel == 'ccaa':
            geo_filter = "geo LIKE 'CCAA%%'"
        elif nivel == 'provincia':
            geo_filter = "geo LIKE 'Provincia%%'"
        elif nivel == 'municipio':
            geo_filter = "geo ~ '^[0-9]'"  # Empieza con números (CP)
        else:  # nacional
            geo_filter = "geo = 'NACIONAL'"
        
        # Filtro de tipología
        tipo_filter = ""
        params = [periodo]
        if tipologia:
            tipo_filter = "AND tipo = %s"
            params.append(tipologia)
        
        # Query que agrupa y suma por geografía
        query = f"""
            SELECT 
                geo,
                SUM(valor_acumulado) as total_delitos,
                COUNT(DISTINCT tipo) as num_tipologias,
                MAX(pob) as poblacion,
                CASE 
                    WHEN MAX(pob) > 0 THEN ROUND((SUM(valor_acumulado)::numeric / MAX(pob) * 1000), 2)
                    ELSE 0 
                END as tasa_por_mil
            FROM delitos_aux
            WHERE periodo = %s
                AND {geo_filter}
                {tipo_filter}
            GROUP BY geo
            ORDER BY total_delitos DESC
        """
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # Convertir a lista de diccionarios
        datos = []
        if rows:
            for row in rows:
                datos.append({
                    "geo": row['geo'],
                    "total_delitos": int(row['total_delitos']) if row['total_delitos'] else 0,
                    "num_tipologias": row['num_tipologias'],
                    "poblacion": int(row['poblacion']) if row['poblacion'] else 0,
                    "tasa_por_mil": float(row['tasa_por_mil']) if row['tasa_por_mil'] else 0
                })
        
        cursor.close()
        conn.close()
        
        return {
            "nivel": nivel,
            "periodo": periodo,
            "tipologia": tipologia,
            "total_registros": len(datos),
            "datos": datos
        }
        
    except Exception as e:
        import traceback
        raise HTTPException(
            status_code=500, 
            detail=f"Error: {str(e)}\nTraceback: {traceback.format_exc()}"
        )


@router.get("/periodos")
async def get_periodos():
    """
    Obtiene lista de periodos disponibles desde delitos_aux
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT DISTINCT periodo 
            FROM delitos_aux 
            ORDER BY periodo DESC
        """)
        
        resultados = cursor.fetchall()
        periodos = [row['periodo'].strftime('%Y-%m-%d') for row in resultados]
        
        cursor.close()
        conn.close()
        
        return {"periodos": periodos}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en base de datos: {str(e)}")


@router.get("/tipologias")
async def get_tipologias():
    """
    Obtiene lista de tipologías de delitos disponibles desde delitos_aux
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT DISTINCT tipo
            FROM delitos_aux
            ORDER BY tipo
        """)

        resultados = cursor.fetchall()
        tipologias = [row['tipo'] for row in resultados]

        cursor.close()
        conn.close()

        return {"tipologias": tipologias}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en base de datos: {str(e)}")


@router.get("/delitos/evolucion/{nivel}")
async def get_evolucion_delitos(
    nivel: str,
    geo1: str,
    geo2: str = None,
    tipologia: str = None
):
    """
    Obtiene evolución temporal de delitos para una o dos geografías.
    Devuelve datos de todos los periodos disponibles.

    Parámetros:
    - nivel: 'ccaa', 'provincia', 'municipio', 'nacional'
    - geo1: Primera ubicación (ej: "CCAA 01 Andalucía")
    - geo2: Segunda ubicación opcional para comparar
    - tipologia: Tipo de delito específico (opcional)
    """

    if nivel not in ['ccaa', 'provincia', 'municipio', 'nacional']:
        raise HTTPException(status_code=400, detail="Nivel debe ser: ccaa, provincia, municipio o nacional")

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Construir lista de geografías a consultar
        geografias = [geo1]
        if geo2:
            geografias.append(geo2)

        # Filtro de tipología
        tipo_filter = ""
        params = geografias.copy()
        if tipologia:
            tipo_filter = "AND tipo = %s"
            params.append(tipologia)

        # Crear placeholders para IN clause
        placeholders = ', '.join(['%s'] * len(geografias))

        # Query que obtiene evolución temporal (usa 'valor' no 'valor_acumulado')
        query = f"""
            SELECT
                geo,
                periodo,
                SUM(valor) as total_delitos,
                MAX(pob) as poblacion,
                CASE
                    WHEN MAX(pob) > 0 THEN ROUND((SUM(valor)::numeric / MAX(pob) * 1000), 2)
                    ELSE 0
                END as tasa_por_mil
            FROM delitos_aux
            WHERE geo IN ({placeholders})
                {tipo_filter}
            GROUP BY geo, periodo
            ORDER BY geo, periodo
        """

        cursor.execute(query, params)
        rows = cursor.fetchall()

        # Organizar datos por geografía
        datos_por_geo = {}
        for row in rows:
            geo = row['geo']
            if geo not in datos_por_geo:
                datos_por_geo[geo] = []

            datos_por_geo[geo].append({
                "periodo": row['periodo'].strftime('%Y-%m-%d'),
                "total_delitos": int(row['total_delitos']) if row['total_delitos'] else 0,
                "poblacion": int(row['poblacion']) if row['poblacion'] else 0,
                "tasa_por_mil": float(row['tasa_por_mil']) if row['tasa_por_mil'] else 0
            })

        # Formatear respuesta
        datos = []
        for geo, evolucion in datos_por_geo.items():
            datos.append({
                "geo": geo,
                "evolucion": evolucion
            })

        cursor.close()
        conn.close()

        return {
            "nivel": nivel,
            "tipologia": tipologia,
            "datos": datos
        }

    except Exception as e:
        import traceback
        raise HTTPException(
            status_code=500,
            detail=f"Error: {str(e)}\nTraceback: {traceback.format_exc()}"
        )
