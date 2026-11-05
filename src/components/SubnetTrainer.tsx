import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  aleatorio, calcular, enteroAIp, ipAEntero, mascara, prefijoDeMascara, wildcard,
} from '../lib/ipv4';
import './SubnetTrainer.css';

type Modo = 'subred' | 'mascara' | 'vlsm';

interface Campo {
  id: string;
  etiqueta: string;
  correcta: string;
  ayuda?: string;
  comparar: (entrada: string) => boolean;
}

interface Ejercicio {
  enunciado: ReactNode;
  campos: Campo[];
  solucion?: ReactNode;
}

const igualTexto = (correcta: string) => (e: string) => e.trim().replace(/\s+/g, '') === correcta;
const igualIp = (correcta: string) => (e: string) => {
  const n = ipAEntero(e);
  return n !== null && enteroAIp(n) === correcta;
};
const igualNumero = (correcta: number) => (e: string) => Number(e.trim().replace(/[.,\s]/g, '')) === correcta;

function ipPrivada(): number {
  const r = Math.random();
  if (r < 0.4) return ipAEntero(`192.168.${aleatorio(0, 255)}.${aleatorio(0, 255)}`)!;
  if (r < 0.7) return ipAEntero(`172.${aleatorio(16, 31)}.${aleatorio(0, 255)}.${aleatorio(0, 255)}`)!;
  return ipAEntero(`10.${aleatorio(0, 255)}.${aleatorio(0, 255)}.${aleatorio(0, 255)}`)!;
}

function prefijoExamen(): number {
  const r = Math.random();
  if (r < 0.6) return aleatorio(24, 30);
  if (r < 0.9) return aleatorio(16, 23);
  return aleatorio(8, 15);
}

function ejercicioSubred(): Ejercicio {
  let ip: number, p: number, s;
  do {
    ip = ipPrivada();
    p = prefijoExamen();
    s = calcular(ip, p);
  } while (ip === s.red || ip === s.broadcast);

  return {
    enunciado: (
      <p>
        Un host tiene la dirección <code>{enteroAIp(ip)}/{p}</code>. Calcula los datos de su subred.
      </p>
    ),
    campos: [
      { id: 'red', etiqueta: 'Dirección de red', correcta: enteroAIp(s.red), comparar: igualIp(enteroAIp(s.red)) },
      { id: 'mascara', etiqueta: 'Máscara', correcta: enteroAIp(mascara(p)), comparar: igualIp(enteroAIp(mascara(p))) },
      { id: 'primero', etiqueta: 'Primer host', correcta: enteroAIp(s.primero), comparar: igualIp(enteroAIp(s.primero)) },
      { id: 'ultimo', etiqueta: 'Último host', correcta: enteroAIp(s.ultimo), comparar: igualIp(enteroAIp(s.ultimo)) },
      { id: 'broadcast', etiqueta: 'Broadcast', correcta: enteroAIp(s.broadcast), comparar: igualIp(enteroAIp(s.broadcast)) },
      { id: 'hosts', etiqueta: 'Hosts utilizables', correcta: String(s.hosts), comparar: igualNumero(s.hosts) },
    ],
    solucion: <PasoAPasoSubred ip={ip} p={p} />,
  };
}

function PasoAPasoSubred({ ip, p }: { ip: number; p: number }) {
  const s = calcular(ip, p);
  const octeto = Math.floor((p === 32 ? 31 : p) / 8); // octeto donde está el límite de la máscara (0-3)
  const salto = 2 ** (8 - (p % 8 || 8));
  const enOcteto = p % 8 !== 0;
  return (
    <ol className="st-pasos">
      <li>La máscara /{p} es <code>{enteroAIp(mascara(p))}</code> y su wildcard es <code>{enteroAIp(wildcard(p))}</code>.</li>
      {enOcteto ? (
        <li>
          El límite cae en el octeto {octeto + 1}. El tamaño de bloque es 256 − {256 - salto} = <strong>{salto}</strong>,
          así que las subredes avanzan de {salto} en {salto} en ese octeto.
        </li>
      ) : (
        <li>El límite coincide con un octeto completo: la red conserva los primeros {p / 8} octetos y el resto va a cero.</li>
      )}
      {enOcteto ? (
        <li>El múltiplo de {salto} que contiene a la IP en ese octeto da la red: <code>{enteroAIp(s.red)}</code>.</li>
      ) : (
        <li>La red es <code>{enteroAIp(s.red)}</code>.</li>
      )}
      <li>La siguiente red menos 1 es el broadcast: <code>{enteroAIp(s.broadcast)}</code>.</li>
      <li>Hosts utilizables: 2<sup>{32 - p}</sup> − 2 = <strong>{s.hosts}</strong>.</li>
    </ol>
  );
}

