// Escenarios de Packet Tracer de SRWE: router básico con SSH y doble pila, VLAN con troncal
// y router-on-a-stick. Usan la misma corrección que los de ITN (escenarios.ts).

import { Azar } from '../azar';
import { expandirVlans, leerVlanBrief, leerTrunk, leerSsh, vtyCumple, normalizarIpv6, normalizarIf, type ConfigLeida, type InterfazLeida } from '../ios/analizador';
import { verificarMd5crypt } from '../ios/md5crypt';
import {
  MASCARA, NOMBRES, FRASES, clave, enSw, enPc, mismaDir, normal, sinEvidencia, abrev,
  type CasoPT, type Requisito, type Evaluacion, type Leidas,
} from './escenarios';

// ---------- Requisitos ----------

const guardado = (d: string): Requisito => ({
  id: `${d}-guardado`, dispositivo: d, texto: 'La configuración está guardada en la NVRAM (startup-config).',
  evaluar: enSw(d, (c) => c.origen === 'startup' ? { ok: true }
    : c.origen === 'running' ? { ok: false, detalle: 'Pegaste show running-config: guarda con copy running-config startup-config y pega show startup-config.' }
      : { ok: false, detalle: 'No reconocemos el inicio de show startup-config. Copia la salida completa, desde «Using … bytes».' }),
});

const hostname = (d: string, h: string): Requisito => ({
  id: `${d}-hostname`, dispositivo: d, texto: `El nombre de host es ${h}.`,
  evaluar: enSw(d, (c) => c.hostname === h ? { ok: true } : { ok: false, detalle: c.hostname ? `El nombre es «${c.hostname}».` : 'No encontramos la línea hostname.' }),
});

const secret = (d: string, clave: string): Requisito => ({
  id: `${d}-secret`, dispositivo: d, texto: `El modo EXEC privilegiado se protege con enable secret «${clave}».`,
  evaluar: enSw(d, (c) => {
    if (!c.enableSecret) return { ok: false, detalle: c.enablePassword !== undefined ? 'Usaste enable password: se pide enable secret.' : 'No hay enable secret.' };
    if (c.enableSecretTipo === '5') return verificarMd5crypt(clave, c.enableSecretHash ?? '') ? { ok: true } : { ok: false, detalle: `El enable secret no es «${clave}».` };
    return { ok: true };
  }),
});

const consola = (d: string, clave: string): Requisito => ({
  id: `${d}-consola`, dispositivo: d, texto: `La consola pide la contraseña «${clave}».`,
  evaluar: enSw(d, (c) => !c.con ? { ok: false, detalle: 'No encontramos line con 0.' }
    : c.con.password !== clave ? { ok: false, detalle: c.con.password ? `La contraseña de consola es «${c.con.password}».` : 'La consola no tiene contraseña.' }
      : !c.con.login ? { ok: false, detalle: 'Falta login en la consola.' } : { ok: true }),
});

const cifrado = (d: string): Requisito => ({
  id: `${d}-cifrado`, dispositivo: d, texto: 'Las contraseñas en texto plano están cifradas (service password-encryption).',
  evaluar: enSw(d, (c) => c.spe ? { ok: true } : { ok: false, detalle: 'Falta service password-encryption.' }),
});

const banner = (d: string, frase: string): Requisito => ({
  id: `${d}-banner`, dispositivo: d, texto: `El banner MOTD dice «${frase}».`,
  evaluar: enSw(d, (c) => !c.banner ? { ok: false, detalle: 'No hay banner motd.' } : normal(c.banner).includes(normal(frase)) ? { ok: true } : { ok: false, detalle: `El banner dice «${c.banner}».` }),
});

function requisitosSsh(d: string, dominio: string, usuario: string, secreto: string, ultimaVty: number): Requisito[] {
  return [
    {
      id: `${d}-dominio`, dispositivo: d, texto: `El dominio IP es ${dominio}.`,
      evaluar: enSw(d, (c) => c.dominio === dominio ? { ok: true } : { ok: false, detalle: c.dominio ? `El dominio es «${c.dominio}».` : 'Falta ip domain-name.' }),
    },
    {
      id: `${d}-usuario`, dispositivo: d, texto: `Existe el usuario local «${usuario}» con el secreto «${secreto}».`,
      evaluar: enSw(d, (c) => {
        const u = c.usuarios.find((x) => x.nombre === usuario);
        if (!u) return { ok: false, detalle: c.usuarios.length ? `Los usuarios configurados son: ${c.usuarios.map((x) => x.nombre).join(', ')}.` : 'No hay ningún username.' };
        if (u.password !== undefined) return { ok: false, detalle: 'El usuario usa password: se pide secret (con hash).' };
        if (u.tipo === '5' && !verificarMd5crypt(secreto, u.hash ?? '')) return { ok: false, detalle: `El secreto del usuario no es «${secreto}».` };
        return { ok: true };
      }),
    },
    {
      id: `${d}-vty-ssh`, dispositivo: d, texto: `Las líneas VTY 0 a ${ultimaVty} aceptan solo SSH y usan la base de datos local (login local).`,
      evaluar: enSw(d, (c) => {
        if (!Object.keys(c.vty).length) return { ok: false, detalle: 'No encontramos los bloques line vty.' };
        if (!vtyCumple(c, ultimaVty, (v) => v.loginLocal)) return { ok: false, detalle: 'Falta login local en las líneas VTY.' };
        if (!vtyCumple(c, ultimaVty, (v) => v.transport === 'ssh')) return { ok: false, detalle: 'Las VTY deben tener transport input ssh (solo SSH).' };
        return { ok: true };
      }),
    },
    {
      id: `${d}-ssh-v2`, dispositivo: d, texto: 'Solo está habilitada la versión 2 de SSH.',
      evaluar: enSw(d, (c) => c.sshVersion === 2 ? { ok: true } : { ok: false, detalle: 'Falta ip ssh version 2.' }),
    },
    {
      id: `${d}-ssh-on`, dispositivo: d, texto: 'SSH está habilitado (se generaron las claves RSA).',
      evaluar: (l) => {
        const sin = sinEvidencia(l, d);
        if (sin) return sin;
        const s = leerSsh(l.textos[d] ?? '');
        if (!s) return { ok: false, detalle: 'Falta la salida de show ip ssh.' };
        return s.habilitado ? { ok: true } : { ok: false, detalle: 'show ip ssh dice «SSH Disabled»: genera las claves con crypto key generate rsa (1024 bits o más).' };
      },
    },
  ];
}

