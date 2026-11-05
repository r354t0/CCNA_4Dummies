// Utilidades IPv4 con enteros sin signo de 32 bits.

export function ipAEntero(ip: string): number | null {
  const partes = ip.trim().split('.');
  if (partes.length !== 4) return null;
  let n = 0;
  for (const p of partes) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const o = Number(p);
    if (o > 255) return null;
    n = n * 256 + o;
  }
  return n >>> 0;
}

export function enteroAIp(n: number): string {
  return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
}

export function mascara(prefijo: number): number {
  return prefijo === 0 ? 0 : (0xffffffff << (32 - prefijo)) >>> 0;
}

export function wildcard(prefijo: number): number {
  return ~mascara(prefijo) >>> 0;
}

export function prefijoDeMascara(m: string): number | null {
  const n = ipAEntero(m);
  if (n === null) return null;
  // Una máscara válida es una serie de unos seguida de ceros.
  const inv = ~n >>> 0;
  if ((inv & (inv + 1)) !== 0) return null;
  let p = 0;
  for (let i = 31; i >= 0; i--) if ((n >>> i) & 1) p++;
  return p;
}

export interface Subred {
  red: number;
  broadcast: number;
  primero: number;
  ultimo: number;
  hosts: number;
  prefijo: number;
}

export function calcular(ip: number, prefijo: number): Subred {
  const m = mascara(prefijo);
  const red = (ip & m) >>> 0;
  const broadcast = (red | wildcard(prefijo)) >>> 0;
  if (prefijo >= 31) {
    // /31 (RFC 3021) y /32 no tienen dirección de red ni broadcast utilizables.
    return { red, broadcast, primero: red, ultimo: broadcast, hosts: prefijo === 31 ? 2 : 1, prefijo };
  }
  return { red, broadcast, primero: red + 1, ultimo: broadcast - 1, hosts: 2 ** (32 - prefijo) - 2, prefijo };
}

/** Prefijo más largo (subred más pequeña) que admite `hosts` direcciones utilizables. */
export function prefijoParaHosts(hosts: number): number {
  for (let p = 30; p >= 0; p--) if (2 ** (32 - p) - 2 >= hosts) return p;
  return 0;
}

export function aleatorio(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
