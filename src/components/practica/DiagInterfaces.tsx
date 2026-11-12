import { Azar } from '../../lib/azar';
import { showInterfaces, ipIntBrief, type ContadoresIf, type FilaIf } from '../../lib/ios/salidasSwitching';
import MarcoDiagnostico, { opcionesDe, type CasoDiagnostico } from './MarcoDiagnostico';

type Falla = 'duplex' | 'cable' | 'runts' | 'shutdown' | 'desconectado' | 'velocidad' | 'r-shutdown' | 'ipv6';

const CAUSA: Record<Falla, string> = {
  duplex: 'Desajuste de dúplex en el enlace S1–S2: S2 tiene el dúplex fijo y S1 negoció semidúplex.',
  cable: 'El cable del enlace S1–S2 está dañado o recibe interferencia.',
  runts: 'Una NIC o un puerto defectuoso del otro extremo envía tramas demasiado cortas.',
  shutdown: 'El puerto de S1 hacia S2 está apagado con shutdown.',
  desconectado: 'No hay enlace físico entre S1 y S2: el cable está desconectado o roto.',
  velocidad: 'Desajuste de velocidad: los dos extremos tienen velocidades fijas distintas y el enlace no se levanta.',
  'r-shutdown': 'La interfaz de R1 hacia la LAN está apagada (shutdown).',
  ipv6: 'R1 no tiene ipv6 unicast-routing: no envía anuncios de router (RA).',
};
const GRUPOS: Falla[][] = [
  ['duplex', 'cable', 'runts', 'velocidad'],
  ['shutdown', 'desconectado', 'velocidad', 'r-shutdown'],
  ['r-shutdown', 'ipv6', 'shutdown'],
];

