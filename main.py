import os
import json
from fastapi import FastAPI, UploadFile, File, Form, Query
from pydantic import BaseModel
from supabase import create_client, Client
from motor import extraer_texto_pdf, generar_examen_ia, evaluar_respuesta_abierta
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI()

# Configuración de CORS
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

# Inicialización de Supabase
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)

class EvaluacionRequest(BaseModel):
    pregunta: str
    respuesta_usuario: str
    contexto_previo: str

@app.post("/generar-examen")
async def api_generar_examen(
    file: UploadFile = File(...),
    modo: str = Form("rapido"),
    cantidad: int = Form(5),
    user_id: str = Form(...)  # NUEVO: Recibimos el ID del usuario desde React
):
    try:
        # LEER DIRECTAMENTE A MEMORIA (Evita errores de "archivo no encontrado")
        contenido_pdf = await file.read()
        
        # Extraer texto usando los bytes
        texto = extraer_texto_pdf(contenido_pdf)
        
        # Generar examen con IA
        examen_str = generar_examen_ia(texto, modo=modo, cantidad=cantidad)
        examen_dict = json.loads(examen_str) 
        
        # Guardar en Supabase con el dueño (user_id)
        data_para_guardar = {
            "titulo": examen_dict.get("examen_titulo", "Examen sin título"),
            "materia": "Arquitectura de Computadores",
            "contenido_json": examen_dict,
            "texto_fuente": texto,
            "user_id": user_id  # VITAL: Vincula el examen al usuario logueado
        }
        
        response = supabase.table("examenes").insert(data_para_guardar).execute()
        
        return {"status": "success", "db_response": response.data, "examen": examen_dict}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/mis-examenes")
async def listar_examenes(user_id: str = Query(...)): # NUEVO: Filtramos por usuario
    try:
        # Consultamos SOLO los exámenes del usuario logueado
        response = supabase.table("examenes").select("*").eq("user_id", user_id).execute()
        
        return {
            "status": "success",
            "cantidad": len(response.data),
            "examenes": response.data
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/evaluar-respuesta")
async def api_evaluar_respuesta(req: EvaluacionRequest):
    try:
        resultado_str = evaluar_respuesta_abierta(
            req.pregunta, 
            req.respuesta_usuario, 
            req.contexto_previo
        )
        resultado_dict = json.loads(resultado_str)
        return {"status": "success", "evaluacion": resultado_dict}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    
@app.delete("/eliminar-examen/{examen_id}")
async def eliminar_examen(examen_id: int):
    try:
        response = supabase.table("examenes").delete().eq("id", examen_id).execute()
        return {"status": "success", "data": response.data}
    except Exception as e:
        return {"status": "error", "message": str(e)}