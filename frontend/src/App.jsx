import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BookOpen, Calendar, ChevronLeft, CheckCircle, Upload } from 'lucide-react';

const API_URL = "https://estudio-saas-api.onrender.com";

function App() {
  const [examenes, setExamenes] = useState([]);
  const [examenSeleccionado, setExamenSeleccionado] = useState(null);
  
  const [indicePregunta, setIndicePregunta] = useState(0);
  const [puntos, setPuntos] = useState(0);
  const [finalizado, setFinalizado] = useState(false);
  const [subiendo, setSubiendo] = useState(false); 
  const [respuestaEscrita, setRespuestaEscrita] = useState("");
  const [resultadoEvaluacion, setResultadoEvaluacion] = useState(null);
  const [evaluando, setEvaluando] = useState(false);
  
  // ESTADOS PARA CONFIGURACIÓN
  const [modo, setModo] = useState("rapido");
  const [cantidad, setCantidad] = useState(5);

  useEffect(() => {
    cargarExamenes();
  }, []);

  const cargarExamenes = async () => {
    try {
      // Corregido: Ahora usa la constante API_URL
      const res = await axios.get(`${API_URL}/mis-examenes`);
      setExamenes(res.data.examenes);
    } catch (err) { console.error(err); }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('modo', modo);      
    formData.append('cantidad', cantidad); 

    setSubiendo(true);
    try {
        await axios.post(`${API_URL}/generar-examen`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        await cargarExamenes();
        alert("¡Examen generado con éxito!");
    } catch (error) {
        alert("Error al procesar el PDF");
    } finally {
        setSubiendo(false);
    }
  };

  const manejarRespuesta = (opcion, correcta) => {
    if (opcion === correcta) setPuntos(puntos + 1);
    const siguiente = indicePregunta + 1;
    if (siguiente < examenSeleccionado.contenido_json.preguntas.length) {
      setIndicePregunta(siguiente);
    } else { setFinalizado(true); }
  };

  const reiniciar = () => {
    setExamenSeleccionado(null);
    setIndicePregunta(0);
    setPuntos(0);
    setFinalizado(false);
  };

  const enviarEvaluacion = async () => {
  if (!respuestaEscrita.trim()) return alert("Escribí algo primero");

  setEvaluando(true);
  try {
    const res = await axios.post(`${API_URL}/evaluar-respuesta`, {
      pregunta: preguntaActual.pregunta,
      respuesta_usuario: respuestaEscrita,
      contexto_previo: examenSeleccionado.texto_fuente // El texto que guardamos en Supabase
    });
    setResultadoEvaluacion(res.data.evaluacion);
  } catch (err) {
    alert("Error al evaluar con la IA");
  } finally {
    setEvaluando(false);
  }
};

  // VISTA 1: DASHBOARD
  if (!examenSeleccionado) {
    return (
      <div style={{ padding: '40px', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
        <h1 style={{ color: '#38bdf8' }}>Mis Exámenes 📚</h1>

        <div style={{ border: '2px dashed #38bdf8', padding: '30px', borderRadius: '15px', textAlign: 'center', marginBottom: '40px', backgroundColor: '#1e293b' }}>
          
          {/* SELECCIÓN DE MODO Y CANTIDAD (Movido aquí para que sea funcional) */}
          <div style={{ marginBottom: '20px', display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Modo de Estudio:</label>
              <select 
                value={modo} 
                onChange={(e) => setModo(e.target.value)}
                style={{ padding: '8px', borderRadius: '5px', background: '#0f172a', color: 'white', border: '1px solid #38bdf8' }}
              >
                <option value="rapido">🚀 Repaso Rápido (Multiple Choice)</option>
                <option value="profundo">🧠 Examen Profundo (Escritura)</option>
              </select>
            </div>
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Preguntas:</label>
              <input 
                type="number" 
                value={cantidad} 
                min="1" max="20"
                onChange={(e) => setCantidad(e.target.value)}
                style={{ padding: '8px', borderRadius: '5px', background: '#0f172a', color: 'white', border: '1px solid #38bdf8', width: '60px' }}
              />
            </div>
          </div>

          <input type="file" id="pdf-upload" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
          <label htmlFor="pdf-upload" style={{ cursor: 'pointer' }}>
            <h2 style={{ margin: 0 }}>{subiendo ? "⏳ Procesando con IA..." : "📤 Subir nuevo PDF"}</h2>
            <p style={{ color: '#94a3b8' }}>Seleccioná tus apuntes de la UADE</p>
          </label>
        </div>

        <div style={{ display: 'grid', gap: '20px' }}>
          {examenes.map(ex => (
            <div key={ex.id} style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', border: '1px solid #334155' }}>
              <div>
                <h3>{ex.titulo}</h3>
                <p style={{ color: '#94a3b8' }}>{ex.materia}</p>
              </div>
              <button onClick={() => setExamenSeleccionado(ex)} style={{ backgroundColor: '#38bdf8', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Repasar ahora</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // VISTA DE RESULTADOS Y QUIZ (Lógica para Modo Rápido por ahora)
  if (finalizado) {
    const nota = (puntos / examenSeleccionado.contenido_json.preguntas.length) * 10;
    return (
      <div style={{ padding: '40px', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', textAlign: 'center' }}>
        <CheckCircle size={80} color="#22c55e" style={{ marginBottom: '20px' }} />
        <h1>¡Examen Completado!</h1>
        <p style={{ fontSize: '1.5rem' }}>Tu nota: <span style={{ color: '#38bdf8' }}>{nota.toFixed(1)} / 10</span></p>
        <button onClick={reiniciar} style={{ marginTop: '30px', backgroundColor: '#38bdf8', border: 'none', padding: '12px 30px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Volver al inicio</button>
      </div>
    );
  }

  const preguntaActual = examenSeleccionado.contenido_json.preguntas[indicePregunta];
  return (
    <div style={{ padding: '40px', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white' }}>
      <button onClick={() => setExamenSeleccionado(null)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', marginBottom: '20px' }}><ChevronLeft /> Volver</button>
      <p style={{ color: '#94a3b8' }}>Pregunta {indicePregunta + 1} de {examenSeleccionado.contenido_json.preguntas.length}</p>
      <h2>{preguntaActual.pregunta}</h2>
      
      {/* Lógica condicional: Si tiene opciones (Modo Rápido), mostramos botones. Si no, mostramos input. */}
      {/* --- ESTE ES EL BLOQUE QUE REEMPLAZA LAS OPCIONES --- */}
<div style={{ marginTop: '30px' }}>
  {!preguntaActual.opciones ? (
    /* LÓGICA MODO PROFUNDO: Si no hay opciones en el JSON, mostramos el área de texto */
    <div style={{ textAlign: 'left' }}>
      {!resultadoEvaluacion ? (
        <>
          <textarea
            value={respuestaEscrita}
            onChange={(e) => setRespuestaEscrita(e.target.value)}
            placeholder="Desarrollá tu respuesta aquí... (Ej: Explicá la Ley de Ohm o el Sistema Binario)"
            style={{ 
              width: '100%', height: '180px', padding: '15px', borderRadius: '12px', 
              backgroundColor: '#1e293b', color: 'white', border: '1px solid #38bdf8', 
              fontSize: '1.1rem', marginBottom: '20px', boxSizing: 'border-box' 
            }}
          />
          <button 
            onClick={enviarEvaluacion}
            disabled={evaluando}
            style={{ 
              backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '15px', 
              borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%',
              fontSize: '1rem'
            }}
          >
            {evaluando ? "⏳ El tutor IA está analizando..." : "📤 Enviar para calificar"}
          </button>
        </>
      ) : (
        /* VISTA DE FEEDBACK: Se activa cuando la IA responde */
        <div style={{ backgroundColor: '#1e293b', padding: '25px', borderRadius: '15px', border: '2px solid #38bdf8' }}>
          <h3 style={{ color: '#38bdf8', marginTop: 0 }}>Calificación: {resultadoEvaluacion.nota} / 10</h3>
          <p style={{ lineHeight: '1.6' }}><strong>Corrección:</strong> {resultadoEvaluacion.feedback}</p>
          <hr style={{ borderColor: '#334155', margin: '20px 0' }} />
          <p style={{ color: '#94a3b8', fontStyle: 'italic' }}><strong>Respuesta de nivel ingeniería:</strong> {resultadoEvaluacion.respuesta_ideal}</p>
          
          <button 
            onClick={() => {
              setResultadoEvaluacion(null);
              setRespuestaEscrita("");
              if(resultadoEvaluacion.nota >= 7) setPuntos(puntos + 1);
              manejarRespuesta("abierta", "abierta"); 
            }}
            style={{ 
              marginTop: '20px', backgroundColor: '#38bdf8', border: 'none', 
              padding: '12px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' 
            }}
          >
            Siguiente Pregunta ➔
          </button>
        </div>
      )}
    </div>
  ) : (
    /* MODO RÁPIDO: Si el JSON tiene opciones, mostramos los botones de siempre */
    <div style={{ display: 'grid', gap: '15px' }}>
      {preguntaActual.opciones.map((opt, i) => (
        <button 
          key={i} 
          onClick={() => manejarRespuesta(opt, preguntaActual.respuesta_correcta)} 
          style={{ 
            textAlign: 'left', padding: '20px', borderRadius: '12px', 
            backgroundColor: '#1e293b', border: '1px solid #334155', 
            color: 'white', cursor: 'pointer', fontSize: '1rem' 
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )}
</div>
    </div>
  );
}

export default App;