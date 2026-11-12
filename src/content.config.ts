import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// En qué dominio del examen 200-301 cae el tema, para cada versión.
// Si una versión no aparece, el tema no está en ese temario.
const examen = z.object({
  'v1.1': z.number().int().min(1).max(6).optional(),
  'v2.0': z.number().int().min(1).max(5).optional(),
});

const actividad = z.object({
  codigo: z.string(), // número de la actividad en NetAcad, p. ej. «2.9.1»
  tipo: z.enum(['Packet Tracer', 'Laboratorio', 'Video', 'Actividad de clase', 'Verificador de sintaxis']),
  titulo: z.string(),
  guia: z.string().optional(), // consejo propio de la app para hacer la actividad
});

// Un tema de teoría: equivale a un tema de NetAcad (p. ej. «1.2 Componentes de la red»).
const teoria = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/teoria' }),
  schema: z.object({
    curso: z.enum(['itn', 'srwe', 'ensa']),
    modulo: z.number().int().min(1),
    tema: z.string().regex(/^\d+\.\d+$/),
    titulo: z.string(),
    objetivo: z.string(),
    duracion: z.number().int(),
    examen: examen.optional(),
    actividades: z.array(actividad).default([]),
    practica: z.array(z.string()).default([]), // ids de ejercicios de la página Práctica
  }),
});

const pregunta = z
  .object({
    id: z.string(),
    tema: z.string().regex(/^\d+\.\d+$/),
    p: z.string(),
    // Texto en monoespaciado que acompaña la pregunta (configuración, salida de un comando).
    ilustracion: z.string().optional(),
    opciones: z.array(z.union([z.string(), z.number()]).transform(String)).min(2),
    // Un número para respuesta única; una lista para «elija dos» o «elija tres».
    correcta: z.union([z.number().int().min(0), z.array(z.number().int().min(0)).min(2)]),
    explicacion: z.string(),
    // Si aparece en el «Verifique su comprensión» del tema.
    verifique: z.boolean().default(false),
  })
  .refine((q) => (Array.isArray(q.correcta) ? q.correcta : [q.correcta]).every((i) => i < q.opciones.length), {
    message: 'La respuesta correcta apunta a una opción que no existe',
  });

// Banco de preguntas originales de un módulo. Alimenta las verificaciones de cada tema,
// la prueba del módulo, los exámenes de punto de control y los simulacros.
const preguntas = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/preguntas' }),
  schema: z.object({
    curso: z.enum(['itn', 'srwe', 'ensa']),
    modulo: z.number().int().min(1),
    preguntas: z.array(pregunta).min(1),
  }),
});

export const collections = { teoria, preguntas };
