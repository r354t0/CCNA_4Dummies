import './contenido.css';

// Mapa de los modos de la CLI de Cisco IOS y los comandos para moverse entre ellos.
export default function ModosIOS() {
  const modos = [
    { y: 30, prompt: 'Switch>', nombre: 'EXEC de usuario', desc: 'Solo consulta básica' },
    { y: 120, prompt: 'Switch#', nombre: 'EXEC privilegiado', desc: 'show, copy, reload, debug' },
    { y: 210, prompt: 'Switch(config)#', nombre: 'Configuración global', desc: 'Cambios a todo el equipo' },
  ];
  const sub = [
    { x: 40, prompt: 'Switch(config-line)#', nombre: 'Línea', desc: 'line console 0 · line vty 0 15' },
    { x: 330, prompt: 'Switch(config-if)#', nombre: 'Interfaz', desc: 'interface vlan 1 · interface f0/1' },
  ];
  return (
    <figure className="modos">
      <svg viewBox="0 0 620 400" role="img" aria-labelledby="modos-t modos-d">
        <title id="modos-t">Modos de la CLI de Cisco IOS</title>
        <desc id="modos-d">
          De EXEC de usuario se pasa a EXEC privilegiado con enable y se vuelve con disable. De EXEC privilegiado se pasa
          a configuración global con configure terminal. Desde configuración global se entra a los submodos de línea o de
          interfaz. exit sube un nivel; end o Ctrl+Z vuelve directo a EXEC privilegiado.
        </desc>
        {modos.map((m, i) => (
          <g key={m.prompt} transform={`translate(160 ${m.y})`}>
            <rect width="300" height="56" rx="8" className={`modo modo-${i}`} />
            <text x="16" y="24" className="modo-prompt">{m.prompt}</text>
            <text x="16" y="44" className="modo-desc">{m.nombre}: {m.desc}</text>
          </g>
        ))}
        {sub.map((s) => (
          <g key={s.prompt} transform={`translate(${s.x} 320)`}>
            <rect width="250" height="56" rx="8" className="modo modo-3" />
            <text x="14" y="24" className="modo-prompt">{s.prompt}</text>
            <text x="14" y="44" className="modo-desc">{s.nombre}: {s.desc}</text>
          </g>
        ))}

        {/* enable / disable */}
        <path d="M290 86 V120" className="flecha" markerEnd="url(#punta)" />
        <path d="M330 120 V86" className="flecha flecha-vuelta" markerEnd="url(#punta)" />
        <text x="282" y="108" textAnchor="end" className="cmd">enable</text>
        <text x="338" y="108" className="cmd cmd-vuelta">disable</text>

        {/* configure terminal / exit */}
        <path d="M290 176 V210" className="flecha" markerEnd="url(#punta)" />
        <path d="M330 210 V176" className="flecha flecha-vuelta" markerEnd="url(#punta)" />
        <text x="282" y="198" textAnchor="end" className="cmd">configure terminal</text>
        <text x="338" y="198" className="cmd cmd-vuelta">exit</text>

        {/* submodos */}
        <path d="M230 266 L170 320" className="flecha" markerEnd="url(#punta)" />
        <path d="M390 266 L450 320" className="flecha" markerEnd="url(#punta)" />
        <text x="150" y="292" textAnchor="end" className="cmd">line …</text>
        <text x="470" y="292" className="cmd">interface …</text>

        {/* end */}
        <path d="M600 322 C622 250 622 160 466 148" className="flecha flecha-end" markerEnd="url(#punta-end)" />
        <text x="472" y="200" className="cmd cmd-end">end · Ctrl+Z</text>

        <defs>
          <marker id="punta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className="punta-m" />
          </marker>
          <marker id="punta-end" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className="punta-end" />
          </marker>
        </defs>
      </svg>
      <figcaption>
        <code>exit</code> sube un nivel. <code>end</code> o <kbd>Ctrl</kbd>+<kbd>Z</kbd> vuelve directo al modo EXEC
        privilegiado desde cualquier modo de configuración.
      </figcaption>
    </figure>
  );
}
