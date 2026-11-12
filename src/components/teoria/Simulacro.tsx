import { useState } from 'react';
import Examen, { type PreguntaExamen } from './Examen';
import './evaluacion.css';

interface ModuloDisponible {
  curso: string;
  sigla: string;
  numero: number;
  titulo: string;
  preguntas: number;
}

interface Props {
  banco: (PreguntaExamen & { curso: string })[];
  modulos: ModuloDisponible[];
}

const CANTIDADES = [10, 20, 30, 50];

/** Simulacro configurable: el alumno elige módulos, cantidad y si quiere tiempo. */
export default function Simulacro({ banco, modulos }: Props) {
  const [elegidos, setElegidos] = useState<string[]>(modulos.map((m) => `${m.curso}:${m.numero}`));
  const [cantidad, setCantidad] = useState(20);
  const [conTiempo, setConTiempo] = useState(false);
  const [ronda, setRonda] = useState(0);

  const pool = banco.filter((q) => elegidos.includes(`${q.curso}:${q.modulo}`));
  const efectiva = Math.min(cantidad, pool.length);
  const titulos = Object.fromEntries(modulos.map((m) => [m.numero, m.titulo]));

  if (ronda > 0) {
    return (
      <div>
        <Examen
          key={ronda}
          banco={pool}
          cantidad={efectiva}
          titulo="Simulacro"
          desglose={elegidos.length > 1 ? 'modulo' : 'tema'}
          minutos={conTiempo ? Math.ceil(efectiva * 1.2) : undefined}
          modulosTitulos={titulos}
          clave={`s:${elegidos.length}`}
          autoiniciar
        />
        <p className="sim-volver">
          <button type="button" className="ev-boton" onClick={() => setRonda(0)}>Cambiar la configuración del simulacro</button>
        </p>
      </div>
    );
  }

  const alternar = (k: string) =>
    setElegidos(elegidos.includes(k) ? elegidos.filter((x) => x !== k) : [...elegidos, k]);

  return (
    <form
      className="sim-config ev-examen"
      onSubmit={(e) => { e.preventDefault(); if (efectiva > 0) setRonda((r) => r + 1); }}
    >
      <fieldset>
        <legend>Módulos que entran</legend>
        <div className="sim-atajos">
          <button type="button" className="ev-boton" onClick={() => setElegidos(modulos.map((m) => `${m.curso}:${m.numero}`))}>Todos</button>
          <button type="button" className="ev-boton" onClick={() => setElegidos([])}>Ninguno</button>
        </div>
        <div className="sim-modulos">
          {modulos.map((m) => {
            const k = `${m.curso}:${m.numero}`;
            return (
              <label key={k} className="ev-opcion">
                <input type="checkbox" checked={elegidos.includes(k)} onChange={() => alternar(k)} />
                <span>
                  <strong>{m.sigla} {m.numero}.</strong> {m.titulo}
                  <span className="sim-n"> {m.preguntas} preguntas en el banco</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend>Cantidad de preguntas</legend>
        <div className="sim-cantidades" role="radiogroup">
          {CANTIDADES.map((n) => (
            <label key={n} className={`sim-chip ${cantidad === n ? 'activo' : ''}`}>
              <input type="radio" name="cantidad" checked={cantidad === n} onChange={() => setCantidad(n)} />
              {n}
            </label>
          ))}
        </div>
        {pool.length < cantidad && pool.length > 0 && (
          <p className="sim-nota">Los módulos elegidos tienen {pool.length} preguntas: el simulacro usará todas.</p>
        )}
      </fieldset>

      <fieldset>
        <legend>Tiempo</legend>
        <label className="ev-opcion">
          <input type="checkbox" checked={conTiempo} onChange={(e) => setConTiempo(e.target.checked)} />
          <span>
            Con cronómetro: {Math.ceil(efectiva * 1.2)} minutos para {efectiva} preguntas.
            <span className="sim-n"> El examen real de CCNA da unos 120 minutos para alrededor de 100 preguntas.</span>
          </span>
        </label>
      </fieldset>

      <button type="submit" className="ev-boton ev-primario" disabled={efectiva === 0}>
        {efectiva === 0 ? 'Elige al menos un módulo' : `Empezar simulacro de ${efectiva} preguntas`}
      </button>
    </form>
  );
}
