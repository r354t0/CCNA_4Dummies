import { Azar } from '../../lib/azar';
import { Switch } from '../../lib/ios/motor';
import MarcoCLI, { type CasoCLI, type TareaCLI } from './MarcoCLI';

const NOMBRES = ['Ventas', 'Piso3', 'Lab2', 'Aula7', 'Bodega', 'Admin', 'Sur', 'Caja'];
const DOMINIOS = ['ccna.lab', 'empresa.local', 'redes.pe', 'campus.edu', 'ccna4dummies.lab'];
const USUARIOS = ['admin', 'soporte', 'netadmin', 'tecnico', 'operador'];
const PALABRAS = ['Andes', 'Ruta', 'Nodo', 'Trama', 'Lima', 'Rack', 'Puerto'];
const clave = (az: Azar) => `${az.elegir(PALABRAS)}${az.entero(10, 99)}${az.elegir(['!', '#', '$'])}`;

export function generar(codigo: string): CasoCLI {
  const az = new Azar(codigo, 'cli-ssh');
  const host = `${az.elegir(['S', 'SW', 'Sw'])}-${az.elegir(NOMBRES)}`;
  const dominio = az.elegir(DOMINIOS);
  const usuario = az.elegir(USUARIOS);
  const secreto = clave(az);
  const bits = az.elegir([1024, 2048]);
  const vlanAdm = az.elegir([1, 99, 88, 50]);
  const red = `172.${az.entero(16, 31)}.${vlanAdm}`;
  const ip = `${red}.${az.entero(2, 20)}`;
  const gw = `${red}.1`;
  const puerto = az.entero(1, 12);
  const pc = `FastEthernet0/${puerto}`;
  const vtyOk = (sw: Switch) => sw.cfg.vty.every((l) => l.login && l.loginLocal && l.transport === 'ssh');
  const svi = `Vlan${vlanAdm}`;

  const tareas: TareaCLI[] = [
    { texto: `Cambia el nombre del switch a ${host}.`, pista: `enable\nconfigure terminal\nhostname ${host}`, ok: (sw) => sw.cfg.hostname === host },
    { texto: `Configura el dominio IP ${dominio}.`, pista: `ip domain-name ${dominio}`, ok: (sw) => sw.cfg.dominio === dominio },
    { texto: `Genera claves RSA de ${bits} bits.`, pista: `crypto key generate rsa\n(responde ${bits} a la pregunta del módulo)`, ok: (sw) => sw.rsa === bits },
    { texto: `Crea el usuario local «${usuario}» con el secreto «${secreto}».`, pista: `username ${usuario} secret ${secreto}`, ok: (sw) => !!sw.cfg.usuarios?.some((u) => u.nombre === usuario && u.secreto === secreto) },
    { texto: 'Haz que las 16 líneas VTY acepten solo SSH y pidan usuario y contraseña locales.', pista: 'line vty 0 15\n transport input ssh\n login local', ok: vtyOk },
    { texto: 'Deja habilitada solo la versión 2 de SSH.', pista: 'ip ssh version 2', ok: (sw) => sw.cfg.sshVersion === 2 },
    ...(vlanAdm !== 1
      ? [{ texto: `Crea la VLAN ${vlanAdm} (administración) y pon el puerto F0/${puerto}, donde está la PC del administrador, en esa VLAN.`, pista: `vlan ${vlanAdm}\n name administracion\ninterface f0/${puerto}\n switchport mode access\n switchport access vlan ${vlanAdm}`, ok: (sw: Switch) => sw.vlans.some((v) => v.id === vlanAdm) && sw.cfg.ifs.find((i) => i.nombre === pc)!.accesoVlan === vlanAdm }]
      : []),
    { texto: `Asigna ${ip}/24 a la SVI de la VLAN ${vlanAdm} y enciéndela. Configura el gateway ${gw}.`, pista: `interface vlan ${vlanAdm}\n ip address ${ip} 255.255.255.0\n no shutdown\n exit\nip default-gateway ${gw}`, ok: (sw) => { const i = sw.cfg.ifs.find((x) => x.nombre === svi); return !!i && i.ip === ip && i.mascara === '255.255.255.0' && !i.shutdown && sw.cfg.gateway === gw; } },
  ];
  const extras: TareaCLI[] = az.muestra([
    { texto: `Fija F0/${puerto} en dúplex completo y 100 Mb/s.`, pista: `interface f0/${puerto}\n duplex full\n speed 100`, ok: (sw) => { const i = sw.cfg.ifs.find((x) => x.nombre === pc)!; return i.duplex === 'full' && i.speed === '100'; } },
    { texto: 'Fija Gi0/1, el enlace al switch de distribución, en 1000 Mb/s y dúplex completo.', pista: 'interface g0/1\n speed 1000\n duplex full', ok: (sw) => { const i = sw.cfg.ifs.find((x) => x.nombre === 'GigabitEthernet0/1')!; return i.duplex === 'full' && i.speed === '1000'; } },
    { texto: 'Protege el modo EXEC privilegiado con enable secret «' + secreto.split('').reverse().join('') + '».', pista: `enable secret ${secreto.split('').reverse().join('')}`, ok: (sw) => sw.cfg.enableSecret === secreto.split('').reverse().join('') },
    { texto: 'Desactiva la búsqueda DNS de los comandos mal escritos.', pista: 'no ip domain-lookup', ok: (sw) => !sw.cfg.domainLookup },
  ], 2);
  tareas.push(...extras, {
    texto: 'Guarda la configuración.', pista: 'end\ncopy running-config startup-config', ok: (sw) => sw.guardado() && tareas.slice(0, -1).every((t) => t.ok(sw)),
  });

  return {
    tareas,
    crear: () => new Switch({ conectados: [pc, 'GigabitEthernet0/1'] }),
    instrucciones: (
      <p>
        Un switch Catalyst 2960 de fábrica. La PC del administrador está en F0/{puerto} y el enlace al resto de la red en
        Gi0/1. Déjalo listo para administrarlo <strong>solo por SSH</strong>. Usa <code>show ip ssh</code> para verificar.
      </p>
    ),
    final: <><strong>¡SSH listo!</strong> Revisa <code>show ip ssh</code> y <code>show running-config</code>. Fíjate en que las claves RSA no aparecen en la configuración.</>,
  };
}

export default function EjercicioSSH() {
  return <MarcoCLI id="cli-ssh" generar={generar} />;
}
