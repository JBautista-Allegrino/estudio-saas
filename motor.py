import os
import fitz  # Se instala como pymupdf pero se importa como fitz
from openai import OpenAI
from dotenv import load_dotenv

# 1. Cargamos configuración
load_dotenv()

# 2. Configuramos el cliente para Groq (Gratis y rápido)
client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY")
)

def extraer_texto_pdf(ruta_pdf):
    """Extrae todo el texto de las páginas del PDF."""
    print(f"📄 Leyendo el archivo: {ruta_pdf}...")
    texto_acumulado = ""
    try:
        with fitz.open(ruta_pdf) as doc:
            for pagina in doc:
                texto_acumulado += pagina.get_text()
        return texto_acumulado
    except Exception as e:
        return f"Error al leer el PDF: {e}"

def generar_examen_ia(contenido, modo="rapido", cantidad=5):
    """
    Función maestra para generar exámenes de la UADE.
    Acepta modo 'rapido' (MCQ) o 'profundo' (Abiertas).
    """
    print(f"🤖 La IA está diseñando tu examen en modo {modo} ({cantidad} preguntas)...")

    # 1. Definimos el rol del sistema (se mantiene igual)
    prompt_sistema = """
    Eres un profesor de Arquitectura de Computadores de la UADE. 
    Tu tarea es generar un examen riguroso en formato JSON. Usa el idioma Español.
    """

    # 2. Definimos la instrucción según el modo para evitar el conflicto de variables
    if modo == "rapido":
        formato_json = '{"preguntas": [{"pregunta": "...", "opciones": ["A", "B", "C"], "respuesta_correcta": "...", "explicacion": "..."}]}'
        instruccion = f"Genera un examen de {cantidad} preguntas de opción múltiple (Multiple Choice)."
    else:
        # Modo profundo: preguntas abiertas
        formato_json = '{"preguntas": [{"id": 1, "pregunta": "..."}]}'
        instruccion = f"Genera {cantidad} preguntas ABIERTAS de desarrollo técnico para evaluar conceptos profundos."

    # 3. Construimos el prompt de usuario final
    prompt_usuario = f"""
    Basándote en el siguiente material técnico, {instruccion}
    Incluye cálculos sobre magnitudes (si hay fórmulas como $V = I \cdot R$) y conceptos teóricos.

    Material: {contenido}

    Formato JSON requerido:
    {formato_json}
    """

    # 4. Llamada a la API (usando las variables ya definidas arriba)
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": prompt_sistema},
            {"role": "user", "content": prompt_usuario}
        ],
        response_format={"type": "json_object"}
    )
    
    return response.choices[0].message.content

# --- FLUJO PRINCIPAL ---
# 1. Nombre del archivo (debe estar en la misma carpeta)
archivo_pdf = "señal analogica y digital (1).pdf"

if os.path.exists(archivo_pdf):
    # 2. Extraer texto
    texto_completo = extraer_texto_pdf(archivo_pdf)
    
    # 3. Generar examen
    examen_json = generar_examen_ia(texto_completo)
    
    # 4. Mostrar resultado
    print("\n✅ ¡Examen generado con éxito!")
    print(examen_json)
else:
    print(f"❌ Error: No se encontró el archivo '{archivo_pdf}' en la carpeta.")

def evaluar_respuesta_abierta(pregunta, respuesta_usuario, contexto_pdf):
    """
    Función para el 'Modo Examen Profundo'.
    Analiza si lo que escribió el alumno en su HP Victus es correcto.
    """
    prompt_sistema = "Eres un evaluador de exámenes de Ingeniería exigente y preciso."
    
    prompt_usuario = f"""
    Contexto original del PDF: {contexto_pdf}
    Pregunta realizada: {pregunta}
    Respuesta del estudiante: {respuesta_usuario}
    
    Analiza la respuesta. Si el estudiante demuestra entender la lógica (aunque no use las 
    mismas palabras del PDF), califica positivo.
    
    Retorna un JSON con:
    {{
      "nota": 0-10,
      "feedback": "Explicación de aciertos y errores",
      "respuesta_ideal": "Cómo debería haber sido la respuesta perfecta"
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