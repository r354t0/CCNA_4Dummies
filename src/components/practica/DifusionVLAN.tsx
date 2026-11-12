import { useMemo, useState } from 'react';
import { Azar, nuevoCodigo } from '../../lib/azar';
import Topologia, { type NodoTopo, type EnlaceTopo } from '../Topologia';
import Escenario, { useCodigo, registrarLogro } from './Escenario';
import './practica.css';

interface Pc { id: string; sw: number; vlan: number }
interface Troncal { de: number; a: number; permitidas: number[] | 'todas' }

export function generar(codigo: string) {
  const az = new Azar(codigo, 'difusion-vlan');
  const nSw = az.entero(2, 3);
  const vlans = az.elegir([[10, 20], [10, 20, 30], [20, 30, 40], [10, 20, 30]]);
  const pcs: Pc[] = [];
  let n = 0;
  for (let s = 0; s < nSw; s++) {
    const cant = nSw === 2 ? az.entero(3, 4) : az.entero(2, 3);
    for (let i = 0; i < cant; i++) pcs.push({ id: `PC${++n}`, sw: s, vlan: az.elegir(vlans) });
  }
  // Troncales en cadena; a veces una no permite alguna VLAN
  const troncales: Troncal[] = [];
  for (let s = 0; s < nSw - 1; s++) {
    troncales.push({ de: s, a: s + 1, permitidas: az.probabilidad(0.45) ? az.muestra(vlans, vlans.length - 1).sort((a, b) => a - b) : 'todas' });
  }
  // A veces una VLAN no se creó en un switch intermedio o final
  const creadas = Array.from({ length: nSw }, () => [...vlans]);
  let faltante: { sw: number; vlan: number } | null = null;
  if (az.probabilidad(0.3)) {
    faltante = { sw: az.entero(1, nSw - 1), vlan: az.elegir(vlans) };
    creadas[faltante.sw] = creadas[faltante.sw].filter((v) => v !== faltante!.vlan);
    // Los puertos de una VLAN inexistente quedan inactivos: que no haya PC en ella en ese switch
    for (const p of pcs) if (p.sw === faltante.sw && p.vlan === faltante.vlan) p.vlan = az.elegir(creadas[faltante.sw]);
  }
  // Que el origen tenga al menos otra PC de su VLAN
  let origen = az.elegir(pcs);
  for (let k = 0; k < 20 && pcs.filter((p) => p.vlan === origen.vlan).length < 2; k++) origen = az.elegir(pcs);

  const pasa = (t: Troncal, v: number) => t.permitidas === 'todas' || t.permitidas.includes(v);
  const v = origen.vlan;
  // ¿Hasta qué switches llega la VLAN v desde el switch de origen?
  const alcanza = new Set([origen.sw]);
  for (let s = origen.sw; s < nSw - 1; s++) {
    const t = troncales[s];
    if (!pasa(t, v) || !creadas[s + 1].includes(v)) break;
    alcanza.add(s + 1);
  }
  for (let s = origen.sw; s > 0; s--) {
    const t = troncales[s - 1];
    if (!pasa(t, v) || !creadas[s - 1].includes(v)) break;
    alcanza.add(s - 1);
  }
  const reciben = pcs.filter((p) => p.id !== origen.id && p.vlan === v && alcanza.has(p.sw)).map((p) => p.id);

  const razon = (p: Pc): string => {
    if (p.id === origen.id) return '';
    if (p.vlan !== v) return `Está en la VLAN ${p.vlan}: otro dominio de difusión.`;
    if (alcanza.has(p.sw)) return p.sw === origen.sw ? `Misma VLAN y mismo switch.` : `Misma VLAN; la troncal la deja pasar y la VLAN ${v} existe en S${p.sw + 1}.`;
    // Explicar el corte
    const dir = p.sw > origen.sw ? 1 : -1;
    for (let s = origen.sw; s !== p.sw; s += dir) {
      const t = troncales[dir === 1 ? s : s - 1];
      if (!pasa(t, v)) return `Misma VLAN, pero la troncal S${t.de + 1}–S${t.a + 1} no permite la VLAN ${v}.`;
      if (!creadas[s + dir].includes(v)) return `Misma VLAN, pero la VLAN ${v} no existe en S${s + dir + 1}: ese switch descarta la trama.`;
    }
    return '';
  };

  const PASO = 105;
  const ancho = Math.max(640, PASO * pcs.length + 80);
  const xpc = new Map(pcs.map((p, i) => [p.id, 60 + PASO / 2 + i * PASO + (ancho - (PASO * pcs.length + 80)) / 2]));
  const xsw = (s: number) => { const xs = pcs.filter((p) => p.sw === s).map((p) => xpc.get(p.id)!); return (Math.min(...xs) + Math.max(...xs)) / 2; };
  const nodos: NodoTopo[] = [];
  const enlaces: EnlaceTopo[] = [];
  for (let s = 0; s < nSw; s++) nodos.push({ id: `S${s + 1}`, tipo: 'switch', x: xsw(s), y: 70, lado: 'arriba', detalle: faltante ? `VLAN creadas: ${creadas[s].join(', ')}` : undefined });
  troncales.forEach((t) => enlaces.push({ a: `S${t.de + 1}`, b: `S${t.a + 1}`, marca: t.permitidas === 'todas' ? 'Troncal: todas' : `Troncal: ${t.permitidas.join(',')}`, resaltado: true }));
  for (const p of pcs) {
    nodos.push({ id: p.id, tipo: 'pc', x: xpc.get(p.id)!, y: 200, detalle: `VLAN ${p.vlan}`, lado: 'abajo' });
    enlaces.push({ a: `S${p.sw + 1}`, b: p.id });
  }
  return { pcs, origen, reciben, razon, creadas, faltante, vlans, topologia: { nodos, enlaces, ancho, alto: 265 } };
}

