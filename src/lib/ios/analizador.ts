// Lee la salida de show running-config / show startup-config y de ipconfig tal como
// las copia un alumno desde Packet Tracer, para corregir los ejercicios.

import { descifrar7 } from './tipo7';

export interface LineaLeida { password?: string; passwordCifrada?: boolean; login: boolean; loginLocal: boolean; transport?: string }
export interface InterfazLeida {
  ip?: string; mascara?: string; shutdown: boolean; descripcion?: string;
  ipv6: string[]; // en minúsculas, con prefijo: 2001:db8:acad:10::1/64
  linkLocal?: string;
  encapsulacion?: number; nativaSubif?: boolean;
  modo?: string; accesoVlan?: number; vozVlan?: number; nativa?: number; permitidas?: string; nonegotiate?: boolean; capa3?: boolean;
}

export interface ConfigLeida {
  origen: 'startup' | 'running' | 'desconocido';
  hostname?: string;
  enableSecret: boolean;
  enableSecretTipo?: string;
  enableSecretHash?: string;
  enablePassword?: string;
  spe: boolean;
  banner?: string;
  domainLookup: boolean;
  gateway?: string;
  con?: LineaLeida;
  vty: Record<string, LineaLeida>; // «0 4», «5 15», «0 15»…
  ifs: Record<string, InterfazLeida>;
  dominio?: string;
  sshVersion?: number;
  usuarios: { nombre: string; hash?: string; tipo?: string; password?: string }[];
  ipv6Routing: boolean;
  ipRouting: boolean;
}

function leerPassword(resto: string): { password: string; cifrada: boolean } {
  const m = resto.match(/^7\s+(\S+)$/);
  if (m) return { password: descifrar7(m[1]) ?? '', cifrada: true };
  return { password: resto.replace(/^0\s+/, ''), cifrada: false };
}

