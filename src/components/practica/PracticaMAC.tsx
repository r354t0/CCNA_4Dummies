import { useMemo, useState } from 'react';
import { Azar, nuevoCodigo } from '../../lib/azar';
import Topologia, { type NodoTopo, type EnlaceTopo } from '../Topologia';
import Escenario, { useCodigo, registrarLogro } from './Escenario';
import '../teoria/contenido.css';
import './practica.css';

const DIFUSION = 'FFFF.FFFF.FFFF';

interface Equipo { id: string; mac: string; puerto: string } // puerto de S1 por el que se llega a él
interface Trama { de: string; a: string }
interface Paso { trama: Trama; salida: string[]; entrada: string; aprende: boolean; tipo: 'reenvio' | 'inundacion' | 'filtro'; tabla: [string, string][] }

export function generar(codigo: string) {
  const az = new Azar(codigo, 'tabla-mac');
  const conS2 = az.probabilidad(0.6);
  const puertos = az.muestra(Array.from({ length: 24 }, (_, i) => `Fa0/${i + 1}`), 4).sort((a, b) => Number(a.split('/')[1]) - Number(b.split('/')[1]));
  const local = conS2 ? 3 : 4;
  const equipos: Equipo[] = [];
  for (let i = 0; i < local; i++) equipos.push({ id: `PC${i + 1}`, mac: az.mac(), puerto: puertos[i] });
  const enlace = 'Gi0/1';
  if (conS2) for (let i = 0; i < 2; i++) equipos.push({ id: `PC${local + i + 1}`, mac: az.mac(), puerto: enlace });
  const puertosS1 = [...new Set(equipos.map((e) => e.puerto))];

  // Tabla inicial: algunas entradas ya aprendidas
  const tabla = new Map<string, string>();
  for (const e of az.muestra(equipos, az.entero(0, 2))) tabla.set(e.mac, e.puerto);
  const inicial: [string, string][] = [...tabla];

  // Secuencia de tramas con variedad: difusión, desconocida, conocida y, si hay S2, filtrado
  const tramas: Trama[] = [];
  const tipos = az.mezclar(['difusion', 'nueva', 'conocida', ...(conS2 ? ['filtro'] : ['conocida'])]);
  for (const t of tipos) {
    if (t === 'difusion') tramas.push({ de: az.elegir(equipos).id, a: DIFUSION });
    else if (t === 'filtro') tramas.push({ de: equipos[local].id, a: equipos[local + 1].id });
    else {
      const de = az.elegir(equipos);
      const dest = az.elegir(equipos.filter((e) => e.id !== de.id && e.puerto !== de.puerto));
      tramas.push({ de: de.id, a: dest.id });
    }
  }

  const pasos: Paso[] = tramas.map((t) => {
    const o = equipos.find((e) => e.id === t.de)!;
    const aprende = tabla.get(o.mac) !== o.puerto;
    tabla.set(o.mac, o.puerto);
    let salida: string[], tipo: Paso['tipo'];
    if (t.a === DIFUSION) { salida = puertosS1.filter((p) => p !== o.puerto); tipo = 'inundacion'; }
    else {
      const d = equipos.find((e) => e.id === t.a)!;
      const conocido = tabla.get(d.mac);
      if (!conocido) { salida = puertosS1.filter((p) => p !== o.puerto); tipo = 'inundacion'; }
      else if (conocido === o.puerto) { salida = []; tipo = 'filtro'; }
      else { salida = [conocido]; tipo = 'reenvio'; }
    }
    return { trama: t, salida, entrada: o.puerto, aprende, tipo, tabla: [...tabla] };
  });

  // Topología
  const nodos: NodoTopo[] = [{ id: 'S1', tipo: 'switch', x: conS2 ? 210 : 300, y: 60, lado: 'derecha' }];
  const enlaces: EnlaceTopo[] = [];
  const locales = equipos.slice(0, local);
  locales.forEach((e, i) => {
    const x = conS2 ? 80 + i * 130 : 75 + i * 150;
    nodos.push({ id: e.id, tipo: 'pc', x, y: 190, detalle: e.mac, lado: 'abajo' });
    enlaces.push({ a: 'S1', b: e.id, ia: e.puerto.replace('Fa', 'F') });
  });
  if (conS2) {
    nodos.push({ id: 'S2', tipo: 'switch', x: 560, y: 60, lado: 'derecha' });
    enlaces.push({ a: 'S1', b: 'S2', ia: 'G0/1', ib: 'G0/1' });
    equipos.slice(local).forEach((e, i) => {
      nodos.push({ id: e.id, tipo: 'pc', x: 500 + i * 130, y: 190, detalle: e.mac, lado: 'abajo' });
      enlaces.push({ a: 'S2', b: e.id });
    });
  }
  return { equipos, puertosS1, inicial, pasos, conS2, topologia: { nodos, enlaces, ancho: conS2 ? 700 : 580, alto: 260 } };
}

const nombre = (equipos: Equipo[], mac: string) => equipos.find((e) => e.mac === mac)?.id ?? '';

