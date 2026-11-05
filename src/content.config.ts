import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// En qué dominio del examen cae el tema, para cada versión.
// Si una versión no aparece, el tema no está en ese temario.
const examen = z
  .object({
    'v1.1': z.number().int().min(1).max(6).optional(),
    'v2.0': z.number().int().min(1).max(5).optional(),
  })
  .refine((e) => e['v1.1'] !== undefined || e['v2.0'] !== undefined, {
    message: 'El tema debe pertenecer al menos a una versión del examen',
  });

const pregunta = z.object({
  p: z.string(),
  // Se aceptan números para escribir opciones como [27, 30, 32] sin comillas.
  opciones: z.array(z.union([z.string(), z.number()]).transform(String)).min(2),
  correcta: z.number().int().min(0),
  explicacion: z.string(),
});

const lecciones = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/lecciones' }),
  schema: z.object({
    titulo: z.string(),
    descripcion: z.string(),
    nivel: z.number().int().min(1).max(5),
    orden: z.number().int(),
    duracion: z.number().int(), // minutos de lectura y práctica
    examen,
    labs: z.array(z.string()).default([]),
    quiz: z.array(pregunta).default([]),
  }),
});

const labs = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/labs' }),
  schema: z.object({
    titulo: z.string(),
    descripcion: z.string(),
    nivel: z.number().int().min(1).max(5),
    orden: z.number().int(),
    duracion: z.number().int(),
    dificultad: z.enum(['Básica', 'Intermedia', 'Avanzada']),
    herramienta: z.enum(['Packet Tracer', 'GNS3', 'Packet Tracer o GNS3']),
    examen,
    tipo: z.enum(['Configuración', 'Troubleshooting']).default('Configuración'),
    dispositivos: z.array(z.string()),
    // Ruta dentro de public/labs/ cuando el archivo ya está subido, p. ej. "l1-01/l1-01.pka"
    archivo: z.string().optional(),
  }),
});

export const collections = { lecciones, labs };
