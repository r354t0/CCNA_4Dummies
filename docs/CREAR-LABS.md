# Cómo crear y subir laboratorios

Esta guía sirve para dos cosas: subir el archivo `.pkt` de un laboratorio que ya está escrito, y escribir un
laboratorio nuevo.

## Subir el archivo de un laboratorio existente

1. Abre la página del laboratorio en la app y arma la topología siguiendo el diagrama y la tabla de
   direccionamiento.
2. Decide qué versión vas a entregar:
   - **Inicial** (recomendada): equipos cableados, PCs sin configurar y routers/switches con configuración de
     fábrica. El alumno hace todo el laboratorio.
   - **Troubleshooting**: la red completa con las fallas inyectadas. Las instrucciones están al final de cada lab de
     troubleshooting, en «Para quien prepara el archivo .pkt».
   - **Con Activity Wizard (.pka)**: Packet Tracer califica automáticamente al alumno. Es la mejor opción si tienes
     tiempo de definir la red de respuesta.
3. Guarda el archivo con el mismo nombre que el laboratorio, dentro de su carpeta:

   ```
   public/labs/l1-01-configuracion-inicial/l1-01-configuracion-inicial.pkt
   ```

4. En el archivo del laboratorio (`src/content/labs/l1-01-configuracion-inicial.mdx`), agrega en el encabezado:

   ```yaml
   archivo: l1-01-configuracion-inicial/l1-01-configuracion-inicial.pkt
   ```

5. Indica en la descripción del commit la versión de Packet Tracer que usaste (por ejemplo 8.2.2). Los archivos
   guardados en versiones nuevas no siempre abren en versiones anteriores.

La página del laboratorio mostrará automáticamente el botón de descarga en lugar del aviso de «en preparación».

### Laboratorios de GNS3

Exporta el proyecto como **portable project** (`.gns3project`) **sin incluir imágenes**. Las imágenes de Cisco IOS
tienen licencia y no se pueden publicar en el repositorio. En el enunciado del lab indica qué imagen y versión se
necesita (por ejemplo, IOSv 15.9 de Cisco Modeling Labs).

## Escribir un laboratorio nuevo

Copia `docs/plantilla-lab.mdx` a `src/content/labs/` con un nombre del tipo `l<nivel>-<número>-<tema>.mdx` y
completa el encabezado:

| Campo | Qué poner |
|---|---|
| `titulo`, `descripcion` | En lenguaje del alumno: qué va a lograr |
| `nivel`, `orden` | Nivel de 1 a 5 y posición dentro del nivel |
| `duracion` | Minutos estimados |
| `dificultad` | `Básica`, `Intermedia` o `Avanzada` |
| `herramienta` | `Packet Tracer`, `GNS3` o `Packet Tracer o GNS3` |
| `tipo` | `Configuración` o `Troubleshooting` |
| `examen` | Dominio del temario en cada versión. Si el tema no entra en una versión, omite esa línea |
| `dispositivos` | Lista de equipos |

Después, agrega el identificador del laboratorio en el campo `labs` de las lecciones relacionadas. En la ruta de
estudio, el laboratorio aparece después de la última lección que lo menciona.

### Lista de control de un buen laboratorio

- La topología se dibuja con el componente `<Topologia>` y coincide con la tabla de direccionamiento.
- Cada tarea dice **qué** lograr, no copia los comandos. Los comandos van en la solución.
- La verificación muestra la salida esperada de los `show` y explica qué mirar en ella.
- La solución está completa y se puede pegar en la consola.
- Hay un reto adicional que obliga a pensar, no solo a repetir.
- Probaste el laboratorio de punta a punta en la herramienta indicada.

## Vista previa local

```bash
npm install
npm run dev
```

Abre http://localhost:4321/CCNA_4Dummies/ en el navegador. Cada cambio en un `.mdx` se refleja al guardar.
