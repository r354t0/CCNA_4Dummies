import { useMemo, useRef, useState } from 'react';
import { Azar } from '../../lib/azar';
import { Switch } from '../../lib/ios/motor';
import Escenario, { useCodigo, registrarLogro } from './Escenario';
import Consola from './Consola';
import './practica.css';

interface Tarea { texto: string; pista: string; ok: (sw: Switch) => boolean }

const NOMBRES = ['Ventas', 'Piso2', 'Lab3', 'Aula5', 'Bodega', 'Admin', 'Recepcion', 'Norte'];
const PALABRAS = ['Cisco', 'Andes', 'Ruta', 'Nodo', 'Trama', 'Puerto', 'Lima', 'Cusco', 'Rack', 'Enlace'];
const FRASES = ['Solo personal autorizado', 'Acceso restringido', 'Prohibido el acceso no autorizado', 'Uso exclusivo del area de TI'];

function clave(az: Azar) {
  return `${az.elegir(PALABRAS)}${az.entero(10, 99)}${az.elegir(['!', '#', '$', '*'])}`;
}

export function generar(codigo: string) {
  const az = new Azar(codigo, 'cli');
  const host = `${az.elegir(['Sw', 'SW', 'S'])}-${az.elegir(NOMBRES)}-${az.entero(1, 9)}`;
  const secreto = clave(az);
  const pCon = clave(az);
  const pVty = clave(az);
  const frase = az.elegir(FRASES);
  const red = `192.168.${az.entero(1, 254)}`;
  const ipSw = `${red}.${az.entero(2, 20)}`;
  const gw = `${red}.1`;
  const pc = `${red}.${az.entero(100, 200)}`;
  const minutos = az.entero(5, 15);
  const puertoLibre = `GigabitEthernet0/2`;

  const vty = (sw: Switch) => sw.cfg.vty.every((l) => l.password === pVty && l.login);
  const opcionales: Tarea[] = az.muestra([
    { texto: 'Desactiva la búsqueda DNS de los comandos mal escritos.', pista: 'no ip domain-lookup', ok: (sw) => !sw.cfg.domainLookup },
    { texto: `En la consola, cierra la sesión tras ${minutos} minutos de inactividad.`, pista: `line console 0\n exec-timeout ${minutos} 0`, ok: (sw) => sw.cfg.con.execTimeout?.[0] === minutos && sw.cfg.con.execTimeout?.[1] === 0 },
    { texto: 'Evita que los mensajes del sistema corten lo que escribes en la consola.', pista: 'line console 0\n logging synchronous', ok: (sw) => sw.cfg.con.loggingSync },
    { texto: `Configura el banner MOTD con el texto «${frase}».`, pista: `banner motd #${frase}#`, ok: (sw) => (sw.cfg.banner ?? '').toLowerCase().includes(frase.toLowerCase()) },
    { texto: `Configura el gateway predeterminado ${gw} para administrar el switch desde otras redes.`, pista: `ip default-gateway ${gw}`, ok: (sw) => sw.cfg.gateway === gw },
    { texto: `Apaga el puerto ${puertoLibre}, que no se usa.`, pista: 'interface g0/2\n shutdown', ok: (sw) => sw.cfg.ifs.find((i) => i.nombre === puertoLibre)!.shutdown },
    { texto: 'Describe el puerto FastEthernet0/1 como «Enlace a PC1».', pista: 'interface f0/1\n description Enlace a PC1', ok: (sw) => sw.cfg.ifs.find((i) => i.nombre === 'FastEthernet0/1')!.descripcion === 'Enlace a PC1' },
  ], az.entero(2, 4));

  const tareas: Tarea[] = [
    { texto: 'Pulsa Enter para iniciar la sesión y entra al modo de configuración global.', pista: 'enable\nconfigure terminal', ok: (sw) => sw.visitados.has('config') },
    { texto: `Cambia el nombre del switch a ${host}.`, pista: `hostname ${host}`, ok: (sw) => sw.cfg.hostname === host },
    { texto: `Protege el modo EXEC privilegiado con la contraseña cifrada «${secreto}».`, pista: `enable secret ${secreto}`, ok: (sw) => sw.cfg.enableSecret === secreto },
    { texto: `Protege la consola con la contraseña «${pCon}» y haz que la pida al conectarse.`, pista: `line console 0\n password ${pCon}\n login`, ok: (sw) => sw.cfg.con.password === pCon && sw.cfg.con.login },
    { texto: `Protege las 16 líneas VTY con la contraseña «${pVty}» y haz que la pidan.`, pista: `line vty 0 15\n password ${pVty}\n login`, ok: vty },
    { texto: 'Cifra las contraseñas que están en texto plano.', pista: 'service password-encryption', ok: (sw) => sw.cfg.spe },
    { texto: `Asigna ${ipSw}/24 a la SVI de la VLAN 1 y enciéndela.`, pista: `interface vlan 1\n ip address ${ipSw} 255.255.255.0\n no shutdown`, ok: (sw) => { const v = sw.cfg.ifs.find((i) => i.nombre === 'Vlan1')!; return v.ip === ipSw && v.mascara === '255.255.255.0' && !v.shutdown; } },
    ...opcionales,
    { texto: 'Guarda la configuración para que sobreviva a un reinicio.', pista: 'end\ncopy running-config startup-config', ok: (sw) => sw.guardado() },
  ];
  return { tareas, pc, ipSw };
}

