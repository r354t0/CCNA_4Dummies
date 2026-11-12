import { useMemo, useState, type ReactNode } from 'react';
import { Azar, nuevoCodigo } from '../../lib/azar';
import { Switch, configInicial, type Config } from '../../lib/ios/motor';
import { ipconfigPT, pingPC } from '../../lib/ios/salidas';
import Topologia from '../Topologia';
import Escenario, { useCodigo, registrarLogro } from './Escenario';
import './practica.css';

type Falla = 'gw-pc' | 'mascara' | 'otra-red' | 'puerto' | 'svi' | 'gw-sw' | 'apipa' | 'login-con' | 'vty-sin-clave' | 'enable';

const CAUSA: Record<Falla, string> = {
  'gw-pc': 'PC-A tiene mal configurado el gateway predeterminado.',
  mascara: 'PC-A tiene una máscara de subred incorrecta.',
  'otra-red': 'PC-A tiene una dirección IP de otra red.',
  puerto: 'El puerto del switch donde está conectada PC-A está apagado (shutdown).',
  svi: 'La SVI de S1 (interface vlan 1) está apagada.',
  'gw-sw': 'S1 no tiene configurado el gateway predeterminado (ip default-gateway).',
  apipa: 'PC-A no obtuvo dirección del servidor DHCP y se asignó una dirección APIPA.',
  'login-con': 'A la línea de consola de S1 le falta el comando login.',
  'vty-sin-clave': 'Las líneas VTY de S1 tienen login, pero no tienen contraseña.',
  enable: 'S1 tiene un enable secret, que tiene prioridad sobre el enable password.',
};

const GRUPOS: Falla[][] = [
  ['gw-pc', 'mascara', 'otra-red', 'puerto', 'apipa'],
  ['svi', 'gw-sw', 'puerto', 'gw-pc'],
  ['login-con', 'vty-sin-clave', 'enable', 'svi'],
];

interface Evidencia { titulo: string; texto: string; clave?: string }

