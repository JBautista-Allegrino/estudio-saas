import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BookOpen, Calendar, ChevronLeft, CheckCircle, Upload } from 'lucide-react';

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
      const res = await axios.get('http://127.0.0.1:8000/mis-examenes');
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
      await axios.post('http://127.0.0.1:8000/generar-examen', formData, {
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
      <div style={{ padding: '40px', backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
        <h1 style={{ color: '#38bdf8' }}>Mis Exámenes 📚</h1>

        {/* <--- BLOQUE DE CARGA DEBAJO DEL H1 */}
        <div style={{ border: '2px dashed #38bdf8', padding: '30px', borderRadius: '15px', textAlign: 'center', marginBottom: '40px', backgroundColor: '#1e293b' }}>
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