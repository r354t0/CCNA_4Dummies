import { useMemo, useState } from 'react';
import { Azar, nuevoCodigo } from '../../lib/azar';
import Topologia, { type NodoTopo, type EnlaceTopo } from '../Topologia';
import Escenario, { useCodigo, registrarLogro } from './Escenario';
import './practica.css';

interface Interfaz { equipo: string; nombre: string; ip?: string; mac?: string }

export function generar(codigo: string) {
  const az = new Azar(codigo, 'direcciones');
  const routers = az.elegir([0, 1, 1, 2, 2, 2]);
  const redes = az.mezclar([`192.168.${az.entero(1, 99)}`, `172.16.${az.entero(1, 99)}`, `10.${az.entero(1, 99)}.${az.entero(1, 99)}`]);
  const macs = new Set<string>();
  const mac = () => { let m; do { m = az.mac(); } while (macs.has(m)); macs.add(m); return m; };
  const destino = az.elegir(['Servidor', 'PC-B', 'Srv-Web']);
  const hA = az.entero(10, 120);
  const hB = az.entero(130, 250);

  // Cadena de equipos y la red (segmento) de cada cable
  const ifs: Interfaz[] = [];
  const nodos: NodoTopo[] = [];
  const enlaces: (EnlaceTopo & { seg: number })[] = [];
  const pcA: Interfaz = { equipo: 'PC-A', nombre: 'NIC', ip: `${redes[0]}.${hA}`, mac: mac() };
  ifs.push(pcA);

  // Segmentos: lista de [emisor, receptor] para el sentido PC-A → destino
  const segmentos: [Interfaz, Interfaz][] = [];
  let anterior = pcA;
  const orden: string[] = ['PC-A', 'S1'];
  for (let r = 1; r <= routers; r++) {
    const rid = `R${r}`;
    const entrada: Interfaz = { equipo: rid, nombre: 'G0/0/0', ip: r === 1 ? `${redes[0]}.1` : `${redes[1]}.2`, mac: mac() };
    const salida: Interfaz = { equipo: rid, nombre: 'G0/0/1', ip: r === routers ? `${redes[routers === 2 ? 2 : 1]}.1` : `${redes[1]}.1`, mac: mac() };
    ifs.push(entrada, salida);
    segmentos.push([anterior, entrada]);
    anterior = salida;
    orden.push(rid);
  }
  const redDestino = routers === 0 ? redes[0] : redes[routers === 2 ? 2 : 1];
  const dst: Interfaz = { equipo: destino, nombre: 'NIC', ip: `${redDestino}.${hB}`, mac: mac() };
  ifs.push(dst);
  segmentos.push([anterior, dst]);
  if (routers > 0) orden.push('S2');
  orden.push(destino);

  // Posiciones y cables
  const paso = 680 / (orden.length - 1);
  orden.forEach((id, i) => {
    const tipo = id.startsWith('S') && id.length === 2 ? 'switch' : id.startsWith('R') ? 'router' : id === 'PC-A' || id === 'PC-B' ? 'pc' : 'servidor';
    const i0 = ifs.find((x) => x.equipo === id);
    nodos.push({
      id, tipo, x: 50 + i * paso, y: 100, lado: tipo === 'switch' ? 'arriba' : 'abajo',
      detalle: tipo === 'pc' || tipo === 'servidor' ? i0?.ip : undefined,
    });
  });
  let seg = 0;
  for (let i = 0; i < orden.length - 1; i++) {
    const a = orden[i];
    const b = orden[i + 1];
    const e: EnlaceTopo & { seg: number } = { a, b, seg };
    if (b.startsWith('R') && b.length === 2) e.ib = 'G0/0/0';
    if (a.startsWith('R') && a.length === 2) e.ia = 'G0/0/1';
    enlaces.push(e);
    // el segmento cambia al salir de un router
    if (b.startsWith('R') && b.length === 2) seg++;
  }

  const respuesta = az.probabilidad(0.4); // la respuesta del destino hacia PC-A
  const preguntado = az.entero(0, enlaces.length - 1);
  const [emisor, receptor] = segmentos[enlaces[preguntado].seg];
  const correcto = respuesta
    ? { macO: receptor.mac!, macD: emisor.mac!, ipO: dst.ip!, ipD: pcA.ip! }
    : { macO: emisor.mac!, macD: receptor.mac!, ipO: pcA.ip!, ipD: dst.ip! };
  enlaces[preguntado].marca = '?';
  enlaces[preguntado].resaltado = true;

  return { nodos, enlaces, ifs, correcto, respuesta, destino, routers, emisor, receptor, preguntado };
}

