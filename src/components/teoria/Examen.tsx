import { useEffect, useMemo, useRef, useState } from 'react';
import { marcar, nota as leerNota, registrarNota, type Nota } from '../../lib/progreso';
import './evaluacion.css';

export interface PreguntaExamen {
  id: string;
  modulo: number;
  tema: string;
  temaTitulo: string;
  p: string;
  ilustracion?: string;
  opciones: string[];
  correcta: number | number[];
  explicacion: string;
}

interface Props {
  banco: PreguntaExamen[];
  cantidad: number;
  titulo: string;
  /** Clave de progreso; si se omite, el resultado no se guarda (simulacros libres). */
  clave?: string;
  umbral?: number;
  desglose?: 'tema' | 'modulo';
  /** Minutos disponibles; sin valor, el examen no tiene tiempo. */
  minutos?: number;
  modulosTitulos?: Record<number, string>;
  /** Empieza directamente, sin pantalla de inicio (lo usa el simulacro). */
  autoiniciar?: boolean;
  alTerminar?: () => void;
}

interface Item {
  q: PreguntaExamen;
  orden: number[]; // orden aleatorio de las opciones (índices originales)
}

type Fase = 'inicio' | 'curso' | 'resultado' | 'revision';

const lista = (c: number | number[]) => (Array.isArray(c) ? c : [c]);

