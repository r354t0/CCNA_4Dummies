import { useId } from 'react';
import './Topologia.css';

// Dibuja una topología en SVG con íconos al estilo de los diagramas de red de Cisco.
// Se usa igual en MDX (sin hidratar, solo HTML) y dentro de ejercicios interactivos.
//
// <Topologia ancho={640} alto={320}
//   nodos={[{ id: 'R1', tipo: 'router', x: 320, y: 60, detalle: 'G0/0/1 192.168.1.1' }, ...]}
//   enlaces={[{ a: 'R1', b: 'S1', ia: 'G0/0/1', ib: 'G0/1' }, ...]} />
//
// x, y son el centro del ícono. Los enlaces se recortan al borde de cada ícono y las
// interfaces se dibujan como etiquetas sobre el cable, junto al equipo al que pertenecen.
// Varios enlaces entre los mismos dos equipos van en paralelo; si comparten `grupo`
// (por ejemplo 'Po1') se dibuja el óvalo de EtherChannel.

export type TipoNodo =
  | 'router' | 'router-inalambrico' | 'switch' | 'switch-l3' | 'hub' | 'ap' | 'firewall'
  | 'pc' | 'laptop' | 'servidor' | 'telefono' | 'impresora' | 'tablet' | 'nube';
type Lado = 'arriba' | 'abajo' | 'derecha' | 'izquierda';

export interface NodoTopo {
  id: string;
  tipo: TipoNodo;
  x: number;
  y: number;
  etiqueta?: string;
  detalle?: string;
  detalle2?: string;
  lado?: Lado;
  resaltado?: boolean;
}
export interface EnlaceTopo {
  a: string;
  b: string;
  ia?: string;
  ib?: string;
  tipo?: 'cobre' | 'serial' | 'consola' | 'fibra' | 'inalambrico';
  grupo?: string;
  /** Rótulo en el centro del cable, por ejemplo «Enlace 2». */
  marca?: string;
  resaltado?: boolean;
  caido?: boolean;
}
interface Props {
  nodos: NodoTopo[];
  enlaces: EnlaceTopo[];
  ancho?: number;
  alto?: number;
  titulo?: string;
  /** Ancho mínimo antes de permitir desplazamiento horizontal en pantallas chicas. */
  minimo?: number;
}

// Medio ancho, medio alto y forma de cada ícono (deben coincidir con los dibujos).
const TAMANO: Record<TipoNodo, { w: number; h: number; forma: 'elipse' | 'rect' }> = {
  router: { w: 30, h: 18, forma: 'elipse' },
  'router-inalambrico': { w: 30, h: 18, forma: 'elipse' },
  switch: { w: 31, h: 14, forma: 'rect' },
  'switch-l3': { w: 26, h: 21, forma: 'rect' },
  hub: { w: 29, h: 12, forma: 'rect' },
  ap: { w: 24, h: 12, forma: 'rect' },
  firewall: { w: 24, h: 17, forma: 'rect' },
  pc: { w: 22, h: 20, forma: 'rect' },
  laptop: { w: 23, h: 13, forma: 'rect' },
  servidor: { w: 13, h: 22, forma: 'rect' },
  telefono: { w: 15, h: 16, forma: 'rect' },
  impresora: { w: 20, h: 16, forma: 'rect' },
  tablet: { w: 13, h: 18, forma: 'rect' },
  nube: { w: 30, h: 18, forma: 'elipse' },
};
const HUECO = 3;
const ANCHO_CARACTER = 6.7; // fuente monoespaciada de 11 px
const ALTO_ETIQUETA = 16;
const SEPARACION = 14;

function borde(n: NodoTopo, ux: number, uy: number) {
  const t = TAMANO[n.tipo];
  if (t.forma === 'elipse') return 1 / Math.hypot(ux / t.w, uy / t.h) + HUECO;
  const kx = ux === 0 ? Infinity : t.w / Math.abs(ux);
  const ky = uy === 0 ? Infinity : t.h / Math.abs(uy);
  return Math.min(kx, ky) + HUECO;
}

const LADO_POR_TIPO: Record<TipoNodo, Lado> = {
  router: 'arriba', 'router-inalambrico': 'arriba', switch: 'derecha', 'switch-l3': 'derecha', hub: 'derecha', ap: 'derecha', firewall: 'arriba',
  nube: 'derecha', pc: 'abajo', laptop: 'abajo', servidor: 'abajo', telefono: 'abajo', impresora: 'abajo', tablet: 'abajo',
};

