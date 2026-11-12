import { useEffect, useMemo, useRef, useState } from 'react';
import Topologia from '../Topologia';
import Escenario, { useCodigo, registrarLogro } from './Escenario';
import { generarPT, corregir, puntaje, crearInforme, leerInforme, type IdPT, type Resultado, type CasoPT, type DatosInforme } from '../../lib/pt/escenarios';
import './practica.css';

const leerLocal = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardarLocal = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

function leerArchivo(f: File): Promise<string> {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result ?? ''));
    r.onerror = () => mal(r.error);
    r.readAsText(f);
  });
}

function descargar(nombre: string, texto: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' }));
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const slug = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
const RUTAS: Record<IdPT, string> = { 'pt-switch': 'switch-inicial', 'pt-conectividad': 'conectividad', 'pt-router': 'router-basico', 'pt-vlan': 'vlan-troncal', 'pt-roas': 'router-on-a-stick' };

function Resultados({ caso, res }: { caso: CasoPT; res: Resultado[] }) {
  const p = puntaje(res);
  return (
    <div className="pt-resultados" aria-live="polite">
      <div className={`pt-nota ${p.ok === p.total ? 'ok' : ''}`}>
        <div className="pt-nota-cifra"><strong>{p.ok}</strong>/{p.total}</div>
        <div className="pt-nota-barra"><span style={{ width: `${p.pct}%` }} /></div>
        <p>{p.ok === p.total ? 'Todo correcto. Descarga el informe y envíalo a tu instructor.' : `${p.pct} % de los requisitos. Corrige lo marcado en Packet Tracer, vuelve a copiar las salidas y corrige otra vez.`}</p>
      </div>
      {caso.evidencias.map(({ dispositivo }) => (
        <section key={dispositivo} className="pt-grupo">
          <h4>{dispositivo}</h4>
          <ul>
            {res.filter((r) => r.dispositivo === dispositivo).map((r) => (
              <li key={r.id} className={`pt-req ${r.estado}`}>
                <span className="pt-req-icono" aria-label={r.estado === 'ok' ? 'Correcto' : r.estado === 'mal' ? 'Incorrecto' : 'Sin evidencia'}>
                  {r.estado === 'ok' ? '✓' : r.estado === 'mal' ? '✗' : '–'}
                </span>
                <span>
                  {r.texto}
                  {r.detalle && r.estado !== 'falta' && <small>{r.detalle}</small>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Enunciado({ caso }: { caso: CasoPT }) {
  const t = caso.topologia;
  return (
    <>
      <Topologia ancho={t.ancho} alto={t.alto} titulo="Topología" nodos={t.nodos} enlaces={t.enlaces} />
      <h3 className="pt-h">Tabla de direccionamiento</h3>
      <div className="pr-tabla-wrap">
        <table className="pr-tabla pt-tabla">
          <thead><tr><th>Dispositivo</th><th>Interfaz</th><th>Dirección IP</th><th>Máscara</th><th>Gateway</th></tr></thead>
          <tbody>
            {caso.direcciones.map((d, i) => (
              <tr key={i}><td>{d.dispositivo}</td><td>{d.interfaz}</td><td><code>{d.ip}</code></td><td><code>{d.mascara}</code></td><td>{d.gateway.includes('.') ? <code>{d.gateway}</code> : d.gateway}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="pt-h">Valores de este escenario</h3>
      <dl className="pt-valores">
        {caso.valores.map((v) => <div key={v.etiqueta}><dt>{v.etiqueta}</dt><dd><code>{v.valor}</code></dd></div>)}
      </dl>
      <h3 className="pt-h">Qué tienes que hacer</h3>
      <ol className="pt-partes">
        {caso.partes.map((p) => (
          <li key={p.titulo}>
            <strong>{p.titulo}</strong>
            <ol>{p.pasos.map((s) => <li key={s}>{s}</li>)}</ol>
          </li>
        ))}
      </ol>
    </>
  );
}

function Revisar({ id, alAbrir }: { id: IdPT; alAbrir: (codigo: string) => void }) {
  const [texto, setTexto] = useState('');
  const [datos, setDatos] = useState<DatosInforme | null>(null);
  const [error, setError] = useState('');

  const revisar = (t: string) => {
    const d = leerInforme(t);
    if (!d) { setDatos(null); setError('No encontramos el bloque de evidencia. El informe debe incluir las líneas entre «INICIO EVIDENCIA» y «FIN EVIDENCIA» sin cambios.'); return; }
    setError('');
    setDatos(d);
  };

  const caso = datos ? generarPT(datos.ej, datos.codigo) : null;
  const res = caso && datos ? corregir(caso, datos.textos) : null;
  const p = res ? puntaje(res) : null;

  return (
    <details className="pt-plegable">
      <summary>Revisar un informe (para el instructor)</summary>
      <div className="pt-plegable-cuerpo">
        <p>Carga el <code>.txt</code> que te envió el alumno. La app vuelve a corregir las salidas originales con los valores de su escenario, así que el resultado no depende de lo que diga el encabezado del informe.</p>
        <div className="pt-carga">
          <label className="pr-boton pt-archivo">
            Elegir archivo…
            <input type="file" accept=".txt,text/plain" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const t = await leerArchivo(f); setTexto(t); revisar(t); } e.target.value = ''; }} />
          </label>
          <span className="pr-marcador">o pégalo aquí:</span>
        </div>
        <textarea className="pt-area" rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="CCNA 4Dummies · Informe de práctica en Packet Tracer…" spellCheck={false} />
        <div className="pr-acciones"><button type="button" className="pr-boton pr-primario" disabled={!texto.trim()} onClick={() => revisar(texto)}>Revisar</button></div>
        {error && <p className="pr-msg mal">{error}</p>}
        {datos && caso && res && p && (
          <div className="pt-revision">
            <dl className="pt-valores">
              <div><dt>Alumno</dt><dd>{datos.alumno || '(sin nombre)'}</dd></div>
              <div><dt>Fecha</dt><dd>{datos.fecha}</dd></div>
              <div><dt>Ejercicio</dt><dd>{caso.titulo}</dd></div>
              <div><dt>Escenario</dt><dd><code>{datos.codigo}</code></dd></div>
            </dl>
            {(datos.ok !== p.ok || datos.total !== p.total) ? (
              <p className="pr-msg mal"><strong>El encabezado no coincide</strong>El informe dice {datos.ok}/{datos.total}, pero al volver a corregir las salidas el resultado es {p.ok}/{p.total}. El archivo pudo haberse editado a mano.</p>
            ) : (
              <p className="pr-msg ok"><strong>Resultado confirmado</strong>La nueva corrección coincide con el informe: {p.ok}/{p.total}.</p>
            )}
            <Resultados caso={caso} res={res} />
            <details className="pt-plegable">
              <summary>Salidas que pegó el alumno</summary>
              <div className="pt-plegable-cuerpo">
                {Object.entries(datos.textos).filter(([, v]) => v.trim()).map(([k, v]) => (
                  <div key={k}><h4 className="pt-h4">{k}</h4><pre className="pr-salida pt-pre">{v}</pre></div>
                ))}
              </div>
            </details>
            <div className="pr-acciones">
              {datos.ej === id
                ? <button type="button" className="pr-boton" onClick={() => alAbrir(datos.codigo)}>Abrir este escenario y su solución</button>
                : <a className="pr-boton" href={`../${RUTAS[datos.ej]}/?s=${datos.codigo}`}>Abrir el ejercicio de este informe</a>}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

export default function ImplementarPT({ id }: { id: IdPT }) {
  const [codigo, setCodigo] = useCodigo();
  const caso = useMemo(() => (codigo ? generarPT(id, codigo) : null), [id, codigo]);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [alumno, setAlumno] = useState('');
  const [res, setRes] = useState<Resultado[] | null>(null);
  const [verSolucion, setVerSolucion] = useState(false);
  const solucionRef = useRef<HTMLDetailsElement>(null);
  const clave = codigo ? `ccna-pt-${id}-${codigo}` : '';

  useEffect(() => { setAlumno(leerLocal('ccna-pt-alumno') ?? ''); }, []);
  useEffect(() => {
    if (!clave) return;
    try { setTextos(JSON.parse(leerLocal(clave) ?? '{}')); } catch { setTextos({}); }
    setRes(null);
  }, [clave]);

  if (!codigo || !caso) return null;

  const cambiarTexto = (d: string, v: string) => {
    const n = { ...textos, [d]: v };
    setTextos(n);
    guardarLocal(clave, JSON.stringify(n));
    setRes(null);
  };

  const evaluar = () => {
    const r = corregir(caso, textos);
    setRes(r);
    const p = puntaje(r);
    if (p.ok === p.total) registrarLogro(id);
  };

  const informe = () => {
    const url = `${location.origin}${location.pathname}?s=${codigo}`;
    descargar(`informe-${id}-${codigo}${alumno ? '-' + slug(alumno) : ''}.txt`, crearInforme(caso, alumno.trim(), textos, url));
  };

  const abrirSolucion = (c: string) => {
    setCodigo(c);
    setVerSolucion(true);
    setTimeout(() => solucionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const hayAlgo = caso.evidencias.some((e) => (textos[e.dispositivo] ?? '').trim());

  return (
    <Escenario id={id} codigo={codigo} alCambiar={(c) => { setCodigo(c); setVerSolucion(false); }}
      instrucciones={
        <p>
          Este escenario se implementa en <strong>Packet Tracer</strong>. Los valores cambian con cada código: tu compañero y tú
          pueden tener ejercicios distintos, y tu instructor puede abrir el tuyo con el mismo código.
        </p>
      }>
      <Enunciado caso={caso} />

      <h3 className="pt-h">Entrega tus resultados</h3>
      <details className="pt-plegable pt-ayuda">
        <summary>Cómo copiar las salidas desde Packet Tracer</summary>
        <div className="pt-plegable-cuerpo">
          <ul>
            <li><strong>Switch o router:</strong> en la pestaña CLI, escribe <code>show startup-config</code> y pulsa la barra espaciadora hasta el final (<code>--More--</code>). Selecciona todo el texto desde <code>show startup-config</code> hasta <code>end</code> y usa el botón <kbd>Copy</kbd> de la ventana o <kbd>Ctrl</kbd>+<kbd>C</kbd>.</li>
            <li>Si se piden varios comandos para el mismo equipo (por ejemplo, <code>show startup-config</code>, <code>show vlan brief</code> y <code>show interfaces trunk</code>), ejecútalos uno detrás de otro y pega todo en el mismo cuadro.</li>
            <li><strong>PC:</strong> en Desktop › Command Prompt ejecuta los comandos que se piden, uno detrás de otro, y copia toda la ventana.</li>
            <li>Se pide <code>show startup-config</code> y no <code>show running-config</code> porque así también se comprueba que guardaste.</li>
            <li>Si prefieres, guarda cada salida en un archivo <code>.txt</code> y súbelo con «Subir .txt».</li>
          </ul>
        </div>
      </details>

      <label className="pt-alumno">
        <span>Tu nombre (aparece en el informe)</span>
        <input value={alumno} onChange={(e) => { setAlumno(e.target.value); guardarLocal('ccna-pt-alumno', e.target.value); }} placeholder="Nombre y apellido" />
      </label>

      <div className="pt-evidencias">
        {caso.evidencias.map((e) => (
          <div key={e.dispositivo} className="pt-evidencia">
            <div className="pt-evidencia-cab">
              <label htmlFor={`ev-${e.dispositivo}`}><strong>{e.dispositivo}</strong> · pega la salida de {e.pide.map((c, i) => <span key={c}>{i > 0 && (i === e.pide.length - 1 ? ' y ' : ', ')}<code>{c}</code></span>)}</label>
              <label className="esc-mini pt-archivo">
                Subir .txt
                <input type="file" accept=".txt,text/plain" onChange={async (ev) => { const f = ev.target.files?.[0]; if (f) cambiarTexto(e.dispositivo, await leerArchivo(f)); ev.target.value = ''; }} />
              </label>
            </div>
            <textarea id={`ev-${e.dispositivo}`} className="pt-area" rows={e.tipo !== 'pc' ? 8 : 6} spellCheck={false}
              value={textos[e.dispositivo] ?? ''} onChange={(ev) => cambiarTexto(e.dispositivo, ev.target.value)}
              placeholder={e.tipo !== 'pc' ? `${e.dispositivo}#show startup-config\nUsing 1182 bytes\n!\nversion 15.0\n…` : 'C:\\>ipconfig\n…\nC:\\>ping …'} />
          </div>
        ))}
      </div>

      <div className="pr-acciones">
        <button type="button" className="pr-boton pr-primario" disabled={!hayAlgo} onClick={evaluar}>Corregir</button>
        <button type="button" className="pr-boton" disabled={!hayAlgo} onClick={informe}>Descargar informe (.txt)</button>
        {!hayAlgo && <span className="pr-marcador">Pega al menos una salida para corregir.</span>}
      </div>

      {res && <Resultados caso={caso} res={res} />}

      <Revisar id={id} alAbrir={abrirSolucion} />

      <details className="pt-plegable" ref={solucionRef} open={verSolucion} onToggle={(e) => setVerSolucion((e.target as HTMLDetailsElement).open)}>
        <summary>Ver la solución de este escenario</summary>
        <div className="pt-plegable-cuerpo">
          <p className="pr-marcador">Inténtalo primero. Con el código del escenario, tu instructor ve exactamente esta misma solución.</p>
          {caso.solucion.map((s) => (
            <div key={s.dispositivo}><h4 className="pt-h4">{s.dispositivo}</h4><pre className="pr-salida pt-pre">{s.texto}</pre></div>
          ))}
        </div>
      </details>
    </Escenario>
  );
}