function mezclar<T>(a: T[]): T[] {
  const c = [...a];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

/** Elige preguntas repartidas entre los objetivos para que ninguno quede sin evaluar. */
function seleccionar(banco: PreguntaExamen[], n: number, por: 'tema' | 'modulo'): Item[] {
  const grupos = new Map<string, PreguntaExamen[]>();
  for (const q of mezclar(banco)) {
    const k = por === 'tema' ? q.tema : String(q.modulo);
    grupos.set(k, [...(grupos.get(k) ?? []), q]);
  }
  const colas = mezclar([...grupos.values()]);
  const elegidas: PreguntaExamen[] = [];
  while (elegidas.length < Math.min(n, banco.length)) {
    for (const cola of colas) {
      const q = cola.shift();
      if (q && elegidas.length < n) elegidas.push(q);
    }
  }
  const ordenTema = (t: string) => t.split('.').map(Number);
  // Se presentan en el orden del curso, como en NetAcad.
  elegidas.sort((a, b) => {
    const [a1, a2] = ordenTema(a.tema);
    const [b1, b2] = ordenTema(b.tema);
    return a1 - b1 || a2 - b2;
  });
  return elegidas.map((q) => ({ q, orden: mezclar(q.opciones.map((_, i) => i)) }));
}

function Medidor({ pct, aprobado }: { pct: number; aprobado: boolean }) {
  const r = 70;
  const largo = Math.PI * r;
  return (
    <svg className="ev-medidor" viewBox="0 0 180 104" role="img" aria-label={`${pct}%`}>
      <path d="M20 94 A70 70 0 0 1 160 94" className="ev-medidor-pista" />
      <path
        d="M20 94 A70 70 0 0 1 160 94"
        className={`ev-medidor-valor ${aprobado ? 'ok' : 'mal'}`}
        strokeDasharray={`${(largo * pct) / 100} ${largo}`}
      />
      <text x="90" y="90" textAnchor="middle">{pct}%</text>
    </svg>
  );
}

export default function Examen({
  banco, cantidad, titulo, clave, umbral = 70, desglose = 'tema', minutos, modulosTitulos = {}, autoiniciar = false, alTerminar,
}: Props) {
  const [fase, setFase] = useState<Fase>(autoiniciar ? 'curso' : 'inicio');
  const [semilla, setSemilla] = useState(0);
  const items = useMemo(() => (semilla >= 0 ? seleccionar(banco, cantidad, desglose) : []), [banco, cantidad, desglose, semilla]);
  const [actual, setActual] = useState(0);
  const [resp, setResp] = useState<Record<number, number[]>>({});
  const [restante, setRestante] = useState<number | null>(minutos ? minutos * 60 : null);
  const [registro, setRegistro] = useState<Nota | undefined>(undefined);
  const [confirmar, setConfirmar] = useState(false);
  const zona = useRef<HTMLDivElement>(null);

  useEffect(() => { if (clave) setRegistro(leerNota(clave)); }, [clave]);

  const esCorrecta = (i: number) => {
    const c = lista(items[i].q.correcta);
    const e = resp[i] ?? [];
    return e.length === c.length && c.every((x) => e.includes(x));
  };
  const aciertos = items.filter((_, i) => esCorrecta(i)).length;
  const pct = items.length ? Math.round((aciertos / items.length) * 100) : 0;
  const respondidas = Object.values(resp).filter((r) => r.length > 0).length;

  function terminar() {
    setConfirmar(false);
    setFase('resultado');
    if (clave) {
      const n = registrarNota(clave, pct);
      setRegistro(n);
      if (pct >= umbral) marcar(clave);
    }
    alTerminar?.();
    zona.current?.scrollIntoView({ block: 'start' });
  }

  // Cronómetro
  useEffect(() => {
    if (fase !== 'curso' || restante === null) return;
    if (restante <= 0) { terminar(); return; }
    const t = setTimeout(() => setRestante((r) => (r ?? 0) - 1), 1000);
    return () => clearTimeout(t);
  });

  function empezar() {
    setSemilla((s) => s + 1);
    setResp({});
    setActual(0);
    setRestante(minutos ? minutos * 60 : null);
    setFase('curso');
  }

  function ir(i: number) {
    setActual(Math.max(0, Math.min(items.length - 1, i)));
    zona.current?.scrollIntoView({ block: 'nearest' });
  }

  if (fase === 'inicio') {
    return (
      <div className="ev-examen" ref={zona}>
        <div className="ev-inicio">
          <h2>{titulo}</h2>
          <ul>
            <li>{Math.min(cantidad, banco.length)} preguntas elegidas al azar de un banco de {banco.length}. Cada intento es distinto.</li>
            <li>Necesitas {umbral}% para aprobar.{minutos ? ` Tienes ${minutos} minutos.` : ' No hay límite de tiempo.'}</li>
            <li>Las preguntas de «elija dos» o «elija tres» solo cuentan si marcas todas las correctas.</li>
            <li>Al terminar verás tu resultado por objetivo y podrás revisar cada respuesta con su explicación.</li>
          </ul>
          {registro && (
            <p className="ev-registro">
              Tu mejor resultado: <strong>{registro.mejor}%</strong> en {registro.intentos} {registro.intentos === 1 ? 'intento' : 'intentos'}.
            </p>
          )}
          <button type="button" className="ev-boton ev-primario" onClick={empezar}>
            {registro ? 'Empezar un nuevo intento' : 'Empezar'}
          </button>
        </div>
      </div>
    );
  }

  const enRevision = fase === 'revision';
  const navegador = (
    <div className="ev-navegador" role="tablist" aria-label="Preguntas">
      {items.map((_, i) => {
        const r = resp[i]?.length;
        let estado = r ? 'respondida' : '';
        if (enRevision) estado = esCorrecta(i) ? 'ok' : 'mal';
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === actual}
            className={`ev-pastilla ${estado}`}
            onClick={() => ir(i)}
            aria-label={`Pregunta ${i + 1}${enRevision ? (esCorrecta(i) ? ', correcta' : ', incorrecta') : r ? ', respondida' : ''}`}
          >
            P{i + 1}
          </button>
        );
      })}
      {enRevision && (
        <button type="button" className="ev-pastilla ev-pastilla-resultado" onClick={() => setFase('resultado')}>
          Resultados
        </button>
      )}
    </div>
  );

  if (fase === 'resultado') {
    const grupos = new Map<string, { nombre: string; total: number; bien: number }>();
    items.forEach((it, i) => {
      const k = desglose === 'tema' ? it.q.tema : String(it.q.modulo);
      const nombre = desglose === 'tema'
        ? `${it.q.tema} ${it.q.temaTitulo}`
        : `Módulo ${it.q.modulo}${modulosTitulos[it.q.modulo] ? `: ${modulosTitulos[it.q.modulo]}` : ''}`;
      const g = grupos.get(k) ?? { nombre, total: 0, bien: 0 };
      g.total++;
      if (esCorrecta(i)) g.bien++;
      grupos.set(k, g);
    });
    const aprobado = pct >= umbral;
    return (
      <div className="ev-examen" ref={zona}>
        <div className="ev-resultado">
          <Medidor pct={pct} aprobado={aprobado} />
          <p>Has obtenido <strong>{pct}%</strong>: {aciertos} de {items.length} respuestas correctas.</p>
          <p className={aprobado ? 'ev-aprobado' : 'ev-reprobado'}>
            {aprobado ? 'Aprobaste.' : `Te falta para el ${umbral}%. Revisa los objetivos con menor puntaje y vuelve a intentarlo.`}
          </p>
          {registro && clave && <p className="ev-registro">Intentos: {registro.intentos}. Mejor resultado: {registro.mejor}%.</p>}
          <div className="ev-acciones">
            <button type="button" className="ev-boton ev-primario" onClick={() => { setActual(0); setFase('revision'); }}>
              Revisar respuestas
            </button>
            <button type="button" className="ev-boton" onClick={empezar}>Nuevo intento</button>
          </div>
          <table className="ev-desglose">
            <caption>Resultado por objetivo</caption>
            <thead><tr><th>Objetivo</th><th>Correctas</th><th>Puntaje</th></tr></thead>
            <tbody>
              {[...grupos.values()].map((g) => {
                const p = Math.round((g.bien / g.total) * 100);
                return (
                  <tr key={g.nombre}>
                    <td>{g.nombre}</td>
                    <td>{g.bien} de {g.total}</td>
                    <td><span className={`ev-pct ${p >= umbral ? 'ok' : 'mal'}`} style={{ ['--p' as string]: `${p}%` }}>{p}%</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // En curso o en revisión
  const it = items[actual];
  const c = lista(it.q.correcta);
  const multiple = c.length > 1;
  const e = resp[actual] ?? [];
  const elegir = (original: number) => {
    if (enRevision) return;
    const nuevo = multiple ? (e.includes(original) ? e.filter((x) => x !== original) : [...e, original]) : [original];
    setResp({ ...resp, [actual]: nuevo });
  };
  const mm = restante !== null ? `${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}` : null;

  return (
    <div className="ev-examen" ref={zona}>
      <div className="ev-cabecera">
        {navegador}
        <div className="ev-estado">
          {mm && !enRevision && <span className={`ev-reloj ${restante! < 60 ? 'urgente' : ''}`} aria-live="off">Tiempo: {mm}</span>}
          {!enRevision && <span>{respondidas} de {items.length} respondidas</span>}
        </div>
      </div>

      <div className="ev-cuerpo">
        <p className="ev-numero">Pregunta {actual + 1} de {items.length}</p>
        <fieldset className="ev-fieldset">
          <legend>
            {it.q.p}
            {multiple && <span className="ev-elija"> Elija {c.length} opciones.</span>}
          </legend>
          {it.q.ilustracion && <pre className="ev-ilustracion">{it.q.ilustracion}</pre>}
          {it.orden.map((original) => {
            let estado = '';
            if (enRevision && c.includes(original)) estado = 'ok';
            else if (enRevision && e.includes(original)) estado = 'mal';
            return (
              <label key={original} className={`ev-opcion ${estado}`}>
                <input
                  type={multiple ? 'checkbox' : 'radio'}
                  name={`ex-${semilla}-${actual}`}
                  checked={e.includes(original)}
                  disabled={enRevision}
                  onChange={() => elegir(original)}
                />
                <span>{it.q.opciones[original]}</span>
              </label>
            );
          })}
        </fieldset>
        {enRevision && (
          <p className={`ev-explicacion ${esCorrecta(actual) ? 'ok' : 'mal'}`}>
            <strong>{esCorrecta(actual) ? 'Correcta.' : e.length ? 'Incorrecta.' : 'Sin responder.'}</strong> {it.q.explicacion}
            <span className="ev-fuente">Tema {it.q.tema}: {it.q.temaTitulo}</span>
          </p>
        )}
      </div>

      <div className="ev-acciones ev-acciones-pie">
        <button type="button" className="ev-boton" onClick={() => ir(actual - 1)} disabled={actual === 0}>Anterior</button>
        {actual < items.length - 1 ? (
          <button type="button" className="ev-boton ev-primario" onClick={() => ir(actual + 1)}>Siguiente</button>
        ) : enRevision ? (
          <button type="button" className="ev-boton ev-primario" onClick={() => setFase('resultado')}>Ver resultados</button>
        ) : (
          <button
            type="button"
            className="ev-boton ev-primario"
            onClick={() => (respondidas < items.length && !confirmar ? setConfirmar(true) : terminar())}
          >
            {confirmar ? 'Enviar de todos modos' : 'Enviar examen'}
          </button>
        )}
      </div>
      {confirmar && !enRevision && respondidas < items.length && (
        <p className="ev-aviso" role="alert">
          Te quedan {items.length - respondidas} preguntas sin responder. Puedes volver a ellas con los botones de arriba o
          enviar el examen así.
        </p>
      )}
    </div>
  );
}
