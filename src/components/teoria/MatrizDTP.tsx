import { useState } from 'react';
import './contenido.css';

const MODOS = ['dynamic auto', 'dynamic desirable', 'trunk', 'access'] as const;
type ModoDTP = (typeof MODOS)[number];
type Resultado = 'Troncal' | 'Acceso' | 'Conectividad limitada';

function resultado(a: ModoDTP, b: ModoDTP): Resultado {
  const par = [a, b].sort().join('|');
  if (a === 'access' && b === 'access') return 'Acceso';
  if (par === 'access|trunk') return 'Conectividad limitada';
  if (a === 'access' || b === 'access') return 'Acceso';
  if (a === 'dynamic auto' && b === 'dynamic auto') return 'Acceso';
  return 'Troncal';
}

function porque(a: ModoDTP, b: ModoDTP, r: Resultado): string {
  if (r === 'Conectividad limitada') return 'Un extremo es troncal y el otro de acceso: no se ponen de acuerdo. Es un error de configuración y el tráfico fallará.';
  if (a === 'dynamic auto' && b === 'dynamic auto') return 'Los dos esperan pasivamente a que el otro proponga la troncal; nadie lo hace, así que el enlace queda en acceso.';
  if (r === 'Acceso') return 'Un puerto de acceso no negocia troncales: el enlace queda en acceso.';
  if (a === 'trunk' && b === 'trunk') return 'Ambos están fijos en troncal. Aquí conviene además switchport nonegotiate para no enviar tramas DTP.';
  return 'Al menos un extremo propone activamente la troncal (desirable o trunk) y el otro la acepta: el enlace se vuelve troncal.';
}

/** Combina los modos de dos switches y muestra si el enlace termina en troncal o en acceso. */
export default function MatrizDTP() {
  const [a, setA] = useState<ModoDTP>('dynamic auto');
  const [b, setB] = useState<ModoDTP>('dynamic auto');
  const r = resultado(a, b);
  const clase = (x: Resultado) => (x === 'Troncal' ? 'troncal' : x === 'Acceso' ? 'acceso' : 'limitada');
  return (
    <section className="md" aria-label="Combinaciones de DTP">
      <p className="md-titulo">¿Troncal o acceso? Elige el modo de cada switch</p>
      <div className="md-tabla-wrap">
        <table className="md-tabla">
          <thead>
            <tr><th scope="col"><span className="md-eje">S1 ↓ · S2 →</span></th>{MODOS.map((m) => <th key={m} scope="col"><code>{m}</code></th>)}</tr>
          </thead>
          <tbody>
            {MODOS.map((f) => (
              <tr key={f}>
                <th scope="row"><code>{f}</code></th>
                {MODOS.map((c) => {
                  const x = resultado(f, c);
                  const sel = f === a && c === b;
                  return (
                    <td key={c}>
                      <button type="button" className={`md-celda ${clase(x)} ${sel ? 'sel' : ''}`} aria-pressed={sel} onClick={() => { setA(f); setB(c); }}>
                        {x}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={`md-resultado ${clase(r)}`} aria-live="polite">
        <strong>S1 <code>{a}</code> + S2 <code>{b}</code> → {r}.</strong> {porque(a, b, r)}
      </p>
    </section>
  );
}