export function generar(codigo: string) {
  const az = new Azar(codigo, 'diagnostico');
  const falla = az.elegir<Falla>(['gw-pc', 'mascara', 'otra-red', 'puerto', 'svi', 'gw-sw', 'apipa', 'login-con', 'vty-sin-clave', 'enable']);
  const n = az.entero(2, 250);
  const red = `192.168.${n}`;
  const gw = `${red}.1`;
  const sw = `${red}.${az.entero(2, 9)}`;
  const pcB = `${red}.${az.entero(20, 40)}`;
  let pcA = `${red}.${az.entero(41, 60)}`;
  const srv = `172.${az.entero(16, 31)}.${az.entero(1, 250)}.${az.entero(10, 60)}`;
  const admin = `10.${az.entero(1, 250)}.${az.entero(1, 250)}.0/24`;
  const macA = az.mac();
  let mascaraA = '255.255.255.0';
  let gwA: string | null = gw;
  const pwEnable = `${az.elegir(['Clase', 'Admin', 'Redes'])}${az.entero(10, 99)}`;

  if (falla === 'gw-pc') gwA = `${red}.${az.elegir([254, 100, 2 === Number(sw.split('.')[3]) ? 3 : 2])}`;
  if (falla === 'mascara') { pcA = `${red}.${az.entero(66, 78)}`; mascaraA = '255.255.255.240'; }
  if (falla === 'otra-red') pcA = `192.168.${n === 250 ? 249 : n + 1}.${az.entero(41, 60)}`;
  if (falla === 'apipa') { pcA = `169.254.${az.entero(1, 254)}.${az.entero(1, 254)}`; mascaraA = '255.255.0.0'; gwA = null; }

  // Configuración de S1
  const c: Config = configInicial();
  c.hostname = 'S1';
  c.domainLookup = false;
  c.spe = true;
  c.enableSecret = 'Secreto' + az.entero(100, 999);
  c.banner = 'Solo personal autorizado';
  c.con = { password: 'Cons' + az.entero(10, 99), login: true, loggingSync: true };
  c.vty = [{ password: 'Remoto' + az.entero(10, 99), login: true, loggingSync: false }, { password: '', login: true, loggingSync: false }];
  c.vty[1].password = c.vty[0].password;
  const v = c.ifs.find((i) => i.nombre === 'Vlan1')!;
  v.ip = sw; v.mascara = '255.255.255.0'; v.shutdown = false;
  c.gateway = gw;
  if (falla === 'puerto') c.ifs.find((i) => i.nombre === 'FastEthernet0/1')!.shutdown = true;
  if (falla === 'svi') v.shutdown = true;
  if (falla === 'gw-sw') c.gateway = undefined;
  if (falla === 'login-con') c.con.login = false;
  if (falla === 'vty-sin-clave') c.vty.forEach((l) => { l.password = undefined; });
  if (falla === 'enable') c.enablePassword = pwEnable;
  const motor = new Switch({ config: c, conectados: ['FastEthernet0/1', 'FastEthernet0/2', 'GigabitEthernet0/1'] });

  // Alcanzabilidad desde PC-A
  const sinRed = ['mascara', 'otra-red', 'puerto', 'apipa'].includes(falla);
  const alcanza = {
    pcB: !sinRed,
    gw: !sinRed,
    sw: !sinRed && falla !== 'svi',
    srv: !sinRed && falla !== 'gw-pc',
  };

  const reporte: Record<Falla, string> = {
    'gw-pc': `Desde PC-A no se llega al servidor ${srv} ni a Internet, pero sí se comparten archivos con PC-B.`,
    mascara: 'PC-A no se comunica con ningún equipo: ni con PC-B ni con el servidor.',
    'otra-red': 'PC-A no se comunica con ningún equipo: ni con PC-B ni con el servidor.',
    puerto: 'PC-A no se comunica con ningún equipo: ni con PC-B ni con el servidor.',
    apipa: 'PC-A no se comunica con ningún equipo: ni con PC-B ni con el servidor.',
    svi: 'Las PC funcionan bien, pero nadie puede hacer ping ni conectarse por Telnet a S1.',
    'gw-sw': `Desde la red de administración (${admin}) no se llega a S1. Desde PC-A, en cambio, S1 responde.`,
    'login-con': 'Cualquiera que conecta un cable de consola a S1 entra directo, sin que le pidan contraseña, aunque se configuró una.',
    'vty-sin-clave': 'Al hacer Telnet a S1 aparece «Password required, but none set» y la conexión se cierra.',
    enable: `El técnico anterior dejó anotada la contraseña de enable «${pwEnable}», pero S1 no la acepta.`,
  };

  const pings = [
    pingPC(pcB, alcanza.pcB, true),
    pingPC(gw, alcanza.gw, true),
    pingPC(sw, alcanza.sw, true),
    pingPC(srv, alcanza.srv),
  ].join('\n\n');

  const evidencias: Evidencia[] = [
    { titulo: 'PC-A: ipconfig', texto: ipconfigPT(pcA, mascaraA, gwA, macA) },
    { titulo: 'PC-A: ping', texto: pings },
    { titulo: 'S1: show ip interface brief', texto: ['S1#show ip interface brief', ...motor.ipIntBrief().filter((l) => !/FastEthernet0\/([4-9]|1\d|2\d) /.test(l))].join('\n').replace(/\n(FastEthernet0\/3 .*)/, '\n$1\n…') },
    { titulo: 'S1: show running-config', texto: 'S1#show running-config\n' + motor.runningConfig().split('\n').filter((l, i, arr) => !(/^interface FastEthernet0\/([3-9]|1\d|2\d)$/.test(l) || (l === '!' && /^interface FastEthernet0\/([3-9]|1\d|2\d)$/.test(arr[i - 1] ?? '')))).join('\n') },
  ];

  // Pistas: qué línea de qué evidencia muestra la causa
  const prueba: Record<Falla, { ev: number; buscar: RegExp; explica: string; arreglo: string }> = {
    'gw-pc': { ev: 0, buscar: new RegExp(`^\\s+${gwA?.replace(/\./g, '\\.')}$`, 'm'), explica: `El gateway de PC-A es ${gwA}, pero el router está en ${gw}. PC-A llega a su red (PC-B, S1 y hasta ${gw} responden), pero envía lo que va a otras redes a una dirección que no es el router.`, arreglo: `En PC-A: Default Gateway ${gw}.` },
    mascara: { ev: 0, buscar: /Subnet Mask.*255\.255\.255\.240/, explica: `Con la máscara /28, PC-A (${pcA}) cree estar en una subred pequeña donde no están ni PC-B, ni S1, ni su gateway ${gw}.`, arreglo: 'En PC-A: máscara 255.255.255.0.' },
    'otra-red': { ev: 0, buscar: /IPv4 Address.*/, explica: `PC-A tiene ${pcA}, de la red 192.168.${n === 250 ? 249 : n + 1}.0/24, pero el resto de la LAN y el gateway están en ${red}.0/24.`, arreglo: `En PC-A: una IP libre de ${red}.0/24, por ejemplo ${red}.${az.entero(61, 90)}.` },
    puerto: { ev: 2, buscar: /^FastEthernet0\/1 .*administratively down.*$/m, explica: 'El puerto F0/1, donde está PC-A, tiene shutdown: aparece como administratively down. La configuración IP de PC-A es correcta.', arreglo: 'S1(config)# interface f0/1\nS1(config-if)# no shutdown' },
    svi: { ev: 2, buscar: /^Vlan1 .*administratively down.*$/m, explica: 'La Vlan1 de S1 tiene shutdown. El switch sigue conmutando tramas entre las PC, pero su IP de administración no responde.', arreglo: 'S1(config)# interface vlan 1\nS1(config-if)# no shutdown' },
    'gw-sw': { ev: 3, buscar: /^interface Vlan1\n ip address.*$/m, explica: `S1 tiene IP pero no tiene ip default-gateway. Responde a equipos de su propia red, pero no sabe a dónde enviar las respuestas para ${admin}.`, arreglo: `S1(config)# ip default-gateway ${gw}` },
    apipa: { ev: 0, buscar: /IPv4 Address.*169\.254.*/, explica: 'PC-A tiene una dirección 169.254.x.x con máscara /16 y sin gateway: es APIPA. Pidió dirección por DHCP y nadie le respondió.', arreglo: 'Revisar el servidor DHCP o configurar PC-A con una IP estática válida.' },
    'login-con': { ev: 3, buscar: /^line con 0\n(?: .*\n)*?(?=!)/m, explica: 'La línea de consola tiene password pero no tiene login: la contraseña existe, pero nunca se pide.', arreglo: 'S1(config)# line console 0\nS1(config-line)# login' },
    'vty-sin-clave': { ev: 3, buscar: /^line vty 0 4\n login$/m, explica: 'Las líneas VTY tienen login pero no password. IOS rechaza la conexión remota con «Password required, but none set».', arreglo: 'S1(config)# line vty 0 15\nS1(config-line)# password …\nS1(config-line)# login' },
    enable: { ev: 3, buscar: /^enable (secret|password).*$/gm, explica: `Hay dos contraseñas de enable. Cuando existe enable secret, IOS ignora enable password: la de «${pwEnable}» nunca sirve.`, arreglo: 'S1(config)# no enable password\n(y usar la contraseña del enable secret, o cambiarla con enable secret …)' },
  };

  const grupo = GRUPOS.find((g) => g.includes(falla))!;
  const distractores = az.mezclar([...new Set([...az.mezclar(grupo), ...az.mezclar(Object.keys(CAUSA) as Falla[])])].filter((f) => f !== falla)).slice(0, 3);
  const opciones = az.mezclar([falla, ...distractores]);

  return { falla, reporte: reporte[falla], evidencias, prueba: prueba[falla], opciones, datos: { red, gw, sw, pcA, pcB, srv } };
}

