import { useState } from 'react';
import './contenido.css';

interface Bloque { t: string; c: string }

const ETAPAS: { capa: string; pdu: string; texto: string; bloques: Bloque[] }[] = [
  {
    capa: 'Aplicación', pdu: 'Datos',
    texto: 'El servidor web genera la página que pidió el cliente. Por ahora son solo datos de la aplicación (HTTP).',
    bloques: [{ t: 'Datos HTTP', c: 'datos' }],
  },
  {
    capa: 'Transporte', pdu: 'Segmento',
    texto: 'TCP divide los datos en segmentos y agrega su encabezado: puertos de origen y destino, números de secuencia y de acuse.',
    bloques: [{ t: 'TCP', c: 'l4' }, { t: 'Datos HTTP', c: 'datos' }],
  },
  {
    capa: 'Internet', pdu: 'Paquete',
    texto: 'IP agrega su encabezado con las direcciones IP de origen y destino. Estas direcciones se mantienen de extremo a extremo.',
    bloques: [{ t: 'IP', c: 'l3' }, { t: 'TCP', c: 'l4' }, { t: 'Datos HTTP', c: 'datos' }],
  },
  {
    capa: 'Acceso a la red', pdu: 'Trama',
    texto: 'Ethernet agrega un encabezado con las direcciones MAC del siguiente salto y un tráiler (FCS) para detectar errores.',
    bloques: [{ t: 'Ethernet', c: 'l2' }, { t: 'IP', c: 'l3' }, { t: 'TCP', c: 'l4' }, { t: 'Datos HTTP', c: 'datos' }, { t: 'FCS', c: 'l2' }],
  },
  {
    capa: 'Física', pdu: 'Bits',
    texto: 'La trama se convierte en bits y se transmite por el medio como señales eléctricas, luz u ondas.',
    bloques: [{ t: '0110100101110010100101011011', c: 'bits' }],
  },
];

/** Encapsulación y desencapsulación, capa por capa. */
export default function Encapsulacion() {
  const [i, setI] = useState(0);
  const [sentido, setSentido] = useState<'enc' | 'des'>('enc');
  const orden = sentido === 'enc' ? ETAPAS : [...ETAPAS].reverse();
  const e = orden[i];
  const cambiar = (s: 'enc' | 'des') => { setSentido(s); setI(0); };
  return (
    <section className="enc" aria-label="Encapsulación de datos">
      <div className="enc-sentido" role="tablist" aria-label="Sentido">
        <button type="button" role="tab" aria-selected={sentido === 'enc'} onClick={() => cambiar('enc')}>Encapsulación (envía el servidor)</button>
        <button type="button" role="tab" aria-selected={sentido === 'des'} onClick={() => cambiar('des')}>Desencapsulación (recibe el cliente)</button>
      </div>
      <div className="enc-escena">
        <ol className="enc-capas">
          {orden.map((x, j) => (
            <li key={x.capa} className={j === i ? 'actual' : j < i ? 'hecha' : ''}>
              <button type="button" onClick={() => setI(j)}>{x.capa}</button>
            </li>
          ))}
        </ol>
        <div className="enc-pdu">
          <p className="enc-pdu-nombre">PDU: <strong>{e.pdu}</strong></p>
          <div className="enc-bloques">
            {e.bloques.map((b, j) => <span key={`${i}-${j}`} className={`enc-b enc-${b.c}`}>{b.t}</span>)}
          </div>
          <p className="enc-texto">
            {sentido === 'des' && i > 0
              ? `El cliente quita el encabezado de la capa anterior y entrega el contenido hacia arriba. ${e.texto}`
              : e.texto}
          </p>
        </div>
      </div>
      <div className="ps-botones">
        <button type="button" onClick={() => setI(i - 1)} disabled={i === 0}>Anterior</button>
        <button type="button" className="ps-sig" onClick={() => setI(i + 1)} disabled={i === orden.length - 1}>Siguiente capa</button>
      </div>
    </section>
  );
}
