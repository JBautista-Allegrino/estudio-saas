import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BookOpen, Calendar, ChevronLeft, CheckCircle, Upload } from 'lucide-react';
const API_URL = "https://estudio-saas-api.onrender.com";
function App() {
  const [examenes, setExamenes] = useState([]);
  const [examenSeleccionado, setExamenSeleccionado] = useState(null);
  
  // ESTADOS PARA EL QUIZ Y CARGA
  const [indicePregunta, setIndicePregunta] = useState(0);
  const [puntos, setPuntos] = useState(0);
  const [finalizado, setFinalizado] = useState(false);
  const [subiendo, setSubiendo] = useState(false); // <--- NUEVO ESTADO

  useEffect(() => {
    cargarExamenes();
  }, []);

  const cargarExamenes = async () => {
    try {
      const res = await axios.get('https://estudio-saas-api.onrender.com/mis-examenes');
      setExamenes(res.data.examenes);
    } catch (err) { console.error(err); }
  };

  // <--- NUEVA FUNCIÓN DE CARGA
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setSubiendo(true);
    try {
      await axios.post('https://estudio-saas-api.onrender.com/generar-examen', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await cargarExamenes(); // Refrescamos la lista
      alert("¡Examen de " + file.name + " generado!");
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

  // VISTA 1: DASHBOARD (HISTORIAL)
  if (!examenSeleccionado) {
    return (
      <div style={{ 
    width: '100%', 
    minHeight: '100vh', 
    padding: '40px', 
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center' // Centra el encabezado, pero no limita el ancho
  }}>
    
    {/* Encabezado */}
    <header style={{ textAlign: 'center', marginBottom: '40px' }}>
      <h1 style={{ fontSize: '3rem', margin: '0' }}>Mis Exámenes 📚</h1>
      <p style={{ opacity: 0.7 }}>Panel de control de estudio - UADE</p>
    </header>

    {/* Zona de Carga */}
    <section style={{ 
      width: '100%', 
      maxWidth: '800px', // El buscador/botón queda elegante si no es Gigante
      marginBottom: '50px' 
    }}>
      <div className="upload-box">
        {/* Aquí va tu botón de "Subir nuevo PDF" */}
      </div>
    </section>

    {/* Grid de Tarjetas (Aquí está la magia) */}
    <main style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
      gap: '25px', 
      width: '100%' 
    }}>
      {examenes.map((ex) => (
        <div key={ex.id} className="card-examen">
          <h3>{ex.titulo}</h3>
          <p>{ex.materia}</p>
          <button>Repasar ahora</button>
        </div>
      ))}
    </main>
  </div>
    );
  }

  // VISTA 2 Y 3: (RESTO DEL CÓDIGO SE MANTIENE IGUAL...)
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
      <div style={{ display: 'grid', gap: '15px', marginTop: '30px' }}>
        {preguntaActual.opciones.map((opt, i) => (
          <button key={i} onClick={() => manejarRespuesta(opt, preguntaActual.respuesta_correcta)} style={{ textAlign: 'left', padding: '20px', borderRadius: '12px', backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white', cursor: 'pointer' }}>{opt}</button>
        ))}
      </div>
    </div>
  );
}

export default App;