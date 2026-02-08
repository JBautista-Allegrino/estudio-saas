import os
import json
import logging
import fitz  # PyMuPDF
from openai import OpenAI
from dotenv import load_dotenv

# Configuración de logs internos para debuguear en Render
logger = logging.getLogger(__name__)
load_dotenv()

# Validación de infraestructura
api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise ValueError("Falta la variable de entorno GROQ_API_KEY")

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=api_key
)

def extraer_texto_pdf(contenido_bytes):
    """Extrae texto con gestión de límites para evitar Error 413."""
    texto_acumulado = ""
    try:
        with fitz.open(stream=contenido_bytes, filetype="pdf") as doc:
            for pagina in doc:
                texto_acumulado += pagina.get_text()
        
        # Validación de contenido técnico
        if not texto_acumulado.strip():
            return "ERROR_TEXTO_VACIO"

        # TRUNCADO ESTRATÉGICO: 
        # Groq (Llama 8B) tiene un límite de TPM/Tokens. 
        # 10,000 caracteres aseguran ~3,000 tokens, dejando margen para el JSON de respuesta.
        return texto_acumulado[:10000] 
    except Exception as e:
        logger.error(f"Fallo en extracción PDF: {e}")
        return f"ERROR_SISTEMA_PDF: {str(e)}"

def generar_examen_ia(contenido, modo="rapido", cantidad=5):
    """Generador con control de fallos y validación de entrada."""
    
    # Manejo de errores previos de extracción
    if "ERROR" in contenido:
        return json.dumps({
            "status": "error", 
            "message": "El PDF es una imagen o está protegido." if contenido == "ERROR_TEXTO_VACIO" else contenido
        })

    # Prompt técnico con escape de caracteres para Arquitectura de Computadores
    prompt_sistema = r"""
    Eres un profesor de Ingeniería de la UADE experto en Arquitectura de Computadores.
    TU TAREA: Generar un examen técnico en formato JSON.
    REGLA ESTRICTA: Tu respuesta debe ser ÚNICAMENTE el objeto JSON, sin texto previo ni posterior.
    Si incluyes fórmulas matemáticas, asegúrate de escapar las comillas dobles internas.
    """

    if modo == "rapido":
        formato_json = '{"examen_titulo": "Repaso Técnico", "preguntas": [{"pregunta": "...", "opciones": ["A", "B", "C"], "respuesta_correcta": "...", "explicacion": "..."}]}'
    else:
        formato_json = '{"examen_titulo": "Examen de Desarrollo", "preguntas": [{"id": 1, "pregunta": "..."}]}'

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": prompt_sistema},
                {"role": "user", "content": f"Genera {cantidad} preguntas {modo}. Material: {contenido}. Formato: {formato_json}"}
            ],
            response_format={"type": "json_object"}
        )
        return response.choices[0].message.content
    except Exception as e:
        # Aquí usamos 'json' para devolver un error que el main.py pueda leer
        return json.dumps({"status": "error", "message": f"IA_TIMEOUT: {str(e)}"})

def evaluar_respuesta_abierta(pregunta, respuesta_usuario, contexto_pdf):
    """Evaluador de alto rigor académico."""
    
    prompt_sistema = r"""
    Eres un profesor de la UADE evaluando respuestas técnicas.
    CRITERIOS:
    - 0-3: Vago o incorrecto.
    - 4-6: Concepto base correcto pero falta profundidad técnica.
    - 7-10: Uso de terminología técnica y razonamiento lógico.
    Retorna un JSON con: nota (number), feedback (string), respuesta_ideal (string).
    """
    
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": prompt_sistema},
                {"role": "user", "content": f"Contexto: {contexto_pdf}\nPregunta: {pregunta}\nRespuesta Alumno: {respuesta_usuario}"}
            ],
            response_format={"type": "json_object"}
        )
        return response.choices[0].message.content
    except Exception as e:
        return json.dumps({"nota": 0, "feedback": f"Error en evaluación: {str(e)}", "respuesta_ideal": "N/A"})