// Escenarios de implementación en Packet Tracer: el alumno arma la topología con los valores
// aleatorios de su código, pega las salidas de los equipos y aquí se corrige cada requisito.

import type { NodoTopo, EnlaceTopo } from '../../components/Topologia';
import { Azar } from '../azar';
import { leerConfig, leerIpconfig, leerPing, vtyCumple, type ConfigLeida, type IpLeida, type PingLeido } from '../ios/analizador';
import { verificarMd5crypt } from '../ios/md5crypt';

export type IdPT = 'pt-switch' | 'pt-conectividad';

export interface Evidencia {
  dispositivo: string;
  tipo: 'switch' | 'pc';
  pide: string[]; // comandos que el alumno debe ejecutar y copiar
}

export interface FilaDireccion { dispositivo: string; interfaz: string; ip: string; mascara: string; gateway: string }

export interface Leidas {
  switches: Record<string, ConfigLeida | null>;
  pcs: Record<string, { ip: IpLeida; pings: PingLeido[] } | null>;
}

type Evaluacion = { ok: boolean; detalle?: string };

export interface Requisito {
  id: string;
  dispositivo: string;
  texto: string;
  evaluar: (l: Leidas) => Evaluacion;
}

export interface Resultado { id: string; dispositivo: string; texto: string; estado: 'ok' | 'mal' | 'falta'; detalle?: string }

export interface CasoPT {
  id: IdPT;
  titulo: string;
  codigo: string;
  topologia: { nodos: NodoTopo[]; enlaces: EnlaceTopo[]; ancho: number; alto: number };
  direcciones: FilaDireccion[];
  valores: { etiqueta: string; valor: string }[];
  partes: { titulo: string; pasos: string[] }[];
  evidencias: Evidencia[];
  requisitos: Requisito[];
  solucion: { dispositivo: string; texto: string }[];
}

const NOMBRES = ['Ventas', 'Piso2', 'Lab3', 'Aula5', 'Bodega', 'Admin', 'Recepcion', 'Norte', 'Sur', 'Caja', 'Soporte', 'Planta'];
const PALABRAS = ['Cisco', 'Andes', 'Ruta', 'Nodo', 'Trama', 'Puerto', 'Lima', 'Cusco', 'Rack', 'Enlace', 'Bit', 'Capa'];
const FRASES = ['Solo personal autorizado', 'Acceso restringido', 'Prohibido el acceso no autorizado', 'Uso exclusivo del area de TI', 'Acceso monitoreado: solo personal autorizado'];
const MASCARA = '255.255.255.0';

const clave = (az: Azar) => `${az.elegir(PALABRAS)}${az.entero(10, 99)}${az.elegir(['!', '#', '$', '*'])}`;

function red(az: Azar) {
  const tipo = az.entero(0, 2);
  if (tipo === 0) return `192.168.${az.entero(1, 254)}`;
  if (tipo === 1) return `172.${az.entero(16, 31)}.${az.entero(0, 254)}`;
  return `10.${az.entero(0, 254)}.${az.entero(0, 254)}`;
}

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// ---------- Requisitos reutilizables ----------

function sinEvidencia(l: Leidas, d: string): Evaluacion | null {
  if (l.switches[d] === undefined && l.pcs[d] === undefined) return { ok: false, detalle: `Falta la salida de ${d}.` };
  if (l.switches[d] === null || l.pcs[d] === null) return { ok: false, detalle: `Falta la salida de ${d}.` };
  return null;
}

/** Envuelve una comprobación de switch: si no hay salida, el requisito queda «falta». */
const enSw = (d: string, f: (c: ConfigLeida) => Evaluacion) => (l: Leidas): Evaluacion => sinEvidencia(l, d) ?? f(l.switches[d]!);
const enPc = (d: string, f: (p: { ip: IpLeida; pings: PingLeido[] }) => Evaluacion) => (l: Leidas): Evaluacion => sinEvidencia(l, d) ?? f(l.pcs[d]!);

interface DatosSwitch {
  nodo: string;
  hostname: string;
  secreto: string;
  pCon: string;
  pVty: string;
  frase: string;
  ip: string;
  gateway?: string;
  domainLookup?: boolean;
  descripcion?: { interfaz: string; texto: string };
  apagar?: string;
}