function ejercicioMascara(): Ejercicio {
  const p = aleatorio(8, 30);
  const m = enteroAIp(mascara(p));
  const w = enteroAIp(wildcard(p));
  const hosts = 2 ** (32 - p) - 2;
  const desdePrefijo = Math.random() < 0.5;

  if (desdePrefijo) {
    return {
      enunciado: <p>Convierte el prefijo <code>/{p}</code>.</p>,
      campos: [
        { id: 'mascara', etiqueta: 'Máscara decimal', correcta: m, comparar: igualIp(m) },
        { id: 'wildcard', etiqueta: 'Wildcard', correcta: w, comparar: igualIp(w) },
        { id: 'hosts', etiqueta: 'Hosts utilizables', correcta: String(hosts), comparar: igualNumero(hosts) },
      ],
    };
  }
  return {
    enunciado: <p>Convierte la máscara <code>{m}</code>.</p>,
    campos: [
      {
        id: 'prefijo', etiqueta: 'Prefijo', correcta: `/${p}`, ayuda: 'Por ejemplo /24',
        comparar: (e) => Number(e.trim().replace('/', '')) === p,
      },
      { id: 'wildcard', etiqueta: 'Wildcard', correcta: w, comparar: igualIp(w) },
      { id: 'hosts', etiqueta: 'Hosts utilizables', correcta: String(hosts), comparar: igualNumero(hosts) },
    ],
  };
}

const NOMBRES_LAN = ['Ventas', 'Administración', 'Producción', 'Invitados', 'Soporte', 'Logística', 'Gerencia', 'Laboratorio'];

