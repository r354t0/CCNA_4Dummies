// Motor de una consola Cisco IOS simplificada (switch Catalyst 2960), suficiente para
// practicar el módulo 2 de ITN: modos, abreviaturas, ayuda con «?», mensajes de error,
// contraseñas, banner, SVI, show y guardado de la configuración.

import { cifrar7, hash5 } from './tipo7';

export interface Linea {
  password?: string;
  login: boolean;
  loginLocal?: boolean;
  transport?: string;
  execTimeout?: [number, number];
  loggingSync: boolean;
}

export interface Interfaz {
  nombre: string; // FastEthernet0/1, Vlan1…
  ip?: string;
  mascara?: string;
  shutdown: boolean;
  descripcion?: string;
  // Capa 2 (SRWE)
  modo?: 'access' | 'trunk' | 'dynamic auto' | 'dynamic desirable'; // sin valor = dynamic auto
  accesoVlan?: number;
  vozVlan?: number;
  nativa?: number;
  permitidas?: number[]; // sin valor = todas
  nonegotiate?: boolean;
  trustCos?: boolean;
  duplex?: 'full' | 'half';
  speed?: '10' | '100' | '1000';
  sinMdix?: boolean;
}

export interface Config {
  hostname: string;
  enableSecret?: string;
  enablePassword?: string;
  spe: boolean;
  banner?: string;
  domainLookup: boolean;
  gateway?: string;
  con: Linea;
  vty: [Linea, Linea]; // vty 0 4 y vty 5 15, como los muestra un 2960
  ifs: Interfaz[];
  dominio?: string;
  usuarios?: { nombre: string; secreto?: string; password?: string; privilegio?: number }[];
  sshVersion?: number;
}

export interface Vlan { id: number; nombre: string }

type Modo = 'user' | 'priv' | 'config' | 'if' | 'line' | 'vlan';
type Espera = null | 'rsa-bits' | 'inicio' | 'clave-login' | 'clave-enable' | 'banner' | 'copiar' | 'guardar-reload' | 'confirmar-reload' | 'confirmar-erase';

export function configInicial(): Config {
  const ifs: Interfaz[] = [];
  for (let i = 1; i <= 24; i++) ifs.push({ nombre: `FastEthernet0/${i}`, shutdown: false });
  ifs.push({ nombre: 'GigabitEthernet0/1', shutdown: false }, { nombre: 'GigabitEthernet0/2', shutdown: false });
  ifs.push({ nombre: 'Vlan1', shutdown: true });
  return {
    hostname: 'Switch',
    spe: false,
    domainLookup: true,
    con: { login: false, loggingSync: false },
    vty: [{ login: false, loggingSync: false }, { login: false, loggingSync: false }],
    ifs,
  };
}

const clonar = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

// ---------- Gramática ----------

type Tok =
  | { k: 'kw'; w: string; d: string }
  | { k: 'arg'; t: 'WORD' | 'LINE' | 'IP' | 'NUM' | 'IFNUM'; d: string; min?: number; max?: number; nombre: string };

interface Entrada {
  modos: Modo[];
  sig: Tok[];
  run: (sw: Switch, a: string[], linea: string) => string[] | void;
}

const AYUDA: Record<string, string> = {
  enable: 'Turn on privileged commands', disable: 'Turn off privileged commands', exit: 'Exit from the EXEC',
  logout: 'Exit from the EXEC', show: 'Show running system information', ping: 'Send echo messages',
  configure: 'Enter configuration mode', terminal: 'Configure from the terminal', copy: 'Copy from one file to another',
  'running-config': 'Current operating configuration', 'startup-config': 'Contents of startup configuration',
  write: 'Write running configuration to memory', memory: 'Write to NV memory', reload: 'Halt and perform a cold restart',
  erase: 'Erase a filesystem', version: 'System hardware and software status', history: 'Display the session command history',
  ip: 'Global IP configuration subcommands', interface: 'Select an interface to configure', brief: 'Brief summary of IP status and configuration',
  hostname: 'Set system\'s network name', secret: 'Assign the privileged level secret', password: 'Assign the privileged level password',
  service: 'Modify use of network based services', 'password-encryption': 'Encrypt system passwords',
  banner: 'Define a login banner', motd: 'Set Message of the Day banner', line: 'Configure a terminal line',
  console: 'Primary terminal line', vty: 'Virtual terminal', 'default-gateway': 'Specify default gateway (if not routing IP)',
  'domain-lookup': 'Enable IP Domain Name System hostname translation', no: 'Negate a command or set its defaults',
  end: 'Exit from configure mode', do: 'To run exec commands in config mode', login: 'Enable password checking',
  'logging': 'Modify message logging facilities', synchronous: 'Synchronized message output', 'exec-timeout': 'Set the EXEC timeout',
  transport: 'Define transport protocols for line', input: 'Define which protocols to use when connecting to the terminal server',
  ssh: 'TCP/IP SSH protocol', telnet: 'TCP/IP Telnet protocol', all: 'All protocols', none: 'No protocols',
  address: 'Set the IP address of an interface', shutdown: 'Shutdown the selected interface', description: 'Interface specific description',
  fastethernet: 'FastEthernet IEEE 802.3', gigabitethernet: 'GigabitEthernet IEEE 802.3z', vlan: 'Catalyst Vlans',
  interfaces: 'Interface status and configuration', clock: 'Display the system clock',
  switchport: 'Set switching mode characteristics', mode: 'Set trunking mode of the interface', access: 'Set access mode characteristics of the interface',
  trunk: 'Set trunking characteristics of the interface', dynamic: 'Set trunking mode to dynamically negotiate access or trunk mode',
  auto: 'Set trunking mode dynamic negotiation parameter to AUTO', desirable: 'Set trunking mode dynamic negotiation parameter to DESIRABLE',
  native: 'Set trunking native characteristics when interface is in trunking mode', allowed: 'Set allowed VLAN characteristics when interface is in trunking mode',
  nonegotiate: 'Device will not engage in negotiation protocol on this interface', voice: 'Voice appliance attributes',
  name: 'Ascii name of the VLAN', crypto: 'Encryption module', key: 'Long term key operations', generate: 'Generate new keys',
  rsa: 'Generate RSA keys', zeroize: 'Remove keys', 'general-keys': 'Generate a general purpose RSA key pair for signing and encryption',
  modulus: 'Provide number of modulus bits on the command line', 'domain-name': 'Define the default domain name',
  username: 'Establish User Name Authentication', privilege: 'Set user privilege level', local: 'Local password checking',
  duplex: 'Configure duplex operation.', full: 'Force full duplex operation', half: 'Force half-duplex operation',
  speed: 'Configure speed operation.', mdix: 'Set Media Dependent Interface with Crossover', range: 'interface range command',
  mls: 'mls interface commands', qos: 'qos command keyword', trust: 'trust keyword', cos: 'cos keyword',
};

function sig(texto: string): Tok[] {
  return (texto.match(/<[^>]*>|\S+/g) ?? []).map((p) => {
    const m = p.match(/^<(.+)>$/);
    if (!m) return { k: 'kw', w: p, d: AYUDA[p] ?? '' };
    const [nombre, d] = m[1].split('|');
    const rango = nombre.match(/^(\d+)-(\d+)$/);
    if (rango) return { k: 'arg', t: 'NUM', nombre, d: d ?? '', min: Number(rango[1]), max: Number(rango[2]) };
    const t = nombre === 'A.B.C.D' ? 'IP' : nombre === 'LINE' ? 'LINE' : nombre === 'x/y' ? 'IFNUM' : 'WORD';
    return { k: 'arg', t, nombre, d: d ?? '' };
  });
}

const ipValida = (s: string) => /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(s) && s.split('.').every((o) => Number(o) <= 255);

function mascaraValida(m: string) {
  if (!ipValida(m)) return false;
  const n = m.split('.').reduce((a, o) => a * 256 + Number(o), 0);
  const inv = (~n) >>> 0;
  return (inv & (inv + 1)) === 0 && n !== 0;
}

const red = (ip: string, m: string) => {
  const a = ip.split('.').map(Number);
  const b = m.split('.').map(Number);
  return a.map((x, i) => x & b[i]).join('.');
};

function ok(...l: string[]) { return l; }

