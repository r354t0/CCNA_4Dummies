import { useMemo, useState } from 'react';
import { Azar } from '../../lib/azar';
import Escenario, { useCodigo, registrarLogro } from './Escenario';
import './practica.css';

interface Item { texto: string; cat: string; porque: string }
interface Categoria { titulo: string; pregunta: string; opciones: string[]; items: Item[] }

// Bancos de elementos para cada tipo de ronda. Cada ronda toma 6 al azar.
const CATEGORIAS: Categoria[] = [
  {
    titulo: 'Componentes de la red',
    pregunta: 'Clasifica cada elemento como dispositivo final, dispositivo intermediario o medio.',
    opciones: ['Dispositivo final', 'Dispositivo intermediario', 'Medio'],
    items: [
      { texto: 'Laptop de un estudiante', cat: 'Dispositivo final', porque: 'Allí empieza o termina la comunicación.' },
      { texto: 'Servidor de correo', cat: 'Dispositivo final', porque: 'Es el destino de los mensajes; ofrece un servicio.' },
      { texto: 'Impresora de red', cat: 'Dispositivo final', porque: 'Recibe los trabajos de impresión: es destino.' },
      { texto: 'Teléfono IP', cat: 'Dispositivo final', porque: 'Origen y destino de las llamadas.' },
      { texto: 'Cámara de seguridad IP', cat: 'Dispositivo final', porque: 'Genera video que envía por la red.' },
      { texto: 'Tablet', cat: 'Dispositivo final', porque: 'La usa una persona para comunicarse.' },
      { texto: 'Terminal de pago con tarjeta', cat: 'Dispositivo final', porque: 'Origina las transacciones.' },
      { texto: 'Switch del armario de cableado', cat: 'Dispositivo intermediario', porque: 'Conecta los equipos de la LAN.' },
      { texto: 'Router de la sucursal', cat: 'Dispositivo intermediario', porque: 'Une redes y elige caminos.' },
      { texto: 'Punto de acceso inalámbrico', cat: 'Dispositivo intermediario', porque: 'Conecta los equipos inalámbricos a la red cableada.' },
      { texto: 'Firewall', cat: 'Dispositivo intermediario', porque: 'Filtra el tráfico entre redes.' },
      { texto: 'Router inalámbrico de la casa', cat: 'Dispositivo intermediario', porque: 'Combina router, switch y punto de acceso.' },
      { texto: 'Cable UTP', cat: 'Medio', porque: 'Transporta impulsos eléctricos.' },
      { texto: 'Fibra óptica entre edificios', cat: 'Medio', porque: 'Transporta pulsos de luz.' },
      { texto: 'Ondas de radio del Wi-Fi', cat: 'Medio', porque: 'El aire es el medio en las redes inalámbricas.' },
      { texto: 'Cable coaxial de la televisión', cat: 'Medio', porque: 'Es el medio del acceso a Internet por cable.' },
    ],
  },
  {
    titulo: 'Tipos de red',
    pregunta: 'Indica qué tipo de red describe cada situación.',
    opciones: ['LAN', 'WAN', 'Intranet', 'Extranet', 'Internet'],
    items: [
      { texto: 'La red de un colegio, administrada por su área de sistemas, que cubre un solo local.', cat: 'LAN', porque: 'Área limitada y una sola organización a cargo.' },
      { texto: 'Los equipos de una casa conectados al mismo router inalámbrico.', cat: 'LAN', porque: 'Red pequeña de un solo dueño.' },
      { texto: 'El enlace contratado a un proveedor que une la sede de Lima con la de Arequipa.', cat: 'WAN', porque: 'Une LAN distantes y la administra un proveedor.' },
      { texto: 'La conexión entre las agencias de un banco en distintos departamentos del país.', cat: 'WAN', porque: 'Une sedes separadas geográficamente.' },
      { texto: 'El portal donde solo los empleados ven sus boletas de pago.', cat: 'Intranet', porque: 'Acceso exclusivo para miembros de la organización.' },
      { texto: 'El sistema interno de documentos de una municipalidad, accesible solo para su personal.', cat: 'Intranet', porque: 'Privado y solo para la organización.' },
      { texto: 'El portal donde los proveedores de un supermercado consultan los pedidos.', cat: 'Extranet', porque: 'Acceso controlado para externos que trabajan con la organización.' },
      { texto: 'Un hospital que permite a sus clínicas asociadas consultar resultados de laboratorio.', cat: 'Extranet', porque: 'Acceso seguro para socios externos autorizados.' },
      { texto: 'La red mundial que conecta millones de redes y no tiene un dueño único.', cat: 'Internet', porque: 'Es la colección mundial de redes interconectadas.' },
      { texto: 'La red pública donde cualquiera puede visitar la página web de una empresa.', cat: 'Internet', porque: 'Acceso público desde cualquier lugar.' },
    ],
  },
  {
    titulo: 'Acceso a Internet',
    pregunta: 'Identifica la tecnología de acceso que describe cada caso.',
    opciones: ['Cable', 'DSL', 'Fibra óptica', 'Celular', 'Satelital', 'Dial-up', 'Línea arrendada dedicada', 'Metro Ethernet'],
    items: [
      { texto: 'Internet por el mismo cable coaxial que trae la televisión.', cat: 'Cable', porque: 'Lo ofrecen los proveedores de televisión por cable.' },
      { texto: 'Internet por la línea telefónica, con más velocidad de bajada que de subida.', cat: 'DSL', porque: 'ADSL es asimétrico y usa la línea telefónica.' },
      { texto: 'Pulsos de luz con la misma velocidad de subida y de bajada.', cat: 'Fibra óptica', porque: 'La fibra ofrece velocidades altas y simétricas.' },
      { texto: 'Conexión desde un teléfono en cualquier lugar con cobertura 4G o 5G.', cat: 'Celular', porque: 'Usa la red de telefonía móvil.' },
      { texto: 'Una antena parabólica en una zona rural sin otra infraestructura.', cat: 'Satelital', porque: 'Necesita línea de vista despejada al satélite.' },
      { texto: 'Un módem que marca un número por la línea telefónica; muy lento.', cat: 'Dial-up', porque: 'Bajo costo y ancho de banda muy bajo.' },
      { texto: 'Un circuito reservado en la red del proveedor que une dos oficinas, con pago mensual.', cat: 'Línea arrendada dedicada', porque: 'Circuito dedicado entre sedes.' },
      { texto: 'La tecnología de las LAN extendida a la red del proveedor para unir sedes de una ciudad.', cat: 'Metro Ethernet', porque: 'También llamada Ethernet WAN.' },
    ],
  },
  {
    titulo: 'Redes confiables',
    pregunta: '¿Qué característica de una red confiable se aplica en cada caso?',
    opciones: ['Tolerancia a fallas', 'Escalabilidad', 'Calidad de servicio', 'Seguridad'],
    items: [
      { texto: 'Se corta un enlace y los paquetes siguen llegando por otra ruta.', cat: 'Tolerancia a fallas', porque: 'La redundancia evita que una falla corte el servicio.' },
      { texto: 'La empresa instala dos routers de salida a Internet por si uno se daña.', cat: 'Tolerancia a fallas', porque: 'Equipos redundantes.' },
      { texto: 'Se suman 200 usuarios nuevos sin que los actuales noten lentitud.', cat: 'Escalabilidad', porque: 'La red crece sin afectar a los usuarios existentes.' },
      { texto: 'Los equipos nuevos de otra marca se integran porque todo sigue estándares abiertos.', cat: 'Escalabilidad', porque: 'Los estándares permiten crecer sin rediseñar.' },
      { texto: 'Las llamadas de voz salen antes que las descargas cuando el enlace se congestiona.', cat: 'Calidad de servicio', porque: 'QoS prioriza el tráfico sensible al retraso.' },
      { texto: 'La videoconferencia del directorio no se corta aunque alguien descargue archivos grandes.', cat: 'Calidad de servicio', porque: 'El video tiene prioridad sobre las descargas.' },
      { texto: 'Los datos de las tarjetas viajan cifrados para que nadie los lea.', cat: 'Seguridad', porque: 'Protege la confidencialidad.' },
      { texto: 'Solo el personal autorizado puede entrar a la sala de servidores.', cat: 'Seguridad', porque: 'Seguridad física de la infraestructura.' },
    ],
  },
  {
    titulo: 'Amenazas y soluciones',
    pregunta: 'Identifica la amenaza o la solución de seguridad que corresponde a cada descripción.',
    opciones: ['Ataque de día cero', 'Denegación de servicio', 'Spyware', 'Robo de identidad', 'Firewall', 'VPN', 'IPS', 'Antivirus'],
    items: [
      { texto: 'Aprovecha una falla el mismo día en que se descubre, antes del parche.', cat: 'Ataque de día cero', porque: 'No hay defensa específica todavía.' },
      { texto: 'Satura el sitio web de una tienda para que nadie pueda comprar.', cat: 'Denegación de servicio', porque: 'Busca dejar el servicio sin respuesta.' },
      { texto: 'Recopila en secreto la información del usuario y la envía a terceros.', cat: 'Spyware', porque: 'Espía sin permiso.' },
      { texto: 'Usan los datos de otra persona para pedir un préstamo a su nombre.', cat: 'Robo de identidad', porque: 'Suplantan a la víctima.' },
      { texto: 'Filtra el tráfico que entra y sale de la red según reglas.', cat: 'Firewall', porque: 'Bloquea el acceso no autorizado.' },
      { texto: 'Crea un túnel cifrado para que un teletrabajador entre a la red de la empresa.', cat: 'VPN', porque: 'Red privada virtual.' },
      { texto: 'Detecta ataques en curso, incluso nuevos, y los bloquea.', cat: 'IPS', porque: 'Sistema de prevención de intrusiones.' },
      { texto: 'Revisa los archivos de una PC en busca de virus y troyanos.', cat: 'Antivirus', porque: 'Protección del dispositivo final.' },
    ],
  },
  {
    titulo: 'Tendencias: tipos de nube',
    pregunta: '¿Qué tipo de nube describe cada caso?',
    opciones: ['Pública', 'Privada', 'Híbrida', 'Comunitaria'],
    items: [
      { texto: 'Un servicio de almacenamiento que cualquiera puede contratar por Internet.', cat: 'Pública', porque: 'Disponible para el público general.' },
      { texto: 'Un correo gratuito que usan millones de personas.', cat: 'Pública', porque: 'Servicio abierto a cualquiera.' },
      { texto: 'Un ministerio que tiene su propia nube solo para sus aplicaciones.', cat: 'Privada', porque: 'Para una sola organización.' },
      { texto: 'Un banco guarda los datos de clientes en su nube propia y su sitio web en una pública.', cat: 'Híbrida', porque: 'Combina dos tipos de nube.' },
      { texto: 'Varias clínicas comparten una nube diseñada para cumplir la misma normativa de salud.', cat: 'Comunitaria', porque: 'Organizaciones con necesidades comunes.' },
      { texto: 'Universidades de una región comparten una plataforma con sus mismas reglas académicas.', cat: 'Comunitaria', porque: 'Grupo de organizaciones con requisitos comunes.' },
    ],
  },
];

