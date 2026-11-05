// Ruta de estudio. Cada nivel tiene el color de un par del cable UTP (T568B)
// para reconocerlo de un vistazo en toda la app.

export interface Nivel {
  numero: number;
  nombre: string;
  resumen: string;
  color: string;       // variable CSS del color del nivel
  cable: string;       // nombre del color de cable, para accesibilidad
  disponible: boolean;
  temas: string[];     // temario previsto (incluye lo que aún no está escrito)
}

export const NIVELES: Nivel[] = [
  {
    numero: 1,
    nombre: 'Fundamentos de red',
    resumen: 'Modelos de referencia, cableado, primeros pasos en IOS, IPv4, subnetting e IPv6.',
    color: 'var(--n1)',
    cable: 'naranja',
    disponible: true,
    temas: ['OSI y TCP/IP', 'Cableado e interfaces', 'Cisco IOS y SSH', 'IPv4 y subnetting', 'VLSM', 'IPv6', 'Virtualización y nube', 'Principios de wireless'],
  },
  {
    numero: 2,
    nombre: 'Switching y acceso',
    resumen: 'VLANs, trunks, inter-VLAN, EtherChannel, CDP/LLDP y Rapid PVST+.',
    color: 'var(--n2)',
    cable: 'verde',
    disponible: false,
    temas: ['VLANs y trunks 802.1Q', 'Enrutamiento inter-VLAN', 'EtherChannel LACP', 'CDP y LLDP', 'Rapid PVST+ y protecciones', 'Arquitecturas WLAN'],
  },
  {
    numero: 3,
    nombre: 'Enrutamiento IP',
    resumen: 'Tabla de enrutamiento, rutas estáticas, OSPFv2/v3 de área única y FHRP.',
    color: 'var(--n3)',
    cable: 'azul',
    disponible: false,
    temas: ['La tabla de enrutamiento', 'Rutas estáticas y flotantes', 'OSPFv2 de área única', 'OSPFv3', 'HSRP y VRRP'],
  },
  {
    numero: 4,
    nombre: 'Servicios y seguridad',
    resumen: 'DHCP, DNS, NAT, NTP, syslog, SNMP, ACLs, seguridad de capa 2, AAA y VPN.',
    color: 'var(--n4)',
    cable: 'marrón',
    disponible: false,
    temas: ['DHCPv4 y relay', 'DNS', 'NAT y PAT', 'NTP, syslog y SNMP', 'ACLs IPv4', 'Seguridad de capa 2', 'AAA', 'VPN IPsec'],
  },
  {
    numero: 5,
    nombre: 'Automatización, IA y operación',
    resumen: 'Controladores, APIs REST y JSON, Ansible, gestión de red e IA aplicada a operaciones.',
    color: 'var(--n5)',
    cable: 'celeste (consola)',
    disponible: false,
    temas: ['Enfoques de gestión de red', 'APIs REST y JSON', 'Ansible', 'Prompts e IA agéntica'],
  },
];
