# CCNA 4Dummies

App web para repasar el **CCNA 200-301**, desde los fundamentos hasta automatización, combinando teoría breve con
laboratorios en **Packet Tracer** y **GNS3**.

**Sitio:** https://r354t0.github.io/CCNA_4Dummies/

## Qué incluye

- **Ruta de estudio en cinco niveles**, cada uno identificado con un color de cable UTP.
- **Lecciones** con la teoría justa, comandos de IOS y notas «Para el examen».
- **Laboratorios** con topología, tabla de direccionamiento, tareas, salidas `show` esperadas, solución y reto
  adicional. Los de troubleshooting esconden fallas reales que hay que encontrar.
- **Quiz** al final de cada lección, con la explicación de cada respuesta.
- **Entrenador de subnetting** con ejercicios ilimitados de subredes, máscaras y VLSM.
- **Ambas versiones del examen**: el selector v1.1 / v2.0 marca qué temas entran en cada una. La v1.1 se puede rendir
  hasta el 2 de febrero de 2027 y la v2.0 desde el 3 de febrero de 2027.
- **Progreso** guardado en el navegador del alumno, sin cuentas.

## Estado

| Nivel | Tema | Estado |
|---|---|---|
| 1 | Fundamentos de red | 6 lecciones y 4 laboratorios |
| 2 | Switching y acceso | 7 lecciones y 5 laboratorios |
| 3 | Enrutamiento IP | En preparación |
| 4 | Servicios y seguridad | En preparación |
| 5 | Automatización, IA y operación | En preparación |

Los archivos `.pkt` de los laboratorios se agregan a medida que se construyen. Ver
[docs/CREAR-LABS.md](docs/CREAR-LABS.md).

## Desarrollo

Requiere Node.js 22 o superior.

```bash
npm install
npm run dev      # vista previa en http://localhost:4321/CCNA_4Dummies/
npm run build    # genera el sitio estático en dist/
```

Estructura:

```
src/content/lecciones/nivel-N/   lecciones en MDX
src/content/labs/                laboratorios en MDX
src/data/blueprints.ts           dominios y pesos del examen v1.1 y v2.0
src/data/niveles.ts              niveles de la ruta y temario previsto
src/components/                  topología, quiz, entrenador de subnetting
public/labs/<id>/                archivos .pkt / .pka / .gns3project
docs/                            guía para crear labs, plantilla y plan del proyecto
```

## Publicación

Cada push a `main` publica el sitio con GitHub Actions. La primera vez hay que activarlo en
**Settings > Pages > Build and deployment > Source: GitHub Actions**.

## Aviso

CCNA y Cisco son marcas de Cisco Systems, Inc. Este proyecto no está afiliado a Cisco. No se distribuyen imágenes de
Cisco IOS: los laboratorios de GNS3 requieren imágenes propias con licencia.