function interfazRouter(d: string, nombre: string, ip: string, opciones: { ipv6?: string; linkLocal?: string; descripcion?: boolean } = {}): Requisito[] {
  const corta = abrev(nombre);
  const i = (c: ConfigLeida): InterfazLeida | undefined => c.ifs[nombre];
  const r: Requisito[] = [
    {
      id: `${d}-${corta}-ip`, dispositivo: d, texto: `${corta} tiene la IP ${ip} ${MASCARA}.`,
      evaluar: enSw(d, (c) => !i(c) ? { ok: false, detalle: `No encontramos interface ${nombre}.` } : i(c)!.ip === ip && i(c)!.mascara === MASCARA ? { ok: true }
        : { ok: false, detalle: i(c)!.ip ? `${corta} tiene ${i(c)!.ip} ${i(c)!.mascara}.` : `${corta} no tiene dirección IPv4.` }),
    },
    {
      id: `${d}-${corta}-up`, dispositivo: d, texto: `${corta} está encendida (no shutdown).`,
      evaluar: enSw(d, (c) => !i(c) ? { ok: false, detalle: `No encontramos interface ${nombre}.` } : i(c)!.shutdown ? { ok: false, detalle: `${corta} sigue en shutdown.` } : { ok: true }),
    },
  ];
  if (opciones.ipv6) {
    const esperado = normalizarIpv6(opciones.ipv6);
    r.push({
      id: `${d}-${corta}-ipv6`, dispositivo: d, texto: `${corta} tiene la IPv6 ${opciones.ipv6}.`,
      evaluar: enSw(d, (c) => !i(c) ? { ok: false, detalle: `No encontramos interface ${nombre}.` } : i(c)!.ipv6.includes(esperado) ? { ok: true }
        : { ok: false, detalle: i(c)!.ipv6.length ? `${corta} tiene ${i(c)!.ipv6.join(', ')}.` : `${corta} no tiene dirección IPv6 global.` }),
    });
  }
  if (opciones.linkLocal) {
    const esperado = normalizarIpv6(opciones.linkLocal);
    r.push({
      id: `${d}-${corta}-ll`, dispositivo: d, texto: `${corta} tiene la link-local estática ${opciones.linkLocal}.`,
      evaluar: enSw(d, (c) => i(c)?.linkLocal === esperado ? { ok: true } : { ok: false, detalle: 'Falta ipv6 address … link-local con ese valor.' }),
    });
  }
  if (opciones.descripcion) {
    r.push({
      id: `${d}-${corta}-desc`, dispositivo: d, texto: `${corta} tiene una descripción.`,
      evaluar: enSw(d, (c) => i(c)?.descripcion ? { ok: true } : { ok: false, detalle: `${corta} no tiene description.` }),
    });
  }
  return r;
}

interface Ping { destino: string; nombre: string; debeFallar?: boolean }

function requisitosPc(d: string, o: { ip: string; gw?: string; ipv6?: string; gw6?: string; pings?: Ping[] }): Requisito[] {
  const r: Requisito[] = [
    {
      id: `${d}-ip`, dispositivo: d, texto: `La PC tiene la IP ${o.ip} y la máscara ${MASCARA}.`,
      evaluar: enPc(d, (p) => !p.ip.ip ? { ok: false, detalle: 'No encontramos la salida de ipconfig.' } : p.ip.ip !== o.ip ? { ok: false, detalle: `La PC tiene ${p.ip.ip}.` }
        : p.ip.mascara !== MASCARA ? { ok: false, detalle: `La máscara es ${p.ip.mascara}.` } : { ok: true }),
    },
  ];
  if (o.gw) r.push({
    id: `${d}-gw`, dispositivo: d, texto: `El gateway IPv4 de la PC es ${o.gw}.`,
    evaluar: enPc(d, (p) => !p.ip.ip ? { ok: false, detalle: 'No encontramos la salida de ipconfig.' } : p.ip.gateway === o.gw ? { ok: true } : { ok: false, detalle: p.ip.gateway && p.ip.gateway !== '0.0.0.0' ? `El gateway es ${p.ip.gateway}.` : 'La PC no tiene gateway IPv4.' }),
  });
  if (o.ipv6) r.push({
    id: `${d}-ipv6`, dispositivo: d, texto: `La PC tiene la IPv6 ${o.ipv6}.`,
    evaluar: enPc(d, (p) => p.ip.ipv6 && mismaDir(p.ip.ipv6, o.ipv6!) ? { ok: true } : { ok: false, detalle: p.ip.ipv6 ? `La IPv6 es ${p.ip.ipv6}.` : 'La PC no tiene IPv6 global (o falta ipconfig).' }),
  });
  if (o.gw6) r.push({
    id: `${d}-gw6`, dispositivo: d, texto: `El gateway IPv6 de la PC es ${o.gw6}.`,
    evaluar: enPc(d, (p) => p.ip.gateway6 && mismaDir(p.ip.gateway6, o.gw6!) ? { ok: true } : { ok: false, detalle: p.ip.gateway6 ? `El gateway IPv6 es ${p.ip.gateway6}.` : 'La PC no tiene gateway IPv6.' }),
  });
  for (const pg of o.pings ?? []) {
    r.push({
      id: `${d}-ping-${pg.nombre}`, dispositivo: d,
      texto: pg.debeFallar ? `El ping de ${d} a ${pg.nombre} (${pg.destino}) falla, como debe ser: están en VLAN distintas.` : `El ping de ${d} a ${pg.nombre} (${pg.destino}) tiene respuesta.`,
      evaluar: enPc(d, (p) => {
        const v = p.pings.filter((x) => mismaDir(x.destino, pg.destino));
        if (!v.length) return { ok: false, detalle: `No encontramos un ping a ${pg.destino}.` };
        const alguno = v.some((x) => x.recibidos > 0);
        if (pg.debeFallar) return alguno ? { ok: false, detalle: `El ping a ${pg.destino} respondió: ¿están de verdad en VLAN distintas?` } : { ok: true };
        return alguno ? { ok: true } : { ok: false, detalle: `El ping a ${pg.destino} no recibió respuestas.` };
      }),
    });
  }
  return r;
}

