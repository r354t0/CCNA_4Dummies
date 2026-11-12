// Lee la salida de show running-config / show startup-config y de ipconfig tal como
// las copia un alumno desde Packet Tracer, para corregir los ejercicios.

import { descifrar7 } from './tipo7';

export interface LineaLeida { password?: string; passwordCifrada?: boolean; login: boolean; loginLocal: boolean; transport?: string }
export interface InterfazLeida { ip?: string; mascara?: string; shutdown: boolean; descripcion?: string }

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
      const nombre = m[1].replace(/^vlan/i, 'Vlan');
      c.ifs[nombre] = { shutdown: false };
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
      if ((m = s.match(/^ip address\s+(\S+)\s+(\S+)/))) { bloque.i.ip = m[1]; bloque.i.mascara = m[2]; }
      else if (s === 'shutdown') bloque.i.shutdown = true;
      else if ((m = s.match(/^description\s+(.+)$/))) bloque.i.descripcion = m[1];
    }
  }
  return c;
}

/** Todas las líneas VTY de 0 a `hasta` quedan cubiertas por bloques que cumplen `cond`. */
export function vtyCumple(c: ConfigLeida, hasta: number, cond: (l: LineaLeida) => boolean): boolean {
  for (let n = 0; n <= hasta; n++) {
    const bloque = Object.entries(c.vty).find(([r]) => { const [a, b] = r.split(' ').map(Number); return n >= a && n <= b; });
    if (!bloque || !cond(bloque[1])) return false;
  }
  return true;
}

export interface IpLeida { ip?: string; mascara?: string; gateway?: string }

const IPV4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/;

export function leerIpconfig(texto: string): IpLeida {
  const l = texto.replace(/\r/g, '').split('\n');
  const r: IpLeida = {};
  for (let i = 0; i < l.length; i++) {
    const s = l[i];
    if (!r.ip && /(IPv4 Address|IP Address|Dirección IPv4|Direcci.n IP)/i.test(s)) r.ip = s.match(IPV4)?.[1];
    else if (!r.mascara && /(Subnet Mask|M.scara de subred)/i.test(s)) r.mascara = s.match(IPV4)?.[1];
    else if (!r.gateway && /(Default Gateway|Puerta de enlace)/i.test(s)) {
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
