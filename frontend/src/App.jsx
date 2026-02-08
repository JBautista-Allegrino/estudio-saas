import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { ChevronLeft, CheckCircle, Trash2, LogOut, Loader2 } from 'lucide-react';

const supabase = createClient("TU_URL", "TU_ANON_KEY");
const API_URL = "https://estudio-saas-api.onrender.com";

function App() {
  const [session, setSession] = useState(null);
  const [examenes, setExamenes] = useState([]);
  const [examenSeleccionado, setExamenSeleccionado] = useState(null);
  const [indicePregunta, setIndicePregunta] = useState(0);
  const [puntos, setPuntos] = useState(0);
  const [finalizado, setFinalizado] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [historialSesion, setHistorialSesion] = useState([]);

  // RESET DE ESTADO AL ELEGIR EXAMEN (Soluciona el error de lectura '1')
  const seleccionarExamen = (ex) => {
    setExamenSeleccionado(ex);
    setIndicePregunta(0); // Vuelve al inicio
    setPuntos(0);
    setFinalizado(false);
    setHistorialSesion([]);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_event, session) => setSession(session));
  }, []);

  const cargarExamenes = useCallback(async () => {
    if (!session) return;
    const res = await axios.get(`${API_URL}/mis-examenes?user_id=${session.user.id}`);
    setExamenes(res.data.examenes || []);
  }, [session]);

  useEffect(() => { if (session) cargarExamenes(); }, [session, cargarExamenes]);

  const eliminarExamen = async (id) => {
    if (!window.confirm("¿Eliminar examen?")) return;
    await axios.delete(`${API_URL}/eliminar-examen/${id}`);
    cargarExamenes();
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setExamenSeleccionado(null);
  };

  if (!session) return (
    <div style={{ padding: '100px', textAlign: 'center', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white' }}>
      <h1>Estudio SaaS 🧠</h1>
      <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { queryParams: { prompt: 'select_account' } } })}>Entrar con Google</button>
    </div>
  );

  if (!examenSeleccionado) return (
    <div style={{ padding: '40px', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h1>Mis Exámenes 📚</h1>
        <button onClick={cerrarSesion} style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LogOut size={18} /> Salir
        </button>
      </header>
      {/* Resto del dashboard... */}
      {examenes.map(ex => (
        <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', backgroundColor: '#1e293b', marginBottom: '10px', borderRadius: '10px' }}>
          <h3>{ex.titulo}</h3>
          <div>
            <button onClick={() => seleccionarExamen(ex)}>Estudiar</button>
            <button onClick={() => eliminarExamen(ex.id)} style={{ color: '#ef4444' }}><Trash2 size={18} /></button>
          </div>
        </div>
      ))}
    </div>
  );

  // Vistas de preguntas y resultados aquí...
  return (<div>Contenido del examen...</div>);
}

export default App;