export default function EjercicioCLI() {
  const [codigo, setCodigo] = useCodigo();
  const caso = useMemo(() => (codigo ? generar(codigo) : null), [codigo]);
  const sw = useMemo(() => (caso ? new Switch({ vecinos: [caso.pc] }) : null), [caso]);
  const [, setTick] = useState(0);
  const [pistas, setPistas] = useState<Record<number, boolean>>({});
  const avisado = useRef(false);
  if (!codigo || !caso || !sw) return null;

  const estados = caso.tareas.map((t) => t.ok(sw));
  const hechas = estados.filter(Boolean).length;
  const todo = hechas === caso.tareas.length;
  if (todo && !avisado.current) { avisado.current = true; registrarLogro('cli'); }

  const cambiar = (c: string) => { setCodigo(c); setPistas({}); avisado.current = false; };

  return (
    <Escenario id="cli" codigo={codigo} alCambiar={cambiar}
      instrucciones={
        <p>
          Estás conectado por consola a un switch Catalyst 2960 con la configuración de fábrica. Una PC con la IP {caso.pc}
          {' '}está conectada a F0/1. Cumple las tareas en la consola: se marcan solas cuando la configuración es correcta.
        </p>
      }>
      <div className="cli">
        <Consola key={codigo} sw={sw} alCambiar={() => setTick((t) => t + 1)} />
        <aside className="cli-tareas" aria-label="Tareas">
          <p className="cli-cab">Tareas <span>{hechas} de {caso.tareas.length}</span></p>
          <div className="cli-barra"><span style={{ width: `${(hechas / caso.tareas.length) * 100}%` }} /></div>
          <ol>
            {caso.tareas.map((t, i) => (
              <li key={i} className={estados[i] ? 'hecha' : ''}>
                <span className="cli-check" aria-hidden="true">{estados[i] ? '✓' : ''}</span>
                <span>
                  {t.texto}
                  {estados[i] && <span className="visually-hidden"> (completada)</span>}
                  {!estados[i] && (
                    pistas[i]
                      ? <pre className="cli-pista">{t.pista}</pre>
                      : <button type="button" className="cli-ver" onClick={() => setPistas({ ...pistas, [i]: true })}>Ver pista</button>
                  )}
                </span>
              </li>
            ))}
          </ol>
          {todo && (
            <p className="pr-msg ok">
              <strong>¡Switch configurado!</strong>
              Prueba ahora <code>reload</code> y comprueba que, al volver, te pide las contraseñas y conserva todo. Luego pide
              un nuevo escenario.
            </p>
          )}
        </aside>
      </div>
    </Escenario>
  );
}
