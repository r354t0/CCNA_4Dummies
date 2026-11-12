import { useMemo, useState } from 'react';
import { Azar, nuevoCodigo } from '../../lib/azar';
import Topologia, { type NodoTopo, type EnlaceTopo, type TipoNodo } from '../Topologia';
import Escenario, { useCodigo, registrarLogro } from './Escenario';
import './practica.css';

interface Pregunta { texto: string; opciones: string[]; correcta: string; porque: string }

const INTERMEDIARIOS: TipoNodo[] = ['router', 'router-inalambrico', 'switch', 'ap', 'firewall'];
const PREFIJO: Record<string, string> = {
  pc: 'PC', laptop: 'Laptop', servidor: 'Servidor', impresora: 'Impresora', telefono: 'Tel-IP', tablet: 'Tablet',
};
const MEDIO: Record<string, string> = { cobre: 'Cobre (UTP)', fibra: 'Fibra óptica', inalambrico: 'Inalámbrico', serial: 'Serial (WAN)' };

export function generar(codigo: string) {
  const az = new Azar(codigo, 'topologias');
  const hogar = az.probabilidad(0.35);
  const logico = az.probabilidad(0.55);
  const nodos: NodoTopo[] = [];
  const enlaces: EnlaceTopo[] = [];
  const salas = az.mezclar(['Sala 101', 'Sala 102', 'Recepción', 'Gerencia', 'Laboratorio', 'Almacén', 'Sala 204', 'Contabilidad']);
  const red = az.entero(1, 250);
  let host = 10;
  const ip = () => `192.168.${red}.${host++}`;

  nodos.push({ id: 'Internet', tipo: 'nube', x: 70, y: 80, lado: 'abajo' });
  const hayFirewall = !hogar && az.probabilidad(0.5);
  const rId = hogar ? az.elegir(['Router-Casa', 'WRT-Hogar', 'Router-SOHO']) : az.elegir(['R1', 'R-Sede', 'Gw-Lima', 'R-Borde']);
  const rx = hayFirewall ? 290 : 220;
  if (hayFirewall) {
    nodos.push({ id: 'FW1', tipo: 'firewall', x: 175, y: 80, lado: 'abajo' });
    enlaces.push({ a: 'Internet', b: 'FW1' }, { a: 'FW1', b: rId, ia: logico ? 'G1/1' : undefined, ib: logico ? 'G0/0/0' : undefined });
  } else {
    enlaces.push({ a: 'Internet', b: rId, ib: logico ? 'G0/0/0' : undefined });
  }
  nodos.push({
    id: rId, tipo: hogar ? 'router-inalambrico' : 'router', x: rx, y: 80, lado: 'abajo',
    detalle: logico ? `192.168.${red}.1` : 'Sala de equipos',
  });

  const finales: TipoNodo[] = hogar ? ['pc', 'laptop', 'impresora', 'tablet'] : ['pc', 'pc', 'impresora', 'servidor', 'telefono', 'laptop'];
  let swId: string | null = null;
  const fibra = !hogar && az.probabilidad(0.4);
  const ifR = az.elegir(['G0/0/1', 'G0/0/2']);
  if (!hogar) {
    swId = az.elegir(['S1', 'Sw-Piso1', 'SW-Core', 'S-Ventas']);
    nodos.push({ id: swId, tipo: 'switch', x: rx + 190, y: 80, lado: 'arriba', detalle: logico ? undefined : 'Armario piso 1' });
    enlaces.push({ a: rId, b: swId, ia: logico ? ifR : undefined, ib: logico ? 'G0/1' : undefined, tipo: fibra ? 'fibra' : 'cobre' });
  }
  const conAP = hogar || az.probabilidad(0.5);
  const centro = swId ?? rId;
  const xs = hogar ? [130, 260, 390] : [250, 380, 510];
  const cantidad = az.entero(2, 3);
  const tipos = az.muestra(finales, cantidad);
  tipos.forEach((t, i) => {
    const id = `${PREFIJO[t]}-${i + 1}`;
    nodos.push({ id, tipo: t, x: xs[i], y: 255, lado: 'abajo', detalle: logico ? ip() : salas[i] });
    enlaces.push({ a: centro, b: id, ia: logico ? (swId ? `F0/${i + 1}` : `LAN${i + 1}`) : undefined });
  });
  if (conAP) {
    let apId = rId;
    if (!hogar) {
      apId = 'AP1';
      nodos.push({ id: apId, tipo: 'ap', x: 640, y: 120, lado: 'arriba', detalle: logico ? undefined : salas[4] });
      enlaces.push({ a: swId!, b: apId, ia: logico ? 'F0/24' : undefined });
    }
    const inal = hogar ? az.elegir<TipoNodo>(['laptop', 'tablet']) : 'laptop';
    const id = inal === 'laptop' ? 'Laptop-W' : 'Tablet-W';
    nodos.push({ id, tipo: inal, x: hogar ? 560 : 640, y: 255, lado: 'abajo', detalle: logico ? ip() : salas[5] });
    enlaces.push({ a: apId, b: id, tipo: 'inalambrico' });
  }

  // Preguntas
  const nombresNodos = nodos.filter((n) => n.tipo !== 'nube').map((n) => n.id);
  const inter = nodos.filter((n) => INTERMEDIARIOS.includes(n.tipo));
  const fin = nodos.filter((n) => n.tipo !== 'nube' && !INTERMEDIARIOS.includes(n.tipo));
  const numeros = (correcto: number) => az.mezclar([...new Set([correcto, correcto + 1, Math.max(0, correcto - 1), correcto + 2])]).slice(0, 4).map(String);
  const banco: Pregunta[] = [];

  banco.push({
    texto: '¿Cuántos dispositivos intermediarios hay en el diagrama?',
    opciones: numeros(inter.length), correcta: String(inter.length),
    porque: `Son ${inter.map((n) => n.id).join(', ')}: conectan equipos o redes. La nube de Internet no se cuenta.`,
  });
  banco.push({
    texto: '¿Cuántos dispositivos finales hay?',
    opciones: numeros(fin.length), correcta: String(fin.length),
    porque: `Son ${fin.map((n) => n.id).join(', ')}: allí empieza o termina la comunicación.`,
  });
  banco.push({
    texto: '¿Qué equipo conecta la red local con Internet?',
    opciones: az.mezclar([rId, ...az.muestra(nombresNodos.filter((n) => n !== rId), 3)]), correcta: rId,
    porque: hayFirewall
      ? `${rId} es el router que une la LAN con Internet; el firewall FW1 filtra el tráfico en el borde, pero quien enruta es el router.`
      : `${rId} es el router (el gateway de la LAN): une la red local con Internet.`,
  });
  banco.push({
    texto: '¿Este diagrama es una topología física o lógica?',
    opciones: ['Física', 'Lógica'], correcta: logico ? 'Lógica' : 'Física',
    porque: logico ? 'Muestra interfaces y direcciones IP: es un diagrama lógico.' : 'Muestra salas y ubicaciones, sin direccionamiento: es un diagrama físico.',
  });
  const enlaceMedio = az.elegir(enlaces.filter((e) => e.a !== 'Internet' && e.b !== 'Internet'));
  const medio = MEDIO[enlaceMedio.tipo ?? 'cobre'];
  banco.push({
    texto: `¿Qué tipo de medio une ${enlaceMedio.a} con ${enlaceMedio.b}?`,
    opciones: ['Cobre (UTP)', 'Fibra óptica', 'Inalámbrico', 'Serial (WAN)'], correcta: medio,
    porque: 'La leyenda bajo el diagrama indica el tipo de cada línea: continua para cobre, naranja para fibra, punteada celeste para inalámbrico.',
  });
  const candidato = az.elegir(inter);
  banco.push({
    texto: '¿Cuál de estos equipos es un dispositivo intermediario?',
    opciones: az.mezclar([candidato.id, ...az.muestra(fin.map((n) => n.id), 3)]), correcta: candidato.id,
    porque: `${candidato.id} es un ${candidato.tipo === 'ap' ? 'punto de acceso' : candidato.tipo.replace('-', ' ')}: conecta otros equipos. Los demás son dispositivos finales.`,
  });
  if (logico && swId) {
    banco.push({
      texto: `¿Qué interfaz de ${rId} conecta con ${swId}?`,
      opciones: az.mezclar(['G0/0/0', 'G0/0/1', 'G0/0/2', 'G0/1']), correcta: ifR,
      porque: `La etiqueta junto a ${rId} sobre el cable hacia ${swId} indica ${ifR}. Cada etiqueta va pegada al equipo al que pertenece.`,
    });
  }
  if (logico) {
    const h = az.elegir(fin);
    banco.push({
      texto: `¿Qué equipo tiene la dirección ${h.detalle}?`,
      opciones: az.mezclar([h.id, ...az.muestra(fin.filter((n) => n.id !== h.id).map((n) => n.id).concat(rId), 3)]).slice(0, 4),
      correcta: h.id,
      porque: 'En un diagrama lógico cada equipo muestra su dirección IP junto al nombre.',
    });
  }
  const preguntas = az.muestra(banco, 4);
  return { nodos, enlaces, preguntas, hogar };
}

