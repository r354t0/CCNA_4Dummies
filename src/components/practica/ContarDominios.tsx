import { useMemo, useState } from 'react';
import { Azar, nuevoCodigo } from '../../lib/azar';
import Topologia, { type NodoTopo, type EnlaceTopo, type TipoNodo } from '../Topologia';
import Escenario, { useCodigo, registrarLogro } from './Escenario';
import './practica.css';

interface Nodo { id: string; tipo: TipoNodo; hijos: Nodo[] }

const ANCHO_HOJA = 92;
const ALTO_NIVEL = 100;

/** Genera una red en árbol: 0, 1 o 2 routers; switches; PC; a veces un hub con sus PC. */
export function generar(codigo: string) {
  const az = new Azar(codigo, 'dominios');
  for (let intento = 0; ; intento++) {
    const r = intentar(az);
    if (intento > 30 || (r.colision.length <= 15 && r.hojas <= 10)) return r;
  }
}

function intentar(az: Azar) {
  let pc = 0, sw = 0, hub = 0;
  const nuevaPc = (): Nodo => ({ id: `PC${++pc}`, tipo: 'pc', hijos: [] });
  const nuevoSwitch = (profundidad: number): Nodo => {
    const s: Nodo = { id: `S${++sw}`, tipo: 'switch', hijos: [] };
    const n = az.entero(1, 2);
    for (let i = 0; i < n; i++) s.hijos.push(nuevaPc());
    if (az.probabilidad(0.35)) s.hijos.push({ id: `Hub${++hub}`, tipo: 'hub', hijos: Array.from({ length: 2 }, nuevaPc) });
    if (profundidad === 0 && az.probabilidad(0.2)) s.hijos.push(nuevoSwitch(1));
    return s;
  };
  const routers = az.elegir([0, 1, 1, 2, 2]);
  const raices: Nodo[] = [];
  if (routers === 0) {
    const s1 = nuevoSwitch(0);
    raices.push(s1);
    if (az.probabilidad(0.5)) raices.push(nuevoSwitch(0));
  } else {
    for (let r = 1; r <= routers; r++) {
      const router: Nodo = { id: `R${r}`, tipo: 'router', hijos: [] };
      const lans = routers === 1 ? 2 : az.entero(1, 2);
      for (let i = 0; i < lans; i++) router.hijos.push(nuevoSwitch(0));
      raices.push(router);
    }
  }

  // Dominios
  const colision: { a: string; b: string; detalle: string }[] = [];
  const recorrer = (n: Nodo) => {
    for (const h of n.hijos) {
      if (n.tipo !== 'hub') colision.push({ a: n.id, b: h.id, detalle: h.tipo === 'hub' ? `${n.id}–${h.id} (con ${h.hijos.map((x) => x.id).join(', ')})` : `${n.id}–${h.id}` });
      recorrer(h);
    }
  };
  raices.forEach(recorrer);
  if (raices.length === 2) colision.unshift({ a: raices[0].id, b: raices[1].id, detalle: `${raices[0].id}–${raices[1].id}` });
  const difusion: string[] = routers === 0
    ? ['Toda la red: los switches no separan difusiones']
    : [
        ...raices.flatMap((r) => r.hijos.map((s) => `La LAN de ${r.id} hacia ${s.id}`)),
        ...(routers === 2 ? ['El enlace R1–R2'] : []),
      ];

  // Diseño en árbol
  const nodos: NodoTopo[] = [];
  const enlaces: EnlaceTopo[] = [];
  let hoja = 0;
  const colocar = (n: Nodo, nivel: number): number => {
    let x: number;
    if (!n.hijos.length) x = 50 + ANCHO_HOJA * hoja++;
    else {
      const xs = n.hijos.map((h) => colocar(h, nivel + 1));
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    nodos.push({ id: n.id, tipo: n.tipo, x, y: 55 + nivel * ALTO_NIVEL, lado: n.tipo === 'router' ? 'arriba' : n.tipo === 'pc' ? 'abajo' : 'derecha' });
    for (const h of n.hijos) enlaces.push({ a: n.id, b: h.id });
    return x;
  };
  raices.forEach((r) => { colocar(r, 0); hoja += 0.4; });
  if (raices.length === 2) enlaces.push({ a: raices[0].id, b: raices[1].id });
  const ancho = Math.max(520, 50 + ANCHO_HOJA * hoja);
  const usado = Math.max(...nodos.map((n) => n.x)) - Math.min(...nodos.map((n) => n.x));
  const desplazar = (ancho - usado) / 2 - Math.min(...nodos.map((n) => n.x));
  for (const n of nodos) n.x += desplazar;
  const niveles = Math.max(...nodos.map((n) => n.y));
  return { nodos, enlaces, ancho, alto: niveles + 70, colision, difusion, hojas: hoja };
}

const OPCIONES = Array.from({ length: 20 }, (_, i) => i + 1);

export default function ContarDominios() {
  const [codigo, setCodigo] = useCodigo();
  const caso = useMemo(() => (codigo ? generar(codigo) : null), [codigo]);
  const [col, setCol] = useState('');
  const [dif, setDif] = useState('');
  const [revisado, setRevisado] = useState(false);
  if (!codigo || !caso) return null;
  const okCol = Number(col) === caso.colision.length;
  const okDif = Number(dif) === caso.difusion.length;
  const cambiar = (c: string) => { setCodigo(c); setCol(''); setDif(''); setRevisado(false); };
  const revisar = () => { setRevisado(true); if (okCol && okDif) registrarLogro('dominios'); };

  const enlaces = revisado
    ? caso.enlaces.map((e) => {
        const i = caso.colision.findIndex((c) => (c.a === e.a && c.b === e.b) || (c.a === e.b && c.b === e.a));
        return i >= 0 ? { ...e, marca: String(i + 1) } : e;
      })
    : caso.enlaces;

  return (
    <Escenario id="dominios" codigo={codigo} alCambiar={cambiar}
      instrucciones={<p>Todos los puertos de switch y de router funcionan en dúplex completo, salvo los que van a un hub. No hay VLAN configuradas.</p>}>
      <Topologia ancho={caso.ancho} alto={caso.alto} titulo="¿Cuántos dominios hay?" nodos={caso.nodos} enlaces={enlaces} />
      <div className="cd-preguntas">
        <label className="cd-campo">
          <span>Dominios de <strong>colisión</strong></span>
          <select className={`pr-select ${revisado ? (okCol ? 'ok' : 'mal') : ''}`} value={col} disabled={revisado} onChange={(e) => setCol(e.target.value)}>
            <option value="" disabled>Elige…</option>
            {OPCIONES.map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        <label className="cd-campo">
          <span>Dominios de <strong>difusión</strong></span>
          <select className={`pr-select ${revisado ? (okDif ? 'ok' : 'mal') : ''}`} value={dif} disabled={revisado} onChange={(e) => setDif(e.target.value)}>
            <option value="" disabled>Elige…</option>
            {OPCIONES.map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="pr-acciones">
        {!revisado
          ? <button type="button" className="pr-boton pr-primario" onClick={revisar} disabled={!col || !dif}>Revisar</button>
          : <button type="button" className="pr-boton pr-primario" onClick={() => cambiar(nuevoCodigo())}>Nueva topología</button>}
      </div>
      {revisado && (
        <div className={`pr-msg ${okCol && okDif ? 'ok' : 'mal'}`}>
          <strong>{okCol && okDif ? '¡Correcto!' : 'Revisa el conteo.'}</strong>
          <p><strong>{caso.colision.length} dominios de colisión</strong> (numerados en el diagrama): uno por cada enlace con un puerto de switch o de router. Un hub y sus PC cuentan como uno solo.</p>
          <ol className="cd-lista">{caso.colision.map((c) => <li key={c.detalle}>{c.detalle}</li>)}</ol>
          <p><strong>{caso.difusion.length} {caso.difusion.length === 1 ? 'dominio' : 'dominios'} de difusión</strong>: {caso.difusion.length === 1 && !caso.nodos.some((n) => n.tipo === 'router') ? caso.difusion[0] : 'uno por cada interfaz de router con una red detrás'}.</p>
          {caso.difusion.length > 1 && <ol className="cd-lista">{caso.difusion.map((d) => <li key={d}>{d}</li>)}</ol>}
        </div>
      )}
    </Escenario>
  );
}
