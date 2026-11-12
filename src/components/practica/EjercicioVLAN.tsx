import { Azar } from '../../lib/azar';
import { Switch } from '../../lib/ios/motor';
import MarcoCLI, { type CasoCLI, type TareaCLI } from './MarcoCLI';

const NOMBRES: Record<number, string> = {
  10: 'ventas', 20: 'contabilidad', 30: 'docentes', 40: 'alumnos', 50: 'invitados', 60: 'gerencia', 70: 'soporte', 110: 'oficina', 120: 'bodega',
};

export function generar(codigo: string): CasoCLI {
  const az = new Azar(codigo, 'cli-vlan');
  const [va, vb] = az.muestra(Object.keys(NOMBRES).map(Number), 2).sort((a, b) => a - b);
  const voz = az.elegir([150, 160, 200]);
  const nativa = az.elegir([99, 999, 199]);
  const inicioA = az.entero(1, 4), finA = inicioA + az.entero(2, 4);
  const inicioB = finA + az.entero(2, 4), finB = inicioB + az.entero(2, 4);
  const telefono = az.entero(finB + 1, 22);
  const troncal = az.elegir(['GigabitEthernet0/1', 'GigabitEthernet0/2']);
  const tc = troncal.replace('GigabitEthernet', 'g');
  const puerto = (n: number) => `FastEthernet0/${n}`;
  const existe = (sw: Switch, id: number, nombre: string) => sw.vlans.some((v) => v.id === id && v.nombre === nombre);
  const rango = (a: number, b: number, v: number) => (sw: Switch) => {
    for (let n = a; n <= b; n++) { const i = sw.cfg.ifs.find((x) => x.nombre === puerto(n))!; if (i.modo !== 'access' || i.accesoVlan !== v) return false; }
    return true;
  };
  const tr = (sw: Switch) => sw.cfg.ifs.find((x) => x.nombre === troncal)!;
  const permitidas = [va, vb, voz, nativa].sort((a, b) => a - b);

  const tareas: TareaCLI[] = [
    { texto: `Crea la VLAN ${va} con el nombre «${NOMBRES[va]}».`, pista: `enable\nconfigure terminal\nvlan ${va}\n name ${NOMBRES[va]}`, ok: (sw) => existe(sw, va, NOMBRES[va]) },
    { texto: `Crea la VLAN ${vb} con el nombre «${NOMBRES[vb]}».`, pista: `vlan ${vb}\n name ${NOMBRES[vb]}`, ok: (sw) => existe(sw, vb, NOMBRES[vb]) },
    { texto: `Crea la VLAN ${voz} «voz» y la VLAN ${nativa} «nativa».`, pista: `vlan ${voz}\n name voz\nvlan ${nativa}\n name nativa`, ok: (sw) => existe(sw, voz, 'voz') && existe(sw, nativa, 'nativa') },
    { texto: `Pon los puertos F0/${inicioA} a F0/${finA} en modo acceso, en la VLAN ${va}.`, pista: `interface range f0/${inicioA} - ${finA}\n switchport mode access\n switchport access vlan ${va}`, ok: rango(inicioA, finA, va) },
    { texto: `Pon los puertos F0/${inicioB} a F0/${finB} en modo acceso, en la VLAN ${vb}.`, pista: `interface range f0/${inicioB} - ${finB}\n switchport mode access\n switchport access vlan ${vb}`, ok: rango(inicioB, finB, vb) },
    { texto: `En F0/${telefono} hay un teléfono IP con una PC detrás: datos en la VLAN ${vb}, voz en la ${voz} y confianza en la marca CoS del teléfono.`, pista: `interface f0/${telefono}\n switchport mode access\n switchport access vlan ${vb}\n mls qos trust cos\n switchport voice vlan ${voz}`, ok: (sw) => { const i = sw.cfg.ifs.find((x) => x.nombre === puerto(telefono))!; return i.modo === 'access' && i.accesoVlan === vb && i.vozVlan === voz && !!i.trustCos; } },
    { texto: `Configura ${troncal.replace('GigabitEthernet', 'Gi')} como troncal permanente.`, pista: `interface ${tc}\n switchport mode trunk`, ok: (sw) => tr(sw).modo === 'trunk' },
    { texto: `En esa troncal, usa la VLAN ${nativa} como nativa.`, pista: `interface ${tc}\n switchport trunk native vlan ${nativa}`, ok: (sw) => tr(sw).nativa === nativa },
    { texto: `Permite en la troncal solo las VLAN ${permitidas.join(', ')}.`, pista: `interface ${tc}\n switchport trunk allowed vlan ${permitidas.join(',')}`, ok: (sw) => JSON.stringify(tr(sw).permitidas) === JSON.stringify(permitidas) },
    { texto: 'Desactiva la negociación DTP en la troncal.', pista: `interface ${tc}\n switchport nonegotiate`, ok: (sw) => !!tr(sw).nonegotiate },
  ];
  if (az.probabilidad(0.5)) {
    const libre = az.entero(23, 24);
    tareas.push({ texto: `F0/${libre} no se usa: déjalo en modo acceso, en la VLAN ${nativa} (sin equipos) y apagado.`, pista: `interface f0/${libre}\n switchport mode access\n switchport access vlan ${nativa}\n shutdown`, ok: (sw) => { const i = sw.cfg.ifs.find((x) => x.nombre === puerto(libre))!; return i.modo === 'access' && i.accesoVlan === nativa && i.shutdown; } });
  }
  tareas.push({ texto: 'Guarda la configuración.', pista: 'end\ncopy running-config startup-config', ok: (sw) => sw.guardado() && tareas.slice(0, -1).every((t) => t.ok(sw)) });

  const conectados = [puerto(inicioA), puerto(finB), puerto(telefono), troncal];
  return {
    tareas,
    crear: () => new Switch({ conectados }),
    instrucciones: (
      <p>
        Un switch Catalyst 2960 de fábrica, con equipos conectados en algunos puertos y un enlace hacia otro switch en
        {' '}{troncal.replace('GigabitEthernet', 'Gi')}. Verifica cada paso con <code>show vlan brief</code>, <code>show interfaces trunk</code>
        {' '}y <code>show interfaces … switchport</code>.
      </p>
    ),
    final: <><strong>¡VLAN y troncal listas!</strong> Compara <code>show vlan brief</code> con <code>show interfaces trunk</code>: la troncal no aparece entre los puertos de ninguna VLAN.</>,
  };
}

export default function EjercicioVLAN() {
  return <MarcoCLI id="cli-vlan" generar={generar} />;
}
