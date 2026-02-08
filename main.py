import os
import json
import logging
from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client
from motor import extraer_texto_pdf, generar_examen_ia, evaluar_respuesta_abierta
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

# Configuración de Logging para debuguear en Render
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI(title="Estudio SaaS API - UADE Edition")

# Configuración de CORS - Sin barras finales para evitar preflight errors
origins = [
    "https://estudio-saas.vercel.app",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- INICIALIZACIÓN CRÍTICA ---
# Para que el backend pueda escribir en tablas con RLS, necesitamos la SERVICE_ROLE_KEY.
# Esta llave NUNCA debe ir en el frontend.
url = os.getenv("SUPABASE_URL")
service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") 

if not url or not service_key:
    logger.error("Faltan variables de entorno de Supabase")
    raise ValueError("Configuración de base de datos incompleta")

supabase: Client = create_client(url, service_key)

class EvaluacionRequest(BaseModel):
    pregunta: str
    respuesta_usuario: str
    contexto_previo: str

@app.post("/generar-examen")
async def api_generar_examen(
    file: UploadFile = File(...),
    modo: str = Form("rapido"),
    cantidad: int = Form(5),
    user_id: str = Form(...) 
):
    try:
        logger.info(f"Iniciando generación de examen para usuario: {user_id}")
        
        # 1. Procesamiento en Memoria (Safe for Render)
        contenido_pdf = await file.read()
        texto = extraer_texto_pdf(contenido_pdf)
        
        if not texto or "Error" in texto:
            raise HTTPException(status_code=400, detail="No se pudo extraer texto del PDF")

        # 2. IA Engine
        examen_str = generar_examen_ia(texto, modo=modo, cantidad=cantidad)
        examen_dict = json.loads(examen_str) 
        
        # 3. Estructura de Persistencia
        data_para_guardar = {
            "titulo": examen_dict.get("examen_titulo", "Examen sin título"),
            "materia": "Arquitectura de Computadores",
            "contenido_json": examen_dict,
            "texto_fuente": texto,
            "user_id": user_id  
        }
        
        # 4. Inserción con Bypass de RLS (vía Service Role Key)
        response = supabase.table("examenes").insert(data_para_guardar).execute()
        
        logger.info(f"Examen guardado exitosamente: {response.data[0]['id'] if response.data else 'Error'}")
        
        return {"status": "success", "db_response": response.data, "examen": examen_dict}

    except Exception as e:
        logger.error(f"Error fatal en generar-examen: {str(e)}")
        return {"status": "error", "message": str(e)}

@app.get("/mis-examenes")
async def listar_examenes(user_id: str = Query(...)):
    try:
        # Filtro explícito por usuario logueado
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
        return {"status": "success", "evaluacion": json.loads(resultado_str)}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    
@app.delete("/eliminar-examen/{examen_id}")
async def eliminar_examen(examen_id: int):
    try:
        # El backend (con service key) tiene poder total para borrar
        response = supabase.table("examenes").delete().eq("id", examen_id).execute()
        return {"status": "success", "data": response.data}
    except Exception as e:
        return {"status": "error", "message": str(e)}