function requisitosSwitch(s: DatosSwitch): Requisito[] {
  const d = s.nodo;
  const r: Requisito[] = [
    {
      id: `${d}-guardado`, dispositivo: d, texto: 'La configuración está guardada en la NVRAM (startup-config).',
      evaluar: enSw(d, (c) => c.origen === 'startup' ? { ok: true }
        : c.origen === 'running'
          ? { ok: false, detalle: 'Pegaste show running-config, que no demuestra que guardaste. Ejecuta copy running-config startup-config y pega show startup-config.' }
          : { ok: false, detalle: 'No reconocemos el inicio de show startup-config. Copia la salida completa, desde la línea «Using … bytes».' }),
    },
    {
      id: `${d}-hostname`, dispositivo: d, texto: `El nombre de host es ${s.hostname}.`,
      evaluar: enSw(d, (c) => c.hostname === s.hostname ? { ok: true }
        : { ok: false, detalle: c.hostname ? `El nombre es «${c.hostname}». Recuerda que IOS distingue mayúsculas y minúsculas.` : 'No encontramos la línea hostname.' }),
    },
    {
      id: `${d}-secret`, dispositivo: d, texto: `El modo EXEC privilegiado se protege con enable secret «${s.secreto}».`,
      evaluar: enSw(d, (c) => {
        if (!c.enableSecret) return { ok: false, detalle: c.enablePassword !== undefined ? 'Usaste enable password: se pide enable secret, que guarda la contraseña con un hash.' : 'No hay ningún enable secret.' };
        if (c.enableSecretTipo === '5') return verificarMd5crypt(s.secreto, c.enableSecretHash ?? '') ? { ok: true } : { ok: false, detalle: `El enable secret existe, pero su contraseña no es «${s.secreto}».` };
        if (c.enableSecretTipo === '0') return c.enableSecretHash === s.secreto ? { ok: true } : { ok: false, detalle: 'La contraseña del enable secret no coincide.' };
        return { ok: true, detalle: `El hash es de tipo ${c.enableSecretTipo}: no se puede comprobar el valor, pero el comando está.` };
      }),
    },
    {
      id: `${d}-consola`, dispositivo: d, texto: `La consola pide la contraseña «${s.pCon}» (password y login).`,
      evaluar: enSw(d, (c) => {
        if (!c.con) return { ok: false, detalle: 'No encontramos el bloque line con 0.' };
        if (c.con.password !== s.pCon) return { ok: false, detalle: c.con.password ? `La contraseña de consola es «${c.con.password}».` : 'La consola no tiene contraseña.' };
        if (!c.con.login) return { ok: false, detalle: 'La contraseña está, pero falta login: la consola no la pedirá.' };
        return { ok: true };
      }),
    },
    {
      id: `${d}-vty`, dispositivo: d, texto: `Las 16 líneas VTY (0 a 15) piden la contraseña «${s.pVty}».`,
      evaluar: enSw(d, (c) => {
        if (!Object.keys(c.vty).length) return { ok: false, detalle: 'No encontramos los bloques line vty.' };
        if (!vtyCumple(c, 15, (v) => v.password === s.pVty)) return { ok: false, detalle: vtyCumple(c, 4, (v) => v.password === s.pVty) ? 'Solo configuraste las líneas 0 a 4: usa line vty 0 15.' : 'La contraseña de las líneas VTY no coincide o falta.' };
        if (!vtyCumple(c, 15, (v) => v.login)) return { ok: false, detalle: 'Falta login en alguna de las líneas VTY.' };
        return { ok: true };
      }),
    },
    {
      id: `${d}-cifrado`, dispositivo: d, texto: 'Las contraseñas en texto plano están cifradas (service password-encryption).',
      evaluar: enSw(d, (c) => c.spe ? { ok: true } : { ok: false, detalle: 'No está service password-encryption: las contraseñas de consola y VTY se ven en texto plano.' }),
    },
    {
      id: `${d}-banner`, dispositivo: d, texto: `El banner MOTD dice «${s.frase}».`,
      evaluar: enSw(d, (c) => !c.banner ? { ok: false, detalle: 'No hay banner motd.' }
        : normal(c.banner).includes(normal(s.frase)) ? { ok: true } : { ok: false, detalle: `El banner dice «${c.banner}».` }),
    },
    {
      id: `${d}-svi`, dispositivo: d, texto: `La SVI de la VLAN 1 tiene la IP ${s.ip} ${MASCARA}.`,
      evaluar: enSw(d, (c) => {
        const v = c.ifs.Vlan1;
        if (!v) return { ok: false, detalle: 'No encontramos interface Vlan1 en la salida.' };
        if (v.ip !== s.ip) return { ok: false, detalle: v.ip ? `La SVI tiene ${v.ip}.` : 'La SVI no tiene dirección IP.' };
        if (v.mascara !== MASCARA) return { ok: false, detalle: `La máscara es ${v.mascara}.` };
        return { ok: true };
      }),
    },
    {
      id: `${d}-svi-up`, dispositivo: d, texto: 'La SVI está encendida (no shutdown).',
      evaluar: enSw(d, (c) => !c.ifs.Vlan1 ? { ok: false, detalle: 'No encontramos interface Vlan1 en la salida.' }
        : c.ifs.Vlan1.shutdown ? { ok: false, detalle: 'La Vlan1 sigue en shutdown: entra a la interfaz y escribe no shutdown.' } : { ok: true }),
    },
  ];
  if (s.domainLookup === false) r.push({
    id: `${d}-dns`, dispositivo: d, texto: 'La búsqueda DNS de comandos mal escritos está desactivada.',
    evaluar: enSw(d, (c) => !c.domainLookup ? { ok: true } : { ok: false, detalle: 'Falta no ip domain-lookup.' }),
  });
  if (s.gateway) r.push({
    id: `${d}-gw`, dispositivo: d, texto: `El switch tiene el gateway predeterminado ${s.gateway}.`,
    evaluar: enSw(d, (c) => c.gateway === s.gateway ? { ok: true } : { ok: false, detalle: c.gateway ? `El gateway es ${c.gateway}.` : 'Falta ip default-gateway.' }),
  });
  if (s.descripcion) {
    const { interfaz, texto } = s.descripcion;
    r.push({
      id: `${d}-desc`, dispositivo: d, texto: `La interfaz ${interfaz} tiene la descripción «${texto}».`,
      evaluar: enSw(d, (c) => { const i = c.ifs[interfaz]; return i?.descripcion && normal(i.descripcion) === normal(texto) ? { ok: true } : { ok: false, detalle: i?.descripcion ? `La descripción es «${i.descripcion}».` : `${interfaz} no tiene descripción.` }; }),
    });
  }
  if (s.apagar) {
    const i = s.apagar;
    r.push({
      id: `${d}-apagar`, dispositivo: d, texto: `La interfaz ${i}, que no se usa, está apagada.`,
      evaluar: enSw(d, (c) => c.ifs[i]?.shutdown ? { ok: true } : { ok: false, detalle: `${i} no tiene shutdown.` }),
    });
  }
  return r;
}

