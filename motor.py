import os
import json
import fitz  # PyMuPDF
from openai import OpenAI
from dotenv import load_dotenv
import time

# 1. Cargamos configuración
load_dotenv()

# 2. Configuramos el cliente para Groq con timeout
client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY"),
    timeout=60.0  # Timeout de 60 segundos
)

def extraer_texto_pdf(contenido_bytes):
    """Extrae texto de un PDF con validación y límites de seguridad."""
    texto_acumulado = ""
    try:
        with fitz.open(stream=contenido_bytes, filetype="pdf") as doc:
            # Límite de seguridad: máximo 50,000 caracteres
            MAX_CHARS = 50000
            
            for pagina in doc:
                texto_pagina = pagina.get_text()
                texto_acumulado += texto_pagina
                
                # Prevenir PDFs gigantes que crashean el sistema
                if len(texto_acumulado) > MAX_CHARS:
                    texto_acumulado = texto_acumulado[:MAX_CHARS]
                    break
            
            # Validación básica de contenido
            if len(texto_acumulado.strip()) < 100:
                return "Error: El PDF parece vacío o tiene muy poco texto extraíble. Asegurate que no sea solo imágenes."
            
            # Limpieza de caracteres problemáticos
            texto_acumulado = texto_acumulado.replace('\x00', '').strip()
            
            return texto_acumulado
            
    except Exception as e:
        return f"Error al procesar el PDF: {str(e)}. Verifica que el archivo no esté corrupto."

def validar_json_respuesta(respuesta_str):
    """Intenta validar y limpiar la respuesta JSON de la IA."""
    try:
        # Intenta parsear directamente
        return json.loads(respuesta_str)
    except json.JSONDecodeError:
        # Si falla, intenta extraer JSON de markdown code blocks
        if "```json" in respuesta_str:
            json_parte = respuesta_str.split("```json")[1].split("```")[0].strip()
            return json.loads(json_parte)
        elif "```" in respuesta_str:
            json_parte = respuesta_str.split("```")[1].split("```")[0].strip()
            return json.loads(json_parte)
        else:
            raise ValueError("La IA no generó un JSON válido")

def generar_examen_ia(contenido, modo="rapido", cantidad=5):
    """
    Generador de exámenes mejorado con:
    - Modelo más potente (llama-3.3-70b)
    - Prompts con ejemplos claros
    - Manejo de errores robusto
    - Validación de output
    """
    
    # Sistema de instrucciones mejorado con criterios explícitos
    prompt_sistema = """Eres un profesor experto de Ingeniería de la UADE.
Debes generar exámenes rigurosos en formato JSON válido.
REGLAS ESTRICTAS:
1. Responde SOLO con JSON válido, sin texto adicional ni markdown
2. Usa español técnico y preciso
3. Las preguntas deben evaluar comprensión profunda, no memorización
4. Incluye cálculos cuando el material lo permita"""

    if modo == "rapido":
        # Formato con ejemplo concreto
        ejemplo_json = {
            "examen_titulo": "Repaso de Circuitos Eléctricos",
            "preguntas": [
                {
                    "pregunta": "¿Cuál es la resistencia total de dos resistencias de 10Ω en serie?",
                    "opciones": ["10Ω", "20Ω", "5Ω", "15Ω"],
                    "respuesta_correcta": "20Ω",
                    "explicacion": "En serie, las resistencias se suman: 10Ω + 10Ω = 20Ω"
                }
            ]
        }
        
        instruccion = f"""Genera {cantidad} preguntas de opción múltiple sobre el material.
REQUISITOS:
- Cada pregunta debe tener 4 opciones
- Una sola respuesta correcta
- Explicación técnica de por qué es correcta
- Incluye cálculos si el material tiene fórmulas

Ejemplo de formato esperado:
{json.dumps(ejemplo_json, indent=2, ensure_ascii=False)}"""

    else:  # modo profundo
        ejemplo_json = {
            "examen_titulo": "Evaluación Profunda de Arquitectura",
            "preguntas": [
                {
                    "id": 1,
                    "pregunta": "Explica cómo funciona el pipeline de instrucciones en un procesador moderno y qué ventajas ofrece sobre la ejecución secuencial simple."
                },
                {
                    "id": 2,
                    "pregunta": "Describe el trade-off entre memoria caché y memoria principal. ¿Por qué no hacer toda la memoria del tipo caché?"
                }
            ]
        }
        
        instruccion = f"""Genera {cantidad} preguntas ABIERTAS de desarrollo profundo.
REQUISITOS:
- Preguntas que requieran explicación técnica completa
- Deben evaluar comprensión de conceptos, no solo definiciones
- Si hay fórmulas en el material, pide que expliquen su aplicación

Ejemplo de formato esperado:
{json.dumps(ejemplo_json, indent=2, ensure_ascii=False)}"""

    # Construcción del prompt con contexto limitado
    contexto_limitado = contenido[:8000] if len(contenido) > 8000 else contenido
    
    prompt_usuario = f"""{instruccion}

MATERIAL DE ESTUDIO:
{contexto_limitado}

Responde ÚNICAMENTE con el JSON, sin texto adicional."""

    # Intentar con reintentos en caso de error
    max_reintentos = 2
    for intento in range(max_reintentos):
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",  # CAMBIO CRÍTICO: Modelo más potente
                messages=[
                    {"role": "system", "content": prompt_sistema},
                    {"role": "user", "content": prompt_usuario}
                ],
                temperature=0.3,  # Menos creatividad = más consistencia
                response_format={"type": "json_object"}
            )
            
            respuesta_raw = response.choices[0].message.content
            
            # Validar que sea JSON válido
            validar_json_respuesta(respuesta_raw)
            
            return respuesta_raw
            
        except Exception as e:
            if intento < max_reintentos - 1:
                time.sleep(2)  # Espera antes de reintentar
                continue
            else:
                # Si falló todo, retornar error estructurado
                return json.dumps({
                    "error": True,
                    "mensaje": f"Error generando examen: {str(e)}",
                    "preguntas": []
                })

