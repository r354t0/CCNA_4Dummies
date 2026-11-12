import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Switch } from '../../lib/ios/motor';
import Escenario, { useCodigo, registrarLogro } from './Escenario';
import Consola from './Consola';
import './practica.css';

export interface TareaCLI { texto: string; pista: string; ok: (sw: Switch) => boolean }
export interface CasoCLI { tareas: TareaCLI[]; crear: () => Switch; instrucciones: ReactNode; final: ReactNode }

/** Consola IOS con una lista de tareas que se marcan solas al cumplirse. */
export default function MarcoCLI({ id, generar }: { id: string; generar: (codigo: string) => CasoCLI }) {
  const [codigo, setCodigo] = useCodigo();
  const caso = useMemo(() => (codigo ? generar(codigo) : null), [codigo, generar]);
  const sw = useMemo(() => (caso ? caso.crear() : null), [caso]);
  const [, setTick] = useState(0);
  const [pistas, setPistas] = useState<Record<number, boolean>>({});
  const avisado = useRef(false);
  if (!codigo || !caso || !sw) return null;

  const estados = caso.tareas.map((t) => t.ok(sw));
  const hechas = estados.filter(Boolean).length;
  const todo = hechas === caso.tareas.length;
  if (todo && !avisado.current) { avisado.current = true; registrarLogro(id); }
  const cambiar = (c: string) => { setCodigo(c); setPistas({}); avisado.current = false; };

  return (
    <Escenario id={id} codigo={codigo} alCambiar={cambiar} instrucciones={caso.instrucciones}>
      <div className="cli">
        <Consola key={codigo} sw={sw} alCambiar={() => setTick((t) => t + 1)} />
        <aside className="cli-tareas" aria-label="Tareas">
          <p className="cli-cab">Tareas <span>{hechas} de {caso.tareas.length}</span></p>
          <div className="cli-barra"><span style={{ width: `${(hechas / caso.tareas.length) * 100}%` }} /></div>
          <ol>
            {caso.tareas.map((t, i) => (
              <li key={i} className={estados[i] ? 'hecha' : ''}>
                <span className="cli-check" aria-hidden="true">{estados[i] ? '✓' : ''}</span>
                <span>
                  {t.texto}
                  {estados[i] && <span className="visually-hidden"> (completada)</span>}
                  {!estados[i] && (
                    pistas[i]
                      ? <pre className="cli-pista">{t.pista}</pre>
                      : <button type="button" className="cli-ver" onClick={() => setPistas({ ...pistas, [i]: true })}>Ver pista</button>
                  )}
                </span>
              </li>
            ))}
          </ol>
          {todo && <div className="pr-msg ok">{caso.final}</div>}
        </aside>
      </div>
    </Escenario>
  );
}
