// Cifrado «tipo 7» de Cisco (service password-encryption). Es reversible: por eso se
// considera débil. Lo implementamos para mostrar contraseñas como IOS y para que el
// corrector de Packet Tracer pueda comprobar el valor real de cada contraseña.

import { md5crypt } from './md5crypt';

const XLAT = 'dsfd;kfoA,.iyewrkldJKDHSUBsgvca69834ncxv9873254k;fg87';

export function cifrar7(texto: string, semilla?: number): string {
  const s = semilla ?? [...texto].reduce((a, c) => a + c.charCodeAt(0), 0) % 16;
  let out = String(s).padStart(2, '0');
  for (let i = 0; i < texto.length; i++) {
    const v = texto.charCodeAt(i) ^ XLAT.charCodeAt((s + i) % XLAT.length);
    out += v.toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}

export function descifrar7(cifrado: string): string | null {
  const limpio = cifrado.trim();
  if (!/^\d{2}([0-9A-Fa-f]{2})*$/.test(limpio)) return null;
  const s = Number(limpio.slice(0, 2));
  if (s > 52) return null;
  let out = '';
  for (let i = 2, j = 0; i < limpio.length; i += 2, j++) {
    out += String.fromCharCode(parseInt(limpio.slice(i, i + 2), 16) ^ XLAT.charCodeAt((s + j) % XLAT.length));
  }
  return out;
}

/** Hash tipo 5 real (MD5-crypt) con una sal derivada del texto, para que sea estable. */
export function hash5(texto: string): string {
  const abc = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let h = 0x811c9dc5;
  let sal = '';
  for (let r = 0; r < 4; r++) {
    for (const c of texto + r) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193); }
    sal += abc[(h >>> 0) % 64];
  }
  return md5crypt(texto, sal);
}
