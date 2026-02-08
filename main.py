import os
import json
import logging
from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client
from motor import extraer_texto_pdf, generar_examen_ia, evaluar_respuesta_abierta
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

# --- CONFIGURACIÓN DE INFRAESTRUCTURA ---
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="UADE Study SaaS API")

# CORS Permisivo para evitar "Error de conexión" en despliegues dinámicos
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelos de Datos (Pydantic) - Crucial para que FastAPI no falle al arrancar
class EvaluacionRequest(BaseModel):
    pregunta: str
    respuesta_usuario: str
    contexto_previo: str

# Inicialización Segura de Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    logger.error("Error: Faltan llaves de Supabase en Environment Variables")
    # No levantamos error aquí para permitir que el proceso de build termine, 
    # pero los endpoints fallarán con logs claros.
    supabase = None
else:
    supabase: Client = create_client(SUPABASE_URL, SERVICE_KEY)

# --- ENDPOINTS ---

@app.post("/generar-examen")
async def api_generar_examen(
    file: UploadFile = File(...),
    modo: str = Form("rapido"),
    cantidad: int = Form(5),
    user_id: str = Form(...)
):
    try:
        logger.info(f"🚀 Iniciando proceso para user: {user_id}")
        
        # 1. Extracción de Texto
        contenido_bytes = await file.read()
        texto = extraer_texto_pdf(contenido_bytes)
        
        if "ERROR" in texto:
            return {"status": "error", "message": "El PDF no tiene texto legible o es muy pesado."}

        # 2. Generación con IA
        examen_str = generar_examen_ia(texto, modo=modo, cantidad=cantidad)
        
        # 3. Parseo Seguro de JSON
        try:
            examen_dict = json.loads(examen_str)
        except json.JSONDecodeError:
            logger.error("La IA devolvió un formato JSON inválido")
            return {"status": "error", "message": "Error de formato en la respuesta de la IA."}
        
        # 4. Persistencia en Supabase
        if supabase:
            data_para_guardar = {
                "titulo": examen_dict.get("examen_titulo", "Examen de la UADE"),
                "materia": "Arquitectura de Computadores",
                "contenido_json": examen_dict,
                "texto_fuente": texto,
                "user_id": user_id 
            }
            response = supabase.table("examenes").insert(data_para_guardar).execute()
            logger.info("✅ Examen guardado exitosamente en DB")
            return {"status": "success", "db_response": response.data, "examen": examen_dict}
        else:
            return {"status": "error", "message": "DB no conectada"}

    except Exception as e:
        logger.error(f"❌ Error fatal en generar-examen: {str(e)}")
        return {"status": "error", "message": str(e)}

@app.get("/mis-examenes")
async def listar_examenes(user_id: str = Query(...)):
    try:
        if not supabase: return {"status": "error", "message": "DB no conectada"}
        
        response = supabase.table("examenes").select("*").eq("user_id", user_id).execute()
        return {
            "status": "success",
            "cantidad": len(response.data),
            "examenes": response.data
        }
    except Exception as e:
        logger.error(f"Error listando exámenes: {str(e)}")
        return {"status": "error", "message": str(e)}

@app.post("/evaluar-respuesta")
async def api_evaluar_respuesta(req: EvaluacionRequest):
    try:
        resultado_str = evaluar_respuesta_abierta(
            req.pregunta, 
            req.respuesta_usuario, 
            req.contexto_previo
        )
        # Parseo seguro del feedback
        return {"status": "success", "evaluacion": json.loads(resultado_str)}
    except Exception as e:
        logger.error(f"Error en evaluación: {str(e)}")
        return {"status": "error", "message": str(e)}
    
@app.delete("/eliminar-examen/{examen_id}")
async def eliminar_examen(examen_id: int):
    try:
        if not supabase: return {"status": "error", "message": "DB no conectada"}
        
        response = supabase.table("examenes").delete().eq("id", examen_id).execute()
        return {"status": "success", "data": response.data}
    except Exception as e:
        logger.error(f"Error borrando examen: {str(e)}")
        return {"status": "error", "message": str(e)}