function requisitosPc(d: string, ip: string, gw: string, pings: { destino: string; nombre: string }[]): Requisito[] {
  return [
    {
      id: `${d}-ip`, dispositivo: d, texto: `La PC tiene la IP ${ip} y la máscara ${MASCARA}.`,
      evaluar: enPc(d, (p) => {
        if (!p.ip.ip) return { ok: false, detalle: 'No encontramos la salida de ipconfig (la línea IPv4 Address).' };
        if (p.ip.ip !== ip) return { ok: false, detalle: `La PC tiene ${p.ip.ip}.` };
        if (p.ip.mascara !== MASCARA) return { ok: false, detalle: `La máscara es ${p.ip.mascara ?? 'desconocida'}.` };
        return { ok: true };
      }),
    },
    {
      id: `${d}-gw`, dispositivo: d, texto: `El gateway predeterminado de la PC es ${gw}.`,
      evaluar: enPc(d, (p) => !p.ip.ip ? { ok: false, detalle: 'No encontramos la salida de ipconfig.' }
        : p.ip.gateway === gw ? { ok: true } : { ok: false, detalle: p.ip.gateway && p.ip.gateway !== '0.0.0.0' ? `El gateway es ${p.ip.gateway}.` : 'La PC no tiene gateway.' }),
    },
    ...pings.map(({ destino, nombre }) => ({
      id: `${d}-ping-${nombre}`, dispositivo: d, texto: `El ping de ${d} a ${nombre} (${destino}) tiene respuesta.`,
      evaluar: enPc(d, (p) => {
        const v = p.pings.filter((x) => x.destino === destino);
        if (!v.length) return { ok: false, detalle: `No encontramos un ping a ${destino} en la salida.` };
        return v.some((x) => x.recibidos > 0) ? { ok: true } : { ok: false, detalle: `El ping a ${destino} no recibió respuestas.` };
      }),
    })),
  ];
}

