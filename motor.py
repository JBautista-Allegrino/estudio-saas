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
    """Extrae texto con limitación de tokens para evitar Error 413."""
    texto_acumulado = ""
    try:
        with fitz.open(stream=contenido_bytes, filetype="pdf") as doc:
            for pagina in doc:
                texto_acumulado += pagina.get_text()
        
        # VALIDACIÓN: Si no hay texto, el PDF es probablemente una imagen
        if not texto_acumulado.strip():
            return "ERROR: El PDF parece ser una imagen o no tiene texto legible."

        # SOLUCIÓN ERROR 413: Truncamos a ~15,000 caracteres (aprox 4000-5000 tokens)
        # Esto asegura que siempre entremos en el límite de Groq
        return texto_acumulado[:15000] 
    except Exception as e:
        return f"Error al leer el PDF: {e}"

def generar_examen_ia(contenido, modo="rapido", cantidad=5):
    # Si recibimos el mensaje de error de la extracción, lo devolvemos directo
    if contenido.startswith("ERROR:"):
        return json.dumps({"error": contenido})

    # Reforzamos el prompt para evitar fallos de JSON (Error 400)
    prompt_sistema = r"""
    Eres un profesor de Ingeniería de la UADE. 
    REGLA DE ORO: Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido.
    No incluyas texto antes o después del JSON. 
    Escapa correctamente caracteres especiales en fórmulas matemáticas.
    """
    
    # ... resto de la lógica ...

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