export function leerConfig(texto: string): ConfigLeida {
  const t = texto.replace(/\r/g, '').replace(/\x03/g, '^C').replace(/[ \t]*-+ ?More ?-+[ \t\x08]*/g, '').replace(/\x08/g, '');
  const lineas = t.split('\n');
  const c: ConfigLeida = {
    origen: /Using \d+ (out of \d+ )?bytes/i.test(t) || /#\s*sh\w* start/i.test(t) ? 'startup' : /Current configuration/i.test(t) || /#\s*sh\w* run/i.test(t) ? 'running' : 'desconocido',
    enableSecret: false,
    spe: false,
    domainLookup: true,
    vty: {},
    ifs: {},
    usuarios: [],
    ipv6Routing: false,
    ipRouting: false,
  };
  let bloque: { tipo: 'line'; linea: LineaLeida } | { tipo: 'if'; i: InterfazLeida } | null = null;

  for (let n = 0; n < lineas.length; n++) {
    const l = lineas[n].replace(/\s+$/, '');
    if (!l.startsWith(' ')) bloque = null;
    const s = l.trim();
    if (!s || s === '!') continue;
    let m: RegExpMatchArray | null;

    if ((m = s.match(/^hostname\s+(\S+)/))) { c.hostname = m[1]; continue; }
    if ((m = s.match(/^enable secret(?:\s+(\d))?\s+(\S+)/))) { c.enableSecret = true; c.enableSecretTipo = m[1] ?? '0'; c.enableSecretHash = m[2]; continue; }
    if ((m = s.match(/^enable password\s+(.+)$/))) { c.enablePassword = leerPassword(m[1]).password; continue; }
    if (s === 'service password-encryption') { c.spe = true; continue; }
    if (s === 'no ip domain-lookup' || s === 'no ip domain lookup') { c.domainLookup = false; continue; }
    if ((m = s.match(/^ip default-gateway\s+(\S+)/))) { c.gateway = m[1]; continue; }
    if ((m = s.match(/^ip domain[- ]name\s+(\S+)/))) { c.dominio = m[1]; continue; }
    if ((m = s.match(/^ip ssh version\s+(\d)/))) { c.sshVersion = Number(m[1]); continue; }
    if (s === 'ipv6 unicast-routing') { c.ipv6Routing = true; continue; }
    if (s === 'ip routing') { c.ipRouting = true; continue; }
    if ((m = s.match(/^username\s+(\S+)(?:\s+privilege\s+\d+)?\s+secret\s+(?:(\d)\s+)?(\S+)/))) { c.usuarios.push({ nombre: m[1], tipo: m[2] ?? '0', hash: m[3] }); continue; }
    if ((m = s.match(/^username\s+(\S+)(?:\s+privilege\s+\d+)?\s+password\s+(.+)$/))) { c.usuarios.push({ nombre: m[1], password: leerPassword(m[2]).password }); continue; }
    if ((m = l.match(/^banner motd\s+(.*)$/))) {
      let resto = m[1];
      const delim = resto.startsWith('^C') ? '^C' : resto[0];
      resto = resto.slice(delim.length);
      let texto = '';
      let fin = resto.indexOf(delim);
      while (fin < 0 && n + 1 < lineas.length) {
        texto += resto + '\n';
        resto = lineas[++n];
        fin = resto.indexOf(delim);
      }
      c.banner = (texto + (fin >= 0 ? resto.slice(0, fin) : resto)).trim();
      continue;
    }
    if ((m = s.match(/^line con(?:sole)?\s+0$/))) {
      c.con = { login: false, loginLocal: false };
      bloque = { tipo: 'line', linea: c.con };
      continue;
    }
    if ((m = s.match(/^line vty\s+(\d+)(?:\s+(\d+))?$/))) {
      const v: LineaLeida = { login: false, loginLocal: false };
      c.vty[`${m[1]} ${m[2] ?? m[1]}`] = v;
      bloque = { tipo: 'line', linea: v };
      continue;
    }
    if ((m = s.match(/^interface\s+(\S+)$/))) {
      const nombre = normalizarIf(m[1]);
      c.ifs[nombre] = { shutdown: false, ipv6: [] };
      bloque = { tipo: 'if', i: c.ifs[nombre] };
      continue;
    }
    if (bloque?.tipo === 'line') {
      if ((m = s.match(/^password\s+(.+)$/))) { const p = leerPassword(m[1]); bloque.linea.password = p.password; bloque.linea.passwordCifrada = p.cifrada; }
      else if (s === 'login') bloque.linea.login = true;
      else if (s === 'login local') { bloque.linea.login = true; bloque.linea.loginLocal = true; }
      else if ((m = s.match(/^transport input\s+(.+)$/))) bloque.linea.transport = m[1];
      continue;
    }
    if (bloque?.tipo === 'if') {
      const i = bloque.i;
      if ((m = s.match(/^ip address\s+(\S+)\s+(\S+)/))) { i.ip = m[1]; i.mascara = m[2]; }
      else if (s === 'shutdown') i.shutdown = true;
      else if ((m = s.match(/^description\s+(.+)$/))) i.descripcion = m[1];
      else if ((m = s.match(/^ipv6 address\s+(\S+)\s+link-local$/i))) i.linkLocal = normalizarIpv6(m[1]);
      else if ((m = s.match(/^ipv6 address\s+(\S+)$/i))) i.ipv6.push(normalizarIpv6(m[1]));
      else if ((m = s.match(/^encapsulation dot1q\s+(\d+)(\s+native)?$/i))) { i.encapsulacion = Number(m[1]); i.nativaSubif = !!m[2]; }
      else if ((m = s.match(/^switchport mode\s+(.+)$/))) i.modo = m[1];
      else if ((m = s.match(/^switchport access vlan\s+(\d+)/))) i.accesoVlan = Number(m[1]);
      else if ((m = s.match(/^switchport voice vlan\s+(\d+)/))) i.vozVlan = Number(m[1]);
      else if ((m = s.match(/^switchport trunk native vlan\s+(\d+)/))) i.nativa = Number(m[1]);
      else if ((m = s.match(/^switchport trunk allowed vlan\s+(?:add\s+)?(.+)$/))) i.permitidas = i.permitidas && /add/.test(s) ? `${i.permitidas},${m[1]}` : m[1];
      else if (s === 'switchport nonegotiate') i.nonegotiate = true;
      else if (s === 'no switchport') i.capa3 = true;
    }
  }
  return c;
}

