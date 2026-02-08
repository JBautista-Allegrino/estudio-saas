import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { ChevronLeft, CheckCircle, Trash2, LogOut, Loader2, AlertTriangle } from 'lucide-react';

// --- CONFIGURACIÓN DE INFRAESTRUCTURA ---
const supabaseUrl = "https://ucndntntyeqkdlzxgfsm.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjbmRudG50eWVxa2RsenhnZnNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMjYyNjIsImV4cCI6MjA4NTkwMjI2Mn0.A0eSlPbz_icnFmrQbtrosQypgszvZyKkMnwMJvQfP1E";
const supabase = createClient(supabaseUrl, supabaseKey);

const API_URL = "https://estudio-saas-api.onrender.com";

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [examenes, setExamenes] = useState([]);
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

  // Helper de Seguridad Senior: Evita Error #31 y accesos a undefined
  const renderSafeText = (data) => {
    if (typeof data === 'object' && data !== null) return JSON.stringify(data);
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
      console.error("Error cargando exámenes:", err);
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
      const res = await axios.post(`${API_URL}/generar-examen`, formData);
      if (res.data.status === "success") {
        await cargarExamenes();
        alert("¡Examen guardado!");
      } else {
        alert(`Fallo técnico: ${res.data.message}`);
      }
    } catch (error) {
      alert("Error de conexión con el backend de Render.");
    } finally {
      setSubiendo(false);
    }
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setExamenSeleccionado(null);
  };

  // --- LÓGICA DE EXAMEN (BLINDADA) ---
  const manejarRespuesta = (puntosGanados, feedbackActual = null, respuestaDada = null) => {
    const preguntas = examenSeleccionado?.contenido_json?.preguntas || [];
    const preguntaActual = preguntas[indicePregunta];
    
    setHistorialSesion(prev => [
      ...prev,
      { 
        pregunta: renderSafeText(preguntaActual?.pregunta), 
        nota: puntosGanados, 
        feedback: renderSafeText(feedbackActual), 
        tuRespuesta: renderSafeText(respuestaDada) 
      }
    ]);

    setPuntos(prev => prev + puntosGanados);
    
    const siguiente = indicePregunta + 1;
    if (siguiente < preguntas.length) {
      setIndicePregunta(siguiente);
    } else {
      setFinalizado(true);
    }
  };

  const enviarEvaluacion = async () => {
    const preguntas = examenSeleccionado?.contenido_json?.preguntas || [];
    const preguntaActual = preguntas[indicePregunta];
    if (!respuestaEscrita.trim() || !preguntaActual) return;
    
    setEvaluando(true);
    try {
      const res = await axios.post(`${API_URL}/evaluar-respuesta`, {
        pregunta: renderSafeText(preguntaActual.pregunta),
        respuesta_usuario: respuestaEscrita,
        contexto_previo: examenSeleccionado.texto_fuente
      });
      setResultadoEvaluacion(res.data.evaluacion);
    } catch (err) {
      alert("La IA no pudo evaluar tu respuesta.");
    } finally {
      setEvaluando(false);
    }
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}><Loader2 className="animate-spin" color="#38bdf8" size={48} /></div>;

  if (!session) {
    return (
      <div style={{ padding: '100px 20px', textAlign: 'center', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
        <h1 style={{ color: '#38bdf8', fontSize: '3rem' }}>Estudio SaaS 🧠</h1>
        <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { queryParams: { prompt: 'select_account' } } })} style={{ backgroundColor: '#1e293b', color: 'white', padding: '18px 40px', borderRadius: '12px', cursor: 'pointer', border: '1px solid #38bdf8' }}>Ingresar con Google</button>
      </div>
    );
  }

  // Vista del Dashboard
  if (!examenSeleccionado) {
    return (
      <div style={{ padding: '40px', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
          <h1 style={{ color: '#38bdf8' }}>Mis Exámenes de la UADE</h1>
          <button onClick={cerrarSesion} style={{ color: '#ef4444', border: '1px solid #ef4444', background: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}><LogOut size={20} /></button>
        </header>

        <section style={{ border: '2px dashed #38bdf8', padding: '30px', borderRadius: '15px', textAlign: 'center', marginBottom: '40px', backgroundColor: '#1e293b' }}>
          <input type="file" id="pdf-upload" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
          <label htmlFor="pdf-upload" style={{ cursor: 'pointer' }}>
            <h2>{subiendo ? "Generando..." : "📤 Subir PDF Técnico"}</h2>
          </label>
        </section>

        <div style={{ display: 'grid', gap: '20px' }}>
          {examenes.map(ex => (
            <div key={ex.id} style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', border: '1px solid #334155' }}>
              <div>
                <h3 style={{ margin: 0 }}>{renderSafeText(ex.titulo)}</h3>
                <p style={{ color: '#38bdf8' }}>{renderSafeText(ex.materia)}</p>
              </div>
              <button onClick={() => { setExamenSeleccionado(ex); setIndicePregunta(0); setHistorialSesion([]); setFinalizado(false); }} style={{ backgroundColor: '#38bdf8', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Estudiar</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Lógica de Renderizado de Preguntas con Defensa ante undefined
  const preguntas = examenSeleccionado?.contenido_json?.preguntas || [];
  const notaFinal = preguntas.length > 0 ? (puntos / preguntas.length) : 0;

  if (finalizado || preguntas.length === 0) {
    return (
      <div style={{ padding: '40px', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
        {preguntas.length === 0 ? (
          <div style={{ textAlign: 'center' }}>
            <AlertTriangle size={60} color="#eab308" style={{ margin: '0 auto' }} />
            <h2>Error en el examen generado</h2>
            <p>La IA no devolvió preguntas válidas. Intentá con otro PDF.</p>
          </div>
        ) : (
          <>
            <h1 style={{ textAlign: 'center' }}>Sesión Finalizada</h1>
            <p style={{ textAlign: 'center', fontSize: '1.5rem' }}>Nota: <span style={{ color: notaFinal >= 4 ? '#38bdf8' : '#ef4444' }}>{notaFinal.toFixed(1)} / 10</span></p>
            {historialSesion.map((item, i) => (
              <div key={i} style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '15px', marginBottom: '15px', borderLeft: '5px solid #38bdf8' }}>
                <h4>{i+1}. {renderSafeText(item.pregunta)}</h4>
                <p><strong>Feedback:</strong> {renderSafeText(item.feedback)}</p>
              </div>
            ))}
          </>
        )}
        <button onClick={() => setExamenSeleccionado(null)} style={{ display: 'block', margin: '30px auto', backgroundColor: '#38bdf8', padding: '15px 40px', borderRadius: '10px', fontWeight: 'bold' }}>Volver</button>
      </div>
    );
  }

  const preguntaActual = preguntas[indicePregunta];

  return (
    <div style={{ padding: '40px', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
      <button onClick={() => setExamenSeleccionado(null)} style={{ background: 'none', color: '#38bdf8', border: 'none', cursor: 'pointer', marginBottom: '20px' }}><ChevronLeft /> Salir</button>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <p style={{ color: '#38bdf8' }}>PREGUNTA {indicePregunta + 1} DE {preguntas.length}</p>
        <h2>{renderSafeText(preguntaActual?.pregunta)}</h2>
        
        {preguntaActual?.opciones ? (
          <div style={{ display: 'grid', gap: '15px' }}>
            {preguntaActual.opciones.map((opt, i) => (
              <button key={i} onClick={() => manejarRespuesta(opt === preguntaActual.respuesta_correcta ? 10 : 0, opt === preguntaActual.respuesta_correcta ? "¡Correcto!" : `Era: ${preguntaActual.respuesta_correcta}`, opt)} style={{ textAlign: 'left', padding: '20px', borderRadius: '12px', backgroundColor: '#1e293b', color: 'white', cursor: 'pointer', border: '1px solid #334155' }}>
                {renderSafeText(opt)}
              </button>
            ))}
          </div>
        ) : (
          <div>
            {!resultadoEvaluacion ? (
              <>
                <textarea value={respuestaEscrita} onChange={(e) => setRespuestaEscrita(e.target.value)} style={{ width: '100%', height: '200px', padding: '20px', borderRadius: '15px', backgroundColor: '#1e293b', color: 'white', border: '1px solid #38bdf8' }} />
                <button onClick={enviarEvaluacion} disabled={evaluando} style={{ width: '100%', padding: '15px', marginTop: '10px', borderRadius: '10px', backgroundColor: '#22c55e', color: 'white', fontWeight: 'bold' }}>{evaluando ? "Analizando..." : "Enviar"}</button>
              </>
            ) : (
              <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '15px', border: '1px solid #38bdf8' }}>
                <h3>Nota: {resultadoEvaluacion.nota} / 10</h3>
                <p>{renderSafeText(resultadoEvaluacion.feedback)}</p>
                <button onClick={() => { manejarRespuesta(resultadoEvaluacion.nota, resultadoEvaluacion.feedback, respuestaEscrita); setResultadoEvaluacion(null); setRespuestaEscrita(""); }} style={{ width: '100%', padding: '10px', backgroundColor: '#38bdf8', borderRadius: '8px', marginTop: '10px' }}>Siguiente</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;