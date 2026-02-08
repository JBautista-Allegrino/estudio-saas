import os
import json # <--- VITAL: Soluciona el error de tus logs
import logging
from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client
from motor import extraer_texto_pdf, generar_examen_ia, evaluar_respuesta_abierta
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
app = FastAPI()

# SENIOR TIP: Permitimos todos los orígenes temporalmente para debuguear el "Error de conexión"
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # <--- Cambiamos esto para que no te bloquee Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

url = os.getenv("SUPABASE_URL")
service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, service_key)

@app.post("/generar-examen")
async def api_generar_examen(
    file: UploadFile = File(...),
    modo: str = Form("rapido"),
    cantidad: int = Form(5),
    user_id: str = Form(...)
):
    try:
        logger.info(f"Procesando PDF para usuario: {user_id}")
        contenido_pdf = await file.read()
        texto = extraer_texto_pdf(contenido_pdf)
        
        # Validación de texto vacío (PDFs escaneados/fotos)
        if not texto or texto.strip() == "":
             return {"status": "error", "message": "El PDF parece no tener texto legible (¿es una foto?)."}

        examen_str = generar_examen_ia(texto, modo=modo, cantidad=cantidad)
        
        # Aquí es donde fallaba antes: name 'json' is not defined
        examen_dict = json.loads(examen_str) 
        
        data_para_guardar = {
            "titulo": examen_dict.get("examen_titulo", "Examen de la UADE"),
            "materia": "Arquitectura de Computadores",
            "contenido_json": examen_dict,
            "texto_fuente": texto,
            "user_id": user_id 
        }
        
        response = supabase.table("examenes").insert(data_para_guardar).execute()
        return {"status": "success", "db_response": response.data, "examen": examen_dict}
    except Exception as e:
        logger.error(f"Error fatal: {str(e)}")
        return {"status": "error", "message": str(e)}

# (El resto de los endpoints se mantienen igual...)

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