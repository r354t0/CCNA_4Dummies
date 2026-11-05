// Construye rutas internas respetando el prefijo de GitHub Pages (/CCNA_4Dummies).
export function url(ruta = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const limpia = ruta.replace(/^\//, '');
  return limpia ? `${base}/${limpia}` : `${base}/`;
}
