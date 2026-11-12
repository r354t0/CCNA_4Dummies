import { useState } from 'react';
import './contenido.css';

type Color = 'off' | 'verde' | 'ambar' | 'verde-parpadea' | 'ambar-parpadea' | 'alterna';
type Modo = 'STAT' | 'DUPLX' | 'SPEED' | 'PoE';

interface Puerto { nombre: string; caso: string; leds: Record<Modo, [Color, string]> }

const MODOS: Modo[] = ['STAT', 'DUPLX', 'SPEED', 'PoE'];
const AYUDA_MODO: Record<Modo, string> = {
  STAT: 'Estado del puerto (modo predeterminado): ¿hay enlace, actividad, bloqueo o falla?',
  DUPLX: 'Modo dúplex: verde es dúplex completo; apagado es semidúplex.',
  SPEED: 'Velocidad: apagado 10 Mb/s, verde 100 Mb/s, verde parpadeante 1000 Mb/s.',
  PoE: 'Alimentación por Ethernet: si el puerto entrega energía a un teléfono o AP.',
};

const sinPoe: [Color, string] = ['off', 'El puerto no entrega PoE.'];
const PUERTOS: Puerto[] = [
  { nombre: 'Fa0/1', caso: 'PC conectada, sin tráfico ahora', leds: { STAT: ['verde', 'Hay enlace.'], DUPLX: ['verde', 'Dúplex completo.'], SPEED: ['verde', '100 Mb/s.'], PoE: sinPoe } },
  { nombre: 'Fa0/2', caso: 'Servidor transmitiendo', leds: { STAT: ['verde-parpadea', 'Hay actividad: el puerto envía o recibe datos.'], DUPLX: ['verde', 'Dúplex completo.'], SPEED: ['verde', '100 Mb/s.'], PoE: sinPoe } },
  { nombre: 'Fa0/3', caso: 'Puerto sin cable', leds: { STAT: ['off', 'No hay enlace o el puerto está apagado administrativamente (shutdown).'], DUPLX: ['off', 'Sin enlace no hay dúplex que mostrar.'], SPEED: ['off', 'Sin enlace.'], PoE: sinPoe } },
  { nombre: 'Fa0/4', caso: 'Hub antiguo', leds: { STAT: ['verde', 'Hay enlace.'], DUPLX: ['off', 'Semidúplex: el otro extremo es un hub.'], SPEED: ['off', '10 Mb/s.'], PoE: sinPoe } },
  { nombre: 'Fa0/5', caso: 'Enlace redundante bloqueado', leds: { STAT: ['ambar', 'Puerto bloqueado por STP para evitar un bucle; no reenvía datos.'], DUPLX: ['verde', 'Dúplex completo.'], SPEED: ['verde', '100 Mb/s.'], PoE: sinPoe } },
  { nombre: 'Fa0/6', caso: 'Cable dañado', leds: { STAT: ['alterna', 'Alterna verde y ámbar: falla en el enlace.'], DUPLX: ['verde', 'Dúplex completo.'], SPEED: ['verde', '100 Mb/s.'], PoE: sinPoe } },
  { nombre: 'Fa0/7', caso: 'Teléfono IP', leds: { STAT: ['verde', 'Hay enlace.'], DUPLX: ['verde', 'Dúplex completo.'], SPEED: ['verde', '100 Mb/s.'], PoE: ['verde', 'El puerto entrega PoE al teléfono.'] } },
  { nombre: 'Fa0/8', caso: 'AP que pide demasiada potencia', leds: { STAT: ['verde', 'Hay enlace.'], DUPLX: ['verde', 'Dúplex completo.'], SPEED: ['verde', '100 Mb/s.'], PoE: ['alterna', 'Alterna verde y ámbar: PoE denegado porque se superaría la capacidad de energía del switch.'] } },
  { nombre: 'Gi0/1', caso: 'Enlace al switch de distribución', leds: { STAT: ['verde-parpadea', 'Hay actividad.'], DUPLX: ['verde', 'Dúplex completo.'], SPEED: ['verde-parpadea', '1000 Mb/s.'], PoE: sinPoe } },
];

const NOMBRE_COLOR: Record<Color, string> = {
  off: 'apagado', verde: 'verde', ambar: 'ámbar', 'verde-parpadea': 'verde parpadeante', 'ambar-parpadea': 'ámbar parpadeante', alterna: 'alterna verde y ámbar',
};

/** Panel frontal simplificado de un Catalyst 2960: el botón Mode cambia lo que indican los LED de los puertos. */
export default function LedsSwitch() {
  const [modo, setModo] = useState<Modo>('STAT');
  const [sel, setSel] = useState(0);
  const p = PUERTOS[sel];
  const [color, texto] = p.leds[modo];
  return (
    <section className="ld" aria-label="LED del switch">
      <p className="ld-titulo">Panel frontal: pulsa <strong>Mode</strong> y elige un puerto</p>
      <div className="ld-panel">
        <div className="ld-sistema">
          {[['SYST', 'verde'], ['RPS', 'off']].map(([n, c]) => (
            <span key={n} className="ld-led-etq"><span className={`ld-led ${c}`} />{n}</span>
          ))}
          {MODOS.map((m) => (
            <span key={m} className="ld-led-etq"><span className={`ld-led ${modo === m ? 'verde' : 'off'}`} />{m}</span>
          ))}
          <button type="button" className="ld-mode" onClick={() => setModo(MODOS[(MODOS.indexOf(modo) + 1) % MODOS.length])}>Mode</button>
        </div>
        <div className="ld-puertos" role="listbox" aria-label="Puertos">
          {PUERTOS.map((x, i) => (
            <button key={x.nombre} type="button" role="option" aria-selected={i === sel} className={`ld-puerto ${i === sel ? 'sel' : ''}`} onClick={() => setSel(i)}>
              <span className={`ld-led ${x.leds[modo][0]}`} />
              <span className="ld-rj45" aria-hidden="true" />
              <span className="ld-nombre">{x.nombre}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="ld-detalle" aria-live="polite">
        <p className="ld-modo"><strong>Modo {modo}.</strong> {AYUDA_MODO[modo]}</p>
        <p><strong>{p.nombre}</strong> · {p.caso}: LED {NOMBRE_COLOR[color]}. {texto}</p>
      </div>
    </section>
  );
}
