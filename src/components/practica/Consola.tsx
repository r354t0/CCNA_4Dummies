import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Switch } from '../../lib/ios/motor';
import './practica.css';

interface Props {
  sw: Switch;
  alCambiar?: () => void; // se llama después de cada comando, para reevaluar las tareas
  alto?: number;
}

/** Terminal de texto conectada al motor de IOS. Admite ?, Tab, historial y Ctrl+Z. */
export default function Consola({ sw, alCambiar, alto = 420 }: Props) {
  const [lineas, setLineas] = useState<string[]>(() => sw.arrancar());
  const [entrada, setEntrada] = useState('');
  const [oculta, setOculta] = useState(false);
  const [hist, setHist] = useState<number | null>(null);
  const pantalla = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    pantalla.current?.scrollTo({ top: pantalla.current.scrollHeight });
  }, [lineas]);

  const agregar = (nuevas: string[]) => setLineas((l) => [...l, ...nuevas].slice(-600));

  const enviar = (texto: string) => {
    const eco = sw.prompt() + (oculta ? '' : texto);
    const r = sw.entrada(texto);
    agregar([eco, ...r.salida]);
    setOculta(Boolean(r.ocultar));
    setEntrada('');
    setHist(null);
    alCambiar?.();
  };

  const teclas = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); enviar(entrada); return; }
    if (oculta) return;
    if (e.key === '?') {
      e.preventDefault();
      agregar([sw.prompt() + entrada + '?', ...sw.ayuda(entrada)]);
      return;
    }
    if (e.key === 'Tab') { e.preventDefault(); setEntrada(sw.completar(entrada)); return; }
    if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey) {
      e.preventDefault();
      if (['config', 'if', 'line'].includes(sw.modo) && !sw.espera) enviar('end');
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const h = sw.historial;
      if (!h.length) return;
      let i = hist === null ? h.length : hist;
      i = e.key === 'ArrowUp' ? Math.max(0, i - 1) : Math.min(h.length, i + 1);
      setHist(i);
      setEntrada(i === h.length ? '' : h[i]);
    }
  };

  return (
    <div className="cs" onClick={() => campo.current?.focus()}>
      <div className="cs-pantalla" ref={pantalla} style={{ height: alto }} role="log" aria-live="polite" aria-label="Salida de la consola">
        {lineas.map((l, i) => <div key={i} className="cs-linea">{l || ' '}</div>)}
        <div className="cs-entrada">
          <span className="cs-prompt">{sw.prompt()}</span>
          <input
            ref={campo}
            type={oculta ? 'password' : 'text'}
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={teclas}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            aria-label={oculta ? 'Contraseña' : `Comando. Prompt actual: ${sw.prompt()}`}
          />
        </div>
      </div>
      <div className="cs-ayuda">
        <span><kbd>?</kbd> ayuda</span>
        <span><kbd>Tab</kbd> completa</span>
        <span><kbd>↑</kbd><kbd>↓</kbd> historial</span>
        <span><kbd>Ctrl</kbd>+<kbd>Z</kbd> fin</span>
        <button type="button" className="cs-mini" onClick={(e) => { e.stopPropagation(); setLineas([]); }}>Limpiar pantalla</button>
      </div>
    </div>
  );
}
