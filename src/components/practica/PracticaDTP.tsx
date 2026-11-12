import { useMemo, useState } from 'react';
import { Azar, nuevoCodigo } from '../../lib/azar';
import Escenario, { useCodigo, registrarLogro } from './Escenario';
import './practica.css';

type Modo = 'access' | 'dynamic auto' | 'dynamic desirable' | 'trunk' | 'trunk + nonegotiate';
type Resultado = 'Troncal' | 'Acceso' | 'Conectividad limitada';
const RESULTADOS: Resultado[] = ['Troncal', 'Acceso', 'Conectividad limitada'];

function resultado(a: Modo, b: Modo): Resultado {
  const tiene = (m: Modo) => a === m || b === m;
  if (tiene('trunk + nonegotiate')) {
    const otro = a === 'trunk + nonegotiate' ? b : a;
    return otro === 'trunk' || otro === 'trunk + nonegotiate' ? 'Troncal' : 'Conectividad limitada';
  }
  if (tiene('access')) return a === b || !tiene('trunk') ? 'Acceso' : 'Conectividad limitada';
  if (a === 'dynamic auto' && b === 'dynamic auto') return 'Acceso';
  return 'Troncal';
}

function explicar(a: Modo, b: Modo, r: Resultado): string {
  if (a.includes('nonegotiate') || b.includes('nonegotiate')) {
    return r === 'Troncal'
      ? 'Los dos extremos están fijos en troncal: no necesitan negociar.'
      : 'Con nonegotiate ese extremo no envía tramas DTP. El otro nunca recibe una propuesta: se queda en acceso mientras el primero es troncal.';
  }
  if (r === 'Conectividad limitada') return 'Un extremo es troncal fijo y el otro es de acceso fijo: no coinciden.';
  if (a === 'dynamic auto' && b === 'dynamic auto') return 'Los dos son pasivos: esperan una propuesta que nadie envía.';
  if (r === 'Acceso') return 'Un puerto de acceso no forma troncales.';
  return 'Al menos un extremo propone la troncal (desirable o trunk) y el otro la acepta.';
}

const MODOS: Modo[] = ['access', 'dynamic auto', 'dynamic desirable', 'trunk', 'trunk + nonegotiate'];

export function generar(codigo: string) {
  const az = new Azar(codigo, 'dtp');
  const pares: [Modo, Modo][] = [];
  // Garantiza variedad: al menos un caso de cada resultado
  while (pares.length < 6 || new Set(pares.map(([a, b]) => resultado(a, b))).size < 3) {
    if (pares.length >= 6) pares.shift();
    const a = az.elegir(MODOS);
    let b = az.elegir(MODOS);
    if (a === 'trunk + nonegotiate' && b === 'trunk + nonegotiate') b = 'trunk';
    if (pares.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) continue;
    pares.push([a, b]);
  }
  return pares.map(([a, b], i) => ({ s1: `SW${2 * i + 1}`, s2: `SW${2 * i + 2}`, a, b, r: resultado(a, b), puerto: `Gi0/${az.entero(1, 2)}` }));
}

export default function PracticaDTP() {
  const [codigo, setCodigo] = useCodigo();
  const casos = useMemo(() => (codigo ? generar(codigo) : null), [codigo]);
  const [resp, setResp] = useState<Record<number, Resultado>>({});
  const [revisado, setRevisado] = useState(false);
  if (!codigo || !casos) return null;
  const bien = casos.filter((c, i) => resp[i] === c.r).length;
  const cambiar = (c: string) => { setCodigo(c); setResp({}); setRevisado(false); };
  const revisar = () => { setRevisado(true); if (bien === casos.length) registrarLogro('dtp'); };

  return (
    <Escenario id="dtp" codigo={codigo} alCambiar={cambiar}
      instrucciones={<p>Cada fila es un enlace entre dos switches Catalyst 2960 con el modo DTP configurado en cada puerto. ¿Cómo queda el enlace?</p>}>
      <ul className="dt-lista">
        {casos.map((c, i) => {
          const estado = revisado ? (resp[i] === c.r ? 'ok' : 'mal') : '';
          return (
            <li key={i} className={`dt-caso ${estado}`}>
              <div className="dt-enlace">
                <span className="dt-sw"><strong>{c.s1}</strong><code>switchport mode {c.a.replace(' + nonegotiate', '')}</code>{c.a.includes('nonegotiate') && <code>switchport nonegotiate</code>}</span>
                <span className="dt-cable" aria-hidden="true"><span>{c.puerto}</span></span>
                <span className="dt-sw"><strong>{c.s2}</strong><code>switchport mode {c.b.replace(' + nonegotiate', '')}</code>{c.b.includes('nonegotiate') && <code>switchport nonegotiate</code>}</span>
              </div>
              <div className="dt-opciones" role="radiogroup" aria-label={`Resultado del enlace ${c.s1}–${c.s2}`}>
                {RESULTADOS.map((r) => (
                  <label key={r} className={`dt-op ${resp[i] === r ? 'sel' : ''} ${revisado && r === c.r ? 'correcta' : ''}`}>
                    <input type="radio" name={`dt-${codigo}-${i}`} disabled={revisado} checked={resp[i] === r} onChange={() => setResp({ ...resp, [i]: r })} />
                    {r}
                  </label>
                ))}
              </div>
              {revisado && <p className="dt-explica">{resp[i] === c.r ? '✓ ' : `✗ Es ${c.r.toLowerCase()}. `}{explicar(c.a, c.b, c.r)}</p>}
            </li>
          );
        })}
      </ul>
      <div className="pr-acciones">
        {!revisado
          ? <button type="button" className="pr-boton pr-primario" onClick={revisar} disabled={Object.keys(resp).length < casos.length}>Revisar</button>
          : <button type="button" className="pr-boton pr-primario" onClick={() => cambiar(nuevoCodigo())}>Nuevo escenario</button>}
      </div>
      {revisado && (
        <p className={`pr-msg ${bien === casos.length ? 'ok' : 'mal'}`}>
          <strong>{bien} de {casos.length} correctas.</strong>
          Regla rápida: si hay un <code>access</code>, no hay troncal; <code>auto</code> + <code>auto</code> es acceso; en el resto, con un <code>desirable</code> o un <code>trunk</code>, hay troncal.
        </p>
      )}
    </Escenario>
  );
}
