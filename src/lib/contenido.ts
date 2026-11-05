import { getCollection, type CollectionEntry } from 'astro:content';
import { url } from './url';

export type Leccion = CollectionEntry<'lecciones'>;
export type Lab = CollectionEntry<'labs'>;

export const idProgresoLeccion = (l: Leccion) => `leccion:${l.id}`;
export const idProgresoLab = (l: Lab) => `lab:${l.id}`;
export const urlLeccion = (l: Leccion) => url(`lecciones/${l.id}/`);
export const urlLab = (l: Lab) => url(`labs/${l.id}/`);

export async function porNivel() {
  const lecciones = (await getCollection('lecciones')).sort((a, b) => a.data.orden - b.data.orden);
  const labs = (await getCollection('labs')).sort((a, b) => a.data.orden - b.data.orden);
  const grupos = new Map<number, { lecciones: Leccion[]; labs: Lab[] }>();
  for (let n = 1; n <= 5; n++) {
    grupos.set(n, {
      lecciones: lecciones.filter((l) => l.data.nivel === n),
      labs: labs.filter((l) => l.data.nivel === n),
    });
  }
  return { lecciones, labs, grupos };
}