function scriptSwitch(s: DatosSwitch): string {
  const l = ['enable', 'configure terminal', `hostname ${s.hostname}`];
  if (s.domainLookup === false) l.push('no ip domain-lookup');
  l.push(`enable secret ${s.secreto}`, 'line console 0', ` password ${s.pCon}`, ' login', ' exit', 'line vty 0 15', ` password ${s.pVty}`, ' login', ' exit');
  l.push('service password-encryption', `banner motd #${s.frase}#`, 'interface vlan 1', ` ip address ${s.ip} ${MASCARA}`, ' no shutdown', ' exit');
  if (s.gateway) l.push(`ip default-gateway ${s.gateway}`);
  if (s.descripcion) l.push(`interface ${s.descripcion.interfaz}`, ` description ${s.descripcion.texto}`, ' exit');
  if (s.apagar) l.push(`interface ${s.apagar}`, ' shutdown', ' exit');
  l.push('end', 'copy running-config startup-config');
  return l.join('\n');
}

const scriptPc = (ip: string, gw: string, pings: string[]) =>
  [`Desktop > IP Configuration (Static)`, `  IPv4 Address : ${ip}`, `  Subnet Mask  : ${MASCARA}`, `  Default Gateway: ${gw}`, '', 'Desktop > Command Prompt', '  ipconfig', ...pings.map((p) => `  ping ${p}`)].join('\n');

const pasosSwitch = (s: DatosSwitch, nombre = s.nodo) => {
  const p = [
    `Conéctate por consola a ${nombre} y cambia su nombre a ${s.hostname}.`,
    `Protege el modo EXEC privilegiado con enable secret «${s.secreto}».`,
    `Protege la consola con «${s.pCon}» y las líneas VTY 0 a 15 con «${s.pVty}»; ambas deben pedir la contraseña.`,
    'Cifra las contraseñas que quedan en texto plano.',
    `Configura el banner MOTD «${s.frase}».`,
    `Asigna ${s.ip} ${MASCARA} a la interfaz Vlan1 y enciéndela.`,
  ];
  if (s.domainLookup === false) p.push('Desactiva la búsqueda DNS de los comandos mal escritos.');
  if (s.gateway) p.push(`Configura el gateway predeterminado del switch: ${s.gateway}.`);
  if (s.descripcion) p.push(`Describe la interfaz ${s.descripcion.interfaz} como «${s.descripcion.texto}».`);
  if (s.apagar) p.push(`Apaga la interfaz ${s.apagar}, que no se usa.`);
  p.push('Guarda la configuración.');
  return p;
};

const abrev = (i: string) => i.replace('FastEthernet', 'F').replace('GigabitEthernet', 'G');

// ---------- Plantilla 1: configuración inicial de un switch ----------