const E: Entrada[] = [
  // EXEC
  { modos: ['user'], sig: sig('enable'), run: (sw) => sw.pedirEnable() },
  { modos: ['priv'], sig: sig('enable'), run: () => [] },
  { modos: ['priv'], sig: sig('disable'), run: (sw) => { sw.modo = 'user'; } },
  { modos: ['user', 'priv'], sig: sig('exit'), run: (sw) => sw.cerrarSesion() },
  { modos: ['user', 'priv'], sig: sig('logout'), run: (sw) => sw.cerrarSesion() },
  { modos: ['priv'], sig: sig('configure terminal'), run: (sw) => { sw.modo = 'config'; return ok('Enter configuration commands, one per line.  End with CNTL/Z.'); } },
  { modos: ['priv'], sig: sig('show running-config'), run: (sw) => sw.runningConfig().split('\n') },
  { modos: ['priv'], sig: sig('show startup-config'), run: (sw) => (sw.startup ? sw.runningConfig(sw.startup, true).split('\n') : ok('startup-config is not present')) },
  { modos: ['user', 'priv'], sig: sig('show ip interface brief'), run: (sw) => sw.ipIntBrief() },
  { modos: ['user', 'priv'], sig: sig('show version'), run: (sw) => sw.version() },
  { modos: ['user', 'priv'], sig: sig('show history'), run: (sw) => sw.historial.slice(-10).map((h) => `  ${h}`) },
  { modos: ['user', 'priv'], sig: sig('show clock'), run: () => ok(`*${new Date().toTimeString().slice(0, 8)}.000 UTC ${new Date().toDateString()}`) },
  { modos: ['priv'], sig: sig('copy running-config startup-config'), run: (sw) => { sw.espera = 'copiar'; return ok('Destination filename [startup-config]? '); } },
  { modos: ['priv'], sig: sig('write memory'), run: (sw) => sw.guardar() },
  { modos: ['priv'], sig: sig('write'), run: (sw) => sw.guardar() },
  { modos: ['priv'], sig: sig('reload'), run: (sw) => sw.pedirReload() },
  { modos: ['priv'], sig: sig('erase startup-config'), run: (sw) => { sw.espera = 'confirmar-erase'; return ok('Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]'); } },
  { modos: ['user', 'priv'], sig: sig('ping <A.B.C.D|Ping destination address>'), run: (sw, a) => sw.ping(a[0]) },
  { modos: ['user', 'priv'], sig: sig('show ip ssh'), run: (sw) => sw.showIpSsh() },
  { modos: ['user', 'priv'], sig: sig('show vlan brief'), run: (sw) => sw.showVlanBrief() },
  { modos: ['user', 'priv'], sig: sig('show vlan'), run: (sw) => sw.showVlanBrief() },
  { modos: ['user', 'priv'], sig: sig('show interfaces trunk'), run: (sw) => sw.showTrunk() },
  { modos: ['user', 'priv'], sig: sig('show interfaces <WORD|Interface> switchport'), run: (sw, a) => sw.showSwitchport(a[0]) },

  // Configuración global
  { modos: ['config'], sig: sig('hostname <WORD|This system\'s network name>'), run: (sw, a) => sw.ponerHostname(a[0]) },
  { modos: ['config'], sig: sig('no hostname'), run: (sw) => { sw.cfg.hostname = 'Switch'; } },
  { modos: ['config'], sig: sig('enable secret <LINE|The UNENCRYPTED (cleartext) \'enable\' secret>'), run: (sw, a) => { sw.cfg.enableSecret = a[0]; } },
  { modos: ['config'], sig: sig('enable password <LINE|The UNENCRYPTED (cleartext) \'enable\' password>'), run: (sw, a) => { sw.cfg.enablePassword = a[0]; } },
  { modos: ['config'], sig: sig('no enable secret'), run: (sw) => { sw.cfg.enableSecret = undefined; } },
  { modos: ['config'], sig: sig('no enable password'), run: (sw) => { sw.cfg.enablePassword = undefined; } },
  { modos: ['config'], sig: sig('service password-encryption'), run: (sw) => { sw.cfg.spe = true; } },
  { modos: ['config'], sig: sig('no service password-encryption'), run: (sw) => { sw.cfg.spe = false; } },
  { modos: ['config'], sig: sig('banner motd <LINE|c banner-text c, where \'c\' is a delimiting character>'), run: (sw, a) => sw.banner(a[0]) },
  { modos: ['config'], sig: sig('no banner motd'), run: (sw) => { sw.cfg.banner = undefined; } },
  { modos: ['config'], sig: sig('no ip domain-lookup'), run: (sw) => { sw.cfg.domainLookup = false; } },
  { modos: ['config'], sig: sig('ip domain-lookup'), run: (sw) => { sw.cfg.domainLookup = true; } },
  { modos: ['config'], sig: sig('ip default-gateway <A.B.C.D|IP address of default gateway>'), run: (sw, a) => { sw.cfg.gateway = a[0]; } },
  { modos: ['config'], sig: sig('no ip default-gateway'), run: (sw) => { sw.cfg.gateway = undefined; } },
  { modos: ['config'], sig: sig('line console <0-0|First Line number>'), run: (sw) => { sw.modo = 'line'; sw.lineas = ['con']; } },
  { modos: ['config'], sig: sig('line vty <0-15|First Line number> <0-15|Last Line number>'), run: (sw, a) => sw.entrarVty(Number(a[0]), Number(a[1])) },
  { modos: ['config'], sig: sig('line vty <0-15|First Line number>'), run: (sw, a) => sw.entrarVty(Number(a[0]), Number(a[0])) },
  { modos: ['config'], sig: sig('interface fastethernet <x/y|FastEthernet interface number>'), run: (sw, a) => sw.entrarIf('FastEthernet', a[0]) },
  { modos: ['config'], sig: sig('interface gigabitethernet <x/y|GigabitEthernet interface number>'), run: (sw, a) => sw.entrarIf('GigabitEthernet', a[0]) },
  { modos: ['config'], sig: sig('interface vlan <1-4094|Vlan interface number>'), run: (sw, a) => sw.entrarIf('Vlan', a[0]) },
  { modos: ['config'], sig: sig('interface range <LINE|Interface range, for example fa0/1 - 5>'), run: (sw, a) => sw.entrarRango(a[0]) },
  { modos: ['config'], sig: sig('vlan <LINE|ISL VLAN IDs 1-4094>'), run: (sw, a) => sw.entrarVlan(a[0]) },
  { modos: ['config'], sig: sig('no vlan <LINE|ISL VLAN IDs 1-4094>'), run: (sw, a) => sw.borrarVlan(a[0]) },
  { modos: ['config'], sig: sig('ip domain-name <WORD|Default domain name>'), run: (sw, a) => { sw.cfg.dominio = a[0]; } },
  { modos: ['config'], sig: sig('no ip domain-name'), run: (sw) => { sw.cfg.dominio = undefined; } },
  { modos: ['config'], sig: sig('crypto key generate rsa general-keys modulus <360-4096|size of the key modulus>'), run: (sw, a) => sw.generarRsa(Number(a[0])) },
  { modos: ['config'], sig: sig('crypto key generate rsa'), run: (sw) => sw.pedirRsa() },
  { modos: ['config'], sig: sig('crypto key zeroize rsa'), run: (sw) => sw.borrarRsa() },
  { modos: ['config'], sig: sig('ip ssh version <1-2|Protocol version>'), run: (sw, a) => sw.versionSsh(Number(a[0])) },
  { modos: ['config'], sig: sig('no ip ssh version'), run: (sw) => { sw.cfg.sshVersion = undefined; } },
  { modos: ['config'], sig: sig('username <WORD|User name> privilege <0-15|User privilege level> secret <LINE|The UNENCRYPTED (cleartext) user secret>'), run: (sw, a) => sw.usuario(a[0], { secreto: a[2], privilegio: Number(a[1]) }) },
  { modos: ['config'], sig: sig('username <WORD|User name> secret <LINE|The UNENCRYPTED (cleartext) user secret>'), run: (sw, a) => sw.usuario(a[0], { secreto: a[1] }) },
  { modos: ['config'], sig: sig('username <WORD|User name> password <LINE|The UNENCRYPTED (cleartext) user password>'), run: (sw, a) => sw.usuario(a[0], { password: a[1] }) },
  { modos: ['config'], sig: sig('no username <WORD|User name>'), run: (sw, a) => { sw.cfg.usuarios = (sw.cfg.usuarios ?? []).filter((u) => u.nombre !== a[0]); } },

  // Comunes a los modos de configuración
  { modos: ['config', 'if', 'line', 'vlan'], sig: sig('end'), run: (sw) => { sw.modo = 'priv'; return ok('%SYS-5-CONFIG_I: Configured from console by console'); } },
  { modos: ['config'], sig: sig('exit'), run: (sw) => { sw.modo = 'priv'; return ok('%SYS-5-CONFIG_I: Configured from console by console'); } },
  { modos: ['if', 'line', 'vlan'], sig: sig('exit'), run: (sw) => { sw.modo = 'config'; } },
  { modos: ['config', 'if', 'line', 'vlan'], sig: sig('do <LINE|Exec Command>'), run: (sw, a) => sw.hacerDo(a[0]) },

  // Línea
  { modos: ['line'], sig: sig('password <LINE|The UNENCRYPTED (cleartext) line password>'), run: (sw, a) => sw.enLineas((l) => { l.password = a[0]; }) },
  { modos: ['line'], sig: sig('no password'), run: (sw) => sw.enLineas((l) => { l.password = undefined; }) },
  { modos: ['line'], sig: sig('login'), run: (sw) => sw.enLineas((l) => { l.login = true; l.loginLocal = false; }, true) },
  { modos: ['line'], sig: sig('login local'), run: (sw) => sw.enLineas((l) => { l.login = true; l.loginLocal = true; }) },
  { modos: ['line'], sig: sig('no login'), run: (sw) => sw.enLineas((l) => { l.login = false; l.loginLocal = false; }) },
  { modos: ['line'], sig: sig('logging synchronous'), run: (sw) => sw.enLineas((l) => { l.loggingSync = true; }) },
  { modos: ['line'], sig: sig('no logging synchronous'), run: (sw) => sw.enLineas((l) => { l.loggingSync = false; }) },
  { modos: ['line'], sig: sig('exec-timeout <0-35791|Timeout in minutes> <0-2147483|Timeout in seconds>'), run: (sw, a) => sw.enLineas((l) => { l.execTimeout = [Number(a[0]), Number(a[1])]; }) },
  { modos: ['line'], sig: sig('exec-timeout <0-35791|Timeout in minutes>'), run: (sw, a) => sw.enLineas((l) => { l.execTimeout = [Number(a[0]), 0]; }) },
  { modos: ['line'], sig: sig('no exec-timeout'), run: (sw) => sw.enLineas((l) => { l.execTimeout = undefined; }) },
  { modos: ['line'], sig: sig('transport input ssh telnet'), run: (sw) => sw.transporte('ssh telnet') },
  { modos: ['line'], sig: sig('transport input telnet ssh'), run: (sw) => sw.transporte('telnet ssh') },
  { modos: ['line'], sig: sig('transport input ssh'), run: (sw) => sw.transporte('ssh') },
  { modos: ['line'], sig: sig('transport input telnet'), run: (sw) => sw.transporte('telnet') },
  { modos: ['line'], sig: sig('transport input all'), run: (sw) => sw.transporte('all') },
  { modos: ['line'], sig: sig('transport input none'), run: (sw) => sw.transporte('none') },

  // Interfaz
  { modos: ['if'], sig: sig('ip address <A.B.C.D|IP address> <A.B.C.D|IP subnet mask>'), run: (sw, a) => sw.ponerIp(a[0], a[1]) },
  { modos: ['if'], sig: sig('no ip address'), run: (sw) => { const i = sw.ifActual(); i.ip = undefined; i.mascara = undefined; } },
  { modos: ['if'], sig: sig('shutdown'), run: (sw) => sw.apagar(true) },
  { modos: ['if'], sig: sig('no shutdown'), run: (sw) => sw.apagar(false) },
  { modos: ['if'], sig: sig('description <LINE|Up to 240 characters describing this interface>'), run: (sw, a) => { sw.ifActual().descripcion = a[0]; } },
  { modos: ['if'], sig: sig('no description'), run: (sw) => { sw.ifActual().descripcion = undefined; } },

  // VLAN
  { modos: ['vlan'], sig: sig('name <WORD|The ascii name for the VLAN>'), run: (sw, a) => sw.nombrarVlan(a[0]) },
  { modos: ['vlan'], sig: sig('no name'), run: (sw) => sw.nombrarVlan(null) },

  // Puertos de switch
  { modos: ['if'], sig: sig('switchport mode access'), run: (sw) => sw.enPuertos((i) => { i.modo = 'access'; }) },
  { modos: ['if'], sig: sig('switchport mode trunk'), run: (sw) => sw.enPuertos((i) => { i.modo = 'trunk'; }) },
  { modos: ['if'], sig: sig('switchport mode dynamic auto'), run: (sw) => sw.modoDinamico('dynamic auto') },
  { modos: ['if'], sig: sig('switchport mode dynamic desirable'), run: (sw) => sw.modoDinamico('dynamic desirable') },
  { modos: ['if'], sig: sig('no switchport mode'), run: (sw) => sw.enPuertos((i) => { i.modo = undefined; }) },
  { modos: ['if'], sig: sig('switchport access vlan <1-4094|VLAN ID of the VLAN when this port is in access mode>'), run: (sw, a) => sw.vlanAcceso(Number(a[0])) },
  { modos: ['if'], sig: sig('no switchport access vlan'), run: (sw) => sw.enPuertos((i) => { i.accesoVlan = undefined; }) },
  { modos: ['if'], sig: sig('switchport voice vlan <1-4094|Vlan for voice traffic>'), run: (sw, a) => sw.vlanVoz(Number(a[0])) },
  { modos: ['if'], sig: sig('no switchport voice vlan'), run: (sw) => sw.enPuertos((i) => { i.vozVlan = undefined; }) },
  { modos: ['if'], sig: sig('switchport trunk native vlan <1-4094|VLAN ID of the native VLAN when this port is in trunking mode>'), run: (sw, a) => sw.enPuertos((i) => { i.nativa = Number(a[0]) === 1 ? undefined : Number(a[0]); }) },
  { modos: ['if'], sig: sig('no switchport trunk native vlan'), run: (sw) => sw.enPuertos((i) => { i.nativa = undefined; }) },
  { modos: ['if'], sig: sig('switchport trunk allowed vlan <LINE|VLAN IDs of the allowed VLANs when this port is in trunking mode>'), run: (sw, a) => sw.permitidas(a[0]) },
  { modos: ['if'], sig: sig('no switchport trunk allowed vlan'), run: (sw) => sw.enPuertos((i) => { i.permitidas = undefined; }) },
  { modos: ['if'], sig: sig('switchport nonegotiate'), run: (sw) => sw.noNegociar(true) },
  { modos: ['if'], sig: sig('no switchport nonegotiate'), run: (sw) => sw.noNegociar(false) },
  { modos: ['if'], sig: sig('mls qos trust cos'), run: (sw) => sw.enPuertos((i) => { i.trustCos = true; }) },
  { modos: ['if'], sig: sig('no mls qos trust'), run: (sw) => sw.enPuertos((i) => { i.trustCos = false; }) },
  { modos: ['if'], sig: sig('duplex full'), run: (sw) => sw.enPuertos((i) => { i.duplex = 'full'; }) },
  { modos: ['if'], sig: sig('duplex half'), run: (sw) => sw.enPuertos((i) => { i.duplex = 'half'; }) },
  { modos: ['if'], sig: sig('duplex auto'), run: (sw) => sw.enPuertos((i) => { i.duplex = undefined; }) },
  { modos: ['if'], sig: sig('speed 10'), run: (sw) => sw.enPuertos((i) => { i.speed = '10'; }) },
  { modos: ['if'], sig: sig('speed 100'), run: (sw) => sw.enPuertos((i) => { i.speed = '100'; }) },
  { modos: ['if'], sig: sig('speed 1000'), run: (sw) => sw.velocidadGiga() },
  { modos: ['if'], sig: sig('speed auto'), run: (sw) => sw.enPuertos((i) => { i.speed = undefined; }) },
  { modos: ['if'], sig: sig('mdix auto'), run: (sw) => sw.enPuertos((i) => { i.sinMdix = undefined; }) },
  { modos: ['if'], sig: sig('no mdix auto'), run: (sw) => sw.enPuertos((i) => { i.sinMdix = true; }) },
];