const conVlans = (d: string, f: (v: ReturnType<typeof leerVlanBrief> & object, c: ConfigLeida) => Evaluacion) => (l: Leidas): Evaluacion => {
  const sin = sinEvidencia(l, d);
  if (sin) return sin;
  const v = leerVlanBrief(l.textos[d] ?? '');
  if (!v) return { ok: false, detalle: 'Falta la salida de show vlan brief.' };
  return f(v, l.switches[d]!);
};

const vlanExiste = (d: string, id: number, nombre: string): Requisito => ({
  id: `${d}-vlan${id}`, dispositivo: d, texto: `Existe la VLAN ${id} con el nombre «${nombre}».`,
  evaluar: conVlans(d, (v) => { const x = v.find((y) => y.id === id); return !x ? { ok: false, detalle: `La VLAN ${id} no aparece en show vlan brief.` } : x.nombre !== nombre ? { ok: false, detalle: `La VLAN ${id} se llama «${x.nombre}».` } : { ok: true }; }),
});

const accesoEn = (d: string, puerto: string, vlan: number): Requisito => ({
  id: `${d}-${abrev(puerto)}-acceso`, dispositivo: d, texto: `${abrev(puerto)} es un puerto de acceso de la VLAN ${vlan}.`,
  evaluar: enSw(d, (c) => {
    const i = c.ifs[puerto];
    if (!i) return { ok: false, detalle: `No encontramos interface ${puerto}.` };
    if ((i.accesoVlan ?? 1) !== vlan) return { ok: false, detalle: `${abrev(puerto)} está en la VLAN ${i.accesoVlan ?? 1}.` };
    if (i.modo !== 'access') return { ok: false, detalle: `Falta switchport mode access en ${abrev(puerto)}.` };
    return { ok: true };
  }),
});

function troncal(d: string, puerto: string, o: { nativa?: number; permitidas?: number[]; operativa?: boolean }): Requisito[] {
  const corta = abrev(puerto).replace(/^G/, 'Gi').replace(/^F/, 'Fa');
  const r: Requisito[] = [{
    id: `${d}-${corta}-trunk`, dispositivo: d, texto: `${corta} está fijo en modo troncal.`,
    evaluar: enSw(d, (c) => c.ifs[puerto]?.modo === 'trunk' ? { ok: true } : { ok: false, detalle: c.ifs[puerto]?.modo ? `${corta} está en modo ${c.ifs[puerto]!.modo}.` : `Falta switchport mode trunk en ${corta}.` }),
  }];
  if (o.nativa) r.push({
    id: `${d}-${corta}-nativa`, dispositivo: d, texto: `La VLAN nativa de la troncal es la ${o.nativa}.`,
    evaluar: enSw(d, (c) => (c.ifs[puerto]?.nativa ?? 1) === o.nativa ? { ok: true } : { ok: false, detalle: `La nativa es la ${c.ifs[puerto]?.nativa ?? 1}.` }),
  });
  if (o.permitidas) {
    const esperadas = [...o.permitidas].sort((a, b) => a - b);
    r.push({
      id: `${d}-${corta}-permitidas`, dispositivo: d, texto: `La troncal permite solo las VLAN ${esperadas.join(', ')}.`,
      evaluar: enSw(d, (c) => {
        const p = expandirVlans(c.ifs[puerto]?.permitidas);
        if (p === 'todas') return { ok: false, detalle: 'La troncal permite todas las VLAN: falta switchport trunk allowed vlan.' };
        return JSON.stringify([...p].sort((a, b) => a - b)) === JSON.stringify(esperadas) ? { ok: true } : { ok: false, detalle: `La troncal permite ${p.join(', ') || 'ninguna'}.` };
      }),
    });
  }
  if (o.operativa) r.push({
    id: `${d}-${corta}-operativa`, dispositivo: d, texto: `show interfaces trunk muestra ${corta} funcionando como troncal.`,
    evaluar: (l) => {
      const sin = sinEvidencia(l, d);
      if (sin) return sin;
      const t = leerTrunk(l.textos[d] ?? '');
      if (!t) return { ok: false, detalle: 'Falta la salida de show interfaces trunk.' };
      const x = t.find((y) => normalizarIf(y.puerto) === puerto);
      if (!x) return { ok: false, detalle: `${corta} no aparece en show interfaces trunk.` };
      if (o.nativa && x.nativa !== o.nativa) return { ok: false, detalle: `La troncal funciona con la nativa ${x.nativa}.` };
      return { ok: true };
    },
  });
  return r;
}

const subinterfaz = (d: string, fisica: string, vlan: number, ip: string): Requisito[] => {
  const n = `${fisica}.${vlan}`;
  const corta = `${abrev(fisica)}.${vlan}`;
  return [
    {
      id: `${d}-sub${vlan}-encap`, dispositivo: d, texto: `La subinterfaz ${corta} atiende la VLAN ${vlan} (encapsulation dot1Q ${vlan}).`,
      evaluar: enSw(d, (c) => !c.ifs[n] ? { ok: false, detalle: `No existe la subinterfaz ${corta}.` } : c.ifs[n]!.encapsulacion === vlan ? { ok: true } : { ok: false, detalle: c.ifs[n]!.encapsulacion ? `Tiene encapsulation dot1Q ${c.ifs[n]!.encapsulacion}.` : 'Falta encapsulation dot1Q.' }),
    },
    {
      id: `${d}-sub${vlan}-ip`, dispositivo: d, texto: `${corta} tiene la IP ${ip} ${MASCARA}.`,
      evaluar: enSw(d, (c) => !c.ifs[n] ? { ok: false, detalle: `No existe la subinterfaz ${corta}.` } : c.ifs[n]!.ip === ip && c.ifs[n]!.mascara === MASCARA ? { ok: true } : { ok: false, detalle: c.ifs[n]!.ip ? `Tiene ${c.ifs[n]!.ip} ${c.ifs[n]!.mascara}.` : 'No tiene dirección IP.' }),
    },
  ];
};