export function generar(codigo: string): CasoDiagnostico {
  const az = new Azar(codigo, 'diag-interfaces');
  const falla = az.elegir(Object.keys(CAUSA) as Falla[]);
  const enlace = az.elegir(['Fa0/24', 'Gi0/1', 'Gi0/2']);
  const largo = enlace.startsWith('Gi') ? `GigabitEthernet0/${enlace.slice(-1)}` : 'FastEthernet0/24';
  const gigabit = enlace.startsWith('Gi');
  const red = `192.168.${az.entero(10, 99)}`;
  const mac = az.mac().toLowerCase();
  const vel = gigabit ? '1000' : '100';

  const sano: ContadoresIf = { estado: 'up', protocolo: 'up', duplex: 'Full', velocidad: vel, runts: 0, giants: 0, crc: 0, colisiones: 0, tardias: 0, entrada: 0, salida: 0, descripcion: 'Enlace a S2' };
  let c: ContadoresIf = { ...sano };
  let s1Config = [`interface ${largo}`, ' description Enlace a S2'];
  let s2Config = [`interface ${largo}`, ' description Enlace a S1'];
  if (falla === 'duplex') { c = { ...c, duplex: 'Half', velocidad: '100', colisiones: az.entero(800, 4000), tardias: az.entero(120, 900) }; s2Config.push(' duplex full', ' speed 100'); }
  if (falla === 'cable') c = { ...c, crc: az.entero(900, 6000), runts: az.entero(0, 4) };
  if (falla === 'runts') c = { ...c, runts: az.entero(1500, 7000), crc: az.entero(10, 60) };
  if (falla === 'shutdown') { c = { ...c, estado: 'administratively down', protocolo: 'down' }; s1Config.push(' shutdown'); }
  if (falla === 'desconectado') c = { ...c, estado: 'down', protocolo: 'down' };
  if (falla === 'velocidad') {
    c = { ...c, estado: 'down', protocolo: 'down' };
    s1Config.push(' duplex full', ' speed 10');
    s2Config.push(' duplex full', ' speed 100');
  }
  const corta = largo.replace('GigabitEthernet', 'GigabitEthernet').replace('FastEthernet', 'FastEthernet');

  const filasS1: FilaIf[] = [
    { nombre: 'FastEthernet0/1', estado: 'up', protocolo: 'up' },
    { nombre: 'FastEthernet0/2', estado: 'down', protocolo: 'down' },
    { nombre: corta, estado: c.estado, protocolo: c.protocolo },
    { nombre: 'Vlan1', ip: `${red}.2`, estado: 'up', protocolo: 'up' },
  ];
  const rShut = falla === 'r-shutdown';
  const filasR1: FilaIf[] = [
    { nombre: 'GigabitEthernet0/0/0', ip: `209.165.${az.entero(200, 220)}.1`, estado: 'up', protocolo: 'up' },
    { nombre: 'GigabitEthernet0/0/1', ip: `${red}.1`, estado: rShut ? 'administratively down' : 'up', protocolo: rShut ? 'down' : 'up' },
    { nombre: 'Serial0/1/0', estado: 'administratively down', protocolo: 'down' },
    { nombre: 'Loopback0', ip: '10.0.0.1', estado: 'up', protocolo: 'up' },
  ];
  const hex = az.entero(10, 99);
  const ipv6If = [
    'R1#show ipv6 interface gigabitEthernet 0/0/1',
    `GigabitEthernet0/0/1 is ${rShut ? 'administratively down' : 'up'}, line protocol is ${rShut ? 'down' : 'up'}`,
    '  IPv6 is enabled, link-local address is FE80::1',
    '  No Virtual link-local address(es):',
    '  Global unicast address(es):',
    `    2001:DB8:ACAD:${hex}::1, subnet is 2001:DB8:ACAD:${hex}::/64`,
    '  Joined group address(es):',
    '    FF02::1',
    ...(falla === 'ipv6' ? [] : ['    FF02::2']),
    '    FF02::1:FF00:1',
    '  MTU is 1500 bytes',
    '  ICMP error messages limited to one every 100 milliseconds',
    ...(falla === 'ipv6' ? [] : ['  ND router advertisements are sent every 200 seconds', '  ND router advertisements live for 1800 seconds']),
    '  Hosts use stateless autoconfig for addresses.',
  ].join('\n');

  const evidencias = [
    { titulo: 'S1: show ip interface brief', texto: ipIntBrief('S1', filasS1) },
    { titulo: `S1: show interfaces ${enlace}`, texto: `S1#show interfaces ${enlace}\n` + showInterfaces(largo, mac.replace(/(....)\.(....)\.(....)/, '$1.$2.$3'), c, gigabit) },
    { titulo: `S1 y S2: configuración de ${enlace}`, texto: `S1#show running-config interface ${enlace}\n${s1Config.join('\n')}\n!\n\nS2#show running-config interface ${enlace}\n${s2Config.join('\n')}\n!` },
    { titulo: 'R1: show ip interface brief', texto: ipIntBrief('R1', filasR1) },
    { titulo: 'R1: show ipv6 interface G0/0/1', texto: ipv6If },
  ];

  const reporte: Record<Falla, string> = {
    duplex: 'Los usuarios conectados a S2 dicen que la red funciona, pero muy lenta, sobre todo cuando copian archivos al servidor.',
    cable: 'Los usuarios de S2 tienen cortes intermitentes y lentitud. El técnico de turno dice que el cableado del rack está viejo.',
    runts: 'La red de S2 está lenta. En el monitoreo se ve una gran cantidad de errores de entrada en el enlace con S1.',
    shutdown: 'Ningún equipo conectado a S2 tiene acceso a la red. Ayer hubo un cambio de configuración en S1.',
    desconectado: 'Ningún equipo conectado a S2 tiene acceso a la red. Esta mañana movieron muebles en el cuarto de comunicaciones.',
    velocidad: 'Se cambió la configuración del enlace entre S1 y S2 para «optimizarlo» y desde entonces los equipos de S2 no tienen red.',
    'r-shutdown': 'Ningún equipo de la LAN sale a Internet ni llega a su gateway. Los equipos sí se comunican entre ellos.',
    ipv6: 'Los equipos de la LAN tienen IPv4, pero no obtienen una dirección IPv6 global por SLAAC: solo tienen link-local.',
  };

  const prueba: Record<Falla, CasoDiagnostico['prueba']> = {
    duplex: { ev: 1, buscar: /Half-duplex|\d+ late collision/, explica: `S1 está en semidúplex y acumula colisiones tardías. En S2 el puerto está fijo en duplex full: S1 no recibe respuesta a la negociación y cae a semidúplex.`, arreglo: `S2(config)# interface ${enlace}\nS2(config-if)# duplex auto\nS2(config-if)# speed auto\n(o fijar los dos extremos igual)` },
    cable: { ev: 1, buscar: /\d+ input errors, \d+ CRC/, explica: 'La interfaz está up/up y en dúplex completo, pero los errores CRC son muy altos: las tramas llegan dañadas. Es un problema del medio.', arreglo: 'Reemplazar el cable, revisar los conectores y alejarlo de fuentes de interferencia. Luego clear counters y volver a medir.' },
    runts: { ev: 1, buscar: /\d+ runts/, explica: 'Hay miles de runts (tramas de menos de 64 bytes) con el dúplex correcto. La causa típica es una NIC o un puerto defectuoso del otro extremo.', arreglo: 'Probar con otro puerto o reemplazar el equipo o la NIC del otro extremo.' },
    shutdown: { ev: 0, buscar: new RegExp(`^${corta}.*administratively down.*$`, 'm'), explica: `El puerto ${enlace} de S1 está administratively down: alguien lo apagó.`, arreglo: `S1(config)# interface ${enlace}\nS1(config-if)# no shutdown` },
    desconectado: { ev: 1, buscar: /is down, line protocol is down \(notconnect\)/, explica: 'La interfaz está down/down (notconnect) y la configuración de los dos extremos es correcta y coincide: no hay señal física.', arreglo: 'Revisar y volver a conectar el cable entre S1 y S2, o reemplazarlo.' },
    velocidad: { ev: 2, buscar: / speed (10|100)$/m, explica: `S1 está fijo en speed 10 y S2 en speed 100. Con velocidades distintas el enlace no se levanta: down/down.`, arreglo: `S1(config)# interface ${enlace}\nS1(config-if)# speed auto\nS1(config-if)# duplex auto\n(y lo mismo en S2)` },
    'r-shutdown': { ev: 3, buscar: /^GigabitEthernet0\/0\/1 .*administratively down.*$/m, explica: 'La interfaz de R1 hacia la LAN está apagada. Los equipos se comunican entre ellos a través de los switches, pero su gateway no responde.', arreglo: 'R1(config)# interface g0/0/1\nR1(config-if)# no shutdown' },
    ipv6: { ev: 4, buscar: /Joined group address\(es\):\n {4}FF02::1\n/, explica: 'La interfaz tiene su IPv6 global, pero no se unió al grupo FF02::2 (todos los routers) ni envía anuncios RA. Falta ipv6 unicast-routing, así que los hosts no reciben el prefijo para SLAAC.', arreglo: 'R1(config)# ipv6 unicast-routing' },
  };

  const grupo = GRUPOS.find((g) => g.includes(falla))!;
  return {
    reporte: reporte[falla],
    topologia: {
      ancho: 700, alto: 230, titulo: 'Red del ticket',
      nodos: [
        { id: 'R1', tipo: 'router', x: 90, y: 80, detalle: `G0/0/1 ${red}.1`, lado: 'abajo' },
        { id: 'S1', tipo: 'switch', x: 300, y: 80, detalle: `Vlan1 ${red}.2`, lado: 'abajo' },
        { id: 'S2', tipo: 'switch', x: 520, y: 80, lado: 'arriba' },
        { id: 'PC1', tipo: 'pc', x: 460, y: 185, lado: 'abajo' },
        { id: 'PC2', tipo: 'pc', x: 600, y: 185, lado: 'abajo' },
      ],
      enlaces: [
        { a: 'R1', b: 'S1', ia: 'G0/0/1', ib: 'F0/1' },
        { a: 'S1', b: 'S2', ia: enlace.replace('Fa', 'F').replace('Gi', 'G'), ib: enlace.replace('Fa', 'F').replace('Gi', 'G'), resaltado: true },
        { a: 'S2', b: 'PC1' },
        { a: 'S2', b: 'PC2' },
      ],
    },
    evidencias,
    opciones: opcionesDe(az, falla, CAUSA, grupo),
    correcta: falla,
    prueba: prueba[falla],
  };
}

export default function DiagInterfaces() {
  return <MarcoDiagnostico id="diag-interfaces" generar={generar} />;
}
