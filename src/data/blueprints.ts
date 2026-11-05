// Temarios oficiales del examen CCNA 200-301.
// v1.1: vigente hasta el 2 de febrero de 2027.
// v2.0: vigente desde el 3 de febrero de 2027.

export type Version = 'v1.1' | 'v2.0';

export interface Dominio {
  numero: number;
  nombre: string;      // traducción al español
  original: string;    // nombre oficial en inglés
  peso: number;        // porcentaje del examen
}

export const VERSIONES: Version[] = ['v1.1', 'v2.0'];

export const INICIO_V20 = '2027-02-03';

export const BLUEPRINTS: Record<Version, { vigencia: string; dominios: Dominio[] }> = {
  'v1.1': {
    vigencia: 'Hasta el 2 de febrero de 2027',
    dominios: [
      { numero: 1, nombre: 'Fundamentos de red', original: 'Network Fundamentals', peso: 20 },
      { numero: 2, nombre: 'Acceso a la red', original: 'Network Access', peso: 20 },
      { numero: 3, nombre: 'Conectividad IP', original: 'IP Connectivity', peso: 25 },
      { numero: 4, nombre: 'Servicios IP', original: 'IP Services', peso: 10 },
      { numero: 5, nombre: 'Fundamentos de seguridad', original: 'Security Fundamentals', peso: 15 },
      { numero: 6, nombre: 'Automatización y programabilidad', original: 'Automation and Programmability', peso: 10 },
    ],
  },
  'v2.0': {
    vigencia: 'Desde el 3 de febrero de 2027',
    dominios: [
      { numero: 1, nombre: 'Infraestructura y conectividad', original: 'Network Infrastructure and Connectivity', peso: 25 },
      { numero: 2, nombre: 'Switching y acceso a la red', original: 'Switching and Network Access', peso: 25 },
      { numero: 3, nombre: 'Enrutamiento IP', original: 'IP Routing', peso: 20 },
      { numero: 4, nombre: 'Servicios de red y seguridad', original: 'Network Services and Security', peso: 20 },
      { numero: 5, nombre: 'IA, operación y gestión de red', original: 'AI, and Network Operations and Management', peso: 10 },
    ],
  },
};

export function dominio(version: Version, numero: number): Dominio | undefined {
  return BLUEPRINTS[version].dominios.find((d) => d.numero === numero);
}
