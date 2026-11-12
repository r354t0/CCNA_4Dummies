import { useMemo, useState, type ReactNode } from 'react';
import { nuevoCodigo } from '../../lib/azar';
import Topologia, { type NodoTopo, type EnlaceTopo } from '../Topologia';
import Escenario, { useCodigo, registrarLogro } from './Escenario';
import './practica.css';

export interface CasoDiagnostico {
  reporte: string;
  topologia: { nodos: NodoTopo[]; enlaces: EnlaceTopo[]; ancho: number; alto: number; titulo: string };
  evidencias: { titulo: string; texto: string }[];
  opciones: { id: string; texto: string }[];
  correcta: string;
  prueba: { ev: number; buscar: RegExp; explica: string; arreglo: string };
}

function Resaltar({ texto, buscar }: { texto: string; buscar?: RegExp }) {
  if (!buscar) return <>{texto}</>;
  const re = new RegExp(buscar.source, buscar.flags.includes('g') ? buscar.flags : buscar.flags + 'g');
  const partes: (string | ReactNode)[] = [];
  let ultimo = 0, k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) && m[0]) {
    partes.push(texto.slice(ultimo, m.index));
    partes.push(<mark key={k++} className="rs">{m[0]}</mark>);
    ultimo = m.index + m[0].length;
  }
  partes.push(texto.slice(ultimo));
  return <>{partes}</>;
}

/** Marco común de los ejercicios de diagnóstico: ticket, topología, evidencia en pestañas y causas posibles. */
export default function MarcoDiagnostico({ id, generar }: { id: string; generar: (codigo: string) => CasoDiagnostico }) {
  const [codigo, setCodigo] = useCodigo();
  const caso = useMemo(() => (codigo ? generar(codigo) : null), [codigo, generar]);
  const [tab, setTab] = useState(0);
  const [elegida, setElegida] = useState<string | null>(null);
  const [vistas, setVistas] = useState<Set<number>>(new Set([0]));
  if (!codigo || !caso) return null;
  const revisado = elegida !== null;
  const acierto = elegida === caso.correcta;
  const texto = (o: string) => caso.opciones.find((x) => x.id === o)!.texto;

  const cambiar = (c: string) => { setCodigo(c); setTab(0); setElegida(null); setVistas(new Set([0])); };
  const elegir = (o: string) => { setElegida(o); if (o === caso.correcta) registrarLogro(id); setTab(caso.prueba.ev); };
  const ver = (i: number) => { setTab(i); setVistas(new Set([...vistas, i])); };

  return (
    <Escenario id={id} codigo={codigo} alCambiar={cambiar}>
      <div className="dg-reporte">
        <span className="dg-ticket">Ticket</span>
        <p>{caso.reporte}</p>
      </div>
      <Topologia {...caso.topologia} />
      <p className="dg-instr">Revisa la evidencia. Cada pestaña es la salida de un comando; la causa está en alguna de ellas.</p>
      <div className="dg-tabs" role="tablist" aria-label="Evidencia">
        {caso.evidencias.map((e, i) => (
          <button key={i} type="button" role="tab" aria-selected={tab === i} className={vistas.has(i) ? 'vista' : ''} onClick={() => ver(i)}>
            {e.titulo}
          </button>
        ))}
      </div>
      <pre className="pr-salida dg-salida" role="tabpanel">
        <Resaltar texto={caso.evidencias[tab].texto} buscar={revisado && tab === caso.prueba.ev ? caso.prueba.buscar : undefined} />
      </pre>

      <fieldset className="dg-opciones" disabled={revisado}>
        <legend className="pr-pregunta">¿Cuál es la causa del problema?</legend>
        {caso.opciones.map((o) => (
          <label key={o.id} className={`ev-opcion ${revisado && o.id === caso.correcta ? 'ok' : revisado && o.id === elegida ? 'mal' : ''}`}>
            <input type="radio" name={`dg-${codigo}`} checked={elegida === o.id} onChange={() => elegir(o.id)} />
            <span>{o.texto}</span>
          </label>
        ))}
      </fieldset>

      {revisado && (
        <div className={`pr-msg ${acierto ? 'ok' : 'mal'}`}>
          <strong>{acierto ? 'Diagnóstico correcto.' : `No. La causa es: ${texto(caso.correcta)}`}</strong>
          <p className="dg-explica">{caso.prueba.explica} La evidencia está resaltada en «{caso.evidencias[caso.prueba.ev].titulo}».</p>
          <p className="dg-explica"><strong>Cómo se corrige</strong></p>
          <pre className="dg-arreglo">{caso.prueba.arreglo}</pre>
        </div>
      )}
      <div className="pr-acciones">
        {revisado && <button type="button" className="pr-boton pr-primario" onClick={() => cambiar(nuevoCodigo())}>Siguiente caso</button>}
        {!revisado && <span className="pr-marcador">Revisaste {vistas.size} de {caso.evidencias.length} salidas.</span>}
      </div>
    </Escenario>
  );
}

/** Elige la correcta y tres distractores, priorizando los del mismo grupo. */
export function opcionesDe<T extends string>(az: { mezclar: <X>(a: X[]) => X[] }, correcta: T, textos: Record<T, string>, grupo: T[]): { id: string; texto: string }[] {
  const resto = (Object.keys(textos) as T[]).filter((k) => k !== correcta);
  const preferidos = az.mezclar(grupo.filter((k) => k !== correcta));
  const otros = az.mezclar(resto.filter((k) => !preferidos.includes(k)));
  const elegidos = [...preferidos, ...otros].slice(0, 3);
  return az.mezclar([correcta, ...elegidos]).map((k) => ({ id: k, texto: textos[k] }));
}
