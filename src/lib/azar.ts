// Generador pseudoaleatorio con semilla. Cada ejercicio tiene un código corto
// (por ejemplo «K7Q2-M4XA») que reproduce exactamente el mismo escenario: así el
// alumno puede compartirlo y el instructor abrir el mismo caso.

const ALFABETO = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin 0, 1, I ni O para evitar confusiones

export function nuevoCodigo(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const c = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

export function normalizarCodigo(c: string): string | null {
  const limpio = c.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (limpio.length !== 8 || [...limpio].some((x) => !ALFABETO.includes(x))) return null;
  return `${limpio.slice(0, 4)}-${limpio.slice(4)}`;
}

function semillaDe(texto: string): number {
  // FNV-1a de 32 bits
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Azar {
  private s: number;

  constructor(codigo: string, contexto = '') {
    this.s = semillaDe(`${contexto}|${codigo}`) || 1;
  }

  /** Número en [0, 1). Algoritmo mulberry32. */
  siguiente(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  entero(min: number, max: number): number {
    return Math.floor(this.siguiente() * (max - min + 1)) + min;
  }

  elegir<T>(lista: readonly T[]): T {
    return lista[Math.floor(this.siguiente() * lista.length)];
  }

  mezclar<T>(lista: readonly T[]): T[] {
    const c = [...lista];
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(this.siguiente() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
    return c;
  }

  muestra<T>(lista: readonly T[], n: number): T[] {
    return this.mezclar(lista).slice(0, Math.min(n, lista.length));
  }

  probabilidad(p: number): boolean {
    return this.siguiente() < p;
  }

  mac(): string {
    // OUI de fabricantes conocidos para que se vea realista
    const oui = this.elegir(['0001.42', '0060.47', '00D0.BC', '0090.21', '000C.85', '0002.16', '00E0.F7', '0050.0F']);
    const h = () => this.entero(0, 255).toString(16).padStart(2, '0').toUpperCase();
    return `${oui}${h()}.${h()}${h()}`;
  }
}