// ---------- Motor ----------

export interface Resultado {
  salida: string[];
  ocultar?: boolean; // la siguiente entrada es una contraseña: no se muestra
}

export class Switch {
  cfg: Config;
  startup: Config | null;
  modo: Modo = 'user';
  lineas: ('con' | 'vty0' | 'vty1')[] = [];
  iface = '';
  ifaces: string[] = [];
  vlanSel: number[] = [];
  vlans: Vlan[]; // vlan.dat: no forma parte de la configuración
  rsa: number | null; // bits de las claves RSA (NVRAM)
  espera: Espera = 'inicio';
  intentos = 0;
  historial: string[] = [];
  delim = '';
  textoBanner = '';
  conectados: Set<string>; // puertos con un equipo conectado
  vecinos: string[]; // IP de equipos que responden ping en la red del switch
  visitados = new Set<Modo>();

  constructor(opciones: { config?: Config; startup?: Config | null; conectados?: string[]; vecinos?: string[]; vlans?: Vlan[]; rsa?: number } = {}) {
    this.cfg = opciones.config ? clonar(opciones.config) : configInicial();
    this.vlans = opciones.vlans ? clonar(opciones.vlans) : [];
    this.rsa = opciones.rsa ?? null;
    this.startup = opciones.startup === undefined ? null : opciones.startup && clonar(opciones.startup);
    this.conectados = new Set(opciones.conectados ?? ['FastEthernet0/1', 'GigabitEthernet0/1']);
    this.vecinos = opciones.vecinos ?? [];
  }

