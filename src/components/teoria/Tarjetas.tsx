import { Icono, type TipoNodo } from '../Topologia';
import './contenido.css';

interface Tarjeta {
  titulo: string;
  texto: string;
  icono?: TipoNodo;
  ejemplo?: string;
}

/** Rejilla de conceptos. Con `icono` muestra el símbolo de red correspondiente. */
export default function Tarjetas({ items, columnas = 3 }: { items: Tarjeta[]; columnas?: 2 | 3 | 4 }) {
  return (
    <ul className={`tj tj-${columnas}`}>
      {items.map((t) => (
        <li key={t.titulo} className="tj-item">
          {t.icono && (
            <svg className="tj-icono topologia-icono" viewBox="-34 -34 68 68" width="56" height="56" aria-hidden="true">
              <Icono tipo={t.icono} />
            </svg>
          )}
          <p className="tj-titulo">{t.titulo}</p>
          <p className="tj-texto">{t.texto}</p>
          {t.ejemplo && <p className="tj-ejemplo">{t.ejemplo}</p>}
        </li>
      ))}
    </ul>
  );
}