export default function DifusionVLAN() {
  const [codigo, setCodigo] = useCodigo();
  const caso = useMemo(() => (codigo ? generar(codigo) : null), [codigo]);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [revisado, setRevisado] = useState(false);
  if (!codigo || !caso) return null;
  const correcto = caso.reciben.length === marcadas.size && caso.reciben.every((x) => marcadas.has(x));
  const cambiar = (c: string) => { setCodigo(c); setMarcadas(new Set()); setRevisado(false); };
  const alternar = (id: string) => { const n = new Set(marcadas); n.has(id) ? n.delete(id) : n.add(id); setMarcadas(n); };
  const revisar = () => { setRevisado(true); if (correcto) registrarLogro('difusion-vlan'); };
  const nodos = caso.topologia.nodos.map((n) => (n.id === caso.origen.id ? { ...n, resaltado: true } : n));

  return (
    <Escenario id="difusion-vlan" codigo={codigo} alCambiar={cambiar}
      instrucciones={<p>Los enlaces entre switches son troncales 802.1Q con la misma VLAN nativa en ambos extremos. Cada PC está en un puerto de acceso de la VLAN indicada.{caso.faltante ? ' Ojo: no todos los switches tienen las mismas VLAN creadas.' : ''}</p>}>
      <Topologia {...caso.topologia} nodos={nodos} titulo={`${caso.origen.id} envía una difusión (por ejemplo, una solicitud ARP)`} />
      <fieldset className="pm-puertos" disabled={revisado}>
        <legend>¿Qué PC reciben la difusión de <strong>{caso.origen.id}</strong> (VLAN {caso.origen.vlan})?</legend>
        {caso.pcs.filter((p) => p.id !== caso.origen.id).map((p) => {
          const estado = revisado ? (caso.reciben.includes(p.id) ? 'debe' : marcadas.has(p.id) ? 'sobra' : '') : '';
          return (
            <label key={p.id} className={`pm-puerto ${marcadas.has(p.id) ? 'sel' : ''} ${estado}`}>
              <input type="checkbox" checked={marcadas.has(p.id)} onChange={() => alternar(p.id)} />
              {p.id}
            </label>
          );
        })}
      </fieldset>
      <div className="pr-acciones">
        {!revisado
          ? <button type="button" className="pr-boton pr-primario" onClick={revisar}>Revisar</button>
          : <button type="button" className="pr-boton pr-primario" onClick={() => cambiar(nuevoCodigo())}>Nuevo escenario</button>}
      </div>
      {revisado && (
        <div className={`pr-msg ${correcto ? 'ok' : 'mal'}`}>
          <strong>{correcto ? '¡Correcto!' : `La reciben: ${caso.reciben.join(', ') || 'ninguna'}.`}</strong>
          <ul className="cd-lista">
            {caso.pcs.filter((p) => p.id !== caso.origen.id).map((p) => (
              <li key={p.id}><strong>{p.id}</strong> {caso.reciben.includes(p.id) ? 'la recibe' : 'no la recibe'}. {caso.razon(p)}</li>
            ))}
          </ul>
        </div>
      )}
    </Escenario>
  );
}
