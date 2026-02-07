import os
import fitz  # PyMuPDF
from openai import OpenAI
from dotenv import load_dotenv

# 1. Cargamos configuración
load_dotenv()

# 2. Configuramos el cliente para Groq
client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY")
)

def extraer_texto_pdf(contenido_bytes):
    """Extrae texto de un PDF directamente desde la memoria (bytes)."""
    texto_acumulado = ""
    try:
        # Abrimos el PDF desde el stream de bytes enviado por FastAPI
        with fitz.open(stream=contenido_bytes, filetype="pdf") as doc:
            for pagina in doc:
                texto_acumulado += pagina.get_text()
        return texto_acumulado
    except Exception as e:
        return f"Error al leer el PDF desde memoria: {e}"

def generar_examen_ia(contenido, modo="rapido", cantidad=5):
    """Generador de exámenes con rigor de la UADE."""
    
    # Usamos Raw Strings (r"") para evitar errores de escape con símbolos técnicos
    prompt_sistema = r"""
    Eres un profesor de Ingeniería de la UADE. 
    Tu tarea es generar un examen riguroso y técnico en formato JSON. Usa Español.
    """

    if modo == "rapido":
        formato_json = '{"preguntas": [{"pregunta": "...", "opciones": ["A", "B", "C"], "respuesta_correcta": "...", "explicacion": "..."}]}'
        instruccion = f"Genera un examen de {cantidad} preguntas de opción múltiple."
    else:
        formato_json = '{"preguntas": [{"id": 1, "pregunta": "..."}]}'
        instruccion = f"Genera {cantidad} preguntas ABIERTAS de desarrollo para evaluar conceptos profundos."

    prompt_usuario = rf"""
    Basándote en el siguiente material, {instruccion}
    Incluye cálculos sobre magnitudes (si hay fórmulas como $V = I \cdot R$) y lógica binaria.

    Material: {contenido}

    Formato JSON requerido:
    {formato_json}
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