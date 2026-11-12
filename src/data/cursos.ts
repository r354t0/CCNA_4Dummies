// Estructura de los tres cursos de Cisco Networking Academy que forman el CCNA.
// La app sigue el mismo índice (curso → módulo → tema) para que el alumno pueda
// estudiar en paralelo con NetAcad. Cada curso usa el color de un par del cable UTP.

export type IdCurso = 'itn' | 'srwe' | 'ensa';

export interface Modulo {
  numero: number;
  titulo: string;
}

export interface PuntoDeControl {
  desde: number;
  hasta: number;
  titulo: string;
}

export interface Curso {
  id: IdCurso;
  sigla: string;
  titulo: string;
  resumen: string;
  color: string;
  modulos: Modulo[];
  puntosDeControl: PuntoDeControl[];
}

export const CURSOS: Curso[] = [
  {
    id: 'itn',
    sigla: 'ITN',
    titulo: 'Introducción a las redes',
    resumen: 'Cómo funciona una red: dispositivos, protocolos, capas, direccionamiento IPv4 e IPv6 y la configuración básica de switches y routers.',
    color: 'var(--n1)',
    modulos: [
      { numero: 1, titulo: 'Las redes en la actualidad' },
      { numero: 2, titulo: 'Configuración básica de switches y terminales' },
      { numero: 3, titulo: 'Protocolos y modelos' },
      { numero: 4, titulo: 'Capa física' },
      { numero: 5, titulo: 'Sistemas numéricos' },
      { numero: 6, titulo: 'Capa de enlace de datos' },
      { numero: 7, titulo: 'Switching Ethernet' },
      { numero: 8, titulo: 'Capa de red' },
      { numero: 9, titulo: 'Resolución de direcciones' },
      { numero: 10, titulo: 'Configuración básica de un router' },
      { numero: 11, titulo: 'Asignación de direcciones IPv4' },
      { numero: 12, titulo: 'Asignación de direcciones IPv6' },
      { numero: 13, titulo: 'ICMP' },
      { numero: 14, titulo: 'Capa de transporte' },
      { numero: 15, titulo: 'Capa de aplicación' },
      { numero: 16, titulo: 'Fundamentos de seguridad de la red' },
      { numero: 17, titulo: 'Crear una red pequeña' },
    ],
    puntosDeControl: [
      { desde: 1, hasta: 3, titulo: 'Conectividad básica de red y comunicaciones' },
      { desde: 4, hasta: 7, titulo: 'Conceptos de Ethernet' },
      { desde: 8, hasta: 10, titulo: 'Comunicación entre redes' },
      { desde: 11, hasta: 13, titulo: 'Direccionamiento IP' },
      { desde: 14, hasta: 15, titulo: 'Comunicaciones de aplicaciones de red' },
      { desde: 16, hasta: 17, titulo: 'Crear y proteger una red pequeña' },
    ],
  },
  {
    id: 'srwe',
    sigla: 'SRWE',
    titulo: 'Switching, enrutamiento y redes inalámbricas',
    resumen: 'VLANs, STP, EtherChannel, DHCP, redundancia de gateway, seguridad de capa 2, WLAN y rutas estáticas.',
    color: 'var(--n2)',
    modulos: [
      { numero: 1, titulo: 'Configuración básica de dispositivos' },
      { numero: 2, titulo: 'Conceptos de switching' },
      { numero: 3, titulo: 'VLANs' },
      { numero: 4, titulo: 'Enrutamiento entre VLANs' },
      { numero: 5, titulo: 'Conceptos de STP' },
      { numero: 6, titulo: 'EtherChannel' },
      { numero: 7, titulo: 'DHCPv4' },
      { numero: 8, titulo: 'SLAAC y DHCPv6' },
      { numero: 9, titulo: 'Conceptos de FHRP' },
      { numero: 10, titulo: 'Conceptos de seguridad de LAN' },
      { numero: 11, titulo: 'Configuración de seguridad del switch' },
      { numero: 12, titulo: 'Conceptos de WLAN' },
      { numero: 13, titulo: 'Configuración de WLAN' },
      { numero: 14, titulo: 'Conceptos de enrutamiento' },
      { numero: 15, titulo: 'Rutas estáticas IP' },
      { numero: 16, titulo: 'Solución de problemas de rutas estáticas y predeterminadas' },
    ],
    puntosDeControl: [
      { desde: 1, hasta: 4, titulo: 'Switching, VLANs y enrutamiento entre VLANs' },
      { desde: 5, hasta: 6, titulo: 'Redes redundantes' },
      { desde: 7, hasta: 9, titulo: 'Redes disponibles y confiables' },
      { desde: 10, hasta: 13, titulo: 'Seguridad de capa 2 y WLAN' },
      { desde: 14, hasta: 16, titulo: 'Conceptos y configuración de enrutamiento' },
    ],
  },
  {
    id: 'ensa',
    sigla: 'ENSA',
    titulo: 'Redes empresariales, seguridad y automatización',
    resumen: 'OSPF, ACLs, NAT, WAN y VPN, QoS, administración y diseño de redes, virtualización y automatización.',
    color: 'var(--n3)',
    modulos: [
      { numero: 1, titulo: 'Conceptos de OSPFv2 de área única' },
      { numero: 2, titulo: 'Configuración de OSPFv2 de área única' },
      { numero: 3, titulo: 'Conceptos de seguridad de la red' },
      { numero: 4, titulo: 'Conceptos de ACL' },
      { numero: 5, titulo: 'ACLs para la configuración IPv4' },
      { numero: 6, titulo: 'NAT para IPv4' },
      { numero: 7, titulo: 'Conceptos de WAN' },
      { numero: 8, titulo: 'Conceptos de VPN e IPsec' },
      { numero: 9, titulo: 'Conceptos de QoS' },
      { numero: 10, titulo: 'Administración de redes' },
      { numero: 11, titulo: 'Diseño de red' },
      { numero: 12, titulo: 'Solución de problemas de red' },
      { numero: 13, titulo: 'Virtualización de la red' },
      { numero: 14, titulo: 'Automatización de la red' },
    ],
    puntosDeControl: [
      { desde: 1, hasta: 2, titulo: 'OSPF de área única' },
      { desde: 3, hasta: 5, titulo: 'Seguridad de la red' },
      { desde: 6, hasta: 8, titulo: 'WAN, NAT y VPN' },
      { desde: 9, hasta: 12, titulo: 'Optimización, supervisión y solución de problemas' },
      { desde: 13, hasta: 14, titulo: 'Tecnologías de red emergentes' },
    ],
  },
];

export function curso(id: string): Curso {
  const c = CURSOS.find((x) => x.id === id);
  if (!c) throw new Error(`Curso desconocido: ${id}`);
  return c;
}

/** «1.2» → «1-2», para usar en URLs. */
export const slugTema = (tema: string) => tema.replace('.', '-');

// Claves de progreso guardadas en el navegador.
export const claveTema = (c: string, tema: string) => `t:${c}:${tema}`;
export const claveModulo = (c: string, m: number) => `p:${c}:${m}`;
export const clavePunto = (c: string, d: number, h: number) => `c:${c}:${d}-${h}`;