function switchInicial(codigo: string): CasoPT {
  const az = new Azar(codigo, 'pt-switch');
  const r = red(az);
  const puerto = `FastEthernet0/${az.entero(1, 24)}`;
  const gw = `${r}.1`;
  const s: DatosSwitch = {
    nodo: 'S1',
    hostname: `${az.elegir(['Sw', 'SW', 'S'])}-${az.elegir(NOMBRES)}-${az.entero(1, 9)}`,
    secreto: clave(az), pCon: clave(az), pVty: clave(az), frase: az.elegir(FRASES),
    ip: `${r}.${az.entero(2, 20)}`,
  };
  const pcIp = `${r}.${az.entero(21, 99)}`;
  for (const extra of az.muestra(['dns', 'gw', 'desc', 'apagar'], 2)) {
    if (extra === 'dns') s.domainLookup = false;
    if (extra === 'gw') s.gateway = gw;
    if (extra === 'desc') s.descripcion = { interfaz: puerto, texto: 'Enlace a PC-A' };
    if (extra === 'apagar') s.apagar = 'GigabitEthernet0/2';
  }
  return {
    id: 'pt-switch', codigo, titulo: 'Configuración inicial de un switch',
    topologia: {
      ancho: 600, alto: 165,
      nodos: [
        { id: 'S1', tipo: 'switch', x: 150, y: 55, detalle: s.hostname, detalle2: `Vlan1 ${s.ip}`, lado: 'abajo' },
        { id: 'PC-A', tipo: 'pc', x: 450, y: 55, detalle: pcIp, lado: 'abajo' },
      ],
      enlaces: [
        { a: 'S1', b: 'PC-A', ia: abrev(puerto), ib: 'Fa0' },
        { a: 'S1', b: 'PC-A', tipo: 'consola', marca: 'Consola' },
      ],
    },
    direcciones: [
      { dispositivo: `S1 (${s.hostname})`, interfaz: 'Vlan1', ip: s.ip, mascara: MASCARA, gateway: s.gateway ?? 'No aplica' },
      { dispositivo: 'PC-A', interfaz: 'NIC', ip: pcIp, mascara: MASCARA, gateway: gw },
    ],
    valores: [
      { etiqueta: 'Nombre de host', valor: s.hostname },
      { etiqueta: 'enable secret', valor: s.secreto },
      { etiqueta: 'Contraseña de consola', valor: s.pCon },
      { etiqueta: 'Contraseña de VTY', valor: s.pVty },
      { etiqueta: 'Banner MOTD', valor: s.frase },
    ],
    partes: [
      { titulo: 'Arma la topología', pasos: [`Coloca un switch 2960 (S1) y una PC (PC-A).`, `Conecta PC-A (FastEthernet0) a ${puerto} de S1 con un cable directo de cobre.`, 'Conecta el puerto RS-232 de PC-A al puerto Console de S1 con un cable de consola.'] },
      { titulo: 'Configura S1', pasos: pasosSwitch(s) },
      { titulo: 'Configura PC-A y verifica', pasos: [`Asigna a PC-A la IP ${pcIp}, la máscara ${MASCARA} y el gateway ${gw}.`, `Desde PC-A, haz ping a la SVI de S1 (${s.ip}).`] },
    ],
    evidencias: [
      { dispositivo: 'S1', tipo: 'switch', pide: ['show startup-config'] },
      { dispositivo: 'PC-A', tipo: 'pc', pide: ['ipconfig', `ping ${s.ip}`] },
    ],
    requisitos: [...requisitosSwitch(s), ...requisitosPc('PC-A', pcIp, gw, [{ destino: s.ip, nombre: 'S1' }])],
    solucion: [
      { dispositivo: 'S1', texto: scriptSwitch(s) },
      { dispositivo: 'PC-A', texto: scriptPc(pcIp, gw, [s.ip]) },
    ],
  };
}

// ---------- Plantilla 2: dos switches y conectividad básica ----------