  prompt(): string {
    if (this.espera === 'clave-login' || this.espera === 'clave-enable') return 'Password: ';
    if (this.espera === 'rsa-bits') return 'How many bits in the modulus [512]: ';
    if (this.espera === 'inicio' || this.espera === 'banner') return '';
    if (this.espera) return '';
    const h = this.cfg.hostname;
    return { user: `${h}>`, priv: `${h}#`, config: `${h}(config)#`, if: this.ifaces.length > 1 ? `${h}(config-if-range)#` : `${h}(config-if)#`, line: `${h}(config-line)#`, vlan: `${h}(config-vlan)#` }[this.modo];
  }

  guardado(): boolean {
    return this.startup !== null && JSON.stringify(this.startup) === JSON.stringify(this.cfg);
  }

  /** Mensaje de bienvenida al abrir la consola. */
  arrancar(): string[] {
    return ['Switch con0 is now available', '', '', '', 'Press RETURN to get started.'];
  }

  // ----- Entrada del usuario -----

  entrada(texto: string): Resultado {
    switch (this.espera) {
      case 'inicio': return this.iniciarSesion();
      case 'clave-login': return this.validarLogin(texto);
      case 'clave-enable': return this.validarEnable(texto);
      case 'banner': return { salida: this.seguirBanner(texto) };
      case 'rsa-bits': {
        this.espera = null;
        const t = texto.trim();
        const bits = t === '' ? 512 : Number(t);
        if (!/^\d*$/.test(t) || bits < 360 || bits > 4096) return { salida: ['% You must choose a key modulus between 360 and 4096'] };
        return { salida: this.generarRsa(bits, true) };
      }
      case 'copiar':
        this.espera = null;
        if (texto.trim() && !'startup-config'.startsWith(texto.trim())) return { salida: ['%Error opening flash:' + texto.trim() + ' (No such file or directory)'] };
        return { salida: this.guardar() };
      case 'guardar-reload': {
        const r = texto.trim().toLowerCase();
        if (r.startsWith('y')) { this.guardarSilencio(); this.espera = 'confirmar-reload'; return { salida: ['Building configuration...', '[OK]', 'Proceed with reload? [confirm]'] }; }
        if (r.startsWith('n')) { this.espera = 'confirmar-reload'; return { salida: ['Proceed with reload? [confirm]'] }; }
        return { salida: ['% Please answer \'yes\' or \'no\'.', 'System configuration has been modified. Save? [yes/no]:'] };
      }
      case 'confirmar-reload':
        this.espera = null;
        if (texto.trim() && !texto.trim().toLowerCase().startsWith('y')) return { salida: [] };
        return { salida: this.reiniciar() };
      case 'confirmar-erase':
        this.espera = null;
        if (texto.trim() && !texto.trim().toLowerCase().startsWith('y')) return { salida: [] };
        this.startup = null;
        return { salida: ['[OK]', 'Erase of nvram: complete', '%SYS-7-NV_BLOCK_INIT: Initialized the geometry of nvram'] };
    }
    const linea = texto.replace(/\s+$/, '');
    if (!linea.trim()) return { salida: [] };
    if (!linea.trim().startsWith('!')) this.historial.push(linea.trim());
    return { salida: this.ejecutar(linea), ocultar: this.espera === 'clave-enable' };
  }

  private iniciarSesion(): Resultado {
    const salida: string[] = [];
    if (this.cfg.banner) salida.push(...this.cfg.banner.split('\n'), '');
    if (this.cfg.con.login) {
      if (!this.cfg.con.password) {
        return { salida: [...salida, '', 'Password required, but none set', '', 'Press RETURN to get started.'] };
      }
      salida.push('', 'User Access Verification', '');
      this.espera = 'clave-login';
      this.intentos = 0;
      return { salida, ocultar: true };
    }
    this.espera = null;
    this.modo = 'user';
    this.visitados.add('user');
    return { salida };
  }

  private validarLogin(t: string): Resultado {
    if (t === this.cfg.con.password) { this.espera = null; this.modo = 'user'; this.visitados.add('user'); return { salida: [] }; }
    this.intentos++;
    if (this.intentos >= 3) { this.espera = 'inicio'; return { salida: ['% Bad passwords', '', 'Press RETURN to get started.'] }; }
    return { salida: [], ocultar: true };
  }

  pedirEnable(): string[] {
    if (this.cfg.enableSecret || this.cfg.enablePassword) { this.espera = 'clave-enable'; this.intentos = 0; return []; }
    this.modo = 'priv';
    this.visitados.add('priv');
    return [];
  }

  private validarEnable(t: string): Resultado {
    const correcta = this.cfg.enableSecret ?? this.cfg.enablePassword;
    if (t === correcta) { this.espera = null; this.modo = 'priv'; this.visitados.add('priv'); return { salida: [] }; }
    this.intentos++;
    if (this.intentos >= 3) { this.espera = null; return { salida: ['% Bad secrets', ''] }; }
    return { salida: [], ocultar: true };
  }

  cerrarSesion(): string[] {
    this.modo = 'user';
    this.espera = 'inicio';
    return ['', `${this.cfg.hostname} con0 is now available`, '', '', '', 'Press RETURN to get started.'];
  }

  // ----- Tokenización y búsqueda en la gramática -----