const etiqueta = (i: Interfaz) => `${i.equipo}${i.nombre !== 'NIC' ? ` ${i.nombre}` : ''}`;

export default function Direcciones() {
  const [codigo, setCodigo] = useCodigo();
  const caso = useMemo(() => (codigo ? generar(codigo) : null), [codigo]);
  const [r, setR] = useState<Record<string, string>>({});
  const [revisado, setRevisado] = useState(false);
  if (!codigo || !caso) return null;

  const campos = [
    { k: 'macO', t: 'MAC de origen', tipo: 'mac' },
    { k: 'macD', t: 'MAC de destino', tipo: 'mac' },
    { k: 'ipO', t: 'IP de origen', tipo: 'ip' },
    { k: 'ipD', t: 'IP de destino', tipo: 'ip' },
  ] as const;
  const ok = (k: keyof typeof caso.correcto) => r[k] === caso.correcto[k];
  const todos = campos.every((c) => ok(c.k));
  const revisar = () => { setRevisado(true); if (todos) registrarLogro('direcciones'); };
  const cambiar = (c: string) => { setCodigo(c); setR({}); setRevisado(false); };
  const conIp = caso.ifs.filter((i) => i.ip);
  const quien = (v: string, tipo: 'mac' | 'ip') => etiqueta(caso.ifs.find((i) => (tipo === 'mac' ? i.mac : i.ip) === v)!);

  return (
    <Escenario id="direcciones" codigo={codigo} alCambiar={cambiar}
      instrucciones={
        <p>
          {caso.respuesta
            ? <>{caso.destino} responde a una solicitud de PC-A.</>
            : <>PC-A envía una solicitud a {caso.destino}.</>}{' '}
          Indica las direcciones de la trama <strong>en el cable marcado con «?»</strong>.
        </p>
      }>
      <Topologia nodos={caso.nodos} enlaces={caso.enlaces} ancho={780} alto={190} titulo="Topología del escenario" />
      <div className="pr-tabla-wrap">
        <table className="pr-tabla dr-tabla">
          <thead><tr><th>Equipo</th><th>Interfaz</th><th>Dirección IP</th><th>Dirección MAC</th></tr></thead>
          <tbody>
            {caso.ifs.map((i) => (
              <tr key={`${i.equipo}${i.nombre}`}>
                <td>{i.equipo}</td><td>{i.nombre}</td><td><code>{i.ip}</code></td><td><code>{i.mac}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dr-nota">Los switches no tienen dirección en este escenario: reenvían las tramas sin modificarlas.</p>

      <div className="dr-campos">
        {campos.map((c) => (
          <label key={c.k} className="dr-campo">
            <span>{c.t}</span>
            <select className={`pr-select ${revisado ? (ok(c.k) ? 'ok' : 'mal') : ''}`} value={r[c.k] ?? ''} disabled={revisado}
              onChange={(e) => setR({ ...r, [c.k]: e.target.value })}>
              <option value="" disabled>Elige…</option>
              {(c.tipo === 'mac' ? caso.ifs : conIp).map((i) => {
                const v = c.tipo === 'mac' ? i.mac! : i.ip!;
                return <option key={v} value={v}>{v} ({etiqueta(i)})</option>;
              })}
            </select>
            {revisado && !ok(c.k) && <span className="dr-correcta">Correcta: {caso.correcto[c.k]} ({quien(caso.correcto[c.k], c.tipo)})</span>}
          </label>
        ))}
      </div>

      <div className="pr-acciones">
        {!revisado
          ? <button type="button" className="pr-boton pr-primario" onClick={revisar} disabled={Object.keys(r).length < 4}>Revisar</button>
          : <button type="button" className="pr-boton pr-primario" onClick={() => cambiar(nuevoCodigo())}>Nuevo escenario</button>}
      </div>
      {revisado && (
        <div className={`pr-msg ${todos ? 'ok' : 'mal'}`}>
          <strong>{todos ? 'Correcto.' : 'Revisa el razonamiento:'}</strong>
          <ul className="dr-razon">
            <li>Las IP son de extremo a extremo: siempre {caso.respuesta ? `${caso.destino} → PC-A` : `PC-A → ${caso.destino}`}, sin importar el cable.</li>
            <li>
              Las MAC son del tramo: en esta red la trama va de{' '}
              <strong>{caso.respuesta ? etiqueta(caso.receptor) : etiqueta(caso.emisor)}</strong> a{' '}
              <strong>{caso.respuesta ? etiqueta(caso.emisor) : etiqueta(caso.receptor)}</strong>.
            </li>
            {caso.routers > 0 && <li>Cada router arma una trama nueva al reenviar; el switch no cambia nada.</li>}
          </ul>
        </div>
      )}
    </Escenario>
  );
}
