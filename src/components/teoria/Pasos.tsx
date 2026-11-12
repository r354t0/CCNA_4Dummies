import { useState, type ReactNode } from 'react';
import './contenido.css';

interface Paso { titulo: string; texto: string; codigo?: string }

/** Un proceso paso a paso: el alumno avanza a su ritmo y ve en qué etapa está. */
export default function Pasos({ pasos, titulo, children }: { pasos: Paso[]; titulo: string; children?: ReactNode }) {
  const [i, setI] = useState(0);
  const p = pasos[i];
  return (
    <section className="ps" aria-label={titulo}>
      <p className="ps-titulo">{titulo}</p>
      {children}
      <ol className="ps-pista">
        {pasos.map((x, j) => (
          <li key={j}>
            <button
              type="button"
              className={`ps-punto ${j === i ? 'actual' : j < i ? 'hecho' : ''}`}
              aria-current={j === i ? 'step' : undefined}
              onClick={() => setI(j)}
            >
              <span className="ps-n">{j + 1}</span>
              <span className="ps-etq">{x.titulo}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="ps-detalle" aria-live="polite">
        <p className="ps-paso">Paso {i + 1} de {pasos.length}: <strong>{p.titulo}</strong></p>
        <p>{p.texto}</p>
        {p.codigo && <pre>{p.codigo}</pre>}
      </div>
      <div className="ps-botones">
        <button type="button" onClick={() => setI(i - 1)} disabled={i === 0}>Anterior</button>
        <button type="button" className="ps-sig" onClick={() => setI(i + 1)} disabled={i === pasos.length - 1}>Siguiente</button>
      </div>
    </section>
  );
}