/** GigabitEthernet0/0/1.10, FastEthernet0/1, Vlan10, Loopback0… a partir de cualquier abreviatura razonable. */
export function normalizarIf(n: string): string {
  const m = n.match(/^([a-zA-Z-]+)\s*([\d/.]+)$/);
  if (!m) return n;
  const t = m[1].toLowerCase();
  const tipo = 'gigabitethernet'.startsWith(t) ? 'GigabitEthernet' : 'fastethernet'.startsWith(t) ? 'FastEthernet' : t.startsWith('vl') ? 'Vlan'
    : t.startsWith('lo') ? 'Loopback' : t.startsWith('se') ? 'Serial' : m[1];
  return `${tipo}${m[2]}`;
}

/** Forma canónica de una dirección IPv6 (con o sin prefijo): grupos completos en minúsculas. */
export function normalizarIpv6(d: string): string {
  const [dir, pref] = d.toLowerCase().split('/');
  const [a, b] = dir.split('::');
  const izq = a ? a.split(':') : [];
  const der = b !== undefined && b ? b.split(':') : [];
  const relleno = b !== undefined ? Array(8 - izq.length - der.length).fill('0') : [];
  const grupos = [...izq, ...relleno, ...der].map((g) => g.replace(/^0+(?=.)/, ''));
  return grupos.join(':') + (pref ? `/${pref}` : '');
}

/** Lista de VLAN de IOS («10,20,30-32») como números. */
export function expandirVlans(texto?: string): number[] | 'todas' {
  if (!texto || /^(all|1-4094)$/.test(texto.trim())) return 'todas';
  if (texto.trim() === 'none') return [];
  const out: number[] = [];
  for (const p of texto.split(',')) {
    const m = p.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    for (let n = Number(m[1]); n <= Number(m[2] ?? m[1]); n++) out.push(n);
  }
  return out;
}

export interface VlanLeida { id: number; nombre: string; puertos: string[] }

/** Lee la tabla de show vlan brief (aunque venga junto con otras salidas). */
export function leerVlanBrief(texto: string): VlanLeida[] | null {
  const t = texto.replace(/\r/g, '');
  const i = t.search(/VLAN Name\s+Status\s+Ports/);
  if (i < 0) return null;
  const out: VlanLeida[] = [];
  for (const l of t.slice(i).split('\n').slice(1)) {
    if (/^-{4}/.test(l)) continue;
    let m: RegExpMatchArray | null;
    if ((m = l.match(/^(\d+)\s+(\S+)\s+(?:active|act\/unsup|act\/lshut|suspended)\s*(.*)$/))) {
      out.push({ id: Number(m[1]), nombre: m[2], puertos: m[3] ? m[3].split(',').map((x) => x.trim()).filter(Boolean) : [] });
    } else if ((m = l.match(/^\s{20,}(\S.*)$/)) && out.length) {
      out[out.length - 1].puertos.push(...m[1].split(',').map((x) => x.trim()).filter(Boolean));
    } else if (out.length && (/^\S/.test(l) || !l.trim())) {
      if (!l.trim()) continue;
      break;
    }
  }
  return out;
}

export interface TroncalLeida { puerto: string; nativa: number; permitidas: string; activas?: string }

