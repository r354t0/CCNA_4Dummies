import { useState } from 'react';
import './contenido.css';

interface Ficha { frente: string; dorso: string }

/** Tarjetas de repaso que se voltean: piensa la respuesta antes de girarla. */
export default function Repaso({ fichas, titulo = 'Tarjetas de repaso' }: { fichas: Ficha[]; titulo?: string }) {
  const [vueltas, setVueltas] = useState<Record<number, boolean>>({});
  const giradas = Object.values(vueltas).filter(Boolean).length;
  return (
    <section className="rp" aria-label={titulo}>
      <div className="rp-cab">
        <p className="rp-titulo">{titulo}</p>
        <p className="rp-ayuda">Piensa la respuesta y toca la tarjeta para comprobarla. {giradas} de {fichas.length} vistas.</p>
      </div>
      <ul className="rp-rejilla">
        {fichas.map((f, i) => (
          <li key={i}>
            <button
              type="button"
              className={`rp-ficha ${vueltas[i] ? 'girada' : ''}`}
              aria-pressed={Boolean(vueltas[i])}
              onClick={() => setVueltas({ ...vueltas, [i]: !vueltas[i] })}
            >
              <span className="rp-cara rp-frente">{f.frente}</span>
              <span className="rp-cara rp-dorso" aria-hidden={!vueltas[i]}>{f.dorso}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
