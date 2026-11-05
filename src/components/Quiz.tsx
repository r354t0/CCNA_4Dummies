import { useEffect, useState } from 'react';
import './Quiz.css';

interface Pregunta {
  p: string;
  opciones: string[];
  correcta: number;
  explicacion: string;
}

const CLAVE = 'ccna-quiz';

function leerMejores(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch { return {}; }
}

export default function Quiz({ id, preguntas }: { id: string; preguntas: Pregunta[] }) {
  const [elegidas, setElegidas] = useState<(number | null)[]>(() => preguntas.map(() => null));
  const [mejor, setMejor] = useState<number | null>(null);

  useEffect(() => {
    const m = leerMejores()[id];
    if (typeof m === 'number') setMejor(m);
  }, [id]);

  const respondidas = elegidas.filter((e) => e !== null).length;
  const aciertos = elegidas.filter((e, i) => e === preguntas[i].correcta).length;
  const terminado = respondidas === preguntas.length;

  useEffect(() => {
    if (!terminado) return;
    const todos = leerMejores();
    if ((todos[id] ?? -1) < aciertos) {
      todos[id] = aciertos;
      try { localStorage.setItem(CLAVE, JSON.stringify(todos)); } catch { /* sin almacenamiento */ }
      setMejor(aciertos);
    }
  }, [terminado, aciertos, id]);

  return (
    <section className="quiz" aria-label="Comprueba lo que aprendiste">
      <ol className="quiz-lista">
        {preguntas.map((q, i) => {
          const elegida = elegidas[i];
          const respondida = elegida !== null;
          return (
            <li key={i} className="quiz-pregunta">
              <fieldset disabled={respondida}>
                <legend>{q.p}</legend>
                {q.opciones.map((o, j) => {
                  let estado = '';
                  if (respondida && j === q.correcta) estado = 'ok';
                  else if (respondida && j === elegida) estado = 'mal';
                  return (
                    <label key={j} className={`quiz-opcion ${estado}`}>
                      <input
                        type="radio"
                        name={`${id}-${i}`}
                        checked={elegida === j}
                        onChange={() => setElegidas(elegidas.map((e, k) => (k === i ? j : e)))}
                      />
                      <span>{o}</span>
                    </label>
                  );
                })}
              </fieldset>
              {respondida && (
                <p className={`quiz-explicacion ${elegida === q.correcta ? 'ok' : 'mal'}`} aria-live="polite">
                  <strong>{elegida === q.correcta ? 'Correcto.' : 'No es correcta.'}</strong> {q.explicacion}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="quiz-pie" aria-live="polite">
        {terminado ? (
          <>
            <span><strong>{aciertos} de {preguntas.length}</strong> respuestas correctas.</span>
            <button type="button" onClick={() => setElegidas(preguntas.map(() => null))}>Repetir el quiz</button>
          </>
        ) : (
          <span>{respondidas} de {preguntas.length} respondidas</span>
        )}
        {mejor !== null && <span className="quiz-mejor">Tu mejor resultado: {mejor} de {preguntas.length}</span>}
      </div>
    </section>
  );
}