/** Lee show interfaces trunk. Devuelve null si la salida no está. */
export function leerTrunk(texto: string): TroncalLeida[] | null {
  const t = texto.replace(/\r/g, '');
  const i = t.search(/show int\w* trunk|Port\s+Mode\s+Encapsulation\s+Status\s+Native vlan/);
  if (i < 0) return null;
  const bloque = t.slice(i).split('\n');
  const out: TroncalLeida[] = [];
  let parte = 0;
  for (const l of bloque) {
    if (/Port\s+Mode\s+Encapsulation/.test(l)) { parte = 1; continue; }
    if (/Vlans allowed on trunk/.test(l)) { parte = 2; continue; }
    if (/Vlans allowed and active/.test(l)) { parte = 3; continue; }
    if (/spanning tree forwarding/.test(l)) { parte = 4; continue; }
    if (/#/.test(l) && parte > 0) break;
    const m = l.match(/^(\S+)\s+(.*\S)\s*$/);
    if (!m) continue;
    if (parte === 1) {
      const c = m[2].split(/\s+/);
      out.push({ puerto: m[1], nativa: Number(c[c.length - 1]), permitidas: '' });
    } else if (parte === 2) { const x = out.find((o) => o.puerto === m[1]); if (x) x.permitidas = m[2]; }
    else if (parte === 3) { const x = out.find((o) => o.puerto === m[1]); if (x) x.activas = m[2]; }
  }
  return out;
}

export function leerSsh(texto: string): { habilitado: boolean; version?: string } | null {
  const m = texto.match(/SSH (Enabled|Disabled) - version (\S+)/);
  return m ? { habilitado: m[1] === 'Enabled', version: m[2] } : null;
}

/** Todas las líneas VTY de 0 a `hasta` quedan cubiertas por bloques que cumplen `cond`. */
export function vtyCumple(c: ConfigLeida, hasta: number, cond: (l: LineaLeida) => boolean): boolean {
  for (let n = 0; n <= hasta; n++) {
    const bloque = Object.entries(c.vty).find(([r]) => { const [a, b] = r.split(' ').map(Number); return n >= a && n <= b; });
    if (!bloque || !cond(bloque[1])) return false;
  }
  return true;
}

export interface IpLeida { ip?: string; mascara?: string; gateway?: string; ipv6?: string; gateway6?: string }

const IPV4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/;

export function leerIpconfig(texto: string): IpLeida {
  const l = texto.replace(/\r/g, '').split('\n');
  const r: IpLeida = {};
  for (let i = 0; i < l.length; i++) {
    const s = l[i];
    if (!r.ip && /(IPv4 Address|IP Address|Dirección IPv4|Direcci.n IP)/i.test(s)) r.ip = s.match(IPV4)?.[1];
    else if (!r.mascara && /(Subnet Mask|M.scara de subred)/i.test(s)) r.mascara = s.match(IPV4)?.[1];
    else if (!r.ipv6 && /^\s*IPv6 Address[ .]*:\s*(\S+)/i.test(s)) {
      const v = s.match(/:\s*([0-9A-Fa-f:]+)\s*$/)?.[1];
      if (v && v !== '::') r.ipv6 = normalizarIpv6(v);
    }
    else if (!r.gateway && /(Default Gateway|Puerta de enlace)/i.test(s)) {
      const v6 = s.match(/:\s*([0-9A-Fa-f]*:[0-9A-Fa-f:]*)\s*$/)?.[1];
      if (v6 && v6 !== '::') r.gateway6 = normalizarIpv6(v6);
      r.gateway = s.match(IPV4)?.[1] ?? l[i + 1]?.match(new RegExp(`^\\s+${IPV4.source}\\s*$`))?.[1];
    }
  }
  return r;
}

export interface PingLeido { destino?: string; enviados: number; recibidos: number }

export function leerPing(texto: string): PingLeido {
  const t = texto.replace(/\r/g, '');
  const destino = t.match(/(?:Pinging|Haciendo ping a)\s+(\S+)/i)?.[1] ?? t.match(/ping\s+(\S+)/i)?.[1];
  const m = t.match(/(?:Sent|Enviados)\s*=\s*(\d+),\s*(?:Received|Recibidos)\s*=\s*(\d+)/i);
  if (m) return { destino, enviados: Number(m[1]), recibidos: Number(m[2]) };
  const ios = t.match(/Success rate is \d+ percent \((\d+)\/(\d+)\)/);
  if (ios) return { destino, enviados: Number(ios[2]), recibidos: Number(ios[1]) };
  return { destino, enviados: 0, recibidos: 0 };
}
