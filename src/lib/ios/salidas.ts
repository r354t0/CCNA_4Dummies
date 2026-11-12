// Salidas simuladas de los comandos de una PC de Packet Tracer.

export function ipconfigPT(ip: string, mascara: string, gateway: string | null, mac: string): string {
  const ll = `FE80::${mac.replace(/\./g, '').slice(0, 4)}:${mac.replace(/\./g, '').slice(4, 6)}FF:FE${mac.replace(/\./g, '').slice(6, 8)}:${mac.replace(/\./g, '').slice(8)}`.toUpperCase();
  return [
    'C:\\>ipconfig',
    '',
    'FastEthernet0 Connection:(default port)',
    '',
    '   Connection-specific DNS Suffix..: ',
    `   Link-local IPv6 Address.........: ${ll}`,
    '   IPv6 Address....................: ::',
    `   IPv4 Address....................: ${ip}`,
    `   Subnet Mask.....................: ${mascara}`,
    '   Default Gateway.................: ::',
    `                                     ${gateway ?? '0.0.0.0'}`,
  ].join('\n');
}

export function pingPC(destino: string, exito: boolean, primeroPerdido = false): string {
  const l = ['C:\\>ping ' + destino, '', `Pinging ${destino} with 32 bytes of data:`, ''];
  let recibidos = 0;
  for (let i = 0; i < 4; i++) {
    if (exito && !(primeroPerdido && i === 0)) { l.push(`Reply from ${destino}: bytes=32 time<1ms TTL=${destino.endsWith('.1') ? 255 : 128}`); recibidos++; }
    else l.push('Request timed out.');
  }
  l.push('', `Ping statistics for ${destino}:`, `    Packets: Sent = 4, Received = ${recibidos}, Lost = ${4 - recibidos} (${(4 - recibidos) * 25}% loss),`);
  if (recibidos) l.push('Approximate round trip times in milli-seconds:', '    Minimum = 0ms, Maximum = 0ms, Average = 0ms');
  return l.join('\n');
}
