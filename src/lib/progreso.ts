// Progreso del alumno, guardado solo en su navegador.
// - ccna-progreso: { clave: true } para temas, pruebas aprobadas y ejercicios hechos.
// - ccna-notas: { clave: { mejor, intentos, ultima } } con porcentajes de exámenes.

const PROGRESO = 'ccna-progreso';
const NOTAS = 'ccna-notas';

export interface Nota {
  mejor: number;
  intentos: number;
  ultima: number;
}

function leerJson<T>(clave: string, vacio: T): T {
  try {
    return JSON.parse(localStorage.getItem(clave) || '') as T;
  } catch {
    return vacio;
  }
}

function escribir(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento disponible: el progreso solo dura esta visita */
  }
  window.dispatchEvent(new Event('ccna-progreso'));
}

export function hecho(clave: string): boolean {
  return Boolean(leerJson<Record<string, boolean>>(PROGRESO, {})[clave]);
}

export function marcar(clave: string, valor = true) {
  const p = leerJson<Record<string, boolean>>(PROGRESO, {});
  if (valor) p[clave] = true;
  else delete p[clave];
  escribir(PROGRESO, p);
}

export function nota(clave: string): Nota | undefined {
  return leerJson<Record<string, Nota>>(NOTAS, {})[clave];
}

export function registrarNota(clave: string, porcentaje: number): Nota {
  const todas = leerJson<Record<string, Nota>>(NOTAS, {});
  const previa = todas[clave];
  const n: Nota = {
    mejor: Math.max(previa?.mejor ?? 0, porcentaje),
    intentos: (previa?.intentos ?? 0) + 1,
    ultima: porcentaje,
  };
  todas[clave] = n;
  escribir(NOTAS, todas);
  return n;
}
