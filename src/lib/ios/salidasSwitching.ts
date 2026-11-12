// Salidas simuladas de comandos de switches y routers para los ejercicios de diagnóstico de SRWE.

export interface ContadoresIf {
  estado: 'up' | 'down' | 'administratively down';
  protocolo: 'up' | 'down';
  duplex: 'Full' | 'Half' | 'Auto';
  velocidad: '10' | '100' | '1000' | 'Auto';
  runts: number; giants: number; crc: number; colisiones: number; tardias: number; entrada: number; salida: number;
  descripcion?: string;
}

export function showInterfaces(nombre: string, mac: string, c: ContadoresIf, gigabit = false): string {
  const conectado = c.estado === 'up' && c.protocolo === 'up' ? ' (connected)' : c.estado === 'administratively down' ? ' (disabled)' : ' (notconnect)';
  const ritmo = c.estado === 'up' ? c.duplex === 'Half' ? 'Half-duplex' : 'Full-duplex' : 'Auto-duplex';
  const vel = c.estado === 'up' ? `${c.velocidad}Mb/s` : 'Auto-speed';
  const errores = c.runts + c.giants + c.crc;
  return [
    `${nombre} is ${c.estado}, line protocol is ${c.protocolo}${conectado}`,
    `  Hardware is ${gigabit ? 'Gigabit' : 'Fast'} Ethernet, address is ${mac} (bia ${mac})`,
    ...(c.descripcion ? [`  Description: ${c.descripcion}`] : []),
    `  MTU 1500 bytes, BW ${gigabit ? 1000000 : 100000} Kbit/sec, DLY ${gigabit ? 10 : 100} usec,`,
    '     reliability 255/255, txload 1/255, rxload 1/255',
    '  Encapsulation ARPA, loopback not set',
    '  Keepalive set (10 sec)',
    `  ${ritmo}, ${vel}, media type is ${gigabit ? '10/100/1000BaseTX' : '10/100BaseTX'}`,
    '  input flow-control is off, output flow-control is unsupported',
    '  ARP type: ARPA, ARP Timeout 04:00:00',
    '  Last input 00:00:01, output 00:00:00, output hang never',
    '  Last clearing of "show interface" counters never',
    '  Input queue: 0/75/0/0 (size/max/drops/flushes); Total output drops: 0',
    '  Queueing strategy: fifo',
    '  Output queue: 0/40 (size/max)',
    '  5 minute input rate 4000 bits/sec, 6 packets/sec',
    '  5 minute output rate 3000 bits/sec, 5 packets/sec',
    '     184372 packets input, 21794410 bytes, 0 no buffer',
    '     Received 2201 broadcasts (1866 multicasts)',
    `     ${c.runts} runts, ${c.giants} giants, 0 throttles`,
    `     ${errores} input errors, ${c.crc} CRC, 0 frame, 0 overrun, 0 ignored`,
    '     0 watchdog, 1866 multicast, 0 pause input',
    '     0 input packets with dribble condition detected',
    '     172644 packets output, 19824563 bytes, 0 underruns',
    `     ${c.tardias ? c.tardias + 3 : 0} output errors, ${c.colisiones} collisions, 1 interface resets`,
    '     0 unknown protocol drops',
    `     0 babbles, ${c.tardias} late collision, 0 deferred`,
    '     0 lost carrier, 0 no carrier, 0 pause output',
    '     0 output buffer failures, 0 output buffers swapped out',
  ].join('\n');
}

export interface FilaIf { nombre: string; ip?: string; estado: 'up' | 'down' | 'administratively down'; protocolo: 'up' | 'down' }

export function ipIntBrief(prompt: string, filas: FilaIf[]): string {
  const l = [`${prompt}#show ip interface brief`, 'Interface              IP-Address      OK? Method Status                Protocol'];
  for (const f of filas) {
    const ip = f.ip ?? 'unassigned';
    l.push(`${(f.nombre + ' ').padEnd(23)}${(ip + ' ').padEnd(16)}YES ${(f.ip ? 'manual' : 'unset').padEnd(7)}${f.estado.padEnd(22)}${f.protocolo}`);
  }
  return l.join('\n');
}

/** show vlan brief de un 2960 con 24 puertos Fa y 2 Gi. `asignacion` dice la VLAN de cada puerto de acceso. */
export function showVlanBrief(prompt: string, vlans: { id: number; nombre: string }[], asignacion: Record<string, number>, troncales: string[] = []): string {
  const todos = [...Array.from({ length: 24 }, (_, i) => `Fa0/${i + 1}`), 'Gi0/1', 'Gi0/2'];
  const l = [
    `${prompt}#show vlan brief`,
    '',
    'VLAN Name                             Status    Ports',
    '---- -------------------------------- --------- -------------------------------',
  ];
  const ids = [{ id: 1, nombre: 'default' }, ...vlans.filter((v) => v.id !== 1)].sort((a, b) => a.id - b.id);
  for (const v of ids) {
    const puertos = todos.filter((p) => !troncales.includes(p) && (asignacion[p] ?? 1) === v.id);
    const filas: string[] = [];
    for (let i = 0; i < Math.max(1, Math.ceil(puertos.length / 4)); i++) filas.push(puertos.slice(i * 4, i * 4 + 4).join(', '));
    l.push(`${String(v.id).padEnd(5)}${v.nombre.padEnd(33)}active    ${filas[0]}`);
    for (const f of filas.slice(1)) l.push(`${''.padEnd(48)}${f}`);
  }
  l.push(
    '1002 fddi-default                     active    ',
    '1003 token-ring-default               active    ',
    '1004 fddinet-default                  active    ',
    '1005 trnet-default                    active    ',
  );
  return l.join('\n');
}

export interface FilaTroncal { puerto: string; modo: 'on' | 'auto' | 'desirable'; nativa: number; permitidas: string; activas: string }

export function showIntTrunk(prompt: string, filas: FilaTroncal[]): string {
  const l = [`${prompt}#show interfaces trunk`];
  if (!filas.length) return l.join('\n');
  l.push('Port        Mode         Encapsulation  Status        Native vlan');
  for (const f of filas) l.push(`${f.puerto.padEnd(12)}${f.modo.padEnd(13)}802.1q         trunking      ${f.nativa}`);
  l.push('', 'Port        Vlans allowed on trunk');
  for (const f of filas) l.push(`${f.puerto.padEnd(12)}${f.permitidas}`);
  l.push('', 'Port        Vlans allowed and active in management domain');
  for (const f of filas) l.push(`${f.puerto.padEnd(12)}${f.activas}`);
  l.push('', 'Port        Vlans in spanning tree forwarding state and not pruned');
  for (const f of filas) l.push(`${f.puerto.padEnd(12)}${f.activas}`);
  return l.join('\n');
}

/** Convierte una lista de VLAN en el formato de IOS: 1,10,20-22 */
export function rangoVlan(ids: number[]): string {
  const s = [...new Set(ids)].sort((a, b) => a - b);
  const partes: string[] = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    partes.push(j > i + 1 ? `${s[i]}-${s[j]}` : j === i + 1 ? `${s[i]},${s[j]}` : `${s[i]}`);
    i = j;
  }
  return partes.join(',');
}
