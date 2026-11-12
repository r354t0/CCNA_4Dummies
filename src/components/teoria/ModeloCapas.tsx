import { useState } from 'react';
import './contenido.css';

interface Capa {
  n: number;
  nombre: string;
  funcion: string;
  pdu: string;
  protocolos: string;
  dispositivos: string;
}

const OSI: Capa[] = [
  { n: 7, nombre: 'Aplicación', funcion: 'Ofrece los servicios de red a las aplicaciones del usuario: navegar, enviar correo, transferir archivos.', pdu: 'Datos', protocolos: 'HTTP, HTTPS, DNS, DHCP, SMTP, FTP, SSH', dispositivos: 'Hosts (el software)' },
  { n: 6, nombre: 'Presentación', funcion: 'Da formato común a los datos: representación, cifrado y compresión, para que el receptor los entienda.', pdu: 'Datos', protocolos: 'TLS (cifrado), JPEG, MP4, ASCII', dispositivos: 'Hosts' },
  { n: 5, nombre: 'Sesión', funcion: 'Abre, administra y cierra los diálogos entre las aplicaciones de origen y destino.', pdu: 'Datos', protocolos: 'RPC, NetBIOS', dispositivos: 'Hosts' },
  { n: 4, nombre: 'Transporte', funcion: 'Segmenta, transfiere y reensambla los datos de cada conversación entre dispositivos finales. Usa números de puerto.', pdu: 'Segmento (TCP) o datagrama (UDP)', protocolos: 'TCP, UDP', dispositivos: 'Hosts; firewalls que filtran por puerto' },
  { n: 3, nombre: 'Red', funcion: 'Intercambia datos entre redes: direccionamiento lógico (IP) y elección del camino (enrutamiento).', pdu: 'Paquete', protocolos: 'IPv4, IPv6, ICMP, OSPF', dispositivos: 'Routers, switches de capa 3' },
  { n: 2, nombre: 'Enlace de datos', funcion: 'Prepara los datos para el medio y los entrega dentro de la misma red, con direcciones físicas (MAC).', pdu: 'Trama', protocolos: 'Ethernet, Wi-Fi (802.11), ARP*', dispositivos: 'Switches, puntos de acceso, NIC' },
  { n: 1, nombre: 'Física', funcion: 'Transmite los bits por el medio: niveles eléctricos, luz u ondas, conectores y cables.', pdu: 'Bits', protocolos: 'Estándares de cableado y radio (UTP, fibra, 802.11 físico)', dispositivos: 'Cables, conectores, repetidores, hubs' },
];

// Capas de TCP/IP y las capas OSI que abarca cada una.
const TCPIP = [
  { nombre: 'Aplicación', desde: 7, hasta: 5, desc: 'Representación, codificación y control de diálogo.' },
  { nombre: 'Transporte', desde: 4, hasta: 4, desc: 'Comunicación entre dispositivos a través de distintas redes.' },
  { nombre: 'Internet', desde: 3, hasta: 3, desc: 'Determina el mejor camino a través de la red.' },
  { nombre: 'Acceso a la red', desde: 2, hasta: 1, desc: 'Controla los dispositivos de hardware y los medios.' },
];

/** OSI y TCP/IP lado a lado. Al elegir una capa se muestra su función, PDU, protocolos y dispositivos. */
export default function ModeloCapas() {
  const [sel, setSel] = useState(4);
  const c = OSI.find((x) => x.n === sel)!;
  const tcp = TCPIP.find((t) => sel <= t.desde && sel >= t.hasta)!;
  return (
    <div className="mc">
      <div className="mc-modelos">
        <div className="mc-col">
          <p className="mc-cab">Modelo OSI</p>
          {OSI.map((x) => (
            <button
              key={x.n}
              type="button"
              className={`mc-capa mc-${x.n} ${x.n === sel ? 'sel' : ''}`}
              aria-pressed={x.n === sel}
              onClick={() => setSel(x.n)}
            >
              <span className="mc-n">{x.n}</span> {x.nombre}
            </button>
          ))}
        </div>
        <div className="mc-col">
          <p className="mc-cab">Modelo TCP/IP</p>
          {TCPIP.map((t) => {
            const filas = t.desde - t.hasta + 1;
            const activa = sel <= t.desde && sel >= t.hasta;
            return (
              <button
                key={t.nombre}
                type="button"
                className={`mc-capa mc-tcp ${activa ? 'sel' : ''}`}
                style={{ flexGrow: filas, minHeight: `calc(${filas} * 2.6rem + ${(filas - 1) * 0.3}rem)` }}
                aria-pressed={activa}
                onClick={() => setSel(t.desde)}
              >
                {t.nombre}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mc-detalle" aria-live="polite">
        <p className="mc-titulo">
          Capa {c.n} de OSI: {c.nombre} <span>· en TCP/IP: {tcp.nombre}</span>
        </p>
        <p>{c.funcion}</p>
        <dl>
          <div><dt>PDU</dt><dd>{c.pdu}</dd></div>
          <div><dt>Protocolos y estándares</dt><dd>{c.protocolos}</dd></div>
          <div><dt>Dispositivos</dt><dd>{c.dispositivos}</dd></div>
        </dl>
        {c.n === 2 && <p className="mc-nota">* ARP trabaja entre las capas 2 y 3: resuelve direcciones IP en direcciones MAC.</p>}
      </div>
    </div>
  );
}
