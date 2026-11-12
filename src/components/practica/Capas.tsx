import { useMemo, useState } from 'react';
import { Azar, nuevoCodigo } from '../../lib/azar';
import Escenario, { useCodigo, registrarLogro } from './Escenario';
import './practica.css';

// Cada elemento indica su capa OSI; la de TCP/IP se deduce.
const ELEMENTOS: { texto: string; osi: number; tipo: string }[] = [
  { texto: 'HTTP', osi: 7, tipo: 'Protocolo' },
  { texto: 'DNS', osi: 7, tipo: 'Protocolo' },
  { texto: 'DHCP', osi: 7, tipo: 'Protocolo' },
  { texto: 'SMTP', osi: 7, tipo: 'Protocolo' },
  { texto: 'FTP', osi: 7, tipo: 'Protocolo' },
  { texto: 'Servicios de red para las aplicaciones del usuario', osi: 7, tipo: 'Función' },
  { texto: 'Cifrado, compresión y formato de los datos', osi: 6, tipo: 'Función' },
  { texto: 'Abrir, administrar y cerrar el diálogo entre aplicaciones', osi: 5, tipo: 'Función' },
  { texto: 'TCP', osi: 4, tipo: 'Protocolo' },
  { texto: 'UDP', osi: 4, tipo: 'Protocolo' },
  { texto: 'Segmento', osi: 4, tipo: 'PDU' },
  { texto: 'Números de puerto de origen y destino', osi: 4, tipo: 'Función' },
  { texto: 'Control de flujo y retransmisión de lo perdido', osi: 4, tipo: 'Función' },
  { texto: 'IPv4', osi: 3, tipo: 'Protocolo' },
  { texto: 'IPv6', osi: 3, tipo: 'Protocolo' },
  { texto: 'ICMP (lo usa ping)', osi: 3, tipo: 'Protocolo' },
  { texto: 'OSPF', osi: 3, tipo: 'Protocolo' },
  { texto: 'Paquete', osi: 3, tipo: 'PDU' },
  { texto: 'Router', osi: 3, tipo: 'Dispositivo' },
  { texto: 'Direccionamiento lógico y elección del camino', osi: 3, tipo: 'Función' },
  { texto: 'Ethernet (802.3)', osi: 2, tipo: 'Protocolo' },
  { texto: 'Wi-Fi (802.11)', osi: 2, tipo: 'Protocolo' },
  { texto: 'Trama', osi: 2, tipo: 'PDU' },
  { texto: 'Switch', osi: 2, tipo: 'Dispositivo' },
  { texto: 'Direcciones MAC', osi: 2, tipo: 'Función' },
  { texto: 'Bits', osi: 1, tipo: 'PDU' },
  { texto: 'Cable UTP y conectores RJ-45', osi: 1, tipo: 'Dispositivo' },
  { texto: 'Señales eléctricas, de luz o de radio', osi: 1, tipo: 'Función' },
];

const OSI = ['', 'Física', 'Enlace de datos', 'Red', 'Transporte', 'Sesión', 'Presentación', 'Aplicación'];
const TCPIP = (n: number) => (n >= 5 ? 'Aplicación' : n === 4 ? 'Transporte' : n === 3 ? 'Internet' : 'Acceso a la red');

export function generar(codigo: string) {
  const az = new Azar(codigo, 'capas');
  const modelo = az.elegir(['OSI', 'TCP/IP'] as const);
  let items;
  do { items = az.muestra(ELEMENTOS, 8); } while (new Set(items.map((i) => i.osi)).size < (modelo === 'OSI' ? 5 : 4));
  const opciones = modelo === 'OSI' ? OSI.slice(1).map((n, i) => `${i + 1} ${n}`).reverse() : ['Aplicación', 'Transporte', 'Internet', 'Acceso a la red'];
  const correcta = (osi: number) => (modelo === 'OSI' ? `${osi} ${OSI[osi]}` : TCPIP(osi));
  return { modelo, items, opciones, correcta };
}

export default function Capas() {
  const [codigo, setCodigo] = useCodigo();
  const caso = useMemo(() => (codigo ? generar(codigo) : null), [codigo]);
  const [resp, setResp] = useState<Record<number, string>>({});
  const [revisado, setRevisado] = useState(false);
  if (!codigo || !caso) return null;
  const ok = (i: number) => resp[i] === caso.correcta(caso.items[i].osi);
  const bien = caso.items.filter((_, i) => ok(i)).length;
  const revisar = () => { setRevisado(true); if (bien === caso.items.length) registrarLogro('capas'); };
  const cambiar = (c: string) => { setCodigo(c); setResp({}); setRevisado(false); };

  return (
    <Escenario id="capas" codigo={codigo} alCambiar={cambiar}
      instrucciones={<p>Ubica cada elemento en su capa del <strong>modelo {caso.modelo}</strong>.</p>}>
      <div className="pr-tabla-wrap">
        <table className="pr-tabla">
          <thead><tr><th>Elemento</th><th>Tipo</th><th>Capa del modelo {caso.modelo}</th></tr></thead>
          <tbody>
            {caso.items.map((it, i) => {
              const estado = revisado ? (ok(i) ? 'ok' : 'mal') : '';
              return (
                <tr key={it.texto}>
                  <td><strong>{it.texto}</strong>{revisado && !ok(i) && <span className="cp-correcta">Correcta: {caso.correcta(it.osi)}</span>}</td>
                  <td className="cp-tipo">{it.tipo}</td>
                  <td>
                    <select className={`pr-select ${estado}`} value={resp[i] ?? ''} disabled={revisado}
                      onChange={(e) => setResp({ ...resp, [i]: e.target.value })} aria-label={`Capa de ${it.texto}`}>
                      <option value="" disabled>Elige la capa…</option>
                      {caso.opciones.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="pr-acciones">
        {!revisado
          ? <button type="button" className="pr-boton pr-primario" onClick={revisar} disabled={Object.keys(resp).length < caso.items.length}>Revisar</button>
          : <button type="button" className="pr-boton pr-primario" onClick={() => cambiar(nuevoCodigo())}>Nuevo escenario</button>}
      </div>
      {revisado && (
        <p className={`pr-msg ${bien === caso.items.length ? 'ok' : 'mal'}`}>
          <strong>{bien} de {caso.items.length} correctas.</strong>
          {caso.modelo === 'TCP/IP'
            ? 'Recuerda: la capa de aplicación de TCP/IP incluye las capas 5, 6 y 7 de OSI, y la de acceso a la red las capas 1 y 2.'
            : 'Truco para las capas de OSI de abajo hacia arriba: Física, Enlace, Red, Transporte, Sesión, Presentación, Aplicación.'}
        </p>
      )}
    </Escenario>
  );
}
