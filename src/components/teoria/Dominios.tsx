import { useState } from 'react';
import { Icono, type TipoNodo } from '../Topologia';
import './contenido.css';

interface N { id: string; tipo: TipoNodo; x: number; y: number }
const NODOS: N[] = [
  { id: 'R1', tipo: 'router', x: 330, y: 52 },
  { id: 'S1', tipo: 'switch', x: 165, y: 140 },
  { id: 'S2', tipo: 'switch', x: 495, y: 140 },
  { id: 'PC1', tipo: 'pc', x: 60, y: 245 },
  { id: 'PC2', tipo: 'pc', x: 150, y: 245 },
  { id: 'Hub', tipo: 'hub', x: 260, y: 235 },
  { id: 'PC3', tipo: 'pc', x: 215, y: 330 },
  { id: 'PC4', tipo: 'pc', x: 305, y: 330 },
  { id: 'PC5', tipo: 'pc', x: 420, y: 245 },
  { id: 'PC6', tipo: 'pc', x: 510, y: 245 },
  { id: 'PC7', tipo: 'pc', x: 600, y: 245 },
];
// [a, b, dominio de colisión]
const ENLACES: [string, string, number][] = [
  ['R1', 'S1', 1], ['R1', 'S2', 2], ['S1', 'PC1', 3], ['S1', 'PC2', 4], ['S1', 'Hub', 5], ['Hub', 'PC3', 5], ['Hub', 'PC4', 5],
  ['S2', 'PC5', 6], ['S2', 'PC6', 7], ['S2', 'PC7', 8],
];
const COLORES = ['#d26c12', '#1f7d4a', '#2b62b0', '#8e44ad', '#c0392b', '#16a085', '#7e5233', '#2f8fbd'];
const n = (id: string) => NODOS.find((x) => x.id === id)!;

/** Cuenta dominios de colisión y de difusión en una red con hub, switches y router. */
export default function Dominios() {
  const [vista, setVista] = useState<'colision' | 'difusion'>('colision');
  return (
    <section className="dm" aria-label="Dominios de colisión y de difusión">
      <div className="tq-modos" role="tablist">
        <button type="button" role="tab" aria-selected={vista === 'colision'} className={vista === 'colision' ? 'sel' : ''} onClick={() => setVista('colision')}>Dominios de colisión (8)</button>
        <button type="button" role="tab" aria-selected={vista === 'difusion'} className={vista === 'difusion' ? 'sel' : ''} onClick={() => setVista('difusion')}>Dominios de difusión (2)</button>
      </div>
      <svg viewBox="0 0 660 400" className="dm-svg topologia-icono" role="img"
        aria-label={vista === 'colision' ? 'Ocho dominios de colisión: uno por cada puerto de switch o de router, y el hub con sus dos PC comparte uno solo.' : 'Dos dominios de difusión: el router separa la red de S1 de la red de S2.'}>
        {vista === 'difusion' && (
          <g className="dm-zonas">
            <rect x="12" y="95" width="320" height="275" rx="18" style={{ fill: COLORES[0] }} />
            <rect x="372" y="95" width="276" height="200" rx="18" style={{ fill: COLORES[2] }} />
            <text x="24" y="118" style={{ fill: COLORES[0] }}>Dominio de difusión 1</text>
            <text x="636" y="118" textAnchor="end" style={{ fill: COLORES[2] }}>Dominio de difusión 2</text>
          </g>
        )}
        {vista === 'colision' && (
          <rect x="180" y="208" width="160" height="152" rx="16" className="dm-hub-zona" style={{ stroke: COLORES[4], fill: COLORES[4] }} />
        )}
        {ENLACES.map(([a, b, d]) => {
          const p = n(a), q = n(b);
          const derecha = ['S2', 'PC5', 'PC6', 'PC7'];
          const color = vista === 'colision' ? COLORES[d - 1] : a === 'R1' ? 'var(--line-strong)' : derecha.includes(a) || derecha.includes(b) ? COLORES[2] : COLORES[0];
          return <line key={a + b} x1={p.x} y1={p.y} x2={q.x} y2={q.y} style={{ stroke: color }} className="dm-cable" />;
        })}
        {vista === 'colision' && ENLACES.filter(([a]) => a !== 'Hub').map(([a, b, d]) => {
          const p = n(a), q = n(b);
          const x = b === 'Hub' ? 300 : (p.x + q.x) / 2, y = b === 'Hub' ? 210 : (p.y + q.y) / 2;
          return (
            <g key={'b' + a + b} transform={`translate(${x} ${y})`}>
              <circle r="11" style={{ fill: COLORES[d - 1] }} /><text y="4" textAnchor="middle" className="dm-num">{d}</text>
            </g>
          );
        })}
        {NODOS.map((x) => (
          <g key={x.id}>
            <g transform={`translate(${x.x} ${x.y}) scale(${x.tipo === 'pc' ? 0.8 : 0.9})`}><Icono tipo={x.tipo} /></g>
            <text x={x.x + (x.tipo === 'switch' ? 0 : x.tipo === 'hub' ? 38 : 0)} y={x.tipo === 'router' ? x.y - 28 : x.tipo === 'hub' ? x.y + 4 : x.y + (x.tipo === 'switch' ? -20 : 32)} textAnchor={x.tipo === 'hub' ? 'start' : 'middle'} className="dm-etq">{x.id}</text>
          </g>
        ))}
      </svg>
      <p className="dm-texto" aria-live="polite">
        {vista === 'colision'
          ? 'Cada puerto de un switch o de un router es su propio dominio de colisión. El hub no separa nada: el hub, PC3 y PC4 comparten un solo dominio (el 5).'
          : 'Los switches reenvían las difusiones por todos sus puertos; el router no. Cada interfaz del router es el borde de un dominio de difusión.'}
      </p>
    </section>
  );
}