const lineas = (...l: (string | false | null | undefined | 0)[]) => l.filter((x): x is string => typeof x === 'string').join('\n');

// ---------- Router básico con SSH y doble pila (SRWE 1) ----------

export function routerBasico(codigo: string): CasoPT {
  const az = new Azar(codigo, 'pt-router');
  const n = az.entero(10, 89);
  const [r1, r2] = [`192.168.${n}`, `192.168.${n + 1}`];
  const [p1, p2] = [`2001:db8:acad:${n}::`, `2001:db8:acad:${n + 1}::`];
  const host = `R1-${az.elegir(NOMBRES)}`;
  const secreto = clave(az), pCon = clave(az), frase = az.elegir(FRASES);
  const dominio = az.elegir(['ccna.lab', 'empresa.local', 'redes.pe', 'campus.edu']);
  const usuario = az.elegir(['admin', 'soporte', 'netadmin', 'tecnico']);
  const secretoUsr = clave(az);
  const lo = `10.${az.entero(1, 250)}.${az.entero(1, 250)}`;
  const pc1 = `${r1}.${az.entero(10, 99)}`, pc2 = `${r2}.${az.entero(10, 99)}`;
  const id1 = pc1.split('.')[3], id2 = pc2.split('.')[3];
  const v61 = `${p1}${id1}`, v62 = `${p2}${id2}`;

  const requisitos: Requisito[] = [
    guardado('R1'), hostname('R1', host), secret('R1', secreto), consola('R1', pCon), cifrado('R1'), banner('R1', frase),
    {
      id: 'R1-ipv6-routing', dispositivo: 'R1', texto: 'R1 enruta IPv6 (ipv6 unicast-routing).',
      evaluar: enSw('R1', (c) => c.ipv6Routing ? { ok: true } : { ok: false, detalle: 'Falta ipv6 unicast-routing.' }),
    },
    ...interfazRouter('R1', 'GigabitEthernet0/0/0', `${r1}.1`, { ipv6: `${p1}1/64`, linkLocal: 'fe80::1', descripcion: true }),
    ...interfazRouter('R1', 'GigabitEthernet0/0/1', `${r2}.1`, { ipv6: `${p2}1/64`, linkLocal: 'fe80::1', descripcion: true }),
    {
      id: 'R1-lo0', dispositivo: 'R1', texto: `Loopback0 tiene la IP ${lo}.1 ${MASCARA}.`,
      evaluar: enSw('R1', (c) => c.ifs.Loopback0?.ip === `${lo}.1` && c.ifs.Loopback0?.mascara === MASCARA ? { ok: true } : { ok: false, detalle: c.ifs.Loopback0 ? `Loopback0 tiene ${c.ifs.Loopback0.ip ?? 'ninguna IP'}.` : 'No existe interface Loopback0.' }),
    },
    ...requisitosSsh('R1', dominio, usuario, secretoUsr, 4),
    ...requisitosPc('PC1', { ip: pc1, gw: `${r1}.1`, ipv6: v61, gw6: 'fe80::1', pings: [{ destino: pc2, nombre: 'PC2' }, { destino: v62, nombre: 'PC2-IPv6' }, { destino: `${lo}.1`, nombre: 'Lo0' }] }),
    ...requisitosPc('PC2', { ip: pc2, gw: `${r2}.1`, ipv6: v62, gw6: 'fe80::1' }),
  ];

  return {
    id: 'pt-router', codigo, titulo: 'Configuración básica de un router',
    topologia: {
      ancho: 720, alto: 275,
      nodos: [
        { id: 'PC1', tipo: 'pc', x: 60, y: 175, detalle: pc1, detalle2: v61, lado: 'abajo' },
        { id: 'S1', tipo: 'switch', x: 190, y: 75, lado: 'arriba' },
        { id: 'R1', tipo: 'router', x: 360, y: 75, detalle: host, detalle2: `Lo0 ${lo}.1`, lado: 'arriba' },
        { id: 'S2', tipo: 'switch', x: 530, y: 75, lado: 'arriba' },
        { id: 'PC2', tipo: 'pc', x: 660, y: 175, detalle: pc2, detalle2: v62, lado: 'abajo' },
      ],
      enlaces: [
        { a: 'PC1', b: 'S1', ib: 'F0/1' },
        { a: 'S1', b: 'R1', ia: 'G0/1', ib: 'G0/0/0' },
        { a: 'R1', b: 'S2', ia: 'G0/0/1', ib: 'G0/1' },
        { a: 'S2', b: 'PC2', ia: 'F0/1' },
      ],
    },
    direcciones: [
      { dispositivo: `R1 (${host})`, interfaz: 'G0/0/0', ip: `${r1}.1 · ${p1}1/64 · fe80::1`, mascara: MASCARA, gateway: 'No aplica' },
      { dispositivo: '', interfaz: 'G0/0/1', ip: `${r2}.1 · ${p2}1/64 · fe80::1`, mascara: MASCARA, gateway: 'No aplica' },
      { dispositivo: '', interfaz: 'Loopback0', ip: `${lo}.1`, mascara: MASCARA, gateway: 'No aplica' },
      { dispositivo: 'PC1', interfaz: 'NIC', ip: `${pc1} · ${v61}/64`, mascara: MASCARA, gateway: `${r1}.1 · fe80::1` },
      { dispositivo: 'PC2', interfaz: 'NIC', ip: `${pc2} · ${v62}/64`, mascara: MASCARA, gateway: `${r2}.1 · fe80::1` },
    ],
    valores: [
      { etiqueta: 'Nombre de host', valor: host },
      { etiqueta: 'enable secret', valor: secreto },
      { etiqueta: 'Contraseña de consola', valor: pCon },
      { etiqueta: 'Banner MOTD', valor: frase },
      { etiqueta: 'Dominio IP', valor: dominio },
      { etiqueta: 'Usuario SSH', valor: `${usuario} / ${secretoUsr}` },
    ],
    partes: [
      { titulo: 'Arma la topología', pasos: ['Coloca un router ISR4321 (R1), dos switches 2960 (S1 y S2) y dos PC.', 'Conecta PC1–S1 (F0/1), S1 (G0/1)–R1 (G0/0/0), R1 (G0/0/1)–S2 (G0/1) y S2 (F0/1)–PC2. Los switches no necesitan configuración.'] },
      { titulo: 'Configura los parámetros básicos de R1', pasos: [
        `Nombre ${host}, enable secret «${secreto}», contraseña de consola «${pCon}» con login.`,
        'Cifra las contraseñas en texto plano y configura el banner MOTD.',
        'Activa el enrutamiento IPv6.',
      ] },
      { titulo: 'Configura las interfaces', pasos: [
        'G0/0/0 y G0/0/1: dirección IPv4, dirección IPv6 global, link-local fe80::1, una descripción y no shutdown.',
        `Loopback0: ${lo}.1 ${MASCARA}.`,
      ] },
      { titulo: 'Configura SSH', pasos: [
        `Dominio ${dominio} y claves RSA de 1024 bits.`,
        `Usuario local «${usuario}» con el secreto «${secretoUsr}».`,
        'Líneas VTY 0 4: solo SSH y login local. Solo SSH versión 2. Guarda la configuración.',
      ] },
      { titulo: 'Configura las PC y verifica', pasos: [
        'Configura IPv4 e IPv6 estáticas en las dos PC; el gateway IPv6 es fe80::1.',
        `Desde PC1: ping a PC2 por IPv4 (${pc2}) y por IPv6 (${v62}), y ping a la Loopback0 (${lo}.1).`,
      ] },
    ],
    evidencias: [
      { dispositivo: 'R1', tipo: 'router', pide: ['show startup-config', 'show ip ssh'] },
      { dispositivo: 'PC1', tipo: 'pc', pide: ['ipconfig', `ping ${pc2}`, `ping ${v62}`, `ping ${lo}.1`] },
      { dispositivo: 'PC2', tipo: 'pc', pide: ['ipconfig'] },
    ],
    requisitos,
    solucion: [
      {
        dispositivo: 'R1', texto: lineas(
          'enable', 'configure terminal', `hostname ${host}`, `enable secret ${secreto}`, 'line console 0', ` password ${pCon}`, ' login', ' exit',
          'service password-encryption', `banner motd #${frase}#`, 'ipv6 unicast-routing',
          'interface g0/0/0', ' description LAN de PC1', ` ip address ${r1}.1 ${MASCARA}`, ` ipv6 address ${p1}1/64`, ' ipv6 address fe80::1 link-local', ' no shutdown',
          'interface g0/0/1', ' description LAN de PC2', ` ip address ${r2}.1 ${MASCARA}`, ` ipv6 address ${p2}1/64`, ' ipv6 address fe80::1 link-local', ' no shutdown',
          'interface loopback 0', ` ip address ${lo}.1 ${MASCARA}`, ' exit',
          `ip domain-name ${dominio}`, 'crypto key generate rsa general-keys modulus 1024', `username ${usuario} secret ${secretoUsr}`, 'ip ssh version 2',
          'line vty 0 4', ' transport input ssh', ' login local', ' end', 'copy running-config startup-config',
        ),
      },
      { dispositivo: 'PC1', texto: `Desktop > IP Configuration\n  IPv4 ${pc1} ${MASCARA}, gateway ${r1}.1\n  IPv6 ${v61}/64, gateway fe80::1\n\nCommand Prompt\n  ipconfig\n  ping ${pc2}\n  ping ${v62}\n  ping ${lo}.1` },
      { dispositivo: 'PC2', texto: `Desktop > IP Configuration\n  IPv4 ${pc2} ${MASCARA}, gateway ${r2}.1\n  IPv6 ${v62}/64, gateway fe80::1\n\nCommand Prompt\n  ipconfig` },
    ],
  };
}