def evaluar_respuesta_abierta(pregunta, respuesta_usuario, contexto_pdf):
    """
    Evaluador mejorado con:
    - Criterios de evaluación explícitos
    - Ejemplos de buenas/malas respuestas
    - Feedback estructurado
    - Respuesta ideal incluida
    """
    
    prompt_sistema = """Eres un profesor riguroso de Ingeniería de la UADE.
Debes evaluar respuestas técnicas con criterio académico estricto.

ESCALA DE NOTAS:
- 0-3: Respuesta incorrecta, superficial o irrelevante
- 4-6: Respuesta parcialmente correcta pero con errores conceptuales o incompleta
- 7-8: Respuesta correcta y completa, con buena explicación técnica
- 9-10: Respuesta excepcional, demuestra dominio profundo del tema

CRITERIOS DE EVALUACIÓN:
1. Precisión técnica (40%)
2. Completitud de la explicación (30%)
3. Uso correcto de terminología (20%)
4. Estructura lógica del razonamiento (10%)

Responde SOLO con JSON válido, sin texto adicional."""

    # Ejemplo de evaluación para guiar al modelo
    ejemplo_evaluacion = {
        "nota": 8,
        "feedback": "Tu respuesta es técnicamente correcta y bien estructurada. Explicaste correctamente el concepto de pipeline y sus ventajas. Sin embargo, podrías haber mencionado los hazards (riesgos) que pueden ocurrir en el pipeline como data hazards o control hazards. La explicación de las etapas (fetch, decode, execute, memory, writeback) está bien pero faltó profundizar en cómo se superponen.",
        "respuesta_ideal": "El pipeline de instrucciones divide la ejecución en 5 etapas: IF (Instruction Fetch), ID (Instruction Decode), EX (Execute), MEM (Memory Access), y WB (Write Back). La ventaja principal es que mientras una instrucción está en ejecución, la siguiente puede estar decodificándose, logrando un throughput de casi 1 instrucción por ciclo en casos ideales. Sin pipeline, cada instrucción debe completarse antes de comenzar la siguiente, resultando en ~5 ciclos por instrucción. Sin embargo, el pipeline enfrenta hazards como data hazards (cuando una instrucción depende del resultado de otra), control hazards (por saltos condicionales) y structural hazards (competencia por recursos)."
    }

    contexto_limitado = contexto_pdf[:5000] if len(contexto_pdf) > 5000 else contexto_pdf
    
    prompt_usuario = f"""CONTEXTO DEL MATERIAL:
{contexto_limitado}

PREGUNTA DEL EXAMEN:
{pregunta}

RESPUESTA DEL ESTUDIANTE:
{respuesta_usuario}

Evalúa la respuesta según los criterios establecidos.

Ejemplo del formato JSON esperado:
{json.dumps(ejemplo_evaluacion, indent=2, ensure_ascii=False)}

Responde ÚNICAMENTE con el JSON de evaluación, sin texto adicional."""

    # Intentar con reintentos
    max_reintentos = 2
    for intento in range(max_reintentos):
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",  # Mismo modelo potente
                messages=[
                    {"role": "system", "content": prompt_sistema},
                    {"role": "user", "content": prompt_usuario}
                ],
                temperature=0.2,  # Muy baja para evaluación consistente
                response_format={"type": "json_object"}
            )
            
            respuesta_raw = response.choices[0].message.content
            
            # Validar JSON
            evaluacion = validar_json_respuesta(respuesta_raw)
            
            # Asegurar que tenga todos los campos necesarios
            if "nota" not in evaluacion or "feedback" not in evaluacion:
                raise ValueError("JSON de evaluación incompleto")
            
            # Agregar respuesta_ideal si no está
            if "respuesta_ideal" not in evaluacion:
                evaluacion["respuesta_ideal"] = "No disponible en esta evaluación"
            
            return json.dumps(evaluacion, ensure_ascii=False)
            
        except Exception as e:
            if intento < max_reintentos - 1:
                time.sleep(2)
                continue
            else:
                # Error estructurado
                return json.dumps({
                    "nota": 0,
                    "feedback": f"Error al evaluar la respuesta: {str(e)}. Por favor intenta nuevamente.",
                    "respuesta_ideal": "Error al generar respuesta ideal"
                })