  private tokens(linea: string): { t: string; col: number }[] {
    const out: { t: string; col: number }[] = [];
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(linea))) out.push({ t: m[0], col: m.index });
    // «interface fa0/1» o «int vlan1»: separa el tipo del número
    if (out.length >= 2 && 'interface'.startsWith(out[0].t.toLowerCase()) && out[0].t.length >= 3) {
      const mm = out[1].t.match(/^([a-zA-Z-]+)(\d[\d/]*)$/);
      if (mm) out.splice(1, 1, { t: mm[1], col: out[1].col }, { t: mm[2], col: out[1].col + mm[1].length });
    }
    return out;
  }

  private entradasDe(modo: Modo): Entrada[] {
    return E.filter((e) => e.modos.includes(modo));
  }

  private coincide(tok: Tok, s: string): boolean {
    if (tok.k === 'kw') return tok.w.startsWith(s.toLowerCase());
    switch (tok.t) {
      case 'WORD': case 'LINE': return true;
      case 'IP': return ipValida(s);
      case 'NUM': return /^\d+$/.test(s) && Number(s) >= tok.min! && Number(s) <= tok.max!;
      case 'IFNUM': return /^\d+\/\d+$/.test(s);
    }
  }

  /**
   * Busca las entradas que aceptan los tokens. Devuelve el error de IOS correspondiente
   * o las entradas completas, junto con los argumentos.
   */
  private analizar(linea: string, modo: Modo) {
    const toks = this.tokens(linea);
    let cand = this.entradasDe(modo).map((e) => ({ e, args: [] as string[], fin: false }));
    for (let i = 0; i < toks.length; i++) {
      const s = toks[i].t;
      const vivos = cand.filter((c) => !c.fin && i < c.e.sig.length && this.coincide(c.e.sig[i], s));
      const conLinea = cand.filter((c) => c.fin);
      if (!vivos.length && !conLinea.length) return { error: 'invalido' as const, pos: toks[i].col, i, toks };
      // Desambiguación de palabras clave
      const kws = [...new Set(vivos.map((c) => c.e.sig[i]).filter((t) => t.k === 'kw').map((t) => (t as { w: string }).w))];
      const exacta = kws.find((w) => w === s.toLowerCase());
      if (kws.length > 1 && !exacta && vivos.every((c) => c.e.sig[i].k === 'kw')) {
        return { error: 'ambiguo' as const, texto: toks.slice(0, i + 1).map((t) => t.t).join(' '), i, toks };
      }
      cand = [
        ...conLinea,
        ...vivos
          .filter((c) => c.e.sig[i].k !== 'kw' || !exacta || (c.e.sig[i] as { w: string }).w === exacta)
          .map((c) => {
            const tok = c.e.sig[i];
            if (tok.k === 'arg' && tok.t === 'LINE') return { ...c, args: [...c.args, linea.slice(toks[i].col)], fin: true };
            return { ...c, args: tok.k === 'arg' ? [...c.args, s] : c.args };
          }),
      ];
    }
    const completas = cand.filter((c) => c.fin || c.e.sig.length === toks.length);
    if (!completas.length) return { error: 'incompleto' as const, toks };
    return { ok: completas[0], toks };
  }

  ejecutar(linea: string): string[] {
    const largo = this.prompt().length;
    let r = this.analizar(linea, this.modo);
    // En un submodo, IOS acepta los comandos de configuración global y sale del submodo.
    if ('error' in r && (this.modo === 'if' || this.modo === 'line' || this.modo === 'vlan')) {
      const g = this.analizar(linea, 'config');
      if ('ok' in g && g.ok) { this.modo = 'config'; r = g; }
    }
    if ('error' in r) {
      if (r.error === 'ambiguo') return [`% Ambiguous command:  "${r.texto}"`];
      if (r.error === 'incompleto') return ['% Incomplete command.', ''];
      if ((this.modo === 'user' || this.modo === 'priv') && r.i === 0) {
        const palabra = r.toks[0].t;
        return this.cfg.domainLookup
          ? [`Translating "${palabra}"...domain server (255.255.255.255)`, '% Unknown command or computer name, or unable to find computer address']
          : [`Translating "${palabra}"`, '% Unknown command or computer name, or unable to find computer address'];
      }
      return [' '.repeat(largo + (r.pos ?? 0)) + '^', "% Invalid input detected at '^' marker.", ''];
    }
    const salida = r.ok!.e.run(this, r.ok!.args, linea) ?? [];
    this.visitados.add(this.modo);
    return salida;
  }

  /** Ayuda contextual: lo que el usuario escribió antes del «?». */
  ayuda(linea: string): string[] {
    const sinEspacio = !/\s$/.test(linea) && linea.length > 0;
    const toks = this.tokens(linea);
    const previos = sinEspacio ? toks.slice(0, -1) : toks;
    const parcial = sinEspacio ? toks[toks.length - 1].t.toLowerCase() : '';
    const modos: Modo[] = this.modo === 'if' || this.modo === 'line' || this.modo === 'vlan' ? [this.modo, 'config'] : [this.modo];
    const opciones = new Map<string, string>();
    let cr = false;
    for (const modo of modos) {
      let cand = this.entradasDe(modo);
      previos.forEach((t, i) => {
        cand = cand.filter((e) => i < e.sig.length && (this.coincide(e.sig[i], t.t) || (e.sig[i].k === 'arg' && (e.sig[i] as { t: string }).t === 'LINE')));
      });
      const n = previos.length;
      for (const e of cand) {
        if (e.sig.slice(0, n).some((t) => t.k === 'arg' && t.t === 'LINE')) { cr = true; continue; }
        if (e.sig.length === n) { cr = true; continue; }
        const t = e.sig[n];
        if (t.k === 'kw') { if (t.w.startsWith(parcial)) opciones.set(t.w, t.d); }
        else if (!sinEspacio) opciones.set(t.t === 'IP' ? 'A.B.C.D' : t.t === 'NUM' ? `<${t.nombre}>` : t.t === 'LINE' ? 'LINE' : t.t === 'IFNUM' ? '<0-1>' : 'WORD', t.d);
      }
      if (opciones.size && modo === this.modo) break;
    }
    if (sinEspacio) {
      if (!opciones.size) return ['% Unrecognized command'];
      return [[...opciones.keys()].sort().join('  ')];
    }
    if (!opciones.size && !cr) return ['% Unrecognized command'];
    const ancho = Math.max(4, ...[...opciones.keys()].map((k) => k.length)) + 2;
    const l = [...opciones.entries()].sort().map(([k, d]) => `  ${k.padEnd(ancho)}${d}`);
    if (cr) l.push('  <cr>');
    return l;
  }

  /** Completa la última palabra con Tab si es inequívoca. */
  completar(linea: string): string {
    if (/\s$/.test(linea) || !linea.trim()) return linea;
    const toks = this.tokens(linea);
    const ultimo = toks[toks.length - 1];
    const previos = toks.slice(0, -1);
    const modos: Modo[] = this.modo === 'if' || this.modo === 'line' || this.modo === 'vlan' ? [this.modo, 'config'] : [this.modo];
    const palabras = new Set<string>();
    for (const modo of modos) {
      let cand = this.entradasDe(modo);
      previos.forEach((t, i) => { cand = cand.filter((e) => i < e.sig.length && this.coincide(e.sig[i], t.t)); });
      cand.forEach((e) => { const t = e.sig[previos.length]; if (t?.k === 'kw' && t.w.startsWith(ultimo.t.toLowerCase())) palabras.add(t.w); });
    }
    if (palabras.size !== 1) return linea;
    return linea.slice(0, ultimo.col) + [...palabras][0] + ' ';
  }

  // ----- Acciones -----

  ponerHostname(h: string): string[] | void {
    if (!/^[A-Za-z]/.test(h)) return ['% Hostname contains one or more illegal characters.'];
    if (!/^[A-Za-z0-9-]+$/.test(h) || !/[A-Za-z0-9]$/.test(h) || h.length > 63) return ['% Hostname contains one or more illegal characters.'];
    this.cfg.hostname = h;
  }

  banner(resto: string): string[] | void {
    // resto = «motd» ya consumido; aquí llega el texto desde el delimitador
    const texto = resto.trimStart();
    const d = texto[0];
    const fin = texto.indexOf(d, 1);
    if (fin > 0) { this.cfg.banner = texto.slice(1, fin); return; }
    this.delim = d;
    this.textoBanner = texto.slice(1);
    this.espera = 'banner';
    return [`Enter TEXT message.  End with the character '${d}'.`];
  }

  private seguirBanner(linea: string): string[] {
    const fin = linea.indexOf(this.delim);
    if (fin < 0) { this.textoBanner += `${this.textoBanner ? '\n' : ''}${linea}`; return []; }
    this.textoBanner += `${this.textoBanner ? '\n' : ''}${linea.slice(0, fin)}`;
    this.cfg.banner = this.textoBanner.replace(/^\n/, '');
    this.espera = null;
    return [];
  }

  entrarVty(a: number, b: number): string[] | void {
    if (b < a) return ['%Invalid line range'];
    this.lineas = [];
    if (a <= 4) this.lineas.push('vty0');
    if (b >= 5) this.lineas.push('vty1');
    this.modo = 'line';
  }

  enLineas(f: (l: Linea) => void, avisarLogin = false): string[] | void {
    for (const k of this.lineas) f(k === 'con' ? this.cfg.con : this.cfg.vty[k === 'vty0' ? 0 : 1]);
    if (avisarLogin && this.lineas.some((k) => !(k === 'con' ? this.cfg.con : this.cfg.vty[k === 'vty0' ? 0 : 1]).password)) {
      return ['% Login disabled on line, until \'password\' is set'];
    }
  }

  transporte(v: string): string[] | void {
    if (this.lineas.includes('con')) return ["% Invalid input detected at '^' marker."];
    this.enLineas((l) => { l.transport = v; });
  }

  entrarIf(tipo: string, num: string): string[] | void {
    const nombre = `${tipo}${num}`;
    let i = this.cfg.ifs.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase());
    if (!i && tipo === 'Vlan') {
      i = { nombre, shutdown: false };
      this.cfg.ifs.push(i);
    }
    if (!i) return ["% Invalid input detected at '^' marker."];
    this.iface = i.nombre;
    this.ifaces = [i.nombre];
    this.modo = 'if';
  }

  /** interface range fa0/1 - 5 (también fa0/1-5 y listas separadas por comas). */
  entrarRango(texto: string): string[] | void {
    const nombres: string[] = [];
    for (const parte of texto.split(',')) {
      const m = parte.trim().match(/^([a-zA-Z]+)\s*(\d+)\/(\d+)\s*(?:-\s*(\d+))?$/);
      if (!m) return ["% Invalid input detected at '^' marker."];
      const tipo = 'fastethernet'.startsWith(m[1].toLowerCase()) ? 'FastEthernet' : 'gigabitethernet'.startsWith(m[1].toLowerCase()) ? 'GigabitEthernet' : null;
      if (!tipo) return ["% Invalid input detected at '^' marker."];
      const desde = Number(m[3]), hasta = m[4] ? Number(m[4]) : desde;
      if (hasta < desde) return ['% Invalid range'];
      for (let n = desde; n <= hasta; n++) {
        const i = this.cfg.ifs.find((x) => x.nombre === `${tipo}${m[2]}/${n}`);
        if (!i) return ['% Interface range not valid'];
        nombres.push(i.nombre);
      }
    }
    this.ifaces = nombres;
    this.iface = nombres[0];
    this.modo = 'if';
  }

  /** Aplica un cambio a la interfaz o al rango actual. Los comandos switchport no existen en una SVI. */
  enPuertos(f: (i: Interfaz) => void): string[] | void {
    if (this.ifaces.some((n) => n.startsWith('Vlan'))) return ["% Invalid input detected at '^' marker."];
    for (const n of this.ifaces) f(this.cfg.ifs.find((x) => x.nombre === n)!);
  }

  modoDinamico(m: 'dynamic auto' | 'dynamic desirable'): string[] | void {
    if (this.ifaces.some((n) => this.cfg.ifs.find((x) => x.nombre === n)?.nonegotiate)) return ["Command rejected: Conflict between 'nonegotiate' and 'dynamic' status."];
    return this.enPuertos((i) => { i.modo = m; });
  }

  noNegociar(si: boolean): string[] | void {
    if (si && this.ifaces.some((n) => { const i = this.cfg.ifs.find((x) => x.nombre === n); return !i?.modo || i.modo.startsWith('dynamic'); })) {
      return ["Command rejected: Conflict between 'nonegotiate' and 'dynamic' status."];
    }
    return this.enPuertos((i) => { i.nonegotiate = si || undefined; });
  }

  private asegurarVlan(id: number, avisar: boolean): string[] {
    if (id === 1 || this.vlans.some((v) => v.id === id)) return [];
    this.vlans.push({ id, nombre: `VLAN${String(id).padStart(4, '0')}` });
    this.vlans.sort((a, b) => a.id - b.id);
    return avisar ? [`% Access VLAN does not exist. Creating vlan ${id}`] : [];
  }

  vlanAcceso(id: number): string[] | void {
    const r = this.enPuertos((i) => { i.accesoVlan = id === 1 ? undefined : id; });
    if (r) return r;
    const aviso = this.asegurarVlan(id, true);
    return aviso.length ? aviso : undefined;
  }

  vlanVoz(id: number): string[] | void {
    const r = this.enPuertos((i) => { i.vozVlan = id; });
    if (r) return r;
    const aviso = this.asegurarVlan(id, true);
    return aviso.length ? aviso.map((l) => l.replace('Access', 'Voice')) : undefined;
  }

  permitidas(texto: string): string[] | void {
    const t = texto.trim().toLowerCase();
    const lista = (x: string): number[] | null => {
      const out: number[] = [];
      for (const p of x.split(',')) {
        const m = p.trim().match(/^(\d+)(?:-(\d+))?$/);
        if (!m) return null;
        const a = Number(m[1]), b = Number(m[2] ?? m[1]);
        if (a < 1 || b > 4094 || b < a) return null;
        for (let n = a; n <= b; n++) out.push(n);
      }
      return out;
    };
    const malo = ["% Invalid input detected at '^' marker."];
    if (t === 'all') return this.enPuertos((i) => { i.permitidas = undefined; });
    if (t === 'none') return this.enPuertos((i) => { i.permitidas = []; });
    const m = t.match(/^(add|remove|except)\s+(.+)$/);
    if (m) {
      const l = lista(m[2]);
      if (!l) return malo;
      return this.enPuertos((i) => {
        const actual = i.permitidas ?? Array.from({ length: 4094 }, (_, k) => k + 1);
        if (m[1] === 'add') i.permitidas = [...new Set([...actual, ...l])].sort((a, b) => a - b);
        else if (m[1] === 'remove') i.permitidas = actual.filter((v) => !l.includes(v));
        else i.permitidas = Array.from({ length: 4094 }, (_, k) => k + 1).filter((v) => !l.includes(v));
        if (i.permitidas.length === 4094) i.permitidas = undefined;
      });
    }
    const l = lista(t);
    if (!l) return malo;
    return this.enPuertos((i) => { i.permitidas = [...new Set(l)].sort((a, b) => a - b); });
  }

  velocidadGiga(): string[] | void {
    if (this.ifaces.some((n) => n.startsWith('FastEthernet'))) return ["% Invalid input detected at '^' marker."];
    return this.enPuertos((i) => { i.speed = '1000'; });
  }

  private listaVlan(texto: string): number[] | null {
    const out: number[] = [];
    for (const p of texto.split(',')) {
      const m = p.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!m) return null;
      const a = Number(m[1]), b = Number(m[2] ?? m[1]);
      if (a < 1 || b > 4094 || b < a) return null;
      for (let n = a; n <= b; n++) out.push(n);
    }
    return out;
  }

  entrarVlan(texto: string): string[] | void {
    const l = this.listaVlan(texto);
    if (!l) return ["% Invalid input detected at '^' marker."];
    if (l.some((v) => v >= 1002 && v <= 1005)) return [`Default VLAN ${l.find((v) => v >= 1002 && v <= 1005)} may not have its name changed.`];
    for (const v of l) this.asegurarVlan(v, false);
    this.vlanSel = l;
    this.modo = 'vlan';
  }

  nombrarVlan(nombre: string | null): string[] | void {
    if (this.vlanSel.includes(1)) return ['Default VLAN 1 may not have its name changed.'];
    if (nombre && this.vlanSel.length > 1) return ['%Only one VLAN can be named at a time'];
    for (const v of this.vlans) if (this.vlanSel.includes(v.id)) v.nombre = nombre ?? `VLAN${String(v.id).padStart(4, '0')}`;
  }

  borrarVlan(texto: string): string[] | void {
    const l = this.listaVlan(texto);
    if (!l) return ["% Invalid input detected at '^' marker."];
    if (l.includes(1)) return ['%Default VLAN 1 may not be deleted.'];
    this.vlans = this.vlans.filter((v) => !l.includes(v.id));
  }

  // ----- SSH -----

  pedirRsa(): string[] | void {
    const r = this.requisitosRsa();
    if (r) return r;
    this.espera = 'rsa-bits';
    return [
      `The name for the keys will be: ${this.cfg.hostname}.${this.cfg.dominio}`,
      'Choose the size of the key modulus in the range of 360 to 4096 for your',
      '  General Purpose Keys. Choosing a key modulus greater than 512 may take',
      '  a few minutes.',
      '',
    ];
  }

  private requisitosRsa(): string[] | null {
    if (this.cfg.hostname === 'Switch') return ['% Please define a hostname other than Switch.'];
    if (!this.cfg.dominio) return ['% Please define a domain-name first.'];
    return null;
  }

  generarRsa(bits: number, yaPreguntado = false): string[] {
    if (!yaPreguntado) { const r = this.requisitosRsa(); if (r) return r; }
    const habia = this.rsa !== null;
    this.rsa = bits;
    const l = [
      ...(yaPreguntado ? [] : [`The name for the keys will be: ${this.cfg.hostname}.${this.cfg.dominio}`]),
      `% The key modulus size is ${bits} bits`,
      `% Generating ${bits} bit RSA keys, keys will be non-exportable...[OK]`,
    ];
    if (!habia) l.push(`%SSH-5-ENABLED: SSH 1.99 has been enabled`);
    return l;
  }

  borrarRsa(): string[] {
    if (this.rsa === null) return ['% No Signature RSA Keys found in configuration.'];
    this.rsa = null;
    return ['%SSH-5-DISABLED: SSH 1.99 has been disabled'];
  }

  versionSsh(v: number): string[] | void {
    if (v === 2 && (this.rsa ?? 0) < 768) return ['Please create RSA keys (of atleast 768 bits size) to enable SSH v2.'];
    this.cfg.sshVersion = v;
  }

  usuario(nombre: string, d: { secreto?: string; password?: string; privilegio?: number }): void {
    const l = (this.cfg.usuarios ?? []).filter((u) => u.nombre !== nombre);
    l.push({ nombre, ...d });
    this.cfg.usuarios = l;
  }

  showIpSsh(): string[] {
    if (this.rsa === null) return ['SSH Disabled - version 1.99', '%Please create RSA keys to enable SSH (and of atleast 768 bits for SSH v2).'];
    const v = this.cfg.sshVersion === 2 ? '2.0' : this.cfg.sshVersion === 1 ? '1.5' : '1.99';
    return [`SSH Enabled - version ${v}`, 'Authentication timeout: 120 secs; Authentication retries: 3'];
  }

  // ----- VLAN y troncales -----

  /** Modo operativo de un puerto. Sin vecino que negocie, dynamic queda en acceso. */
  esTroncal(i: Interfaz): boolean {
    return i.modo === 'trunk' && this.conectados.has(i.nombre) && !i.shutdown;
  }

  private corto(n: string) { return n.replace('FastEthernet', 'Fa').replace('GigabitEthernet', 'Gi'); }

  showVlanBrief(): string[] {
    const l = ['', 'VLAN Name                             Status    Ports', '---- -------------------------------- --------- -------------------------------'];
    const fisicas = this.cfg.ifs.filter((i) => !i.nombre.startsWith('Vlan'));
    const todas: Vlan[] = [{ id: 1, nombre: 'default' }, ...this.vlans];
    for (const v of todas) {
      const p = fisicas.filter((i) => !this.esTroncal(i) && i.modo !== 'trunk' && (i.accesoVlan ?? 1) === v.id).map((i) => this.corto(i.nombre));
      const voz = fisicas.filter((i) => i.vozVlan === v.id && v.id !== (i.accesoVlan ?? 1)).map((i) => this.corto(i.nombre));
      const puertos = [...p, ...voz];
      const filas: string[] = [];
      for (let k = 0; k < Math.max(1, Math.ceil(puertos.length / 4)); k++) filas.push(puertos.slice(k * 4, k * 4 + 4).join(', '));
      l.push(`${String(v.id).padEnd(5)}${v.nombre.slice(0, 32).padEnd(33)}active    ${filas[0]}`);
      for (const f of filas.slice(1)) l.push(`${''.padEnd(48)}${f}`);
    }
    l.push('1002 fddi-default                     active    ', '1003 token-ring-default               active    ', '1004 fddinet-default                  active    ', '1005 trnet-default                    active    ');
    return l;
  }

  private rango(ids: number[]): string {
    const s = [...ids].sort((a, b) => a - b);
    const partes: string[] = [];
    for (let i = 0; i < s.length; i++) {
      let j = i;
      while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
      partes.push(j > i + 1 ? `${s[i]}-${s[j]}` : j === i + 1 ? `${s[i]},${s[j]}` : `${s[i]}`);
      i = j;
    }
    return partes.join(',') || 'none';
  }

  showTrunk(): string[] {
    const t = this.cfg.ifs.filter((i) => this.esTroncal(i));
    if (!t.length) return [];
    const existentes = [1, ...this.vlans.map((v) => v.id)];
    const l = ['Port        Mode         Encapsulation  Status        Native vlan'];
    for (const i of t) l.push(`${this.corto(i.nombre).padEnd(12)}${(i.nonegotiate ? 'on' : 'on').padEnd(13)}802.1q         trunking      ${i.nativa ?? 1}`);
    l.push('', 'Port        Vlans allowed on trunk');
    for (const i of t) l.push(`${this.corto(i.nombre).padEnd(12)}${i.permitidas ? this.rango(i.permitidas) : '1-4094'}`);
    l.push('', 'Port        Vlans allowed and active in management domain');
    const activas = (i: Interfaz) => this.rango(existentes.filter((v) => !i.permitidas || i.permitidas.includes(v)));
    for (const i of t) l.push(`${this.corto(i.nombre).padEnd(12)}${activas(i)}`);
    l.push('', 'Port        Vlans in spanning tree forwarding state and not pruned');
    for (const i of t) l.push(`${this.corto(i.nombre).padEnd(12)}${activas(i)}`);
    return l;
  }

  showSwitchport(nombre: string): string[] {
    const m = nombre.match(/^([a-zA-Z]+)(\d+\/\d+)$/);
    const tipo = m && ('fastethernet'.startsWith(m[1].toLowerCase()) ? 'FastEthernet' : 'gigabitethernet'.startsWith(m[1].toLowerCase()) ? 'GigabitEthernet' : null);
    const i = m && tipo ? this.cfg.ifs.find((x) => x.nombre === `${tipo}${m[2]}`) : undefined;
    if (!i) return ["% Invalid input detected at '^' marker."];
    const nombreVlan = (id: number) => (id === 1 ? 'default' : this.vlans.find((v) => v.id === id)?.nombre ?? 'Inactive');
    const adm = i.modo === 'trunk' ? 'trunk' : i.modo === 'access' ? 'static access' : i.modo ?? 'dynamic auto';
    const op = this.esTroncal(i) ? 'trunk' : this.conectados.has(i.nombre) && !i.shutdown ? 'static access' : 'down';
    const acc = i.accesoVlan ?? 1;
    return [
      `Name: ${this.corto(i.nombre)}`,
      'Switchport: Enabled',
      `Administrative Mode: ${adm}`,
      `Operational Mode: ${op}`,
      'Administrative Trunking Encapsulation: dot1q',
      `Operational Trunking Encapsulation: ${op === 'trunk' ? 'dot1q' : 'native'}`,
      `Negotiation of Trunking: ${i.nonegotiate ? 'Off' : 'On'}`,
      `Access Mode VLAN: ${acc} (${nombreVlan(acc)})`,
      `Trunking Native Mode VLAN: ${i.nativa ?? 1} (${nombreVlan(i.nativa ?? 1)})`,
      `Voice VLAN: ${i.vozVlan ? `${i.vozVlan} (${nombreVlan(i.vozVlan)})` : 'none'}`,
      `Trunking VLANs Enabled: ${i.permitidas ? this.rango(i.permitidas) : 'ALL'}`,
    ];
  }

  ifActual(): Interfaz {
    return this.cfg.ifs.find((x) => x.nombre === this.iface)!;
  }

  ponerIp(ip: string, m: string): string[] | void {
    const i = this.ifActual();
    if (!i.nombre.startsWith('Vlan')) return ["% Invalid input detected at '^' marker."];
    if (!mascaraValida(m)) return [`Bad mask 0x${m.split('.').map((o) => Number(o).toString(16).toUpperCase().padStart(2, '0')).join('')} for address ${ip}`];
    if (red(ip, m) === ip) return [`Bad mask /${m} for address ${ip}`];
    i.ip = ip;
    i.mascara = m;
  }

  private estado(i: Interfaz): [string, string] {
    if (i.shutdown) return ['administratively down', 'down'];
    if (i.nombre.startsWith('Vlan')) {
      const id = Number(i.nombre.slice(4));
      if (id !== 1 && !this.vlans.some((v) => v.id === id)) return ['down', 'down'];
      const activo = this.cfg.ifs.some((p) => !p.nombre.startsWith('Vlan') && !p.shutdown && this.conectados.has(p.nombre)
        && (this.esTroncal(p) ? !p.permitidas || p.permitidas.includes(id) : (p.accesoVlan ?? 1) === id));
      return activo ? ['up', 'up'] : ['down', 'down'];
    }
    return this.conectados.has(i.nombre) ? ['up', 'up'] : ['down', 'down'];
  }

  apagar(si: boolean): string[] | void {
    if (this.ifaces.length > 1) {
      const out: string[] = [];
      const todas = this.ifaces;
      for (const n of todas) { this.ifaces = [n]; this.iface = n; out.push(...(this.apagar(si) ?? [])); }
      this.ifaces = todas; this.iface = todas[0];
      return out;
    }
    const i = this.ifActual();
    if (i.shutdown === si) return;
    i.shutdown = si;
    const [st, pr] = this.estado(i);
    if (si) return [`%LINK-5-CHANGED: Interface ${i.nombre}, changed state to administratively down`, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${i.nombre}, changed state to down`];
    const l = [`%LINK-5-CHANGED: Interface ${i.nombre}, changed state to ${st === 'up' ? 'up' : 'down'}`];
    if (pr === 'up') l.push(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${i.nombre}, changed state to up`);
    return l;
  }

  hacerDo(cmd: string): string[] {
    const antes = this.modo;
    this.modo = 'priv';
    const r = this.ejecutar(cmd);
    if (this.modo === 'priv' || this.modo === 'config') this.modo = antes;
    return r;
  }

  guardarSilencio() { this.startup = clonar(this.cfg); }

  guardar(): string[] {
    this.guardarSilencio();
    return ['Building configuration...', '[OK]'];
  }

  pedirReload(): string[] {
    if (!this.guardado()) { this.espera = 'guardar-reload'; return ['System configuration has been modified. Save? [yes/no]:']; }
    this.espera = 'confirmar-reload';
    return ['Proceed with reload? [confirm]'];
  }

  private reiniciar(): string[] {
    this.cfg = this.startup ? clonar(this.startup) : configInicial();
    this.modo = 'user';
    this.espera = 'inicio';
    return ['', 'C2960 Boot Loader (C2960-HBOOT-M) Version 12.2(25r)FX', 'Loading "flash:/c2960-lanbasek9-mz.150-2.SE4.bin"...', '########################################', '',
      ...(this.startup ? [] : ['--- System Configuration Dialog ---', '', 'Would you like to enter the initial configuration dialog? [yes/no]: no', '']),
      'Press RETURN to get started!'];
  }

  ping(destino: string): string[] {
    const v = this.cfg.ifs.find((i) => i.nombre.startsWith('Vlan') && i.ip) ?? this.cfg.ifs.find((i) => i.nombre === 'Vlan1');
    const svi = v && !v.shutdown && v.ip && v.mascara && this.estado(v)[1] === 'up' ? v : null;
    const cab = ['Type escape sequence to abort.', `Sending 5, 100-byte ICMP Echos to ${destino}, timeout is 2 seconds:`];
    if (svi && destino === svi.ip) return [...cab, '!!!!!', 'Success rate is 100 percent (5/5), round-trip min/avg/max = 0/0/1 ms'];
    if (svi && this.vecinos.includes(destino) && red(destino, svi.mascara!) === red(svi.ip!, svi.mascara!)) {
      return [...cab, '.!!!!', 'Success rate is 80 percent (4/5), round-trip min/avg/max = 0/0/1 ms'];
    }
    return [...cab, '.....', 'Success rate is 0 percent (0/5)'];
  }

  ipIntBrief(): string[] {
    const l = ['Interface              IP-Address      OK? Method Status                Protocol '];
    for (const i of this.cfg.ifs) {
      const [st, pr] = this.estado(i);
      l.push(`${i.nombre.padEnd(23)}${(i.ip ?? 'unassigned').padEnd(16)}YES ${(i.ip ? 'manual' : 'unset').padEnd(7)}${st.padEnd(22)}${pr}`);
    }
    return l;
  }

  version(): string[] {
    return [
      'Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.0(2)SE4, RELEASE SOFTWARE (fc1)',
      'Technical Support: http://www.cisco.com/techsupport',
      '',
      `${this.cfg.hostname} uptime is 12 minutes`,
      'System image file is "flash:c2960-lanbasek9-mz.150-2.SE4.bin"',
      '',
      'cisco WS-C2960-24TT-L (PowerPC405) processor with 65536K bytes of memory.',
      '24 FastEthernet interfaces',
      '2 Gigabit Ethernet interfaces',
      '64K bytes of flash-simulated non-volatile configuration memory.',
      'Configuration register is 0xF',
    ];
  }

  /** Genera el texto de la configuración con el formato de un 2960 en Packet Tracer. */
  runningConfig(c: Config = this.cfg, inicio = false): string {
    const pw = (p: string) => (c.spe ? `password 7 ${cifrar7(p)}` : `password ${p}`);
    const linea = (l: Linea, extra = false) => {
      const out: string[] = [];
      if (l.execTimeout) out.push(` exec-timeout ${l.execTimeout[0]} ${l.execTimeout[1]}`);
      if (l.password) out.push(` ${pw(l.password)}`);
      if (l.loggingSync) out.push(' logging synchronous');
      if (l.login) out.push(l.loginLocal ? ' login local' : ' login');
      if (extra && l.transport) out.push(` transport input ${l.transport}`);
      return out;
    };
    const o: string[] = [];
    if (!inicio) o.push('Building configuration...', '');
    o.push(inicio ? 'Using 1182 bytes' : 'Current configuration : 1182 bytes', '!', 'version 15.0', 'no service timestamps log datetime msec', 'no service timestamps debug datetime msec');
    o.push(c.spe ? 'service password-encryption' : 'no service password-encryption', '!', `hostname ${c.hostname}`, '!');
    if (c.enableSecret) o.push(`enable secret 5 ${hash5(c.enableSecret)}`);
    if (c.enablePassword) o.push(`enable ${pw(c.enablePassword)}`);
    o.push('!', '!', '!');
    if (c.sshVersion) o.push(`ip ssh version ${c.sshVersion}`);
    if (!c.domainLookup) o.push('no ip domain-lookup');
    if (c.dominio) o.push(`ip domain-name ${c.dominio}`);
    o.push('!');
    for (const u of c.usuarios ?? []) {
      const priv = u.privilegio !== undefined ? ` privilege ${u.privilegio}` : '';
      o.push(u.secreto ? `username ${u.nombre}${priv} secret 5 ${hash5(u.secreto)}` : `username ${u.nombre}${priv} ${pw(u.password ?? '')}`);
    }
    o.push('!', '!', 'spanning-tree mode pvst', 'spanning-tree extend system-id', '!');
    for (const i of c.ifs) {
      o.push(`interface ${i.nombre}`);
      if (i.descripcion) o.push(` description ${i.descripcion}`);
      if (i.accesoVlan) o.push(` switchport access vlan ${i.accesoVlan}`);
      if (i.nativa) o.push(` switchport trunk native vlan ${i.nativa}`);
      if (i.permitidas) o.push(` switchport trunk allowed vlan ${this.rango(i.permitidas)}`);
      if (i.modo && i.modo !== 'dynamic auto') o.push(` switchport mode ${i.modo}`);
      if (i.nonegotiate) o.push(' switchport nonegotiate');
      if (i.trustCos) o.push(' mls qos trust cos');
      if (i.vozVlan) o.push(` switchport voice vlan ${i.vozVlan}`);
      if (i.duplex) o.push(` duplex ${i.duplex}`);
      if (i.speed) o.push(` speed ${i.speed}`);
      if (i.sinMdix) o.push(' no mdix auto');
      if (i.nombre.startsWith('Vlan')) o.push(i.ip ? ` ip address ${i.ip} ${i.mascara}` : ' no ip address');
      if (i.shutdown) o.push(' shutdown');
      o.push('!');
    }
    if (c.gateway) o.push(`ip default-gateway ${c.gateway}`);
    o.push('!', '!', '!');
    if (c.banner) o.push(`banner motd ^C${c.banner}^C`);
    o.push('!', '!', '!', 'line con 0', ...linea(c.con), '!', 'line vty 0 4', ...linea(c.vty[0], true), 'line vty 5 15', ...linea(c.vty[1], true), '!', '!', '!', 'end');
    return o.join('\n');
  }
}