// ---------- VLAN y troncal entre dos switches (SRWE 3) ----------

const NOMBRES_VLAN: Record<number, string> = { 10: 'ventas', 20: 'contabilidad', 30: 'docentes', 40: 'alumnos', 50: 'invitados', 60: 'gerencia', 70: 'soporte' };

export function vlanTroncal(codigo: string): CasoPT {
  const az = new Azar(codigo, 'pt-vlan');
  const [va, vb] = az.muestra([10, 20, 30, 40, 50, 60, 70], 2).sort((a, b) => a - b);
  const nativa = az.elegir([99, 199, 999]);
  const h1 = `S1-${az.elegir(NOMBRES)}`, h2 = `S2-${az.elegir(NOMBRES)}`;
  const enlace = az.elegir(['GigabitEthernet0/1', 'GigabitEthernet0/2']);
  const pa1 = `FastEthernet0/${az.entero(1, 10)}`, pb1 = `FastEthernet0/${az.entero(11, 20)}`;
  const pa2 = `FastEthernet0/${az.entero(1, 10)}`, pb2 = `FastEthernet0/${az.entero(11, 20)}`;
  const ra = `192.168.${va}`, rb = `192.168.${vb}`;
  const ip = (r: string) => `${r}.${az.entero(10, 99)}`;
  const [pc1, pc2, pc3] = [ip(ra), ip(rb), ip(ra)];
  let pc4 = ip(rb);
  if (pc4 === pc2) pc4 = `${rb}.${Number(pc2.split('.')[3]) + 1}`;
  const pc3b = pc3 === pc1 ? `${ra}.${Number(pc1.split('.')[3]) + 1}` : pc3;
  const permitidas = [va, vb, nativa];
  const noNeg = az.probabilidad(0.5);

  const sw = (d: string, h: string, pa: string, pb: string): Requisito[] => [
    guardado(d), hostname(d, h),
    vlanExiste(d, va, NOMBRES_VLAN[va]), vlanExiste(d, vb, NOMBRES_VLAN[vb]), vlanExiste(d, nativa, 'nativa'),
    accesoEn(d, pa, va), accesoEn(d, pb, vb),
    ...troncal(d, enlace, { nativa, permitidas, operativa: true }),
    ...(noNeg ? [{
      id: `${d}-nonegotiate`, dispositivo: d, texto: 'La troncal no envía tramas DTP (switchport nonegotiate).',
      evaluar: enSw(d, (c) => c.ifs[enlace]?.nonegotiate ? { ok: true } : { ok: false, detalle: 'Falta switchport nonegotiate.' }),
    }] : []),
  ];
  const script = (h: string, pa: string, pb: string) => lineas(
    'enable', 'configure terminal', `hostname ${h}`,
    `vlan ${va}`, ` name ${NOMBRES_VLAN[va]}`, `vlan ${vb}`, ` name ${NOMBRES_VLAN[vb]}`, `vlan ${nativa}`, ' name nativa', ' exit',
    `interface ${abrev(pa).replace('F', 'f')}`, ' switchport mode access', ` switchport access vlan ${va}`,
    `interface ${abrev(pb).replace('F', 'f')}`, ' switchport mode access', ` switchport access vlan ${vb}`,
    `interface ${abrev(enlace).replace('G', 'g')}`, ' switchport mode trunk', ` switchport trunk native vlan ${nativa}`, ` switchport trunk allowed vlan ${permitidas.join(',')}`,
    noNeg && ' switchport nonegotiate', ' end', 'copy running-config startup-config',
  );
  const e = abrev(enlace);
  return {
    id: 'pt-vlan', codigo, titulo: 'VLAN y troncal entre dos switches',
    topologia: {
      ancho: 720, alto: 260,
      nodos: [
        { id: 'S1', tipo: 'switch', x: 220, y: 70, detalle: h1, lado: 'arriba' },
        { id: 'S2', tipo: 'switch', x: 500, y: 70, detalle: h2, lado: 'arriba' },
        { id: 'PC1', tipo: 'pc', x: 90, y: 195, detalle: `VLAN ${va} · ${pc1}`, lado: 'abajo' },
        { id: 'PC2', tipo: 'pc', x: 260, y: 195, detalle: `VLAN ${vb} · ${pc2}`, lado: 'abajo' },
        { id: 'PC3', tipo: 'pc', x: 460, y: 195, detalle: `VLAN ${va} · ${pc3b}`, lado: 'abajo' },
        { id: 'PC4', tipo: 'pc', x: 630, y: 195, detalle: `VLAN ${vb} · ${pc4}`, lado: 'abajo' },
      ],
      enlaces: [
        { a: 'S1', b: 'S2', ia: e, ib: e, marca: 'Troncal', resaltado: true },
        { a: 'S1', b: 'PC1', ia: abrev(pa1) }, { a: 'S1', b: 'PC2', ia: abrev(pb1) },
        { a: 'S2', b: 'PC3', ia: abrev(pa2) }, { a: 'S2', b: 'PC4', ia: abrev(pb2) },
      ],
    },
    direcciones: [
      { dispositivo: 'PC1', interfaz: `NIC · VLAN ${va}`, ip: pc1, mascara: MASCARA, gateway: 'No aplica' },
      { dispositivo: 'PC2', interfaz: `NIC · VLAN ${vb}`, ip: pc2, mascara: MASCARA, gateway: 'No aplica' },
      { dispositivo: 'PC3', interfaz: `NIC · VLAN ${va}`, ip: pc3b, mascara: MASCARA, gateway: 'No aplica' },
      { dispositivo: 'PC4', interfaz: `NIC · VLAN ${vb}`, ip: pc4, mascara: MASCARA, gateway: 'No aplica' },
    ],
    valores: [
      { etiqueta: 'Hostname de S1', valor: h1 },
      { etiqueta: 'Hostname de S2', valor: h2 },
      { etiqueta: `VLAN ${va}`, valor: NOMBRES_VLAN[va] },
      { etiqueta: `VLAN ${vb}`, valor: NOMBRES_VLAN[vb] },
      { etiqueta: `VLAN ${nativa}`, valor: 'nativa' },
    ],
    partes: [
      { titulo: 'Arma la topología', pasos: [
        'Coloca dos switches 2960 y cuatro PC.',
        `S1: PC1 en ${abrev(pa1)}, PC2 en ${abrev(pb1)}. S2: PC3 en ${abrev(pa2)}, PC4 en ${abrev(pb2)}. Une ${e} de S1 con ${e} de S2.`,
      ] },
      { titulo: 'Configura los dos switches', pasos: [
        'Cambia los nombres de host.',
        `Crea las VLAN ${va} (${NOMBRES_VLAN[va]}), ${vb} (${NOMBRES_VLAN[vb]}) y ${nativa} (nativa) en los dos switches.`,
        'Asigna los puertos de las PC a sus VLAN, en modo acceso.',
        `Configura ${e} como troncal fija, con la VLAN nativa ${nativa} y permitiendo solo las VLAN ${permitidas.join(', ')}.`,
        ...(noNeg ? ['Desactiva DTP en la troncal.'] : []),
        'Guarda la configuración.',
      ] },
      { titulo: 'Configura las PC y verifica', pasos: [
        'Asigna las direcciones de la tabla (no hay router, así que no hace falta gateway).',
        `Desde PC1: ping a PC3 (misma VLAN, otro switch: debe responder) y a PC2 (otra VLAN: no debe responder).`,
        'Desde PC4: ping a PC2.',
      ] },
    ],
    evidencias: [
      { dispositivo: 'S1', tipo: 'switch', pide: ['show startup-config', 'show vlan brief', 'show interfaces trunk'] },
      { dispositivo: 'S2', tipo: 'switch', pide: ['show startup-config', 'show vlan brief', 'show interfaces trunk'] },
      { dispositivo: 'PC1', tipo: 'pc', pide: ['ipconfig', `ping ${pc3b}`, `ping ${pc2}`] },
      { dispositivo: 'PC2', tipo: 'pc', pide: ['ipconfig'] },
      { dispositivo: 'PC3', tipo: 'pc', pide: ['ipconfig'] },
      { dispositivo: 'PC4', tipo: 'pc', pide: ['ipconfig', `ping ${pc2}`] },
    ],
    requisitos: [
      ...sw('S1', h1, pa1, pb1), ...sw('S2', h2, pa2, pb2),
      ...requisitosPc('PC1', { ip: pc1, pings: [{ destino: pc3b, nombre: 'PC3' }, { destino: pc2, nombre: 'PC2', debeFallar: true }] }),
      ...requisitosPc('PC2', { ip: pc2 }),
      ...requisitosPc('PC3', { ip: pc3b }),
      ...requisitosPc('PC4', { ip: pc4, pings: [{ destino: pc2, nombre: 'PC2' }] }),
    ],
    solucion: [
      { dispositivo: 'S1', texto: script(h1, pa1, pb1) },
      { dispositivo: 'S2', texto: script(h2, pa2, pb2) },
      { dispositivo: 'PC1 a PC4', texto: `Desktop > IP Configuration: la IP de la tabla y la máscara ${MASCARA}.\nPC1: ping ${pc3b} (responde) y ping ${pc2} (no responde).\nPC4: ping ${pc2} (responde).` },
    ],
  };
}