function rotulo(n: NodoTopo) {
  const lado = n.lado ?? LADO_POR_TIPO[n.tipo];
  const { w, h } = TAMANO[n.tipo];
  const lineas = 1 + (n.detalle ? 1 : 0) + (n.detalle2 ? 1 : 0);
  switch (lado) {
    case 'arriba': return { x: 0, y: -h - 9 - (lineas - 1) * 14, anchor: 'middle' as const };
    case 'derecha': return { x: w + 10, y: 5 - (lineas - 1) * 7, anchor: 'start' as const };
    case 'izquierda': return { x: -w - 10, y: 5 - (lineas - 1) * 7, anchor: 'end' as const };
    default: return { x: 0, y: h + 17, anchor: 'middle' as const };
  }
}

export function Icono({ tipo }: { tipo: TipoNodo }) {
  switch (tipo) {
    case 'router':
    case 'router-inalambrico':
      return (
        <>
          {tipo === 'router-inalambrico' && (
            <g className="antenas">
              <path d="M-18 -14 L-22 -30 M18 -14 L22 -30" />
              <circle cx="-22" cy="-31" r="2.2" />
              <circle cx="22" cy="-31" r="2.2" />
            </g>
          )}
          <path d="M-30 -6 V7 A30 11 0 0 0 30 7 V-6 Z" className="cara-frente" />
          <ellipse cx="0" cy="-6" rx="30" ry="11" className="cara-superior" />
          <g className="flechas">
            <path d="M-25 -6 H-11 M25 -6 H11 M0 -9 V-12 M0 -3 V0" />
            <path d="M-7 -6 L-12.5 -9.5 L-12.5 -2.5 Z M7 -6 L12.5 -9.5 L12.5 -2.5 Z M0 -16 L-3.5 -12 L3.5 -12 Z M0 4 L-3.5 0 L3.5 0 Z" className="punta" />
          </g>
        </>
      );
    case 'switch':
      return (
        <>
          <polygon points="-31,-2 -23,-14 31,-14 23,-2" className="cara-superior" />
          <rect x="-31" y="-2" width="54" height="16" className="cara-frente" />
          <polygon points="23,-2 31,-14 31,2 23,14" className="cara-lateral" />
          <g className="flechas">
            <path d="M-18 -10.5 H17 M18 -5.5 H-17" />
            <path d="M22 -10.5 L16.5 -13.2 L16.5 -7.8 Z M-22 -5.5 L-16.5 -8.2 L-16.5 -2.8 Z" className="punta" />
          </g>
        </>
      );
    case 'switch-l3':
      return (
        <>
          <polygon points="-26,-9 -18,-21 26,-21 18,-9" className="cara-superior" />
          <rect x="-26" y="-9" width="44" height="30" className="cara-frente" />
          <polygon points="18,-9 26,-21 26,9 18,21" className="cara-lateral" />
          <g className="flechas">
            <path d="M-14 -11 L12 -19 M-8 -19 L6 -11" />
            <path d="M15 -20 L9.5 -20.6 L11.4 -16 Z M-17 -10 L-11.5 -9.4 L-13.4 -14 Z M10 -10 L5 -14.4 L3.6 -9.6 Z M-12 -20 L-7 -15.6 L-5.6 -20.4 Z" className="punta" />
            <path d="M-17 6 H11 M-17 12 H11" />
            <path d="M15 6 L10 3.4 L10 8.6 Z M-21 12 L-16 9.4 L-16 14.6 Z" className="punta" />
          </g>
        </>
      );
    case 'hub':
      return (
        <>
          <polygon points="-29,0 -22,-10 29,-10 22,0" className="cara-superior" />
          <rect x="-29" y="0" width="51" height="12" className="cara-frente" />
          <polygon points="22,0 29,-10 29,2 22,12" className="cara-lateral" />
          <g className="flechas">
            <path d="M-17 6 H11" />
            <path d="M15 6 L10 3.2 L10 8.8 Z M-21 6 L-16 3.2 L-16 8.8 Z" className="punta" />
          </g>
        </>
      );
    case 'ap':
      return (
        <>
          <rect x="-24" y="-6" width="48" height="18" rx="9" className="cara-frente" />
          <ellipse cx="0" cy="-6" rx="24" ry="6" className="cara-superior" />
          <g className="ondas">
            <path d="M-8 -16 A10 10 0 0 1 8 -16" />
            <path d="M-13 -21 A17 17 0 0 1 13 -21" />
          </g>
        </>
      );
    case 'firewall':
      return (
        <>
          <rect x="-24" y="-17" width="48" height="34" rx="2" className="ladrillo-fondo" />
          <path d="M-24 -6 H24 M-24 5 H24 M-8 -17 V-6 M10 -17 V-6 M-16 -6 V5 M2 -6 V5 M18 -6 V5 M-8 5 V17 M10 5 V17" className="ladrillo-junta" />
        </>
      );
    case 'pc':
      return (
        <>
          <rect x="-22" y="-22" width="44" height="31" rx="2.5" className="carcasa" />
          <rect x="-17.5" y="-17.5" width="35" height="22" rx="1.2" className="pantalla" />
          <path d="M-4 9 V14 H4 V9" className="carcasa" />
          <rect x="-14" y="14" width="28" height="5" rx="2" className="carcasa" />
        </>
      );
    case 'laptop':
      return (
        <>
          <rect x="-16" y="-15" width="32" height="20" rx="2" className="carcasa" />
          <rect x="-12.5" y="-11.5" width="25" height="13" rx="1" className="pantalla" />
          <path d="M-20 5 H20 L23 11 H-23 Z" className="carcasa" />
        </>
      );
    case 'servidor':
      return (
        <>
          <rect x="-13" y="-22" width="26" height="44" rx="2" className="carcasa" />
          <rect x="-9" y="-17" width="18" height="5" rx="1" className="bahia" />
          <rect x="-9" y="-9" width="18" height="5" rx="1" className="bahia" />
          <rect x="-9" y="-1" width="18" height="5" rx="1" className="bahia" />
          <circle cx="6" cy="15" r="2" className="led" />
        </>
      );
    case 'telefono':
      return (
        <>
          <path d="M-15 16 L-11 -8 H11 L15 16 Z" className="carcasa" />
          <rect x="-8" y="-5" width="16" height="7" rx="1" className="pantalla" />
          <path d="M-13 -9 C-13 -18 13 -18 13 -9 L9 -9 C9 -13 -9 -13 -9 -9 Z" className="carcasa" />
          <path d="M-6 6 H-3 M1.5 6 H4.5 M-6 10 H-3 M1.5 10 H4.5" className="teclas" />
        </>
      );
    case 'impresora':
      return (
        <>
          <rect x="-12" y="-16" width="24" height="10" className="hoja" />
          <rect x="-20" y="-7" width="40" height="17" rx="2.5" className="carcasa" />
          <rect x="-12" y="6" width="24" height="10" className="hoja" />
          <circle cx="14" cy="-1" r="1.8" className="led" />
        </>
      );
    case 'tablet':
      return (
        <>
          <rect x="-13" y="-18" width="26" height="36" rx="3.5" className="carcasa" />
          <rect x="-10" y="-14" width="20" height="26" rx="1" className="pantalla" />
          <circle cx="0" cy="15" r="1.4" className="bahia" />
        </>
      );
    case 'nube':
      return <path d="M-18 16 A11 11 0 0 1 -26 -2 A12 12 0 0 1 -12 -14 A15 15 0 0 1 14 -15 A12 12 0 0 1 28 0 A10 10 0 0 1 20 16 Z" className="carcasa" />;
  }
}

