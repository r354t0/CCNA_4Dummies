# Cómo agregar contenido

## Regla de oro: nada de material de Cisco en el repositorio

El repositorio es público. No copies textos, capturas, preguntas de examen ni archivos `.pka`/`.pdf` de Networking
Academy. Sigue su índice y escribe con tus palabras; las actividades se citan por su número.

## Un tema de la parte Teórica

Cada tema es un archivo MDX en `src/content/teoria/<curso>/mNN/`, con el nombre `<módulo>-<tema>-<slug>.mdx`
(por ejemplo `m02/2-4-configuracion-basica.mdx`). Encabezado:

```yaml
---
curso: itn
modulo: 2
tema: "2.4"              # entre comillas
titulo: Configuración básica de dispositivos
objetivo: Configurar un dispositivo IOS con nombre de host, contraseñas y un aviso.
duracion: 30             # minutos
examen:                  # dominio del temario en cada versión; omite la que no aplique
  v1.1: 5
  v2.0: 4
practica: [cli, pt-switch]   # ids de src/data/practica.ts
actividades:
  - codigo: "2.4.7"
    tipo: Verificador de sintaxis   # Packet Tracer, Laboratorio, Video, Actividad de clase
    titulo: Configuración básica de dispositivos
    guia: "Consejo propio para aprovechar la actividad."
---
```

Si un texto del encabezado lleva «: », ponlo entre comillas.

Recursos disponibles dentro del MDX: `<Topologia>`, `<Tarjetas>`, `<Repaso>` (tarjetas que se voltean), `<Pasos>`,
`<ModosIOS>`, `<ModeloCapas>`, `<Encapsulacion>` y los recuadros `<aside class="clave|ojo|dato|examen">`. Mira los
temas existentes como ejemplo. El tema `N.0` es la introducción del módulo y el último, el resumen.

Un curso nuevo (SRWE, ENSA) ya tiene sus módulos y puntos de control en `src/data/cursos.ts`: basta con crear la
carpeta y los temas.

## Preguntas

Cada módulo tiene un banco en `src/content/preguntas/<curso>-NN.yaml`:

```yaml
curso: itn
modulo: 2
preguntas:
  - id: itn2-01
    tema: "2.4"
    verifique: true          # también aparece en «Verifique su comprensión» del tema
    p: "Enunciado"
    opciones: ["A", "B", "C", "D"]
    correcta: 1              # o [0, 2] si hay varias correctas
    explicacion: "Por qué."
```

Apunta a unas 35 preguntas por módulo. La prueba del módulo toma 15 al azar y el punto de control se publica solo
cuando todos sus módulos tienen temas y banco.

## Un ejercicio de Práctica

1. Agrégalo al catálogo `src/data/practica.ts` (id, tipo, módulos, temas y ruta).
2. Crea el componente en `src/components/practica/`. Usa `useCodigo()` y `<Escenario>` para el código del
   escenario, y genera todos los valores con `new Azar(codigo, '<id>')` para que el mismo código dé siempre el mismo
   ejercicio. Llama a `registrarLogro(id)` cuando el alumno lo complete.
3. Crea la página en `src/pages/practica/` con el layout `Practica`.

### Escenarios de Packet Tracer

Las plantillas están en `src/lib/pt/escenarios.ts`. Cada una define topología, tabla de direccionamiento, pasos,
qué salidas pedir (`evidencias`), los requisitos con su corrección y la solución. El lector de configuraciones
(`src/lib/ios/analizador.ts`) entiende `show startup-config` y `show running-config` de un 2960, `ipconfig` y
`ping` de una PC de Packet Tracer.

### Archivo de inicio (.pkt) opcional

Los ejercicios de Packet Tracer funcionan sin archivo: el alumno arma la topología. Si quieres darle los equipos ya
colocados y cableados:

1. Arma la topología **sin configurar** (los valores cambian con cada código).
2. Guárdala en `public/labs/<id>/inicial.pkt` (por ejemplo `public/labs/pt-switch/inicial.pkt`).
3. En `src/data/practica.ts`, agrega al ejercicio `archivo: 'pt-switch/inicial.pkt'`.
4. Indica en el commit la versión de Packet Tracer que usaste.

La página del ejercicio mostrará el enlace de descarga.

## Vista previa local

```bash
npm install
npm run dev
```

Abre http://localhost:4321/CCNA_4Dummies/. Antes de subir cambios, `npm run build` debe terminar sin errores.
