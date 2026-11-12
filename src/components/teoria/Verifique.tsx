import { useState } from 'react';
import './evaluacion.css';

export interface PreguntaVerifique {
  id: string;
  p: string;
  ilustracion?: string;
  opciones: string[];
  correcta: number | number[];
  explicacion: string;
}

const lista = (c: number | number[]) => (Array.isArray(c) ? c : [c]);

/** «Verifique su comprensión»: preguntas cortas con respuesta inmediata al final de cada tema. */
export default function Verifique({ preguntas }: { preguntas: PreguntaVerifique[] }) {
  const [elegidas, setElegidas] = useState<Record<string, number[]>>({});
  const [comprobadas, setComprobadas] = useState<Record<string, boolean>>({});

  const correctas = preguntas.filter((q) => {
    const e = elegidas[q.id] ?? [];
    const c = lista(q.correcta);
    return comprobadas[q.id] && e.length === c.length && c.every((x) => e.includes(x));
  }).length;
  const terminadas = preguntas.filter((q) => comprobadas[q.id]).length;

  return (
    <div className="ev-verifique">
      <ol className="ev-lista">
        {preguntas.map((q) => {
          const c = lista(q.correcta);
          const multiple = c.length > 1;
          const e = elegidas[q.id] ?? [];
          const hecha = Boolean(comprobadas[q.id]);
          const bien = hecha && e.length === c.length && c.every((x) => e.includes(x));
          const alternar = (j: number) => {
            if (hecha) return;
            const nuevo = multiple ? (e.includes(j) ? e.filter((x) => x !== j) : [...e, j]) : [j];
            setElegidas({ ...elegidas, [q.id]: nuevo });
            if (!multiple) setComprobadas({ ...comprobadas, [q.id]: true });
          };
          return (
            <li key={q.id} className="ev-pregunta">
              <fieldset disabled={hecha}>
                <legend>
                  {q.p}
                  {multiple && <span className="ev-elija"> Elija {c.length} opciones.</span>}
                </legend>
                {q.ilustracion && <pre className="ev-ilustracion">{q.ilustracion}</pre>}
                {q.opciones.map((o, j) => {
                  let estado = '';
                  if (hecha && c.includes(j)) estado = 'ok';
                  else if (hecha && e.includes(j)) estado = 'mal';
                  return (
                    <label key={j} className={`ev-opcion ${estado}`}>
                      <input
                        type={multiple ? 'checkbox' : 'radio'}
                        name={`v-${q.id}`}
                        checked={e.includes(j)}
                        onChange={() => alternar(j)}
                      />
                      <span>{o}</span>
                    </label>
                  );
                })}
              </fieldset>
              {multiple && !hecha && (
                <button
                  type="button"
                  className="ev-boton"
                  disabled={e.length !== c.length}
                  onClick={() => setComprobadas({ ...comprobadas, [q.id]: true })}
                >
                  {e.length === c.length ? 'Comprobar' : `Elige ${c.length - e.length} más`}
                </button>
              )}
              {hecha && (
                <p className={`ev-explicacion ${bien ? 'ok' : 'mal'}`} aria-live="polite">
                  <strong>{bien ? 'Correcto.' : 'No es correcta.'}</strong> {q.explicacion}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <div className="ev-pie" aria-live="polite">
        {terminadas === preguntas.length ? (
          <>
            <span><strong>{correctas} de {preguntas.length}</strong> correctas.</span>
            <button type="button" className="ev-boton" onClick={() => { setElegidas({}); setComprobadas({}); }}>
              Intentar de nuevo
            </button>
          </>
        ) : (
          <span>{terminadas} de {preguntas.length} respondidas</span>
        )}
      </div>
    </div>
  );
}
