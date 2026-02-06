import os
import json
from fastapi import FastAPI, UploadFile, File
from supabase import create_client, Client
from motor import extraer_texto_pdf, generar_examen_ia
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
from fastapi.middleware.cors import CORSMiddleware

# Permitimos que nuestro Frontend de React se conecte
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción pondremos la URL real
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicialización de Supabase
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)

@app.post("/generar-examen")
async def api_generar_examen(file: UploadFile = File(...)):
    # 1. Procesamiento (lo que ya hacíamos)
    ruta_temporal = f"temp_{file.filename}"
    with open(ruta_temporal, "wb") as buffer:
        buffer.write(await file.read())
    
    texto = extraer_texto_pdf(ruta_temporal)
    # Importante: Asegurarnos de que la IA nos devuelva un string que podamos convertir a dict
    examen_str = generar_examen_ia(texto)
    examen_dict = json.loads(examen_str) 
    
    # 2. Persistencia (El nuevo paso)
    data_para_guardar = {
        "titulo": examen_dict.get("examen_titulo", "Examen sin título"),
        "materia": "Arquitectura de Computadores", # Esto lo podemos automatizar después
        "contenido_json": examen_dict
    }
    
    # Enviamos la "carga" a la base de datos
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