const POR_RONDA = 6;

export default function Clasificar() {
  const [codigo, setCodigo] = useCodigo();
  const [ronda, setRonda] = useState(0);
  const [resp, setResp] = useState<Record<number, string>>({});
  const [revisado, setRevisado] = useState(false);
  const [marcador, setMarcador] = useState({ bien: 0, total: 0 });

  const caso = useMemo(() => {
    if (!codigo) return null;
    const az = new Azar(codigo, `clasificar-${ronda}`);
    const cat = az.elegir(CATEGORIAS);
    // Asegura variedad: al menos dos categorías distintas en la ronda.
    let items: Item[];
    do { items = az.muestra(cat.items, POR_RONDA); } while (new Set(items.map((i) => i.cat)).size < 2);
    return { cat, items };
  }, [codigo, ronda]);

  if (!codigo || !caso) return null;
  const { cat, items } = caso;
  const correcto = (i: number) => resp[i] === items[i].cat;
  const todos = items.every((_, i) => correcto(i));
  const completas = items.every((_, i) => resp[i]);

  const revisar = () => {
    setRevisado(true);
    const bien = items.filter((_, i) => correcto(i)).length;
    setMarcador((m) => ({ bien: m.bien + bien, total: m.total + items.length }));
    if (bien === items.length) registrarLogro('clasificar');
  };
  const siguiente = () => { setRonda((r) => r + 1); setResp({}); setRevisado(false); };
  const cambiarCodigo = (c: string) => { setCodigo(c); setRonda(0); setResp({}); setRevisado(false); };

  return (
    <Escenario id="clasificar" codigo={codigo} alCambiar={cambiarCodigo}>
      <p className="cl-ronda">Ronda {ronda + 1}: <strong>{cat.titulo}</strong></p>
      <p className="pr-pregunta">{cat.pregunta}</p>
      <ol className="cl-items">
        {items.map((it, i) => {
          const estado = revisado ? (correcto(i) ? 'ok' : 'mal') : '';
          return (
            <li key={`${ronda}-${i}`} className={`cl-item ${estado}`}>
              <span className="cl-texto">{it.texto}</span>
              <select
                className={`pr-select ${estado}`}
                value={resp[i] ?? ''}
                disabled={revisado}
                onChange={(e) => setResp({ ...resp, [i]: e.target.value })}
                aria-label={`Clasificación de: ${it.texto}`}
              >
                <option value="" disabled>Elige…</option>
                {cat.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              {revisado && !correcto(i) && (
                <span className="cl-porque">Es <strong>{it.cat}</strong>. {it.porque}</span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="pr-acciones">
        {!revisado ? (
          <button type="button" className="pr-boton pr-primario" disabled={!completas} onClick={revisar}>
            {completas ? 'Revisar' : `Faltan ${items.filter((_, i) => !resp[i]).length}`}
          </button>
        ) : (
          <button type="button" className="pr-boton pr-primario" onClick={siguiente}>Siguiente ronda</button>
        )}
        {marcador.total > 0 && <span className="pr-marcador">Aciertos en esta sesión: {marcador.bien} de {marcador.total}</span>}
      </div>
      {revisado && (
        <p className={`pr-msg ${todos ? 'ok' : 'mal'}`} aria-live="polite">
          <strong>{todos ? '¡Ronda perfecta!' : `${items.filter((_, i) => correcto(i)).length} de ${items.length} correctas.`}</strong>
          {todos ? 'Sigue con la siguiente ronda: el tipo de clasificación cambia.' : 'Lee la explicación de cada error y pasa a la siguiente ronda.'}
        </p>
      )}
    </Escenario>
  );
}