export default function LeerTopologia() {
  const [codigo, setCodigo] = useCodigo();
  const [resp, setResp] = useState<Record<number, string>>({});
  const [revisado, setRevisado] = useState(false);
  const caso = useMemo(() => (codigo ? generar(codigo) : null), [codigo]);
  if (!codigo || !caso) return null;

  const bien = caso.preguntas.filter((q, i) => resp[i] === q.correcta).length;
  const revisar = () => { setRevisado(true); if (bien === caso.preguntas.length) registrarLogro('topologias'); };
  const cambiar = (c: string) => { setCodigo(c); setResp({}); setRevisado(false); };

  return (
    <Escenario id="topologias" codigo={codigo} alCambiar={cambiar}
      instrucciones={<p>Observa el diagrama de una {caso.hogar ? 'red doméstica' : 'oficina'} y responde las cuatro preguntas.</p>}>
      <Topologia nodos={caso.nodos} enlaces={caso.enlaces} ancho={720} alto={320} titulo="Topología del escenario" />
      <ol className="tp-preguntas">
        {caso.preguntas.map((q, i) => {
          const estado = revisado ? (resp[i] === q.correcta ? 'ok' : 'mal') : '';
          return (
            <li key={i} className={estado}>
              <p className="tp-texto">{q.texto}</p>
              <div className="tp-opciones" role="radiogroup" aria-label={q.texto}>
                {q.opciones.map((o) => (
                  <label key={o} className={`tp-op ${resp[i] === o ? 'sel' : ''} ${revisado && o === q.correcta ? 'correcta' : ''}`}>
                    <input type="radio" name={`tp-${codigo}-${i}`} checked={resp[i] === o} disabled={revisado}
                      onChange={() => setResp({ ...resp, [i]: o })} />
                    {o}
                  </label>
                ))}
              </div>
              {revisado && <p className="tp-porque">{q.porque}</p>}
            </li>
          );
        })}
      </ol>
      <div className="pr-acciones">
        {!revisado ? (
          <button type="button" className="pr-boton pr-primario" onClick={revisar} disabled={Object.keys(resp).length < caso.preguntas.length}>Revisar</button>
        ) : (
          <button type="button" className="pr-boton pr-primario" onClick={() => cambiar(nuevoCodigo())}>Nuevo escenario</button>
        )}
      </div>
      {revisado && (
        <p className={`pr-msg ${bien === caso.preguntas.length ? 'ok' : 'mal'}`}>
          <strong>{bien} de {caso.preguntas.length} correctas.</strong>
          {bien === caso.preguntas.length ? 'Lees diagramas con soltura.' : 'Revisa las explicaciones y prueba otro escenario.'}
        </p>
      )}
    </Escenario>
  );
}