// ---------- Router-on-a-stick (SRWE 4) ----------

export function routerOnAStick(codigo: string): CasoPT {
  const az = new Azar(codigo, 'pt-roas');
  const [va, vb] = az.muestra([10, 20, 30, 40, 50, 60, 70], 2).sort((a, b) => a - b);
  const admin = az.probabilidad(0.5) ? az.elegir([88, 99]) : null;
  const hr = `R1-${az.elegir(NOMBRES)}`, hs = `S1-${az.elegir(NOMBRES)}`;
  const fisica = az.elegir(['GigabitEthernet0/0/1', 'GigabitEthernet0/0/0']);
  const pa = `FastEthernet0/${az.entero(1, 10)}`, pb = `FastEthernet0/${az.entero(11, 20)}`;
  const ra = `192.168.${va}`, rb = `192.168.${vb}`;
  const pc1 = `${ra}.${az.entero(10, 99)}`, pc2 = `${rb}.${az.entero(10, 99)}`;
  const ipS1 = admin ? `192.168.${admin}.${az.entero(2, 9)}` : '';
  const f = abrev(fisica);

  const requisitos: Requisito[] = [
    guardado('R1'), hostname('R1', hr),
    ...subinterfaz('R1', fisica, va, `${ra}.1`), ...subinterfaz('R1', fisica, vb, `${rb}.1`),
    ...(admin ? subinterfaz('R1', fisica, admin, `192.168.${admin}.1`) : []),
    {
      id: 'R1-fisica', dispositivo: 'R1', texto: `La interfaz física ${f} está encendida y sin dirección IP.`,
      evaluar: enSw('R1', (c) => {
        const i = c.ifs[fisica];
        if (!i) return { ok: false, detalle: `No encontramos interface ${fisica}.` };
        if (i.shutdown) return { ok: false, detalle: `${f} está en shutdown: ninguna subinterfaz funciona.` };
        if (i.ip) return { ok: false, detalle: `${f} tiene la IP ${i.ip}: en router-on-a-stick las IP van en las subinterfaces.` };
        return { ok: true };
      }),
    },
    guardado('S1'), hostname('S1', hs),
    vlanExiste('S1', va, NOMBRES_VLAN[va]), vlanExiste('S1', vb, NOMBRES_VLAN[vb]),
    ...(admin ? [vlanExiste('S1', admin, 'administracion')] : []),
    accesoEn('S1', pa, va), accesoEn('S1', pb, vb),
    ...troncal('S1', 'GigabitEthernet0/1', {}),
    ...(admin ? [
      {
        id: 'S1-svi', dispositivo: 'S1', texto: `La SVI de la VLAN ${admin} tiene ${ipS1} y está encendida.`,
        evaluar: enSw('S1', (c) => { const i = c.ifs[`Vlan${admin}`]; return !i ? { ok: false, detalle: `No existe interface Vlan${admin}.` } : i.ip !== ipS1 ? { ok: false, detalle: `La SVI tiene ${i.ip ?? 'ninguna IP'}.` } : i.shutdown ? { ok: false, detalle: 'La SVI está en shutdown.' } : { ok: true }; }),
      },
      {
        id: 'S1-gw', dispositivo: 'S1', texto: `S1 tiene el gateway predeterminado 192.168.${admin}.1.`,
        evaluar: enSw('S1', (c) => c.gateway === `192.168.${admin}.1` ? { ok: true } : { ok: false, detalle: c.gateway ? `El gateway es ${c.gateway}.` : 'Falta ip default-gateway.' }),
      },
    ] as Requisito[] : []),
    ...requisitosPc('PC1', { ip: pc1, gw: `${ra}.1`, pings: [{ destino: pc2, nombre: 'PC2' }, ...(admin ? [{ destino: ipS1, nombre: 'S1' }] : [])] }),
    ...requisitosPc('PC2', { ip: pc2, gw: `${rb}.1`, pings: [{ destino: `${ra}.1`, nombre: 'R1' }] }),
  ];

  return {
    id: 'pt-roas', codigo, titulo: 'Router-on-a-stick',
    topologia: {
      ancho: 640, alto: 320,
      nodos: [
        { id: 'R1', tipo: 'router', x: 320, y: 50, detalle: hr, lado: 'derecha' },
        { id: 'S1', tipo: 'switch', x: 320, y: 180, detalle: hs, detalle2: admin ? `Vlan${admin} ${ipS1}` : undefined, lado: 'derecha' },
        { id: 'PC1', tipo: 'pc', x: 160, y: 260, detalle: `VLAN ${va} · ${pc1}`, lado: 'abajo' },
        { id: 'PC2', tipo: 'pc', x: 480, y: 260, detalle: `VLAN ${vb} · ${pc2}`, lado: 'abajo' },
      ],
      enlaces: [
        { a: 'R1', b: 'S1', ia: f, ib: 'G0/1', marca: 'Troncal', resaltado: true },
        { a: 'S1', b: 'PC1', ia: abrev(pa) },
        { a: 'S1', b: 'PC2', ia: abrev(pb) },
      ],
    },
    direcciones: [
      { dispositivo: `R1 (${hr})`, interfaz: `${f}.${va}`, ip: `${ra}.1`, mascara: MASCARA, gateway: 'No aplica' },
      { dispositivo: '', interfaz: `${f}.${vb}`, ip: `${rb}.1`, mascara: MASCARA, gateway: 'No aplica' },
      ...(admin ? [{ dispositivo: '', interfaz: `${f}.${admin}`, ip: `192.168.${admin}.1`, mascara: MASCARA, gateway: 'No aplica' }] : []),
      ...(admin ? [{ dispositivo: `S1 (${hs})`, interfaz: `Vlan${admin}`, ip: ipS1, mascara: MASCARA, gateway: `192.168.${admin}.1` }] : []),
      { dispositivo: 'PC1', interfaz: `NIC · VLAN ${va}`, ip: pc1, mascara: MASCARA, gateway: `${ra}.1` },
      { dispositivo: 'PC2', interfaz: `NIC · VLAN ${vb}`, ip: pc2, mascara: MASCARA, gateway: `${rb}.1` },
    ],
    valores: [
      { etiqueta: 'Hostname del router', valor: hr },
      { etiqueta: 'Hostname del switch', valor: hs },
      { etiqueta: `VLAN ${va}`, valor: NOMBRES_VLAN[va] },
      { etiqueta: `VLAN ${vb}`, valor: NOMBRES_VLAN[vb] },
      ...(admin ? [{ etiqueta: `VLAN ${admin}`, valor: 'administracion' }] : []),
    ],
    partes: [
      { titulo: 'Arma la topología', pasos: [`Un router ISR4321 (R1), un switch 2960 (S1) y dos PC. R1 ${f} a S1 G0/1. PC1 en ${abrev(pa)} y PC2 en ${abrev(pb)}.`] },
      { titulo: 'Configura S1', pasos: [
        `Nombre ${hs}. Crea las VLAN de la tabla de valores con sus nombres.`,
        'Asigna los puertos de las PC a sus VLAN, en modo acceso.',
        'Configura G0/1 como troncal fija (el router no negocia DTP).',
        ...(admin ? [`Asigna ${ipS1}/24 a la SVI de la VLAN ${admin} y el gateway 192.168.${admin}.1.`] : []),
        'Guarda la configuración.',
      ] },
      { titulo: 'Configura R1', pasos: [
        `Nombre ${hr}.`,
        `Crea una subinterfaz de ${f} por cada VLAN, con encapsulation dot1Q y la IP del gateway.`,
        `Enciende la interfaz física ${f} (sin dirección IP). Guarda la configuración.`,
      ] },
      { titulo: 'Configura las PC y verifica', pasos: [
        'IP, máscara y gateway de la tabla.',
        `Desde PC1: ping a PC2 (${pc2})${admin ? ` y a S1 (${ipS1})` : ''}. Desde PC2: ping a ${ra}.1.`,
      ] },
    ],
    evidencias: [
      { dispositivo: 'R1', tipo: 'router', pide: ['show startup-config'] },
      { dispositivo: 'S1', tipo: 'switch', pide: ['show startup-config', 'show vlan brief'] },
      { dispositivo: 'PC1', tipo: 'pc', pide: ['ipconfig', `ping ${pc2}`, ...(admin ? [`ping ${ipS1}`] : [])] },
      { dispositivo: 'PC2', tipo: 'pc', pide: ['ipconfig', `ping ${ra}.1`] },
    ],
    requisitos,
    solucion: [
      {
        dispositivo: 'S1', texto: lineas(
          'enable', 'configure terminal', `hostname ${hs}`,
          `vlan ${va}`, ` name ${NOMBRES_VLAN[va]}`, `vlan ${vb}`, ` name ${NOMBRES_VLAN[vb]}`, admin && `vlan ${admin}`, admin && ' name administracion', ' exit',
          `interface ${abrev(pa).replace('F', 'f')}`, ' switchport mode access', ` switchport access vlan ${va}`,
          `interface ${abrev(pb).replace('F', 'f')}`, ' switchport mode access', ` switchport access vlan ${vb}`,
          'interface g0/1', ' switchport mode trunk',
          admin && `interface vlan ${admin}`, admin && ` ip address ${ipS1} ${MASCARA}`, admin && ' no shutdown', admin && ' exit', admin && `ip default-gateway 192.168.${admin}.1`,
          ' end', 'copy running-config startup-config',
        ),
      },
      {
        dispositivo: 'R1', texto: lineas(
          'enable', 'configure terminal', `hostname ${hr}`,
          `interface ${f.toLowerCase()}.${va}`, ` encapsulation dot1Q ${va}`, ` ip address ${ra}.1 ${MASCARA}`,
          `interface ${f.toLowerCase()}.${vb}`, ` encapsulation dot1Q ${vb}`, ` ip address ${rb}.1 ${MASCARA}`,
          admin && `interface ${f.toLowerCase()}.${admin}`, admin && ` encapsulation dot1Q ${admin}`, admin && ` ip address 192.168.${admin}.1 ${MASCARA}`,
          `interface ${f.toLowerCase()}`, ' no shutdown', ' end', 'copy running-config startup-config',
        ),
      },
      { dispositivo: 'PC1 y PC2', texto: `PC1: ${pc1} ${MASCARA}, gateway ${ra}.1\nPC2: ${pc2} ${MASCARA}, gateway ${rb}.1` },
    ],
  };
}