function Resaltar({ texto, buscar }: { texto: string; buscar?: RegExp }) {
  if (!buscar) return <>{texto}</>;
  const re = new RegExp(buscar.source, buscar.flags.includes('g') ? buscar.flags : buscar.flags + 'g');
  const partes: (string | ReactNode)[] = [];
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(texto)) && m[0]) {
    partes.push(texto.slice(ultimo, m.index));
    partes.push(<mark key={k++} className="rs">{m[0]}</mark>);
    ultimo = m.index + m[0].length;
  }
  partes.push(texto.slice(ultimo));
  return <>{partes}</>;
}

export default function Diagnostico() {
  const [codigo, setCodigo] = useCodigo();
  const caso = useMemo(() => (codigo ? generar(codigo) : null), [codigo]);
  const [tab, setTab] = useState(0);
  const [elegida, setElegida] = useState<Falla | null>(null);
  const [vistas, setVistas] = useState<Set<number>>(new Set([0]));
  if (!codigo || !caso) return null;
  const revisado = elegida !== null;
  const acierto = elegida === caso.falla;

  const cambiar = (c: string) => { setCodigo(c); setTab(0); setElegida(null); setVistas(new Set([0])); };
  const elegir = (f: Falla) => { setElegida(f); if (f === caso.falla) registrarLogro('diagnostico'); setTab(caso.prueba.ev); };
  const ver = (i: number) => { setTab(i); setVistas(new Set([...vistas, i])); };
  const d = caso.datos;

  return (
    <Escenario id="diagnostico" codigo={codigo} alCambiar={cambiar}>
      <div className="dg-reporte">
        <span className="dg-ticket">Ticket</span>
        <p>{caso.reporte}</p>
      </div>
      <Topologia
        ancho={720} alto={280} titulo="Topología del escenario"
        nodos={[
          { id: 'PC-A', tipo: 'pc', x: 70, y: 210, detalle: 'Ver ipconfig' },
          { id: 'PC-B', tipo: 'pc', x: 230, y: 210, detalle: d.pcB },
          { id: 'S1', tipo: 'switch', x: 150, y: 85, detalle: `Vlan1 ${d.sw}`, lado: 'arriba' },
          { id: 'R1', tipo: 'router', x: 420, y: 85, detalle: `G0/0/0 ${d.gw}`, lado: 'abajo' },
          { id: 'Servidor', tipo: 'servidor', x: 640, y: 85, detalle: d.srv, lado: 'abajo' },
        ]}
        enlaces={[
          { a: 'S1', b: 'PC-A', ia: 'F0/1' },
          { a: 'S1', b: 'PC-B', ia: 'F0/2' },
          { a: 'S1', b: 'R1', ia: 'G0/1', ib: 'G0/0/0' },
          { a: 'R1', b: 'Servidor', tipo: 'serial', marca: 'WAN' },
        ]}
      />
      <p className="dg-instr">Revisa la evidencia. Cada pestaña es la salida de un comando; la causa está en alguna de ellas.</p>
      <div className="dg-tabs" role="tablist" aria-label="Evidencia">
        {caso.evidencias.map((e, i) => (
          <button key={i} type="button" role="tab" aria-selected={tab === i} className={vistas.has(i) ? 'vista' : ''} onClick={() => ver(i)}>
            {e.titulo}
          </button>
        ))}
      </div>
      <pre className="pr-salida dg-salida" role="tabpanel">
        <Resaltar texto={caso.evidencias[tab].texto} buscar={revisado && tab === caso.prueba.ev ? caso.prueba.buscar : undefined} />
      </pre>

      <fieldset className="dg-opciones" disabled={revisado}>
        <legend className="pr-pregunta">¿Cuál es la causa del problema?</legend>
        {caso.opciones.map((f) => (
          <label key={f} className={`ev-opcion ${revisado && f === caso.falla ? 'ok' : revisado && f === elegida ? 'mal' : ''}`}>
            <input type="radio" name={`dg-${codigo}`} checked={elegida === f} onChange={() => elegir(f)} />
            <span>{CAUSA[f]}</span>
          </label>
        ))}
      </fieldset>

      {revisado && (
        <div className={`pr-msg ${acierto ? 'ok' : 'mal'}`}>
          <strong>{acierto ? 'Diagnóstico correcto.' : `No. La causa es: ${CAUSA[caso.falla]}`}</strong>
          <p className="dg-explica">{caso.prueba.explica} La evidencia está resaltada en «{caso.evidencias[caso.prueba.ev].titulo}».</p>
          <p className="dg-explica"><strong>Cómo se corrige</strong></p>
          <pre className="dg-arreglo">{caso.prueba.arreglo}</pre>
        </div>
      )}
      <div className="pr-acciones">
        {revisado && <button type="button" className="pr-boton pr-primario" onClick={() => cambiar(nuevoCodigo())}>Siguiente caso</button>}
        {!revisado && <span className="pr-marcador">Revisaste {vistas.size} de {caso.evidencias.length} salidas.</span>}
      </div>
    </Escenario>
  );
}
