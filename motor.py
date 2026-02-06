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

def generar_examen_ia(contenido):
    """Envía el texto a la IA para generar el JSON."""
    print("🤖 La IA está diseñando tu examen...")
    
    prompt_sistema = """
    Eres un profesor de Arquitectura de Computadores. 
    Tu tarea es generar un examen riguroso en formato JSON.
    Usa el idioma Español.
    """

    prompt_usuario = f"""
    Basándote en el siguiente material técnico, genera un examen de 5 preguntas.
    Incluye cálculos sobre magnitudes (si hay fórmulas) y conceptos teóricos.

    Material: {contenido}

    Formato JSON requerido:
    {{
        "examen_titulo": "Título del tema",
        "preguntas": [
            {{
                "id": 1,
                "pregunta": "¿...?",
                "opciones": ["A", "B", "C"],
                "respuesta_correcta": "...",
                "explicacion": "Explicación basada en el texto"
            }}
        ]
    }}
    """

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
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