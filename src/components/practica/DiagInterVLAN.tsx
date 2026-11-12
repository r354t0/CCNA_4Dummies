import { Azar } from '../../lib/azar';
import { ipconfigPT, pingPC } from '../../lib/ios/salidas';
import { ipIntBrief, showVlanBrief, showIntTrunk, rangoVlan, type FilaIf } from '../../lib/ios/salidasSwitching';
import MarcoDiagnostico, { opcionesDe, type CasoDiagnostico } from './MarcoDiagnostico';

type Falla =
  | 'vlan-faltante' | 'troncal' | 'permitidas' | 'acceso' | 'encap' | 'subif-ip' | 'fisica' | 'gw-pc'
  | 'ip-routing' | 'svi-shutdown';

const ROAS: Falla[] = ['vlan-faltante', 'troncal', 'permitidas', 'acceso', 'encap', 'subif-ip', 'fisica', 'gw-pc'];
const L3: Falla[] = ['ip-routing', 'svi-shutdown', 'acceso', 'gw-pc', 'vlan-faltante'];

export function generar(codigo: string): CasoDiagnostico {
  const az = new Azar(codigo, 'diag-intervlan');
  const modo = az.probabilidad(0.65) ? 'roas' : 'l3';
  const falla = az.elegir(modo === 'roas' ? ROAS : L3);
  const [va, vb] = az.elegir([[10, 20], [10, 30], [20, 30], [100, 200], [11, 22]]);
  const nombres: Record<number, string> = { 10: 'ventas', 20: 'contabilidad', 30: 'docentes', 100: 'oficina', 200: 'bodega', 11: 'alumnos', 22: 'profesores' };
  const ra = `192.168.${va}`, rb = `192.168.${vb}`;
  const pa = `Fa0/${az.entero(2, 8)}`, pb = `Fa0/${az.entero(11, 20)}`;
  const pc1 = `${ra}.${az.entero(10, 50)}`, pc2 = `${rb}.${az.entero(10, 50)}`;
  const gw1 = `${ra}.1`, gw2 = `${rb}.1`;
  const sw = modo === 'roas' ? 'S1' : 'D1';
  const rt = modo === 'roas' ? 'R1' : 'D1';
  const uplink = 'Gi0/1';

  // Estado configurado
  const vlansCreadas = falla === 'vlan-faltante' ? [va] : [va, vb];
  const asignacion: Record<string, number> = { [pa]: va, [pb]: falla === 'acceso' ? az.elegir([1, va]) : vb };
  const esTroncal = modo === 'roas' && falla !== 'troncal';
  if (modo === 'roas' && !esTroncal) asignacion[uplink] = 1;
  const permitidas = falla === 'permitidas' ? [1, va] : null; // null = todas
  const encapB = falla === 'encap' ? az.elegir([vb + 1, vb * 10, va]) : vb;
  const ipSubB = falla === 'subif-ip' ? `192.168.${vb + 1}.1` : gw2;
  const fisicaUp = falla !== 'fisica';
  const gwPc2 = falla === 'gw-pc' ? az.elegir([`${rb}.254`, gw1, `${rb}.100`]) : gw2;
  const sviBUp = falla !== 'svi-shutdown' && falla !== 'vlan-faltante';
  const ipRouting = falla !== 'ip-routing';

  // Alcance desde PC2 (la VLAN con la falla)
  const pc2EnVlan = falla !== 'acceso' && falla !== 'vlan-faltante';
  let llegaGw: boolean, llegaPc1: boolean;
  if (modo === 'roas') {
    const camino = pc2EnVlan && esTroncal && falla !== 'permitidas' && fisicaUp && encapB === vb;
    llegaGw = camino && ipSubB === gw2;
    llegaPc1 = llegaGw && gwPc2 === gw2;
  } else {
    llegaGw = pc2EnVlan && sviBUp;
    llegaPc1 = llegaGw && gwPc2 === gw2 && ipRouting;
  }

  const evidencias: CasoDiagnostico['evidencias'] = [
    { titulo: 'PC2: ipconfig', texto: ipconfigPT(pc2, '255.255.255.0', gwPc2, az.mac()) },
    { titulo: 'PC2: ping', texto: [pingPC(gw2, llegaGw, true), pingPC(pc1, llegaPc1, true)].join('\n\n') },
  ];
  const vlanLista = vlansCreadas.map((v) => ({ id: v, nombre: nombres[v] }));
  // Puertos de una VLAN inexistente no aparecen
  const asignVisible = Object.fromEntries(Object.entries(asignacion).filter(([, v]) => v === 1 || vlansCreadas.includes(v)));
  const troncales = esTroncal ? [uplink] : [];
  evidencias.push({ titulo: `${sw}: show vlan brief`, texto: showVlanBrief(sw, vlanLista, asignVisible, troncales) });

  if (modo === 'roas') {
    const perm = permitidas ? rangoVlan(permitidas) : '1-4094';
    const activas = rangoVlan([1, ...vlansCreadas].filter((v) => !permitidas || permitidas.includes(v)));
    evidencias.push({ titulo: 'S1: show interfaces trunk', texto: showIntTrunk('S1', esTroncal ? [{ puerto: uplink, modo: 'on', nativa: 1, permitidas: perm, activas }] : []) });
    const est = (up: boolean): Pick<FilaIf, 'estado' | 'protocolo'> => (fisicaUp ? { estado: up ? 'up' : 'down', protocolo: up ? 'up' : 'down' } : { estado: 'administratively down', protocolo: 'down' });
    evidencias.push({
      titulo: 'R1: show ip interface brief',
      texto: ipIntBrief('R1', [
        { nombre: 'GigabitEthernet0/0/0', estado: 'administratively down', protocolo: 'down' },
        { nombre: 'GigabitEthernet0/0/1', ...est(true) },
        { nombre: `GigabitEthernet0/0/1.${va}`, ip: gw1, ...est(true) },
        { nombre: `GigabitEthernet0/0/1.${vb}`, ip: ipSubB, ...est(true) },
      ]),
    });
    evidencias.push({
      titulo: 'R1: show running-config (interfaces)',
      texto: [
        'R1#show running-config | section interface GigabitEthernet0/0/1',
        'interface GigabitEthernet0/0/1',
        ' no ip address',
        ...(fisicaUp ? [] : [' shutdown']),
        ' duplex auto',
        ' speed auto',
        `interface GigabitEthernet0/0/1.${va}`,
        ` description Gateway ${nombres[va]}`,
        ` encapsulation dot1Q ${va}`,
        ` ip address ${gw1} 255.255.255.0`,
        `interface GigabitEthernet0/0/1.${vb}`,
        ` description Gateway ${nombres[vb]}`,
        ` encapsulation dot1Q ${encapB}`,
        ` ip address ${ipSubB} 255.255.255.0`,
      ].join('\n'),
    });
  } else {
    evidencias.push({
      titulo: 'D1: show ip interface brief',
      texto: ipIntBrief('D1', [
        { nombre: 'GigabitEthernet1/0/1', ip: '10.10.10.2', estado: 'up', protocolo: 'up' },
        { nombre: `Vlan${va}`, ip: gw1, estado: 'up', protocolo: 'up' },
        { nombre: `Vlan${vb}`, ip: gw2, estado: falla === 'svi-shutdown' ? 'administratively down' : sviBUp ? 'up' : 'down', protocolo: sviBUp ? 'up' : 'down' },
      ]),
    });
    evidencias.push({
      titulo: 'D1: show running-config (enrutamiento)',
      texto: [
        'D1#show running-config | include routing',
        ...(ipRouting ? ['ip routing'] : []),
        'ipv6 unicast-routing',
        '',
        `D1#show running-config | section interface Vlan`,
        `interface Vlan${va}`,
        ` ip address ${gw1} 255.255.255.0`,
        `interface Vlan${vb}`,
        ` ip address ${gw2} 255.255.255.0`,
        ...(falla === 'svi-shutdown' ? [' shutdown'] : []),
      ].join('\n'),
    });
  }

  const textos: Record<Falla, string> = {
    'vlan-faltante': `La VLAN ${vb} no existe en ${sw}.`,
    troncal: 'El puerto de S1 hacia R1 no está configurado como troncal.',
    permitidas: `La troncal de S1 hacia R1 no permite la VLAN ${vb}.`,
    acceso: `El puerto de PC2 (${pb}) no está asignado a la VLAN ${vb}.`,
    encap: `La subinterfaz G0/0/1.${vb} de R1 tiene la VLAN equivocada en encapsulation dot1Q.`,
    'subif-ip': `La subinterfaz G0/0/1.${vb} de R1 tiene una dirección IP de otra red.`,
    fisica: 'La interfaz física G0/0/1 de R1 está apagada.',
    'gw-pc': 'PC2 tiene mal configurado el gateway predeterminado.',
    'ip-routing': 'D1 no tiene activado el enrutamiento IPv4 (ip routing).',
    'svi-shutdown': `La SVI de la VLAN ${vb} de D1 está apagada.`,
  };
  const disponibles = Object.fromEntries((modo === 'roas' ? ROAS : L3).map((k) => [k, textos[k]])) as Record<Falla, string>;

  const reporte = falla === 'gw-pc' || falla === 'ip-routing'
    ? `PC2 (VLAN ${vb}) llega a su gateway, pero no puede comunicarse con PC1 (VLAN ${va}).`
    : `PC2 (VLAN ${vb}) no responde al ping de su gateway ni puede comunicarse con PC1 (VLAN ${va}).`;

  const idx = (t: string) => evidencias.findIndex((e) => e.titulo.includes(t));
  const prueba: Record<Falla, CasoDiagnostico['prueba']> = {
    'vlan-faltante': { ev: idx('show vlan brief'), buscar: new RegExp(`^${va} .*$`, 'm'), explica: `En show vlan brief solo está la VLAN ${va}: la ${vb} no existe y ${pb} no aparece en ninguna VLAN (sus puertos quedan inactivos).`, arreglo: `${sw}(config)# vlan ${vb}\n${sw}(config-vlan)# name ${nombres[vb]}` },
    troncal: { ev: idx('trunk'), buscar: /show interfaces trunk/, explica: `show interfaces trunk no muestra ningún puerto, y en show vlan brief ${uplink} aparece como puerto de acceso de la VLAN 1. Las tramas etiquetadas no llegan a R1.`, arreglo: `S1(config)# interface ${uplink}\nS1(config-if)# switchport mode trunk` },
    permitidas: { ev: idx('trunk'), buscar: new RegExp(`^${uplink} +${rangoVlan([1, va])}$`, 'm'), explica: `La troncal solo permite ${rangoVlan([1, va])}: el tráfico de la VLAN ${vb} no pasa hacia R1.`, arreglo: `S1(config)# interface ${uplink}\nS1(config-if)# switchport trunk allowed vlan add ${vb}` },
    acceso: { ev: idx('show vlan brief'), buscar: new RegExp(`${pb.replace('/', '\\/')}(?=[,\\s]|$)`), explica: `${pb}, el puerto de PC2, está en la VLAN ${asignacion[pb]} en lugar de la ${vb}. PC2 queda en otro dominio de difusión y no ve a su gateway.`, arreglo: `${sw}(config)# interface ${pb}\n${sw}(config-if)# switchport mode access\n${sw}(config-if)# switchport access vlan ${vb}` },
    encap: { ev: idx('running-config'), buscar: new RegExp(` encapsulation dot1Q ${encapB}$`, 'm'), explica: `La subinterfaz .${vb} espera tramas de la VLAN ${encapB}, pero PC2 está en la VLAN ${vb}.`, arreglo: `R1(config)# interface g0/0/1.${vb}\nR1(config-subif)# encapsulation dot1Q ${vb}` },
    'subif-ip': { ev: idx('R1: show ip interface brief'), buscar: new RegExp(`^GigabitEthernet0/0/1\\.${vb} +${ipSubB.replace(/\./g, '\\.')}`, 'm'), explica: `La subinterfaz .${vb} tiene ${ipSubB}, que no es de la red ${rb}.0/24. El gateway de PC2 (${gw2}) no existe.`, arreglo: `R1(config)# interface g0/0/1.${vb}\nR1(config-subif)# ip address ${gw2} 255.255.255.0` },
    fisica: { ev: idx('R1: show ip interface brief'), buscar: /^GigabitEthernet0\/0\/1 .*administratively down.*$/m, explica: 'La interfaz física está apagada, y con ella todas sus subinterfaces. Aunque PC1 no se quejó, tampoco puede salir de su VLAN.', arreglo: 'R1(config)# interface g0/0/1\nR1(config-if)# no shutdown' },
    'gw-pc': { ev: 0, buscar: new RegExp(`^\\s+${gwPc2.replace(/\./g, '\\.')}$`, 'm'), explica: `El gateway de PC2 es ${gwPc2}, pero el de la VLAN ${vb} es ${gw2}. PC2 llega a ${gw2} si le hace ping, pero envía lo que va a otras redes a una dirección equivocada.`, arreglo: `En PC2: Default Gateway ${gw2}.` },
    'ip-routing': { ev: idx('enrutamiento'), buscar: /show running-config \| include routing\n(?!ip routing)/, explica: 'D1 tiene las SVI up, y cada PC llega a su gateway, pero falta ip routing: el switch no enruta entre sus SVI.', arreglo: 'D1(config)# ip routing' },
    'svi-shutdown': { ev: idx('D1: show ip interface brief'), buscar: new RegExp(`^Vlan${vb} .*administratively down.*$`, 'm'), explica: `La SVI Vlan${vb} está apagada: el gateway de la VLAN ${vb} no responde.`, arreglo: `D1(config)# interface vlan ${vb}\nD1(config-if)# no shutdown` },
  };

  const grupo: Falla[] = modo === 'roas'
    ? falla === 'encap' || falla === 'subif-ip' || falla === 'fisica' ? ['encap', 'subif-ip', 'fisica', 'troncal'] : ['vlan-faltante', 'troncal', 'permitidas', 'acceso', 'gw-pc']
    : L3;

  const topologia: CasoDiagnostico['topologia'] = modo === 'roas'
    ? {
        ancho: 640, alto: 310, titulo: 'Router-on-a-stick',
        nodos: [
          { id: 'R1', tipo: 'router', x: 320, y: 50, detalle: `Subinterfaces .${va} y .${vb}`, lado: 'derecha' },
          { id: 'S1', tipo: 'switch', x: 320, y: 175, lado: 'derecha' },
          { id: 'PC1', tipo: 'pc', x: 160, y: 250, detalle: `VLAN ${va} · ${pc1}`, lado: 'abajo' },
          { id: 'PC2', tipo: 'pc', x: 480, y: 250, detalle: `VLAN ${vb} · ${pc2}`, lado: 'abajo' },
        ],
        enlaces: [
          { a: 'R1', b: 'S1', ia: 'G0/0/1', ib: 'G0/1', marca: 'Troncal' },
          { a: 'S1', b: 'PC1', ia: pa.replace('Fa', 'F') },
          { a: 'S1', b: 'PC2', ia: pb.replace('Fa', 'F') },
        ],
      }
    : {
        ancho: 640, alto: 240, titulo: 'Switch de capa 3',
        nodos: [
          { id: 'D1', tipo: 'switch-l3', x: 320, y: 70, detalle: `Vlan${va} ${gw1}`, detalle2: `Vlan${vb} ${gw2}`, lado: 'derecha' },
          { id: 'PC1', tipo: 'pc', x: 160, y: 185, detalle: `VLAN ${va} · ${pc1}`, lado: 'abajo' },
          { id: 'PC2', tipo: 'pc', x: 480, y: 185, detalle: `VLAN ${vb} · ${pc2}`, lado: 'abajo' },
        ],
        enlaces: [
          { a: 'D1', b: 'PC1', ia: pa.replace('Fa', 'F') },
          { a: 'D1', b: 'PC2', ia: pb.replace('Fa', 'F') },
        ],
      };

  return { reporte, topologia, evidencias, opciones: opcionesDe(az, falla, disponibles, grupo), correcta: falla, prueba: prueba[falla] };
}

export default function DiagInterVLAN() {
  return <MarcoDiagnostico id="diag-intervlan" generar={generar} />;
}
