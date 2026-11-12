import { useMemo, useState } from 'react';
import { Azar, nuevoCodigo } from '../../lib/azar';
import Escenario, { useCodigo, registrarLogro } from './Escenario';
import './practica.css';

const APPS = [
  { app: 'HTTP', desc: 'una página web', l4: 'TCP' },
  { app: 'HTTPS', desc: 'una página web segura', l4: 'TCP' },
  { app: 'SMTP', desc: 'un correo electrónico', l4: 'TCP' },
  { app: 'Telnet', desc: 'una sesión remota', l4: 'TCP' },
  { app: 'SSH', desc: 'una sesión remota cifrada', l4: 'TCP' },
  { app: 'FTP', desc: 'un archivo', l4: 'TCP' },
  { app: 'DNS', desc: 'una consulta de nombre', l4: 'UDP' },
  { app: 'DHCP', desc: 'una solicitud de dirección', l4: 'UDP' },
  { app: 'TFTP', desc: 'un archivo de configuración', l4: 'UDP' },
] as const;

const PDUS = ['Datos', 'Segmento', 'Datagrama', 'Paquete', 'Trama', 'Bits'];

interface Paso { texto: string; pdu: string[]; capa: string }

export function generar(codigo: string) {
  const az = new Azar(codigo, 'encapsulacion');
  const a = az.elegir(APPS);
  const ip = az.elegir(['IPv4', 'IPv6']);
  const l2 = az.elegir(['Ethernet', '802.11 (Wi-Fi)']);
  const recibir = az.probabilidad(0.4);
  const host = recibir ? 'El equipo de destino recibe' : 'Un equipo envía';
  const pdu4 = a.l4 === 'TCP' ? ['Segmento'] : ['Datagrama', 'Segmento'];
  const enviar: Paso[] = [
    { capa: 'Aplicación', texto: `Los datos de ${a.app} se generan y se entregan a la capa de transporte`, pdu: ['Datos'] },
    { capa: 'Transporte', texto: `Se agrega el encabezado ${a.l4} con los puertos de origen y destino`, pdu: pdu4 },
    { capa: 'Internet', texto: `Se agrega el encabezado ${ip} con las direcciones de origen y destino`, pdu: ['Paquete'] },
    { capa: 'Acceso a la red', texto: `Se agregan el encabezado y el tráiler ${l2} con las direcciones MAC`, pdu: ['Trama'] },
    { capa: 'Física', texto: 'Se transmiten los bits por el medio', pdu: ['Bits'] },
  ];
  const recibe: Paso[] = [
    { capa: 'Física', texto: 'Se reciben los bits desde el medio y se arma la trama', pdu: ['Bits'] },
    { capa: 'Acceso a la red', texto: `Se verifica el FCS y se quitan el encabezado y el tráiler ${l2}`, pdu: ['Trama'] },
    { capa: 'Internet', texto: `Se revisa la dirección de destino y se quita el encabezado ${ip}`, pdu: ['Paquete'] },
    { capa: 'Transporte', texto: `Se quita el encabezado ${a.l4} y se entregan los datos al proceso según el puerto`, pdu: pdu4 },
    { capa: 'Aplicación', texto: `${a.app} procesa los datos recibidos`, pdu: ['Datos'] },
  ];
  const pasos = recibir ? recibe : enviar;
  let mezcla = az.mezclar(pasos.map((_, i) => i));
  while (mezcla.every((v, i) => v === i)) mezcla = az.mezclar(mezcla);
  return { a, ip, l2, recibir, host, pasos, mezcla };
}

export default function Encapsular() {
  const [codigo, setCodigo] = useCodigo();
  const caso = useMemo(() => (codigo ? generar(codigo) : null), [codigo]);
  const [orden, setOrden] = useState<number[] | null>(null);
  const [pdus, setPdus] = useState<Record<number, string>>({});
  const [revisado, setRevisado] = useState(false);
  if (!codigo || !caso) return null;
  const actual = orden ?? caso.mezcla;

  const mover = (pos: number, d: number) => {
    const n = [...actual];
    const j = pos + d;
    if (j < 0 || j >= n.length) return;
    [n[pos], n[j]] = [n[j], n[pos]];
    setOrden(n);
  };
  const ordenOk = actual.every((v, i) => v === i);
  const pduOk = (paso: number) => caso.pasos[paso].pdu.includes(pdus[paso] ?? '');
  const todoOk = ordenOk && caso.pasos.every((_, i) => pduOk(i));
  const revisar = () => { setRevisado(true); if (todoOk) registrarLogro('encapsulacion'); };
  const cambiar = (c: string) => { setCodigo(c); setOrden(null); setPdus({}); setRevisado(false); };

  return (
    <Escenario id="encapsulacion" codigo={codigo} alCambiar={cambiar}
      instrucciones={
        <p>
          {caso.host} {caso.a.desc} con <strong>{caso.a.app}</strong>, sobre {caso.ip} y {caso.l2}.{' '}
          {caso.recibir ? 'Ordena los pasos de la desencapsulación' : 'Ordena los pasos de la encapsulación'} con las flechas y
          elige el nombre de la PDU en cada paso.
        </p>
      }>
      <ol className="en-lista">
        {actual.map((paso, pos) => {
          const p = caso.pasos[paso];
          const okPos = paso === pos;
          return (
            <li key={paso} className={revisado ? (okPos && pduOk(paso) ? 'ok' : 'mal') : ''}>
              <span className="en-num">{pos + 1}</span>
              <span className="en-texto">{p.texto}</span>
              <select className={`pr-select ${revisado ? (pduOk(paso) ? 'ok' : 'mal') : ''}`} value={pdus[paso] ?? ''} disabled={revisado}
                onChange={(e) => setPdus({ ...pdus, [paso]: e.target.value })} aria-label={`PDU del paso: ${p.texto}`}>
                <option value="" disabled>PDU…</option>
                {PDUS.map((x) => <option key={x}>{x}</option>)}
              </select>
              <span className="en-flechas">
                <button type="button" onClick={() => mover(pos, -1)} disabled={revisado || pos === 0} aria-label="Subir">↑</button>
                <button type="button" onClick={() => mover(pos, 1)} disabled={revisado || pos === actual.length - 1} aria-label="Bajar">↓</button>
              </span>
              {revisado && !okPos && <span className="en-nota">Este paso va en la posición {paso + 1} (capa {p.capa}).</span>}
              {revisado && okPos && !pduOk(paso) && <span className="en-nota">En la capa {p.capa} la PDU es {p.pdu.join(' o ')}.</span>}
            </li>
          );
        })}
      </ol>
      <div className="pr-acciones">
        {!revisado
          ? <button type="button" className="pr-boton pr-primario" onClick={revisar} disabled={Object.keys(pdus).length < caso.pasos.length}>Revisar</button>
          : <button type="button" className="pr-boton pr-primario" onClick={() => cambiar(nuevoCodigo())}>Nuevo escenario</button>}
      </div>
      {revisado && (
        <p className={`pr-msg ${todoOk ? 'ok' : 'mal'}`}>
          <strong>{todoOk ? 'Perfecto.' : 'Hay pasos por corregir.'}</strong>
          {caso.recibir
            ? 'Al recibir se quitan los encabezados de abajo hacia arriba: bits, trama, paquete, segmento y datos.'
            : 'Al enviar se agregan los encabezados de arriba hacia abajo: datos, segmento, paquete, trama y bits.'}
          {caso.a.l4 === 'UDP' && ' Con UDP la PDU de transporte se llama datagrama, aunque en NetAcad también verás «segmento».'}
        </p>
      )}
    </Escenario>
  );
}
