import os
import json
import fitz  # PyMuPDF
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=os.getenv("GROQ_API_KEY"))

def extraer_texto_pdf(contenido_bytes):
    texto_acumulado = ""
    try:
        with fitz.open(stream=contenido_bytes, filetype="pdf") as doc:
            for pagina in doc:
                texto_acumulado += pagina.get_text()
        return texto_acumulado[:12000] # Límite seguro de tokens para Groq
    except Exception:
        return ""

def generar_examen_ia(contenido, modo="rapido", cantidad=5):
    prompt_sistema = "Eres un profesor de la UADE. Genera un examen en JSON estricto. Responde solo el JSON."
    
    if modo == "rapido":
        formato = '{"examen_titulo": "Test Rápido", "preguntas": [{"pregunta": "...", "opciones": ["A", "B", "C"], "respuesta_correcta": "...", "explicacion": "..."}]}'
    else:
        formato = '{"examen_titulo": "Examen Profundo", "preguntas": [{"id": 1, "pregunta": "..."}]}'

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": prompt_sistema},
            {"role": "user", "content": f"Material: {contenido}. Genera {cantidad} preguntas {modo}. Formato: {formato}"}
        ],
        response_format={"type": "json_object"}
    )
    return response.choices[0].message.content