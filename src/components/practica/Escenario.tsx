import { useEffect, useState, type ReactNode } from 'react';
import { nuevoCodigo, normalizarCodigo } from '../../lib/azar';
import { marcar } from '../../lib/progreso';
import './practica.css';

/**
 * Marco común de los ejercicios de Práctica: muestra el código del escenario, permite
 * generar uno nuevo o abrir uno compartido, y guarda el código en la URL (?s=XXXX-XXXX).
 */
export function useCodigo() {
  const [codigo, setCodigo] = useState<string | null>(null);

  useEffect(() => {
    const desdeUrl = normalizarCodigo(new URLSearchParams(location.search).get('s') ?? '');
    setCodigo(desdeUrl ?? nuevoCodigo());
  }, []);

  useEffect(() => {
    if (!codigo) return;
    const u = new URL(location.href);
    u.searchParams.set('s', codigo);
    history.replaceState(null, '', u);
  }, [codigo]);

  return [codigo, setCodigo] as const;
}

interface Props {
  id: string; // id del ejercicio, para el progreso
  codigo: string;
  alCambiar: (c: string) => void;
  children: ReactNode;
  instrucciones?: ReactNode;
}

export default function Escenario({ id, codigo, alCambiar, children, instrucciones }: Props) {
  const [abrir, setAbrir] = useState('');
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);

  const abrirCodigo = () => {
    const c = normalizarCodigo(abrir);
    if (!c) { setError('El código tiene 8 caracteres, por ejemplo K7Q2-M4XA.'); return; }
    setError('');
    setAbrir('');
    alCambiar(c);
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch { /* el navegador no permite copiar: el código sigue visible */ }
  };

  return (
    <div className="esc" data-ejercicio={id}>
      <div className="esc-barra">
        <div className="esc-codigo">
          <span className="esc-rotulo">Escenario</span>
          <code>{codigo}</code>
          <button type="button" className="esc-mini" onClick={copiar}>{copiado ? 'Enlace copiado' : 'Copiar enlace'}</button>
        </div>
        <div className="esc-acciones">
          <button type="button" className="esc-boton esc-primario" onClick={() => alCambiar(nuevoCodigo())}>Nuevo escenario</button>
          <details className="esc-abrir">
            <summary>Abrir un código</summary>
            <div>
              <label>
                <span className="visually-hidden">Código de escenario</span>
                <input value={abrir} onChange={(e) => setAbrir(e.target.value)} placeholder="K7Q2-M4XA"
                  onKeyDown={(e) => { if (e.key === 'Enter') abrirCodigo(); }} />
              </label>
              <button type="button" className="esc-boton" onClick={abrirCodigo}>Abrir</button>
              {error && <p className="esc-error">{error}</p>}
            </div>
          </details>
        </div>
      </div>
      {instrucciones && <div className="esc-instrucciones">{instrucciones}</div>}
      <div className="esc-cuerpo">{children}</div>
    </div>
  );
}

/** Marca el ejercicio como practicado (cuenta para la barra de progreso de Práctica). */
export const registrarLogro = (id: string) => marcar(`e:${id}`);
