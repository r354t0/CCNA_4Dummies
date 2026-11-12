import { useState } from 'react';
import './contenido.css';

interface Campo { nombre: string; tam: string; texto: string; peso?: number; destacado?: boolean; grupo?: string }
interface Modo { nombre: string; hasta: number; texto: string }

/**
 * Una trama dibujada como barra de campos. Al tocar un campo se explica.
 * Con `modos`, cada botón marca hasta qué campo lee el switch antes de reenviar.
 */
export default function Trama({ titulo, campos, modos }: { titulo: string; campos: Campo[]; modos?: Modo[] }) {
  const [sel, setSel] = useState(campos.findIndex((c) => c.destacado) >= 0 ? campos.findIndex((c) => c.destacado) : 0);
  const [modo, setModo] = useState(0);
  const m = modos?.[modo];
  const total = campos.reduce((n, c) => n + (c.peso ?? 1), 0);
  let acumulado = 0;
  const grupos = campos.map((c) => c.grupo).filter((g, i, a): g is string => !!g && a.indexOf(g) === i);
  return (
    <section className="tq" aria-label={titulo}>
      <p className="tq-titulo">{titulo}</p>
      {modos && (
        <div className="tq-modos" role="tablist">
          {modos.map((x, i) => (
            <button key={x.nombre} type="button" role="tab" aria-selected={i === modo} className={i === modo ? 'sel' : ''} onClick={() => setModo(i)}>{x.nombre}</button>
          ))}
        </div>
      )}
      <div className="tq-scroll">
      <div className="tq-barra">
        {campos.map((c, i) => {
          const izq = acumulado;
          acumulado += c.peso ?? 1;
          return (
            <button
              key={c.nombre}
              type="button"
              className={`tq-campo ${i === sel ? 'sel' : ''} ${c.destacado ? 'destacado' : ''} ${m && i <= m.hasta ? 'leido' : ''}`}
              style={{ flexGrow: c.peso ?? 1 }}
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              data-izq={izq / total}
            >
              <span className="tq-nombre">{c.nombre}</span>
              <span className="tq-tam">{c.tam}</span>
            </button>
          );
        })}
      </div>
      {grupos.length > 0 && (
        <div className="tq-grupos" aria-hidden="true">
          {campos.map((c, i) => (
            <span key={i} style={{ flexGrow: c.peso ?? 1 }} className={c.grupo ? 'en-grupo' : ''}>{c.grupo && campos.findIndex((x) => x.grupo === c.grupo) === i ? c.grupo : ''}</span>
          ))}
        </div>
      )}
      </div>
      <div className="tq-detalle" aria-live="polite">
        {m && <p className="tq-modo-texto"><strong>{m.nombre}:</strong> {m.texto}</p>}
        <p><strong>{campos[sel].nombre}</strong> ({campos[sel].tam}). {campos[sel].texto}</p>
      </div>
    </section>
  );
}