function conectividad(codigo: string): CasoPT {
  const az = new Azar(codigo, 'pt-conectividad');
  const r = red(az);
  const gw = `${r}.1`;
  const [n1, n2] = az.muestra(NOMBRES, 2);
  const pre = az.elegir(['Sw', 'SW', 'S']);
  const comun = { secreto: clave(az), pCon: clave(az), pVty: clave(az), frase: az.elegir(FRASES) };
  const ip1 = az.entero(2, 9), ip2 = az.entero(10, 19);
  const s1: DatosSwitch = { nodo: 'S1', hostname: `${pre}-${n1}`, ...comun, ip: `${r}.${ip1}` };
  const s2: DatosSwitch = { nodo: 'S2', hostname: `${pre}-${n2}`, ...comun, ip: `${r}.${ip2}` };
  if (az.probabilidad(0.5)) { s1.domainLookup = false; s2.domainLookup = false; }
  const troncal = az.elegir([['GigabitEthernet0/1', 'GigabitEthernet0/1'], ['FastEthernet0/24', 'FastEthernet0/24'], ['GigabitEthernet0/1', 'GigabitEthernet0/2']]);
  const p1 = `FastEthernet0/${az.entero(1, 12)}`, p2 = `FastEthernet0/${az.entero(1, 12)}`;
  const pc1 = `${r}.${az.entero(20, 59)}`, pc2 = `${r}.${az.entero(60, 99)}`;
  if (az.probabilidad(0.5)) s1.descripcion = { interfaz: troncal[0], texto: `Enlace a ${s2.hostname}` };
  return {
    id: 'pt-conectividad', codigo, titulo: 'Dos switches y conectividad básica',
    topologia: {
      ancho: 720, alto: 240,
      nodos: [
        { id: 'PC1', tipo: 'pc', x: 70, y: 175, detalle: pc1, lado: 'abajo' },
        { id: 'S1', tipo: 'switch', x: 230, y: 70, detalle: s1.hostname, detalle2: `Vlan1 ${s1.ip}`, lado: 'arriba' },
        { id: 'S2', tipo: 'switch', x: 490, y: 70, detalle: s2.hostname, detalle2: `Vlan1 ${s2.ip}`, lado: 'arriba' },
        { id: 'PC2', tipo: 'pc', x: 650, y: 175, detalle: pc2, lado: 'abajo' },
      ],
      enlaces: [
        { a: 'S1', b: 'PC1', ia: abrev(p1), ib: 'Fa0' },
        { a: 'S1', b: 'S2', ia: abrev(troncal[0]), ib: abrev(troncal[1]) },
        { a: 'S2', b: 'PC2', ia: abrev(p2), ib: 'Fa0' },
      ],
    },
    direcciones: [
      { dispositivo: `S1 (${s1.hostname})`, interfaz: 'Vlan1', ip: s1.ip, mascara: MASCARA, gateway: 'No aplica' },
      { dispositivo: `S2 (${s2.hostname})`, interfaz: 'Vlan1', ip: s2.ip, mascara: MASCARA, gateway: 'No aplica' },
      { dispositivo: 'PC1', interfaz: 'NIC', ip: pc1, mascara: MASCARA, gateway: gw },
      { dispositivo: 'PC2', interfaz: 'NIC', ip: pc2, mascara: MASCARA, gateway: gw },
    ],
    valores: [
      { etiqueta: 'enable secret (ambos)', valor: comun.secreto },
      { etiqueta: 'Contraseña de consola (ambos)', valor: comun.pCon },
      { etiqueta: 'Contraseña de VTY (ambos)', valor: comun.pVty },
      { etiqueta: 'Banner MOTD (ambos)', valor: comun.frase },
    ],
    partes: [
      { titulo: 'Arma la topología', pasos: [
        'Coloca dos switches 2960 (S1 y S2) y dos PC (PC1 y PC2).',
        `Conecta PC1 a ${p1} de S1 y PC2 a ${p2} de S2 con cables directos.`,
        `Une ${troncal[0]} de S1 con ${troncal[1]} de S2 (un cable directo basta: los 2960 tienen Auto-MDIX).`,
      ] },
      { titulo: 'Configura S1', pasos: pasosSwitch(s1) },
      { titulo: 'Configura S2', pasos: pasosSwitch(s2) },
      { titulo: 'Configura las PC y verifica', pasos: [
        `PC1: ${pc1} ${MASCARA}, gateway ${gw}. PC2: ${pc2} ${MASCARA}, gateway ${gw}. (El gateway será un router que se añade en un laboratorio posterior.)`,
        `Desde PC1, haz ping a PC2 (${pc2}) y a S2 (${s2.ip}).`,
        `Desde PC2, haz ping a S1 (${s1.ip}).`,
      ] },
    ],
    evidencias: [
      { dispositivo: 'S1', tipo: 'switch', pide: ['show startup-config'] },
      { dispositivo: 'S2', tipo: 'switch', pide: ['show startup-config'] },
      { dispositivo: 'PC1', tipo: 'pc', pide: ['ipconfig', `ping ${pc2}`, `ping ${s2.ip}`] },
      { dispositivo: 'PC2', tipo: 'pc', pide: ['ipconfig', `ping ${s1.ip}`] },
    ],
    requisitos: [
      ...requisitosSwitch(s1), ...requisitosSwitch(s2),
      ...requisitosPc('PC1', pc1, gw, [{ destino: pc2, nombre: 'PC2' }, { destino: s2.ip, nombre: 'S2' }]),
      ...requisitosPc('PC2', pc2, gw, [{ destino: s1.ip, nombre: 'S1' }]),
    ],
    solucion: [
      { dispositivo: 'S1', texto: scriptSwitch(s1) },
      { dispositivo: 'S2', texto: scriptSwitch(s2) },
      { dispositivo: 'PC1', texto: scriptPc(pc1, gw, [pc2, s2.ip]) },
      { dispositivo: 'PC2', texto: scriptPc(pc2, gw, [s1.ip]) },
    ],
  };
}

