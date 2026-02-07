import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BookOpen, Calendar, ChevronLeft, CheckCircle, Upload, Trash2 } from 'lucide-react';

const API_URL = "https://estudio-saas-api.onrender.com";

function App() {
  const [session, setSession] = useState(null);
  const [historialSesion, setHistorialSesion] = useState([]);
  const [examenes, setExamenes] = useState([]);
  const [examenSeleccionado, setExamenSeleccionado] = useState(null);
  const [indicePregunta, setIndicePregunta] = useState(0);
  const [puntos, setPuntos] = useState(0); 
  const [finalizado, setFinalizado] = useState(false);
  const [subiendo, setSubiendo] = useState(false); 
  const [respuestaEscrita, setRespuestaEscrita] = useState("");
  const [resultadoEvaluacion, setResultadoEvaluacion] = useState(null);
  const [evaluando, setEvaluando] = useState(false);
  const [modo, setModo] = useState("rapido");
  const [cantidad, setCantidad] = useState(5);

  useEffect(() => {
  // 1. Obtener sesión actual al cargar
  const checkSession = async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
  };
  checkSession();

  // 2. Escuchar cambios (Login/Logout)
  const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
  });

  return () => authListener.subscription.unsubscribe();
}, []);

// Modificamos cargarExamenes para que solo busque si hay sesión
useEffect(() => {
  if (session) cargarExamenes();
}, [session]);

  const cargarExamenes = async () => {
    try {
      const res = await axios.get(`${API_URL}/mis-examenes`);
      setExamenes(res.data.examenes);
    } catch (err) { console.error(err); }
  };

  const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file || !session) return; // <--- No sube si no hay usuario

  const formData = new FormData();
  formData.append('file', file);
  formData.append('modo', modo);
  formData.append('cantidad', cantidad);
  formData.append('user_id', session.user.id); // <--- ENVIAMOS TU "LLAVE" DE IDENTIDAD

  setSubiendo(true);
  try {
    await axios.post(`${API_URL}/generar-examen`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    await cargarExamenes();
    alert("¡Examen guardado en tu cuenta!");
  } catch (error) {
    alert("Error al procesar el PDF");
  } finally {
    setSubiendo(false);
  }
};

  // --- LÓGICA DE HISTORIAL Y CALIFICACIÓN ---
  const manejarRespuesta = (puntosGanados, feedbackActual = null, respuestaDada = null) => {
    // Capturamos el estado actual de la pregunta antes de avanzar
    setHistorialSesion((prev) => [
      ...prev,
      {
        pregunta: preguntaActual.pregunta,
        nota: puntosGanados,
        feedback: feedbackActual,
        tuRespuesta: respuestaDada
      }
    ]);

    setPuntos((prevPuntos) => prevPuntos + puntosGanados); 
    
    const siguiente = indicePregunta + 1;
    if (siguiente < examenSeleccionado.contenido_json.preguntas.length) {
      setIndicePregunta(siguiente);
    } else { 
      setFinalizado(true); 
    }
  };

  const reiniciar = () => {
    setExamenSeleccionado(null);
    setIndicePregunta(0);
    setPuntos(0);
    setFinalizado(false);
    setResultadoEvaluacion(null);
    setRespuestaEscrita("");
    setHistorialSesion([]); // Importante: Limpiar el historial para el próximo test
  };

  const enviarEvaluacion = async () => {
    if (!respuestaEscrita.trim()) return alert("Escribí algo primero");
    
    setEvaluando(true);
    try {
      const res = await axios.post(`${API_URL}/evaluar-respuesta`, {
        pregunta: preguntaActual.pregunta,
        respuesta_usuario: respuestaEscrita,
        contexto_previo: examenSeleccionado.texto_fuente
      });
      setResultadoEvaluacion(res.data.evaluacion);
    } catch (err) {
      alert("Error al evaluar con la IA");
    } finally {
      setEvaluando(false);
    }
  };

  const eliminarExamen = async (id) => {
    if (!window.confirm("¿Estás seguro de que querés eliminar este examen?")) return;
    try {
      await axios.delete(`${API_URL}/eliminar-examen/${id}`);
      alert("Examen eliminado correctamente");
      cargarExamenes();
    } catch (err) {
      alert("Error al intentar eliminar el examen");
    }
  };

  if (!session) {
  return (
    <div style={{ padding: '100px', textAlign: 'center', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white' }}>
      <h1 style={{ color: '#38bdf8' }}>Bienvenido a tu SaaS de Estudio 🧠</h1>
      <p>Iniciá sesión para ver tus exámenes de la UADE</p>
      {/* Aquí podés usar un componente de Login simple o el Auth UI de Supabase */}
      <button 
        onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}
        style={{ backgroundColor: '#1e293b', color: 'white', padding: '15px 30px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #38bdf8' }}
      >
        Entrar con Google
      </button>
    </div>
  );
}

  if (!examenSeleccionado) {
    return (
      <div style={{ padding: '40px', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
        <h1 style={{ color: '#38bdf8' }}>Mis Exámenes 📚</h1>

        <div style={{ border: '2px dashed #38bdf8', padding: '30px', borderRadius: '15px', textAlign: 'center', marginBottom: '40px', backgroundColor: '#1e293b' }}>
          <div style={{ marginBottom: '20px', display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Modo de Estudio:</label>
              <select value={modo} onChange={(e) => setModo(e.target.value)} style={{ padding: '8px', borderRadius: '5px', background: '#0f172a', color: 'white', border: '1px solid #38bdf8' }}>
                <option value="rapido">🚀 Repaso Rápido (Multiple Choice)</option>
                <option value="profundo">🧠 Examen Profundo (Escritura)</option>
              </select>
            </div>
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Preguntas:</label>
              <input type="number" value={cantidad} min="1" max="20" onChange={(e) => setCantidad(e.target.value)} style={{ padding: '8px', borderRadius: '5px', background: '#0f172a', color: 'white', border: '1px solid #38bdf8', width: '60px' }} />
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
            <div key={ex.id} style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #334155' }}>
              <div>
                <h3 style={{ margin: 0 }}>{ex.titulo}</h3>
                <p style={{ color: '#94a3b8', margin: '5px 0 0 0' }}>{ex.materia}</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setExamenSeleccionado(ex)} style={{ backgroundColor: '#38bdf8', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Repasar ahora</button>
                <button onClick={() => eliminarExamen(ex.id)} style={{ backgroundColor: '#ef4444', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', color: 'white' }}><Trash2 size={18} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- VISTA DE RESULTADOS PRO ---
  if (finalizado) {
    const notaFinal = puntos / examenSeleccionado.contenido_json.preguntas.length;
    return (
      <div style={{ padding: '40px', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <CheckCircle size={80} color="#22c55e" style={{ marginBottom: '20px', margin: '0 auto' }} />
          <h1>¡Examen Completado!</h1>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>
            Promedio final: <span style={{ color: notaFinal >= 4 ? '#38bdf8' : '#ef4444' }}>{notaFinal.toFixed(1)} / 10</span>
          </p>
        </div>

        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'grid', gap: '20px' }}>
          <h2 style={{ borderBottom: '1px solid #334155', paddingBottom: '10px' }}>Resumen Detallado</h2>
          {historialSesion.map((item, i) => (
            <div key={i} style={{ backgroundColor: '#1e293b', padding: '25px', borderRadius: '15px', borderLeft: `6px solid ${item.nota >= 7 ? '#22c55e' : item.nota >= 4 ? '#eab308' : '#ef4444'}` }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#38bdf8', fontSize: '1.1rem' }}>Pregunta {i + 1}: {item.pregunta}</h4>
              <p style={{ fontSize: '0.95rem', marginBottom: '10px' }}><strong>Tu respuesta:</strong> {item.tuRespuesta}</p>
              {item.feedback && (
                <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '10px', marginTop: '10px' }}>
                  <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: 0 }}><strong>Feedback de la IA:</strong> {item.feedback}</p>
                </div>
              )}
              <p style={{ margin: '15px 0 0 0', fontWeight: 'bold', textAlign: 'right', fontSize: '1.1rem' }}>Nota: {item.nota}/10</p>
            </div>
          ))}
        </div>

        <button onClick={reiniciar} style={{ display: 'block', margin: '50px auto 0', backgroundColor: '#38bdf8', border: 'none', padding: '15px 50px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem' }}>
          Volver al Inicio
        </button>
      </div>
    );
  }

  const preguntaActual = examenSeleccionado.contenido_json.preguntas[indicePregunta];
  
  return (
    <div style={{ padding: '40px', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white' }}>
      <button onClick={() => setExamenSeleccionado(null)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', marginBottom: '20px' }}><ChevronLeft /> Volver</button>
      <p style={{ color: '#94a3b8' }}>Pregunta {indicePregunta + 1} de {examenSeleccionado.contenido_json.preguntas.length}</p>
      <h2>{preguntaActual.pregunta}</h2>
      
      <div style={{ marginTop: '30px' }}>
        {!preguntaActual.opciones ? (
          <div style={{ textAlign: 'left' }}>
            {!resultadoEvaluacion ? (
              <>
                <textarea
                  value={respuestaEscrita}
                  onChange={(e) => setRespuestaEscrita(e.target.value)}
                  placeholder="Desarrollá tu respuesta aquí..."
                  style={{ width: '100%', height: '180px', padding: '15px', borderRadius: '12px', backgroundColor: '#1e293b', color: 'white', border: '1px solid #38bdf8', fontSize: '1.1rem', marginBottom: '20px', boxSizing: 'border-box' }}
                />
                <button onClick={enviarEvaluacion} disabled={evaluando} style={{ backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>
                  {evaluando ? "⏳ Analizando..." : "📤 Enviar para calificar"}
                </button>
              </>
            ) : (
              <div style={{ backgroundColor: '#1e293b', padding: '25px', borderRadius: '15px', border: '2px solid #38bdf8' }}>
                <h3 style={{ color: '#38bdf8', marginTop: 0 }}>Calificación: {resultadoEvaluacion.nota} / 10</h3>
                <p><strong>Corrección:</strong> {resultadoEvaluacion.feedback}</p>
                <hr style={{ borderColor: '#334155', margin: '20px 0' }} />
                <p style={{ color: '#94a3b8', fontStyle: 'italic' }}><strong>Respuesta ideal:</strong> {resultadoEvaluacion.respuesta_ideal}</p>
                <button onClick={() => {
                    // PASAMOS LA NOTA, EL FEEDBACK Y LA RESPUESTA AL HISTORIAL
                    manejarRespuesta(resultadoEvaluacion.nota, resultadoEvaluacion.feedback, respuestaEscrita); 
                    setResultadoEvaluacion(null);
                    setRespuestaEscrita("");
                  }} style={{ marginTop: '20px', backgroundColor: '#38bdf8', border: 'none', padding: '12px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Siguiente Pregunta ➔
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {preguntaActual.opciones.map((opt, i) => (
              <button 
                key={i} 
                onClick={() => {
                  const esCorrecta = opt === preguntaActual.respuesta_correcta;
                  manejarRespuesta(
                    esCorrecta ? 10 : 0, 
                    esCorrecta ? "¡Excelente elección!" : `Respuesta incorrecta. La opción válida era: ${preguntaActual.respuesta_correcta}`,
                    opt
                  );
                }} 
                style={{ textAlign: 'left', padding: '20px', borderRadius: '12px', backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white', cursor: 'pointer' }}
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