import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js'; // IMPORTANTE: Nueva importación
import { BookOpen, Calendar, ChevronLeft, CheckCircle, Upload, Trash2, LogOut } from 'lucide-react';

// 1. INICIALIZACIÓN DE SUPABASE (Asegurate de poner tus llaves reales aquí)
const supabaseUrl = "https://ucndntntyeqkdlzxgfsm.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjbmRudG50eWVxa2RsenhnZnNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMjYyNjIsImV4cCI6MjA4NTkwMjI2Mn0.A0eSlPbz_icnFmrQbtrosQypgszvZyKkMnwMJvQfP1E";
const supabase = createClient(supabaseUrl, supabaseKey);

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

  // 2. MANEJO DE SESIÓN
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) cargarExamenes();
  }, [session]);

  const cargarExamenes = async () => {
    try {
      // ENVIAMOS EL USER_ID como Query Parameter al backend de Render
      const res = await axios.get(`${API_URL}/mis-examenes?user_id=${session.user.id}`);
      setExamenes(res.data.examenes);
    } catch (err) { console.error(err); }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !session) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('modo', modo);
    formData.append('cantidad', cantidad);
    formData.append('user_id', session.user.id); // Identidad para el backend

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

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setExamenes([]); // Limpiamos la vista al salir
  };

  const manejarRespuesta = (puntosGanados, feedbackActual = null, respuestaDada = null) => {
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
    setHistorialSesion([]);
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
      alert("Error al evaluar");
    } finally {
      setEvaluando(false);
    }
  };

  const eliminarExamen = async (id) => {
    if (!window.confirm("¿Seguro?")) return;
    try {
      await axios.delete(`${API_URL}/eliminar-examen/${id}`);
      cargarExamenes();
    } catch (err) { alert("Error al eliminar"); }
  };

  // 3. PANTALLA DE LOGIN (EL ESCUDO)
  if (!session) {
    return (
      <div style={{ padding: '100px 20px', textAlign: 'center', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
        <h1 style={{ color: '#38bdf8', fontSize: '2.5rem' }}>Estudio SaaS 🧠</h1>
        <p style={{ color: '#94a3b8', marginBottom: '40px' }}>Iniciá sesión para acceder a tus apuntes de la UADE</p>
        <button 
          onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}
          style={{ backgroundColor: '#1e293b', color: 'white', padding: '15px 30px', borderRadius: '12px', cursor: 'pointer', border: '1px solid #38bdf8', fontSize: '1.1rem', fontWeight: 'bold' }}
        >
          Entrar con Google
        </button>
      </div>
    );
  }

  // 4. DASHBOARD
  if (!examenSeleccionado) {
    return (
      <div style={{ padding: '40px', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ color: '#38bdf8', margin: 0 }}>Mis Exámenes 📚</h1>
          <button onClick={cerrarSesion} style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LogOut size={18} /> Salir
          </button>
        </div>

        <div style={{ border: '2px dashed #38bdf8', padding: '30px', borderRadius: '15px', textAlign: 'center', marginBottom: '40px', backgroundColor: '#1e293b' }}>
          <div style={{ marginBottom: '20px', display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Modo:</label>
              <select value={modo} onChange={(e) => setModo(e.target.value)} style={{ padding: '8px', borderRadius: '5px', background: '#0f172a', color: 'white', border: '1px solid #38bdf8' }}>
                <option value="rapido">🚀 Rápido</option>
                <option value="profundo">🧠 Profundo</option>
              </select>
            </div>
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Preguntas:</label>
              <input type="number" value={cantidad} min="1" max="20" onChange={(e) => setCantidad(e.target.value)} style={{ padding: '8px', borderRadius: '5px', background: '#0f172a', color: 'white', border: '1px solid #38bdf8', width: '60px' }} />
            </div>
          </div>
          <input type="file" id="pdf-upload" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
          <label htmlFor="pdf-upload" style={{ cursor: 'pointer' }}>
            <h2>{subiendo ? "⏳ Procesando..." : "📤 Subir PDF de la UADE"}</h2>
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
                <button onClick={() => setExamenSeleccionado(ex)} style={{ backgroundColor: '#38bdf8', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Repasar</button>
                <button onClick={() => eliminarExamen(ex.id)} style={{ backgroundColor: '#ef4444', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}><Trash2 size={18} color="white" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- RESTO DE LA LÓGICA (RESULTADOS Y PREGUNTAS) SE MANTIENE IGUAL ---
  if (finalizado) {
    const notaFinal = puntos / examenSeleccionado.contenido_json.preguntas.length;
    return (
      <div style={{ padding: '40px', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <CheckCircle size={80} color="#22c55e" style={{ marginBottom: '20px', margin: '0 auto' }} />
          <h1>¡Examen Completado!</h1>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>
            Promedio: <span style={{ color: notaFinal >= 4 ? '#38bdf8' : '#ef4444' }}>{notaFinal.toFixed(1)} / 10</span>
          </p>
        </div>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'grid', gap: '20px' }}>
          {historialSesion.map((item, i) => (
            <div key={i} style={{ backgroundColor: '#1e293b', padding: '25px', borderRadius: '15px', borderLeft: `6px solid ${item.nota >= 7 ? '#22c55e' : item.nota >= 4 ? '#eab308' : '#ef4444'}` }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#38bdf8' }}>{item.pregunta}</h4>
              <p><strong>Tu respuesta:</strong> {item.tuRespuesta}</p>
              <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}><strong>Feedback:</strong> {item.feedback}</p>
              <p style={{ textAlign: 'right', fontWeight: 'bold' }}>Nota: {item.nota}/10</p>
            </div>
          ))}
        </div>
        <button onClick={reiniciar} style={{ display: 'block', margin: '50px auto 0', backgroundColor: '#38bdf8', border: 'none', padding: '15px 50px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Volver</button>
      </div>
    );
  }

  const preguntaActual = examenSeleccionado.contenido_json.preguntas[indicePregunta];
  
  return (
    <div style={{ padding: '40px', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white' }}>
      <button onClick={() => setExamenSeleccionado(null)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', marginBottom: '20px' }}><ChevronLeft /> Volver</button>
      <h2>{preguntaActual.pregunta}</h2>
      <div style={{ marginTop: '30px' }}>
        {!preguntaActual.opciones ? (
          <div style={{ textAlign: 'left' }}>
            {!resultadoEvaluacion ? (
              <>
                <textarea value={respuestaEscrita} onChange={(e) => setRespuestaEscrita(e.target.value)} style={{ width: '100%', height: '180px', padding: '15px', borderRadius: '12px', backgroundColor: '#1e293b', color: 'white', border: '1px solid #38bdf8', fontSize: '1.1rem', marginBottom: '20px', boxSizing: 'border-box' }} />
                <button onClick={enviarEvaluacion} disabled={evaluando} style={{ backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>{evaluando ? "Analizando..." : "Enviar"}</button>
              </>
            ) : (
              <div style={{ backgroundColor: '#1e293b', padding: '25px', borderRadius: '15px', border: '2px solid #38bdf8' }}>
                <h3>Nota: {resultadoEvaluacion.nota} / 10</h3>
                <p>{resultadoEvaluacion.feedback}</p>
                <button onClick={() => { manejarRespuesta(resultadoEvaluacion.nota, resultadoEvaluacion.feedback, respuestaEscrita); setResultadoEvaluacion(null); setRespuestaEscrita(""); }} style={{ marginTop: '20px', backgroundColor: '#38bdf8', border: 'none', padding: '12px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Siguiente</button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {preguntaActual.opciones.map((opt, i) => (
              <button key={i} onClick={() => { const esCorrecta = opt === preguntaActual.respuesta_correcta; manejarRespuesta(esCorrecta ? 10 : 0, esCorrecta ? "¡Bien!" : `Mal, era: ${preguntaActual.respuesta_correcta}`, opt); }} style={{ textAlign: 'left', padding: '20px', borderRadius: '12px', backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white', cursor: 'pointer' }}>{opt}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;