export function generarPT(id: IdPT, codigo: string): CasoPT {
  return id === 'pt-switch' ? switchInicial(codigo) : conectividad(codigo);
}

// ---------- Corrección ----------

function leerPc(texto: string) {
  const pings = texto.split(/(?=Pinging |Haciendo ping a )/i).filter((t) => /^(Pinging|Haciendo ping a)/i.test(t)).map(leerPing);
  return { ip: leerIpconfig(texto), pings };
}

export function corregir(caso: CasoPT, textos: Record<string, string>): Resultado[] {
  const l: Leidas = { switches: {}, pcs: {} };
  for (const e of caso.evidencias) {
    const t = (textos[e.dispositivo] ?? '').trim();
    if (e.tipo === 'switch') l.switches[e.dispositivo] = t ? leerConfig(t) : null;
    else l.pcs[e.dispositivo] = t ? leerPc(t) : null;
  }
  return caso.requisitos.map((r) => {
    const vacio = !(textos[r.dispositivo] ?? '').trim();
    const ev = r.evaluar(l);
    return { id: r.id, dispositivo: r.dispositivo, texto: r.texto, estado: vacio ? 'falta' : ev.ok ? 'ok' : 'mal', detalle: ev.detalle };
  });
}

export const puntaje = (res: Resultado[]) => {
  const ok = res.filter((r) => r.estado === 'ok').length;
  return { ok, total: res.length, pct: Math.round((ok / res.length) * 100) };
};

// ---------- Informe para el instructor ----------

const INICIO = '-----INICIO EVIDENCIA-----';
const FIN = '-----FIN EVIDENCIA-----';

const aBase64 = (s: string) => {
  const b = new TextEncoder().encode(s);
  let bin = '';
  b.forEach((x) => { bin += String.fromCharCode(x); });
  return btoa(bin);
};
const deBase64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

export interface DatosInforme { v: 1; ej: IdPT; codigo: string; alumno: string; fecha: string; textos: Record<string, string>; ok: number; total: number }

export function crearInforme(caso: CasoPT, alumno: string, textos: Record<string, string>, url: string, fecha = new Date()): string {
  const res = corregir(caso, textos);
  const p = puntaje(res);
  const f = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')} ${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
  const o = [
    'CCNA 4Dummies · Informe de práctica en Packet Tracer',
    '='.repeat(52),
    `Ejercicio : ${caso.titulo}`,
    `Escenario : ${caso.codigo}`,
    `Alumno    : ${alumno || '(sin nombre)'}`,
    `Fecha     : ${f}`,
    `Resultado : ${p.ok}/${p.total} requisitos (${p.pct} %)`,
    '',
  ];
  for (const d of caso.evidencias.map((e) => e.dispositivo)) {
    o.push(d);
    for (const r of res.filter((x) => x.dispositivo === d)) {
      o.push(`  [${r.estado === 'ok' ? 'OK' : r.estado === 'falta' ? '--' : 'X '}] ${r.texto}`);
      if (r.estado !== 'ok' && r.detalle) o.push(`       ${r.detalle}`);
    }
    o.push('');
  }
  o.push('Para el instructor: abre el ejercicio en', `  ${url}`, 'y usa «Revisar un informe» para volver a corregirlo con las salidas originales', 'y ver la solución de este escenario.', '');
  const datos: DatosInforme = { v: 1, ej: caso.id, codigo: caso.codigo, alumno, fecha: f, textos, ok: p.ok, total: p.total };
  o.push(INICIO, ...(aBase64(JSON.stringify(datos)).match(/.{1,76}/g) ?? []), FIN, '');
  return o.join('\n');
}

export function leerInforme(texto: string): DatosInforme | null {
  const i = texto.indexOf(INICIO), f = texto.indexOf(FIN);
  if (i < 0 || f < i) return null;
  try {
    const d = JSON.parse(deBase64(texto.slice(i + INICIO.length, f).replace(/\s+/g, '')));
    if (d?.v !== 1 || (d.ej !== 'pt-switch' && d.ej !== 'pt-conectividad') || typeof d.codigo !== 'string' || typeof d.textos !== 'object') return null;
    const declarado = texto.match(/Resultado\s*:\s*(\d+)\/(\d+)/);
    if (declarado) { d.ok = Number(declarado[1]); d.total = Number(declarado[2]); }
    return d as DatosInforme;
  } catch {
    return null;
  }
}
