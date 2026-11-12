// Enlaces entre la parte Teórica y la Práctica de un mismo módulo.
import { EJERCICIOS } from '../data/practica';
import type { IdCurso } from '../data/cursos';
import { url } from './url';

export const ejerciciosDeModulo = (curso: IdCurso, modulo: number) =>
  EJERCICIOS.filter((e) => e.curso === curso && e.modulos.includes(modulo));

export const anclaModulo = (curso: IdCurso, modulo: number) => `${curso}-${modulo}`;
export const urlPracticaModulo = (curso: IdCurso, modulo: number) => url(`practica/#${anclaModulo(curso, modulo)}`);
