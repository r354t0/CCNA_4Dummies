import { useState } from 'react';
import { Icono } from '../Topologia';
import './contenido.css';

const PCS = [
  { id: 'A', mac: '00-0A', puerto: 'Fa0/1', x: 70 },
  { id: 'B', mac: '00-0B', puerto: 'Fa0/2', x: 210 },
  { id: 'C', mac: '00-0C', puerto: 'Fa0/3', x: 350 },
  { id: 'D', mac: '00-0D', puerto: 'Fa0/4', x: 490 },
];
const DIFUSION = 'FF-FF';

interface Trama { de: string; a: string }
const TRAMAS: Trama[] = [
  { de: 'A', a: 'D' },
  { de: 'D', a: 'A' },
  { de: 'B', a: DIFUSION },
  { de: 'A', a: 'D' },
  { de: 'C', a: 'B' },
];

interface Paso { trama: Trama; aprende?: string; salida: string[]; accion: string; explicacion: string; tabla: string[] }

function simular(): Paso[] {
  const tabla: string[] = [];
  return TRAMAS.map((t) => {
    const origen = PCS.find((p) => p.id === t.de)!;
    let aprende: string | undefined;
    if (!tabla.includes(t.de)) { tabla.push(t.de); aprende = t.de; }
    const otros = PCS.filter((p) => p.id !== t.de).map((p) => p.id);
    let salida: string[], accion: string, explicacion: string;
    if (t.a === DIFUSION) {
      salida = otros; accion = 'Inundación';
      explicacion = 'Es una trama de difusión (FF-FF-FF-FF-FF-FF): el switch siempre la envía por todos los puertos menos por el que entró.';
    } else if (tabla.includes(t.a)) {
      const d = PCS.find((p) => p.id === t.a)!;
      salida = [t.a]; accion = 'Reenvío';
      explicacion = `La MAC de destino ${d.mac} ya está en la tabla, asociada a ${d.puerto}: el switch envía la trama solo por ese puerto.`;
    } else {
      salida = otros; accion = 'Inundación';
      explicacion = `La MAC de destino no está en la tabla (unidifusión desconocida): el switch la envía por todos los puertos menos por ${origen.puerto}.`;
    }
    return { trama: t, aprende, salida, accion, explicacion, tabla: [...tabla] };
  });
}

const PASOS = simular();
const SW = { x: 280, y: 60 };

/** El switch aprende las MAC de origen y decide si reenvía, inunda o filtra cada trama. */
export default function TablaMAC() {
  const [i, setI] = useState(0);
  const p = PASOS[i];
  const origen = PCS.find((x) => x.id === p.trama.de)!;
  const mac = (id: string) => (id === DIFUSION ? 'FF-FF-FF-FF-FF-FF' : `00-00-00-00-${PCS.find((x) => x.id === id)!.mac}`);
  return (
    <section className="tm" aria-label="Tabla de direcciones MAC">
      <p className="tm-titulo">Cómo aprende y reenvía un switch</p>
      <div className="tm-cuerpo">
        <svg viewBox="0 0 560 230" className="tm-svg topologia-icono" role="img" aria-label={`Trama ${i + 1}: de PC-${p.trama.de} a ${p.trama.a === DIFUSION ? 'todos' : 'PC-' + p.trama.a}. ${p.accion}.`}>
          {PCS.map((x) => {
            const entra = x.id === p.trama.de;
            const sale = p.salida.includes(x.id);
            return (
              <g key={x.id}>
                <line x1={SW.x} y1={SW.y + 14} x2={x.x} y2={170} className={`tm-cable ${entra ? 'entra' : sale ? 'sale' : ''}`} />
                <text x={(SW.x + x.x) / 2 + (x.x < SW.x ? -18 : 18)} y={118} className="tm-puerto" textAnchor="middle">{x.puerto}</text>
                <g transform={`translate(${x.x} 185) scale(0.75)`}><Icono tipo="pc" /></g>
                <text x={x.x} y={218} textAnchor="middle" className="tm-pc">PC-{x.id} · {x.mac}</text>
              </g>
            );
          })}
          <g transform={`translate(${SW.x} ${SW.y}) scale(0.9)`}><Icono tipo="switch" /></g>
          <text x={SW.x + 40} y={SW.y - 10} className="tm-pc">S1</text>
          <g className="tm-leyenda">
            <line x1="10" y1="16" x2="34" y2="16" className="tm-cable entra" /><text x="40" y="20">Entra</text>
            <line x1="10" y1="36" x2="34" y2="36" className="tm-cable sale" /><text x="40" y="40">Sale</text>
          </g>
        </svg>
        <div className="tm-tabla">
          <p className="tm-tabla-tit">Tabla MAC de S1</p>
          <table>
            <thead><tr><th>MAC</th><th>Puerto</th></tr></thead>
            <tbody>
              {p.tabla.length === 0 && <tr><td colSpan={2}>(vacía)</td></tr>}
              {p.tabla.map((id) => {
                const x = PCS.find((y) => y.id === id)!;
                return <tr key={id} className={id === p.aprende ? 'nueva' : ''}><td>{mac(id)}</td><td>{x.puerto}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="tm-detalle" aria-live="polite">
        <p className="tm-trama">Trama {i + 1} de {PASOS.length}: origen <code>{mac(p.trama.de)}</code> → destino <code>{mac(p.trama.a)}</code></p>
        <p><strong>1. Aprender.</strong> {p.aprende ? `La MAC de origen no estaba en la tabla: el switch la agrega asociada a ${origen.puerto}, el puerto por el que entró.` : `La MAC de origen ya estaba en la tabla: el switch solo renueva su temporizador (por defecto, 5 minutos).`}</p>
        <p><strong>2. {p.accion}.</strong> {p.explicacion}</p>
      </div>
      <div className="ps-botones">
        <button type="button" onClick={() => setI(i - 1)} disabled={i === 0}>Anterior</button>
        <button type="button" className="ps-sig" onClick={() => setI(i + 1)} disabled={i === PASOS.length - 1}>Siguiente trama</button>
      </div>
    </section>
  );
}
