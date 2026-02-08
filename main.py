import os
import json
from fastapi import FastAPI, UploadFile, File, Form, Query
from supabase import create_client, Client
from motor import extraer_texto_pdf, generar_examen_ia
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# VITAL: Usar SERVICE_ROLE_KEY para bypass de RLS
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

@app.post("/generar-examen")
async def api_generar_examen(file: UploadFile = File(...), modo: str = Form("rapido"), cantidad: int = Form(5), user_id: str = Form(...)):
    try:
        pdf_bytes = await file.read()
        texto = extraer_texto_pdf(pdf_bytes)
        examen_str = generar_examen_ia(texto, modo, cantidad)
        examen_dict = json.loads(examen_str)
        
        data = {
            "titulo": examen_dict.get("examen_titulo", "Examen UADE"),
            "materia": "Arquitectura de Computadores",
            "contenido_json": examen_dict,
            "texto_fuente": texto,
            "user_id": user_id
        }
        supabase.table("examenes").insert(data).execute()
        return {"status": "success", "examen": examen_dict}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/mis-examenes")
async def listar(user_id: str = Query(...)):
    res = supabase.table("examenes").select("*").eq("user_id", user_id).execute()
    return {"status": "success", "examenes": res.data}

@app.delete("/eliminar-examen/{examen_id}")
async def eliminar(examen_id: int):
    # Ahora el delete funcionará siempre gracias a la service key
    supabase.table("examenes").delete().eq("id", examen_id).execute()
    return {"status": "success"}