export default function PracticaMAC() {
  const [codigo, setCodigo] = useCodigo();
  const caso = useMemo(() => (codigo ? generar(codigo) : null), [codigo]);
  const [i, setI] = useState(0);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [comprobado, setComprobado] = useState(false);
  const [aciertos, setAciertos] = useState<boolean[]>([]);
  if (!codigo || !caso) return null;
  const fin = aciertos.length === caso.pasos.length;
  const p = caso.pasos[Math.min(i, caso.pasos.length - 1)];
  const o = caso.equipos.find((e) => e.id === p.trama.de)!;
  const d = caso.equipos.find((e) => e.id === p.trama.a);
  const correcto = comprobado && p.salida.length === marcados.size && p.salida.every((x) => marcados.has(x));
  const tablaVisible = comprobado ? p.tabla : i === 0 ? caso.inicial : caso.pasos[i - 1].tabla;

  const cambiar = (c: string) => { setCodigo(c); setI(0); setMarcados(new Set()); setComprobado(false); setAciertos([]); };
  const alternar = (pto: string) => { const n = new Set(marcados); n.has(pto) ? n.delete(pto) : n.add(pto); setMarcados(n); };
  const comprobar = () => {
    const ok = p.salida.length === marcados.size && p.salida.every((x) => marcados.has(x));
    const a = [...aciertos, ok];
    setAciertos(a);
    setComprobado(true);
    if (a.length === caso.pasos.length && a.every(Boolean)) registrarLogro('tabla-mac');
  };
  const siguiente = () => { setI(i + 1); setMarcados(new Set()); setComprobado(false); };

  const explicacion = () => {
    const aprende = p.aprende ? `S1 aprende ${o.mac} en ${p.entrada}.` : `${o.mac} ya estaba en la tabla en ${p.entrada}: solo se renueva.`;
    if (p.trama.a === DIFUSION) return `${aprende} Es una difusión: S1 la inunda por todos los puertos menos ${p.entrada}.`;
    if (p.tipo === 'filtro') return `${aprende} La MAC de destino ${d!.mac} está asociada al mismo puerto por el que entró la trama (${p.entrada}): S1 la descarta. ${caso.conS2 ? 'S2 ya la entregó a su destino.' : ''}`;
    if (p.tipo === 'inundacion') return `${aprende} La MAC de destino ${d!.mac} no está en la tabla: unicast desconocida, se inunda por todos los puertos menos ${p.entrada}.`;
    return `${aprende} La MAC de destino ${d!.mac} está en la tabla asociada a ${p.salida[0]}: S1 la reenvía solo por ese puerto.`;
  };

  return (
    <Escenario id="tabla-mac" codigo={codigo} alCambiar={cambiar}
      instrucciones={<p>Sigue las tramas una por una. Para cada una, marca <strong>por qué puertos de S1 sale</strong>. Si S1 la descarta, no marques ninguno.</p>}>
      <Topologia {...caso.topologia} titulo="Red del escenario" />
      <div className="tm-cuerpo pm-cuerpo">
        <div>
          {!fin || comprobado ? (
            <>
              <p className="pm-trama">
                <span className="pm-n">Trama {Math.min(i, caso.pasos.length - 1) + 1} de {caso.pasos.length}</span>
                <span><strong>{o.id}</strong> envía una trama a <strong>{d ? d.id : 'todos (difusión)'}</strong></span>
                <span className="pm-macs">Origen <code>{o.mac}</code> · Destino <code>{d ? d.mac : DIFUSION}</code></span>
                {d && o.puerto === 'Gi0/1' && d.puerto === 'Gi0/1' && <span className="pm-macs">S2 todavía no conocía el destino y la inundó: una copia llega a S1 por Gi0/1.</span>}
              </p>
              <fieldset className="pm-puertos" disabled={comprobado}>
                <legend>¿Por qué puertos de S1 sale la trama?</legend>
                {caso.puertosS1.map((pto) => {
                  const estado = comprobado ? (p.salida.includes(pto) ? 'debe' : marcados.has(pto) ? 'sobra' : '') : '';
                  return (
                    <label key={pto} className={`pm-puerto ${marcados.has(pto) ? 'sel' : ''} ${estado}`}>
                      <input type="checkbox" checked={marcados.has(pto)} onChange={() => alternar(pto)} />
                      {pto}{pto === p.entrada && <small> (entrada)</small>}
                    </label>
                  );
                })}
              </fieldset>
              {comprobado && <p className={`pr-msg ${correcto ? 'ok' : 'mal'}`}><strong>{correcto ? 'Correcto.' : p.salida.length ? `Sale por: ${p.salida.join(', ')}.` : 'S1 descarta la trama: no sale por ningún puerto.'}</strong>{explicacion()}</p>}
              <div className="pr-acciones">
                {!comprobado && <button type="button" className="pr-boton pr-primario" onClick={comprobar}>Comprobar</button>}
                {comprobado && i < caso.pasos.length - 1 && <button type="button" className="pr-boton pr-primario" onClick={siguiente}>Siguiente trama</button>}
                {comprobado && i === caso.pasos.length - 1 && <button type="button" className="pr-boton pr-primario" onClick={() => cambiar(nuevoCodigo())}>Nuevo escenario</button>}
              </div>
              {fin && <p className={`pr-msg ${aciertos.every(Boolean) ? 'ok' : 'mal'}`}><strong>{aciertos.filter(Boolean).length} de {aciertos.length} tramas bien resueltas.</strong>Recuerda: aprende con la MAC de origen, decide con la de destino.</p>}
            </>
          ) : null}
        </div>
        <div className="tm-tabla">
          <p className="tm-tabla-tit">Tabla MAC de S1 {comprobado ? 'después de la trama' : 'antes de la trama'}</p>
          <table>
            <thead><tr><th>MAC</th><th>Puerto</th><th>Equipo</th></tr></thead>
            <tbody>
              {tablaVisible.length === 0 && <tr><td colSpan={3}>(vacía)</td></tr>}
              {tablaVisible.map(([mac, pto]) => (
                <tr key={mac} className={comprobado && p.aprende && mac === o.mac ? 'nueva' : ''}><td>{mac}</td><td>{pto}</td><td>{nombre(caso.equipos, mac)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Escenario>
  );
}
