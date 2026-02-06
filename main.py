import os
import json
from fastapi import FastAPI, UploadFile, File, Form  # Agregamos Form
from pydantic import BaseModel                      # Agregamos BaseModel
from supabase import create_client, Client
from motor import extraer_texto_pdf, generar_examen_ia, evaluar_respuesta_abierta # Agregamos la nueva función
from dotenv import load_dotenv

load_dotenv()
class EvaluacionRequest(BaseModel):
    pregunta: str
    respuesta_usuario: str
    contexto_previo: str

app = FastAPI()
from fastapi.middleware.cors import CORSMiddleware

# Lista de orígenes permitidos (SIN la barra al final /)
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

@app.post("/generar-examen")
async def api_generar_examen(
    file: UploadFile = File(...),
    modo: str = Form("rapido"),   # Nuevo: Recibe 'rapido' o 'profundo'
    cantidad: int = Form(5)       # Nuevo: Recibe cuántas preguntas querés
):
    ruta_temporal = f"temp_{file.filename}"
    with open(ruta_temporal, "wb") as buffer:
        buffer.write(await file.read())
    
    texto = extraer_texto_pdf(ruta_temporal)
    
    # Enviamos los nuevos parámetros al motor evolucionado
    examen_str = generar_examen_ia(texto, modo=modo, cantidad=cantidad)
    examen_dict = json.loads(examen_str) 
    
    # Guardamos en Supabase incluyendo el texto original (lo necesitaremos para evaluar)
    data_para_guardar = {
        "titulo": examen_dict.get("examen_titulo", "Examen sin título"),
        "materia": "Arquitectura de Computadores",
        "contenido_json": examen_dict,
        "texto_fuente": texto  # GUARDAMOS EL TEXTO: Vital para el modo profundo
    }
    
    response = supabase.table("examenes").insert(data_para_guardar).execute()
    os.remove(ruta_temporal)
    
    return {"status": "success", "db_response": response.data, "examen": examen_dict}

@app.get("/mis-examenes")
async def listar_examenes():
    try:
        # Consultamos todos los datos de la tabla
        response = supabase.table("examenes").select("*").execute()
        
        # Devolvemos la lista de exámenes encontrados
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
        # Llamamos a la función de evaluación que pegaste en motor.py
        resultado_str = evaluar_respuesta_abierta(
            req.pregunta, 
            req.respuesta_usuario, 
            req.contexto_previo
        )
        
        # Convertimos la respuesta de la IA a un objeto JSON
        resultado_dict = json.loads(resultado_str)
        
        return {"status": "success", "evaluacion": resultado_dict}
    except Exception as e:
        return {"status": "error", "message": str(e)}