function mezclar<T>(a: T[]): T[] {
  const c = [...a];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

function ejercicioVlsm(): Ejercicio {
  // Bloques de LAN que caben en un /24 junto con los enlaces punto a punto.
  const enlaces = aleatorio(1, 2);
  let bloques: number[];
  do {
    const cantidad = aleatorio(3, 4);
    bloques = Array.from({ length: cantidad }, () => [128, 64, 64, 32, 32, 16, 8][aleatorio(0, 6)]);
  } while (bloques.reduce((a, b) => a + b, 0) + enlaces * 4 > 256 || Math.max(...bloques) < 32);

  const nombres = mezclar(NOMBRES_LAN);
  const lans = bloques.map((b, i) => ({
    nombre: `LAN ${nombres[i]}`,
    hosts: aleatorio(b / 2 - 1, b - 2),
    bloque: b,
  }));
  const p2p = Array.from({ length: enlaces }, (_, i) => ({
    nombre: `Enlace R${i + 1}–R${i + 2}`,
    hosts: 2,
    bloque: 4,
  }));
  // Convención del ejercicio: se asigna de mayor a menor, en el orden de la tabla.
  const requisitos = [...lans.sort((a, b) => b.bloque - a.bloque), ...p2p];

  const base = Math.random() < 0.5
    ? ipAEntero(`192.168.${aleatorio(1, 254)}.0`)!
    : ipAEntero(`172.${aleatorio(16, 31)}.${aleatorio(0, 255)}.0`)!;

  let cursor = base;
  const asignadas = requisitos.map((r) => {
    const p = 32 - Math.log2(r.bloque);
    const s = calcular(cursor, p);
    cursor += r.bloque;
    return { ...r, p, s };
  });

  return {
    enunciado: (
      <>
        <p>
          Diseña el direccionamiento con VLSM a partir de <code>{enteroAIp(base)}/24</code>. Asigna en el orden de la
          tabla (de la subred más grande a la más pequeña), empezando por el inicio del bloque y sin dejar huecos.
        </p>
        <p className="st-nota">Escribe cada respuesta como red/prefijo, por ejemplo <code>192.168.1.0/26</code>.</p>
      </>
    ),
    campos: asignadas.map((a, i) => {
      const correcta = `${enteroAIp(a.s.red)}/${a.p}`;
      return {
        id: `vlsm-${i}`,
        etiqueta: `${a.nombre}: ${a.hosts} hosts`,
        correcta,
        comparar: (e: string) => {
          const t = e.trim().replace(/\s+/g, ' ');
          const [ip, resto] = t.includes('/') ? t.split('/') : t.split(' ');
          const p = resto?.includes('.') ? prefijoDeMascara(resto) : Number(resto);
          return igualIp(enteroAIp(a.s.red))(ip ?? '') && p === a.p;
        },
      };
    }),
    solucion: (
      <div className="st-tabla-wrap">
        <table className="st-tabla">
          <thead>
            <tr><th>Segmento</th><th>Hosts</th><th>Red</th><th>Rango utilizable</th><th>Broadcast</th></tr>
          </thead>
          <tbody>
            {asignadas.map((a) => (
              <tr key={a.nombre}>
                <td>{a.nombre}</td>
                <td>{a.hosts} de {a.s.hosts}</td>
                <td><code>{enteroAIp(a.s.red)}/{a.p}</code></td>
                <td><code>{enteroAIp(a.s.primero)}</code> a <code>{enteroAIp(a.s.ultimo)}</code></td>
                <td><code>{enteroAIp(a.s.broadcast)}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  };
}

const GENERADORES: Record<Modo, () => Ejercicio> = {
  subred: ejercicioSubred,
  mascara: ejercicioMascara,
  vlsm: ejercicioVlsm,
};

const NOMBRES_MODO: Record<Modo, string> = {
  subred: 'Subred de un host',
  mascara: 'Máscaras y prefijos',
  vlsm: 'Diseño VLSM',
};

export default function SubnetTrainer({ modo = 'subred', pestanas = false }: { modo?: Modo; pestanas?: boolean }) {
  const [modoActual, setModo] = useState<Modo>(modo);
  const [semilla, setSemilla] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [revisado, setRevisado] = useState(false);
  const [verSolucion, setVerSolucion] = useState(false);
  const [marcador, setMarcador] = useState({ correctos: 0, total: 0 });

  // Se genera solo en el navegador (client:only / client:visible) para que cada visita sea distinta.
  const ej = useMemo(() => GENERADORES[modoActual](), [modoActual, semilla]);

  const resultados = ej.campos.map((c) => c.comparar(respuestas[c.id] ?? ''));
  const todoBien = resultados.every(Boolean);

  function nuevo(m: Modo = modoActual) {
    setModo(m);
    setSemilla((s) => s + 1);
    setRespuestas({});
    setRevisado(false);
    setVerSolucion(false);
  }

  function revisar(e: FormEvent) {
    e.preventDefault();
    if (!revisado) setMarcador((m) => ({ correctos: m.correctos + (todoBien ? 1 : 0), total: m.total + 1 }));
    setRevisado(true);
  }

  return (
    <section className="st" aria-label="Entrenador de subnetting">
      {pestanas && (
        <div className="st-pestanas" role="tablist" aria-label="Tipo de ejercicio">
          {(Object.keys(NOMBRES_MODO) as Modo[]).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={m === modoActual} onClick={() => nuevo(m)}>
              {NOMBRES_MODO[m]}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={revisar} className="st-cuerpo">
        <div className="st-enunciado">{ej.enunciado}</div>

        <div className={`st-campos ${modoActual === 'vlsm' ? 'st-campos-lista' : ''}`}>
          {ej.campos.map((c, i) => {
            const estado = revisado ? (resultados[i] ? 'ok' : 'mal') : '';
            return (
              <label key={`${semilla}-${c.id}`} className={`st-campo ${estado}`}>
                <span className="st-etiqueta">{c.etiqueta}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={c.ayuda}
                  value={respuestas[c.id] ?? ''}
                  aria-invalid={revisado ? !resultados[i] : undefined}
                  onChange={(e) => {
                    setRespuestas({ ...respuestas, [c.id]: e.target.value });
                  }}
                />
                {revisado && !resultados[i] && verSolucion && (
                  <span className="st-correcta">Correcta: <code>{c.correcta}</code></span>
                )}
              </label>
            );
          })}
        </div>

        <div className="st-acciones">
          <button type="submit" className="st-primario">Revisar respuestas</button>
          {revisado && !todoBien && !verSolucion && (
            <button type="button" onClick={() => setVerSolucion(true)}>Ver solución</button>
          )}
          <button type="button" onClick={() => nuevo()}>Nuevo ejercicio</button>
          <span className="st-marcador" aria-live="polite">
            {marcador.total > 0 && `${marcador.correctos} de ${marcador.total} ejercicios resueltos sin errores`}
          </span>
        </div>

        <div aria-live="polite">
          {revisado && todoBien && <p className="st-mensaje ok">Todo correcto. Prueba con un ejercicio nuevo.</p>}
          {revisado && !todoBien && !verSolucion && (
            <p className="st-mensaje mal">
              {resultados.filter((r) => !r).length} de {resultados.length} respuestas no coinciden. Corrígelas y vuelve a revisar, o mira la solución.
            </p>
          )}
        </div>

        {(verSolucion || (revisado && todoBien)) && ej.solucion && (
          <div className="st-solucion">
            <h4>Cómo se resuelve</h4>
            {ej.solucion}
          </div>
        )}
      </form>
    </section>
  );
}
