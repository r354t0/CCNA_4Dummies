// MD5-crypt ($1$sal$hash), el algoritmo del «enable secret 5» de IOS. Con él, el corrector
// de Packet Tracer comprueba que el enable secret tiene la contraseña pedida sin guardarla.

const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

export function md5(datos: Uint8Array): Uint8Array {
  const largo = datos.length;
  const total = (((largo + 8) >> 6) + 1) << 6;
  const m = new Uint8Array(total);
  m.set(datos);
  m[largo] = 0x80;
  const bits = largo * 8;
  for (let i = 0; i < 4; i++) m[total - 8 + i] = (bits >>> (8 * i)) & 0xff;
  m[total - 4] = Math.floor(largo / 2 ** 29) & 0xff;

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const w = new Uint32Array(16);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = m[off + 4 * i] | (m[off + 4 * i + 1] << 8) | (m[off + 4 * i + 2] << 16) | (m[off + 4 * i + 3] << 24);
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const t = d;
      d = c;
      c = b;
      const x = (a + f + K[i] + w[g]) >>> 0;
      b = (b + ((x << S[i]) | (x >>> (32 - S[i])))) >>> 0;
      a = t;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  const r = new Uint8Array(16);
  [a0, b0, c0, d0].forEach((v, i) => { for (let j = 0; j < 4; j++) r[4 * i + j] = (v >>> (8 * j)) & 0xff; });
  return r;
}

const ABC = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const bytes = (s: string) => new TextEncoder().encode(s);
const unir = (...partes: Uint8Array[]) => {
  const r = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of partes) { r.set(p, o); o += p.length; }
  return r;
};

export function md5crypt(clave: string, sal: string): string {
  sal = sal.split('$')[0].slice(0, 8);
  const pw = bytes(clave), sl = bytes(sal);
  const alt = md5(unir(pw, sl, pw));
  const partes: Uint8Array[] = [pw, bytes('$1$'), sl];
  for (let n = pw.length; n > 0; n -= 16) partes.push(alt.slice(0, Math.min(16, n)));
  for (let i = pw.length; i; i >>= 1) partes.push(i & 1 ? new Uint8Array([0]) : pw.slice(0, 1));
  let f = md5(unir(...partes));
  for (let i = 0; i < 1000; i++) {
    const c: Uint8Array[] = [i & 1 ? pw : f];
    if (i % 3) c.push(sl);
    if (i % 7) c.push(pw);
    c.push(i & 1 ? f : pw);
    f = md5(unir(...c));
  }
  let out = '';
  const a64 = (v: number, n: number) => { while (n--) { out += ABC[v & 0x3f]; v >>= 6; } };
  a64((f[0] << 16) | (f[6] << 8) | f[12], 4);
  a64((f[1] << 16) | (f[7] << 8) | f[13], 4);
  a64((f[2] << 16) | (f[8] << 8) | f[14], 4);
  a64((f[3] << 16) | (f[9] << 8) | f[15], 4);
  a64((f[4] << 16) | (f[10] << 8) | f[5], 4);
  a64(f[11], 2);
  return `$1$${sal}$${out}`;
}

/** ¿El hash «$1$sal$…» corresponde a esta contraseña? */
export function verificarMd5crypt(clave: string, hash: string): boolean {
  const m = hash.match(/^\$1\$([^$]{0,8})\$/);
  return !!m && md5crypt(clave, m[1]) === hash;
}
