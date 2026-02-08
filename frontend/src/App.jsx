import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { ChevronLeft, CheckCircle, Trash2, LogOut, Loader2 } from 'lucide-react';

// --- CONFIGURACIÓN DE INFRAESTRUCTURA ---
const supabaseUrl = "https://ucndntntyeqkdlzxgfsm.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjbmRudG50eWVxa2RsenhnZnNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMjYyNjIsImV4cCI6MjA4NTkwMjI2Mn0.A0eSlPbz_icnFmrQbtrosQypgszvZyKkMnwMJvQfP1E";
const supabase = createClient(supabaseUrl, supabaseKey);

const API_URL = "https://estudio-saas-api.onrender.com";

function App() {
  // Estados de Sesión y Datos
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [examenes, setExamenes] = useState([]);
  
  // Estados de UI y Examen
  const [examenSeleccionado, setExamenSeleccionado] = useState(null);
  const [historialSesion, setHistorialSesion] = useState([]);
  const [indicePregunta, setIndicePregunta] = useState(0);
  const [puntos, setPuntos] = useState(0);
  const [finalizado, setFinalizado] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [respuestaEscrita, setRespuestaEscrita] = useState("");
  const [resultadoEvaluacion, setResultadoEvaluacion] = useState(null);
  const [evaluando, setEvaluando] = useState(false);
  const [modo, setModo] = useState("rapido");
  const [cantidad, setCantidad] = useState(5);

  // Helper Senior para evitar el Error #31 de React
  const renderSafeText = (data) => {
    if (typeof data === 'object' && data !== null) {
      return JSON.stringify(data);
    }
    return data || "";
  };

  // --- LÓGICA DE AUTENTICACIÓN ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setExamenes([]);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- LÓGICA DE DATOS ---
  const cargarExamenes = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await axios.get(`${API_URL}/mis-examenes`, {
        params: { user_id: session.user.id }
      });
      setExamenes(res.data.examenes || []);
    } catch (err) {
      console.error("Error en Fetch Exámenes:", err);
    }
  }, [session]);

  useEffect(() => {
    if (session) cargarExamenes();
  }, [session, cargarExamenes]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !session) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('modo', modo);
    formData.append('cantidad', cantidad);
    formData.append('user_id', session.user.id);

    setSubiendo(true);
    try {
      const res = await axios.post(`${API_URL}/generar-examen`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data.status === "success") {
        await cargarExamenes();
        alert("¡Examen guardado!");
      } else {
        alert(`Error en el servidor: ${res.data.message}`);
      }
    } catch (error) {
      console.error("Error completo de Axios:", error);
      alert("Error de conexión. Abrí la Consola (F12) para ver el detalle técnico.");
    } finally {
      setSubiendo(false);
    }
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setExamenSeleccionado(null);
    setExamenes([]);
  };

  const iniciarSesionGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: {
          prompt: 'select_account',
          access_type: 'offline'
        },
        redirectTo: "https://estudio-saas.vercel.app"
      }
    });
  };

  const manejarRespuesta = (puntosGanados, feedbackActual = null, respuestaDada = null) => {
    const preguntaActual = examenSeleccionado.contenido_json.preguntas[indicePregunta];
    
    setHistorialSesion(prev => [
      ...prev,
      { 
        pregunta: renderSafeText(preguntaActual.pregunta), 
        nota: puntosGanados, 
        feedback: renderSafeText(feedbackActual), 
        tuRespuesta: renderSafeText(respuestaDada) 
      }
    ]);

    setPuntos(prev => prev + puntosGanados);
    
    const siguiente = indicePregunta + 1;
    if (siguiente < examenSeleccionado.contenido_json.preguntas.length) {
      setIndicePregunta(siguiente);
    } else {
      setFinalizado(true);
    }
  };

  const enviarEvaluacion = async () => {
    if (!respuestaEscrita.trim()) return;
    setEvaluando(true);
    try {
      const preguntaActual = examenSeleccionado.contenido_json.preguntas[indicePregunta];
      const res = await axios.post(`${API_URL}/evaluar-respuesta`, {
        pregunta: renderSafeText(preguntaActual.pregunta),
        respuesta_usuario: respuestaEscrita,
        contexto_previo: examenSeleccionado.texto_fuente
      });
      setResultadoEvaluacion(res.data.evaluacion);
    } catch (err) {
      alert("Error de conexión con la IA");
    } finally {
      setEvaluando(false);
    }
  };

  const eliminarExamen = async (id) => {
    if (!window.confirm("¿Borrar examen de forma permanente?")) return;
    try {
      await axios.delete(`${API_URL}/eliminar-examen/${id}`);
      await cargarExamenes();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}><Loader2 className="animate-spin" color="#38bdf8" size={48} /></div>;

  if (!session) {
    return (
      <div style={{ padding: '100px 20px', textAlign: 'center', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
        <h1 style={{ color: '#38bdf8', fontSize: '3rem', marginBottom: '10px' }}>Estudio SaaS 🧠</h1>
        <p style={{ color: '#94a3b8', fontSize: '1.2rem', marginBottom: '40px' }}>Tu plataforma de Active Recall</p>
        <button onClick={iniciarSesionGoogle} style={{ backgroundColor: '#1e293b', color: 'white', padding: '18px 40px', borderRadius: '12px', cursor: 'pointer', border: '1px solid #38bdf8', fontSize: '1.1rem', fontWeight: 'bold' }}>Ingresar con Google</button>
      </div>
    );
  }

  if (!examenSeleccionado) {
    return (
      <div style={{ padding: '40px', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div>
            <h1 style={{ color: '#38bdf8', margin: 0 }}>Panel de Control</h1>
            <p style={{ color: '#94a3b8', margin: 0 }}>Hola, {session.user.email}</p>
          </div>
          <button onClick={cerrarSesion} style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
            <LogOut size={20} /> Cerrar Sesión
          </button>
        </header>

        <section style={{ border: '2px dashed #38bdf8', padding: '40px', borderRadius: '20px', textAlign: 'center', marginBottom: '40px', backgroundColor: '#1e293b' }}>
          <div style={{ display: 'flex', gap: '25px', justifyContent: 'center', marginBottom: '30px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>MÉTODO DE ESTUDIO</label>
              <select value={modo} onChange={(e) => setModo(e.target.value)} style={{ padding: '12px', borderRadius: '8px', background: '#0f172a', color: 'white', border: '1px solid #334155', width: '220px' }}>
                <option value="rapido">🚀 Repaso (Multiple Choice)</option>
                <option value="profundo">🧠 Examen (Escritura)</option>
              </select>
            </div>
            <div style={{ textAlign: 'left' }}>
              <label style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>CANTIDAD</label>
              <input type="number" value={cantidad} min="1" max="20" onChange={(e) => setCantidad(e.target.value)} style={{ padding: '12px', borderRadius: '8px', background: '#0f172a', color: 'white', border: '1px solid #334155', width: '80px' }} />
            </div>
          </div>
          <input type="file" id="pdf-upload" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
          <label htmlFor="pdf-upload" style={{ cursor: 'pointer', display: 'inline-block', backgroundColor: '#38bdf8', color: '#0f172a', padding: '15px 40px', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.1rem' }}>
            {subiendo ? "Generando examen con IA..." : "📤 Subir Apunte PDF"}
          </label>
        </section>

        <div style={{ display: 'grid', gap: '20px' }}>
          {examenes.map(ex => (
            <div key={ex.id} style={{ backgroundColor: '#1e293b', padding: '25px', borderRadius: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #334155' }}>
              <div>
                <h3 style={{ margin: 0 }}>{renderSafeText(ex.titulo)}</h3>
                <p style={{ color: '#38bdf8', margin: '4px 0 0 0', fontWeight: '600' }}>{renderSafeText(ex.materia)}</p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setExamenSeleccionado(ex)} style={{ backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', padding: '12px 25px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Estudiar</button>
                <button onClick={() => eliminarExamen(ex.id)} style={{ backgroundColor: '#ef444422', border: '1px solid #ef4444', color: '#ef4444', padding: '12px', borderRadius: '10px', cursor: 'pointer' }}><Trash2 size={20} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (finalizado) {
    const notaFinal = puntos / examenSeleccionado.contenido_json.preguntas.length;
    return (
      <div style={{ padding: '40px', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <CheckCircle size={100} color="#22c55e" style={{ margin: '0 auto 20px' }} />
          <h1>¡Sesión Finalizada!</h1>
          <p style={{ fontSize: '1.5rem' }}>Promedio: <span style={{ color: notaFinal >= 4 ? '#38bdf8' : '#ef4444' }}>{notaFinal.toFixed(1)} / 10</span></p>
        </div>
        <div style={{ display: 'grid', gap: '20px' }}>
          {historialSesion.map((item, i) => (
            <div key={i} style={{ backgroundColor: '#1e293b', padding: '25px', borderRadius: '15px', borderLeft: `6px solid ${item.nota >= 7 ? '#22c55e' : item.nota >= 4 ? '#eab308' : '#ef4444'}` }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#38bdf8' }}>{i+1}. {renderSafeText(item.pregunta)}</h4>
              <p><strong>Tu respuesta:</strong> {renderSafeText(item.tuRespuesta)}</p>
              {item.feedback && <p style={{ fontSize: '0.9rem', color: '#94a3b8', backgroundColor: '#0f172a', padding: '15px', borderRadius: '10px', marginTop: '10px' }}>{renderSafeText(item.feedback)}</p>}
              <p style={{ textAlign: 'right', fontWeight: 'bold' }}>Nota: {item.nota}/10</p>
            </div>
          ))}
        </div>
        <button onClick={() => { setExamenSeleccionado(null); setFinalizado(false); setHistorialSesion([]); setIndicePregunta(0); setPuntos(0); }} style={{ display: 'block', margin: '40px auto', backgroundColor: '#38bdf8', color: '#0f172a', padding: '15px 60px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Volver al Panel</button>
      </div>
    );
  }

  const preguntaActual = examenSeleccionado.contenido_json.preguntas[indicePregunta];
  return (
    <div style={{ padding: '40px', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
      <button onClick={() => setExamenSeleccionado(null)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', display: 'flex', alignItems: 'center', marginBottom: '30px' }}><ChevronLeft size={20} /> Abandonar</button>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2>{renderSafeText(preguntaActual.pregunta)}</h2>
        {preguntaActual.opciones ? (
          <div style={{ display: 'grid', gap: '15px' }}>
            {preguntaActual.opciones.map((opt, i) => (
              <button key={i} onClick={() => {
                  const esCorrecta = opt === preguntaActual.respuesta_correcta;
                  manejarRespuesta(esCorrecta ? 10 : 0, esCorrecta ? "¡Correcto!" : `Incorrecto. Era: ${preguntaActual.respuesta_correcta}`, opt);
                }} style={{ textAlign: 'left', padding: '20px', borderRadius: '12px', backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white', cursor: 'pointer' }}>
                {renderSafeText(opt)}
              </button>
            ))}
          </div>
        ) : (
          <div>
            {!resultadoEvaluacion ? (
              <>
                <textarea value={respuestaEscrita} onChange={(e) => setRespuestaEscrita(e.target.value)} placeholder="Tu respuesta..." style={{ width: '100%', height: '200px', padding: '20px', borderRadius: '15px', backgroundColor: '#1e293b', color: 'white', border: '1px solid #38bdf8', marginBottom: '20px' }} />
                <button onClick={enviarEvaluacion} disabled={evaluando} style={{ width: '100%', padding: '18px', borderRadius: '12px', backgroundColor: '#22c55e', color: 'white', fontWeight: 'bold' }}>{evaluando ? "Analizando..." : "Enviar"}</button>
              </>
            ) : (
              <div style={{ backgroundColor: '#1e293b', padding: '30px', borderRadius: '20px', border: '2px solid #38bdf8' }}>
                <h3>Nota: {resultadoEvaluacion.nota} / 10</h3>
                <p>{renderSafeText(resultadoEvaluacion.feedback)}</p>
                <button onClick={() => { manejarRespuesta(resultadoEvaluacion.nota, resultadoEvaluacion.feedback, respuestaEscrita); setResultadoEvaluacion(null); setRespuestaEscrita(""); }} style={{ marginTop: '25px', width: '100%', padding: '15px', borderRadius: '10px', backgroundColor: '#38bdf8', color: '#0f172a', fontWeight: 'bold' }}>Siguiente ➔</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;