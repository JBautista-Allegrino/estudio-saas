import os
import json
import fitz  # PyMuPDF
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY")
)

def extraer_texto_pdf(contenido_bytes):
    """Extrae texto y maneja el límite de tokens (Error 413)."""
    texto_acumulado = ""
    try:
        with fitz.open(stream=contenido_bytes, filetype="pdf") as doc:
            for pagina in doc:
                texto_acumulado += pagina.get_text()
        
        # VALIDACIÓN: Si no hay texto (PDF escaneado/imagen)
        if not texto_acumulado.strip():
            return "ERROR_TEXTO_VACIO"

        # TRUNCADO: Groq tiene un límite de 6,000 tokens (aprox 15k-20k caracteres)
        # Cortamos a 12,000 para dejar espacio al prompt y la respuesta
        return texto_acumulado[:12000] 
    except Exception as e:
        return f"Error al leer el PDF: {e}"

def generar_examen_ia(contenido, modo="rapido", cantidad=5):
    """Generador con protección de formato JSON (Error 400)."""
    
    # Prompt de sistema ultra-estricto para evitar json_validate_failed
    prompt_sistema = r"""
    Eres un profesor de Ingeniería de la UADE. 
    REGLA ORO: Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido.
    No incluyas explicaciones fuera del JSON. 
    Usa el formato exacto pedido. Escapa correctamente comillas dentro de las preguntas.
    """

    if modo == "rapido":
        formato_json = '{"preguntas": [{"pregunta": "...", "opciones": ["A", "B", "C"], "respuesta_correcta": "...", "explicacion": "..."}]}'
    else:
        formato_json = '{"preguntas": [{"id": 1, "pregunta": "..."}]}'

    prompt_usuario = rf"""
    Genera {cantidad} preguntas de tipo {modo} sobre este material: {contenido}
    Formato JSON: {formato_json}
    """

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": prompt_sistema},
            {"role": "user", "content": prompt_usuario}
        ],
        response_format={"type": "json_object"}
    )
    return response.choices[0].message.content

def evaluar_respuesta_abierta(pregunta, respuesta_usuario, contexto_pdf):
    """Evaluador riguroso para el Modo Profundo."""
    
    # Raw string para evitar advertencias por los símbolos matemáticos
    prompt_sistema = r"""
    Eres un profesor de Ingeniería de la UADE extremadamente riguroso. 
    REGLAS DE EVALUACIÓN:
    1. Si la respuesta es vaga o incompleta, la nota es de 0 a 3.
    2. Errores en magnitudes físicas (ej: $V = I \cdot R$) bajan la nota a menos de 4.
    3. Para un 10, la respuesta debe ser técnica y demostrar razonamiento propio.
    """
    
    prompt_usuario = f"""
    Contexto original: {contexto_pdf}
    Pregunta: {pregunta}
    Respuesta del estudiante: {respuesta_usuario}
    
    Retorna un JSON con:
    {{
      "nota": 0-10,
      "feedback": "Explicación técnica de aciertos y errores",
      "respuesta_ideal": "Respuesta de nivel ingeniería"
    }}
    """

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": prompt_sistema},
            {"role": "user", "content": prompt_usuario}
        ],
        response_format={"type": "json_object"}
    )
    
    return response.choices[0].message.content