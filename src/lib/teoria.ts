import { getCollection, type CollectionEntry } from 'astro:content';
import { CURSOS, curso as datosCurso, claveTema, claveModulo, clavePunto, slugTema, type IdCurso } from '../data/cursos';
import { url } from './url';

export type Tema = CollectionEntry<'teoria'>;

const orden = (t: string) => t.split('.').map(Number);
export const compararTema = (a: string, b: string) => {
  const [a1, a2] = orden(a);
  const [b1, b2] = orden(b);
  return a1 - b1 || a2 - b2;
};

export async function temas(cursoId?: IdCurso): Promise<Tema[]> {
  const todos = await getCollection('teoria');
  return todos
    .filter((t) => !cursoId || t.data.curso === cursoId)
    .sort((a, b) => a.data.curso.localeCompare(b.data.curso) || compararTema(a.data.tema, b.data.tema));
}

export const urlTema = (t: Tema) => url(`teorica/${t.data.curso}/${t.data.modulo}/${slugTema(t.data.tema)}/`);
export const urlPrueba = (c: string, m: number) => url(`teorica/${c}/${m}/prueba/`);
export const urlPunto = (c: string, d: number, h: number) => url(`teorica/${c}/punto-de-control/${d}-${h}/`);
export const urlModulo = (c: string, m: number) => url(`teorica/${c}/${m}/${m}-0/`);

export interface PreguntaPlana {
  id: string;
  curso: string;
  modulo: number;
  tema: string;
  temaTitulo: string;
  p: string;
  ilustracion?: string;
  opciones: string[];
  correcta: number | number[];
  explicacion: string;
  verifique: boolean;
}

export async function preguntas(cursoId: IdCurso, modulos?: number[]): Promise<PreguntaPlana[]> {
  const bancos = (await getCollection('preguntas')).filter(
    (b) => b.data.curso === cursoId && (!modulos || modulos.includes(b.data.modulo)),
  );
  const titulos = new Map((await temas(cursoId)).map((t) => [t.data.tema, t.data.titulo]));
  return bancos.flatMap((b) =>
    b.data.preguntas.map((q) => ({
      ...q,
      curso: cursoId,
      modulo: b.data.modulo,
      temaTitulo: titulos.get(q.tema) ?? `Tema ${q.tema}`,
    })),
  );
}

export interface ItemIndice {
  tipo: 'tema' | 'prueba' | 'punto';
  numero: string;
  titulo: string;
  href: string;
  clave: string;
}

export interface ModuloIndice {
  numero: number;
  titulo: string;
  disponible: boolean;
  items: ItemIndice[];
  claves: string[];
  punto?: ItemIndice & { disponible: boolean };
}

/** Índice de un curso para la barra lateral: módulos, temas, pruebas y puntos de control. */
export async function indice(cursoId: IdCurso): Promise<ModuloIndice[]> {
  const c = datosCurso(cursoId);
  const lista = await temas(cursoId);
  const bancos = new Set((await getCollection('preguntas')).filter((b) => b.data.curso === cursoId).map((b) => b.data.modulo));

  const modulos: ModuloIndice[] = c.modulos.map((m) => {
    const propios = lista.filter((t) => t.data.modulo === m.numero);
    const items: ItemIndice[] = propios.map((t) => ({
      tipo: 'tema',
      numero: t.data.tema,
      titulo: t.data.titulo,
      href: urlTema(t),
      clave: claveTema(cursoId, t.data.tema),
    }));
    if (propios.length && bancos.has(m.numero)) {
      items.push({
        tipo: 'prueba',
        numero: `${m.numero}.P`,
        titulo: 'Prueba del módulo',
        href: urlPrueba(cursoId, m.numero),
        clave: claveModulo(cursoId, m.numero),
      });
    }
    return { numero: m.numero, titulo: m.titulo, disponible: propios.length > 0, items, claves: items.map((i) => i.clave) };
  });

  for (const pc of c.puntosDeControl) {
    const rango = modulos.filter((m) => m.numero >= pc.desde && m.numero <= pc.hasta);
    const ultimo = rango[rango.length - 1];
    ultimo.punto = {
      tipo: 'punto',
      numero: `${pc.desde}-${pc.hasta}`,
      titulo: `Examen de punto de control: ${pc.titulo}`,
      href: urlPunto(cursoId, pc.desde, pc.hasta),
      clave: clavePunto(cursoId, pc.desde, pc.hasta),
      disponible: rango.every((m) => m.disponible && bancos.has(m.numero)),
    };
  }
  return modulos;
}

export { CURSOS };

/** Orden de lectura del curso: temas, prueba de cada módulo y puntos de control. */
export async function secuencia(cursoId: IdCurso): Promise<{ href: string; titulo: string }[]> {
  const mods = await indice(cursoId);
  return mods.flatMap((m) => [
    ...m.items.map((i) => ({ href: i.href, titulo: i.tipo === 'tema' ? `${i.numero} ${i.titulo}` : `Módulo ${m.numero}: ${i.titulo}` })),
    ...(m.punto?.disponible ? [{ href: m.punto.href, titulo: m.punto.titulo }] : []),
  ]);
}

export async function vecinos(cursoId: IdCurso, href: string) {
  const s = await secuencia(cursoId);
  const i = s.findIndex((x) => x.href === href);
  return { anterior: i > 0 ? s[i - 1] : undefined, siguiente: i >= 0 && i < s.length - 1 ? s[i + 1] : undefined };
}