export default function Topologia({
  nodos, enlaces, ancho = 640, alto = 320, titulo = 'Topología de la red', minimo = 480,
}: Props) {
  const uid = useId().replace(/:/g, '');
  const porId = new Map(nodos.map((n) => [n.id, n]));

  const clavePar = (e: EnlaceTopo) => [e.a, e.b].sort().join('|');
  const totalPorPar = new Map<string, number>();
  enlaces.forEach((e) => totalPorPar.set(clavePar(e), (totalPorPar.get(clavePar(e)) ?? 0) + 1));
  const vistosPorPar = new Map<string, number>();

  const trazos = enlaces.map((e) => {
    const a = porId.get(e.a);
    const b = porId.get(e.b);
    if (!a || !b) throw new Error(`Topologia: enlace con nodo inexistente ${e.a} - ${e.b}`);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const largo = Math.hypot(dx, dy) || 1;
    const ux = dx / largo;
    const uy = dy / largo;
    const da = borde(a, ux, uy);
    const db = borde(b, -ux, -uy);

    const clave = clavePar(e);
    const total = totalPorPar.get(clave)!;
    const indice = vistosPorPar.get(clave) ?? 0;
    vistosPorPar.set(clave, indice + 1);
    const signo = e.a < e.b ? 1 : -1;
    const desfase = (indice - (total - 1) / 2) * SEPARACION;
    const px = -uy * signo * desfase;
    const py = ux * signo * desfase;

    const etiqueta = (texto: string | undefined, desde: NodoTopo, d: number, sx: number, sy: number) => {
      if (!texto) return null;
      const w = texto.length * ANCHO_CARACTER + 10;
      const recorrido = (w * Math.abs(sx) + ALTO_ETIQUETA * Math.abs(sy)) / 2;
      const dist = d + 5 + recorrido;
      const ox = desde.x + px;
      const oy = desde.y + py;
      return { texto, w, sx, sy, ox, oy, dist, max: largo / 2, x: ox + sx * dist, y: oy + sy * dist };
    };

    const x1 = a.x + px + ux * da;
    const y1 = a.y + py + uy * da;
    const x2 = b.x + px - ux * db;
    const y2 = b.y + py - uy * db;
    return {
      e, a, b, ux, uy, x1, y1, x2, y2,
      mx: (x1 + x2) / 2, my: (y1 + y2) / 2,
      la: etiqueta(e.ia, a, da, ux, uy),
      lb: etiqueta(e.ib, b, db, -ux, -uy),
    };
  });

  type Etiqueta = NonNullable<(typeof trazos)[number]['la']>;
  const etiquetas = trazos.flatMap((t) => [t.la, t.lb]).filter((l): l is Etiqueta => l !== null);
  const MARGEN = 5;
  const chocan = (p: Etiqueta, q: Etiqueta) =>
    Math.abs(p.x - q.x) < (p.w + q.w) / 2 + MARGEN && Math.abs(p.y - q.y) < ALTO_ETIQUETA + MARGEN;
  const inclinacion = (l: Etiqueta) => Math.min(Math.abs(l.sx), Math.abs(l.sy));
  for (let vuelta = 0; vuelta < 200; vuelta++) {
    let movida = false;
    for (let i = 0; i < etiquetas.length; i++) {
      for (let j = i + 1; j < etiquetas.length; j++) {
        const [p, q] = [etiquetas[i], etiquetas[j]];
        if (!chocan(p, q)) continue;
        const mover = inclinacion(q) >= inclinacion(p) ? q : p;
        const otra = mover === q ? p : q;
        const elegida = mover.dist < mover.max ? mover : otra.dist < otra.max ? otra : null;
        if (!elegida) continue;
        elegida.dist += 2;
        elegida.x = elegida.ox + elegida.sx * elegida.dist;
        elegida.y = elegida.oy + elegida.sy * elegida.dist;
        movida = true;
      }
    }
    if (!movida) break;
  }

  const grupos = [...new Set(trazos.filter((t) => t.e.grupo).map((t) => `${clavePar(t.e)}|${t.e.grupo}`))].map((k) => {
    const miembros = trazos.filter((t) => t.e.grupo && `${clavePar(t.e)}|${t.e.grupo}` === k);
    const t0 = miembros[0];
    const mx = (t0.a.x + t0.b.x) / 2;
    const my = (t0.a.y + t0.b.y) / 2;
    const angulo = (Math.atan2(t0.uy, t0.ux) * 180) / Math.PI;
    const radio = ((miembros.length - 1) * SEPARACION) / 2 + 9;
    const nombre = t0.e.grupo!;
    const w = nombre.length * ANCHO_CARACTER + 10;
    const nx = -t0.uy;
    const ny = t0.ux;
    const d = radio + 6 + (w * Math.abs(nx) + ALTO_ETIQUETA * Math.abs(ny)) / 2;
    return { k, mx, my, angulo, radio, nombre, w, lx: mx + nx * d, ly: my + ny * d };
  });

  const descripcion = enlaces
    .map((e) => `${e.a}${e.ia ? ` ${e.ia}` : ''} conectado a ${e.b}${e.ib ? ` ${e.ib}` : ''}${e.tipo === 'consola' ? ' por cable de consola' : ''}${e.tipo === 'inalambrico' ? ' por conexión inalámbrica' : ''}${e.caido ? ' (enlace caído)' : ''}`)
    .join('; ');
  const usados = new Set(enlaces.map((e) => e.tipo ?? 'cobre'));
  const hayGrupo = grupos.length > 0;
  const leyenda = usados.size > 1 || hayGrupo || usados.has('consola') || usados.has('serial') || usados.has('fibra');

  return (
    <figure className="topologia">
      <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-labelledby={`${uid}-t ${uid}-d`} style={{ minWidth: minimo }}>
        <title id={`${uid}-t`}>{titulo}</title>
        <desc id={`${uid}-d`}>{descripcion}</desc>

        {trazos.map((t, i) => (
          <line key={`l${i}`} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            className={`enlace enlace-${t.e.tipo ?? 'cobre'}${t.e.resaltado ? ' enlace-resaltado' : ''}`} />
        ))}

        {trazos.filter((t) => t.e.caido).map((t, i) => (
          <g key={`x${i}`} className="caido" transform={`translate(${t.mx} ${t.my})`}>
            <circle r="9" />
            <path d="M-4 -4 L4 4 M4 -4 L-4 4" />
          </g>
        ))}

        {grupos.map((g) => (
          <ellipse key={g.k} className="etherchannel" cx={g.mx} cy={g.my} rx="8" ry={g.radio}
            transform={`rotate(${g.angulo} ${g.mx} ${g.my})`} />
        ))}

        {nodos.map((n) => {
          const r = rotulo(n);
          return (
            <g key={n.id} className={`nodo nodo-${n.tipo}${n.resaltado ? ' nodo-resaltado' : ''}`} transform={`translate(${n.x} ${n.y})`}>
              {n.resaltado && <circle r={Math.max(TAMANO[n.tipo].w, TAMANO[n.tipo].h) + 9} className="halo" />}
              <Icono tipo={n.tipo} />
              <text className="nombre" x={r.x} y={r.y} textAnchor={r.anchor}>{n.etiqueta ?? n.id}</text>
              {n.detalle && <text className="detalle" x={r.x} y={r.y + 14} textAnchor={r.anchor}>{n.detalle}</text>}
              {n.detalle2 && <text className="detalle" x={r.x} y={r.y + 28} textAnchor={r.anchor}>{n.detalle2}</text>}
            </g>
          );
        })}

        {grupos.map((g) => (
          <g key={`g${g.k}`} className="interfaz interfaz-grupo" transform={`translate(${g.lx} ${g.ly})`}>
            <rect x={-g.w / 2} y={-ALTO_ETIQUETA / 2} width={g.w} height={ALTO_ETIQUETA} rx="3" />
            <text textAnchor="middle" dy="0.35em">{g.nombre}</text>
          </g>
        ))}

        {etiquetas.map((l, i) => (
          <g key={`e${i}`} className="interfaz" transform={`translate(${l.x} ${l.y})`}>
            <rect x={-l.w / 2} y={-ALTO_ETIQUETA / 2} width={l.w} height={ALTO_ETIQUETA} rx="3" />
            <text textAnchor="middle" dy="0.35em">{l.texto}</text>
          </g>
        ))}

        {trazos.filter((t) => t.e.marca).map((t, i) => {
          const w = t.e.marca!.length * 7.2 + 14;
          return (
            <g key={`m${i}`} className={`marca${t.e.resaltado ? ' marca-resaltada' : ''}`} transform={`translate(${t.mx} ${t.my})`}>
              <rect x={-w / 2} y={-11} width={w} height={22} rx="11" />
              <text textAnchor="middle" dy="0.35em">{t.e.marca}</text>
            </g>
          );
        })}
      </svg>
      {leyenda && (
        <figcaption>
          {usados.has('cobre') && <span className="ley"><svg width="28" height="6" aria-hidden="true"><line x1="0" y1="3" x2="28" y2="3" className="enlace" /></svg> Cobre</span>}
          {usados.has('consola') && <span className="ley"><svg width="28" height="6" aria-hidden="true"><line x1="0" y1="3" x2="28" y2="3" className="enlace enlace-consola" /></svg> Cable de consola</span>}
          {usados.has('serial') && <span className="ley"><svg width="28" height="6" aria-hidden="true"><line x1="0" y1="3" x2="28" y2="3" className="enlace enlace-serial" /></svg> Serial</span>}
          {usados.has('fibra') && <span className="ley"><svg width="28" height="6" aria-hidden="true"><line x1="0" y1="3" x2="28" y2="3" className="enlace enlace-fibra" /></svg> Fibra</span>}
          {usados.has('inalambrico') && <span className="ley"><svg width="28" height="6" aria-hidden="true"><line x1="0" y1="3" x2="28" y2="3" className="enlace enlace-inalambrico" /></svg> Inalámbrico</span>}
          {hayGrupo && <span className="ley"><svg width="28" height="14" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" className="enlace" /><line x1="0" y1="10" x2="28" y2="10" className="enlace" /><ellipse cx="14" cy="7" rx="4" ry="6.5" className="etherchannel" /></svg> EtherChannel</span>}
        </figcaption>
      )}
    </figure>
  );
}
