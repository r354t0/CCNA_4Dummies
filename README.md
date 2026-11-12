# CCNA 4Dummies

App web para preparar el **CCNA 200-301**, desde los fundamentos hasta lo avanzado. Igual que el examen, tiene dos
partes: **Teórica** y **Práctica**.

**Sitio:** https://r354t0.github.io/CCNA_4Dummies/

## Teórica

Sigue el índice de los cursos de Cisco Networking Academy (ITN, SRWE y ENSA), con explicaciones, diagramas y
preguntas propios:

- **Temas** con esquemas, animaciones (encapsulamiento, modelos OSI y TCP/IP, modos de IOS), tarjetas de repaso y
  avisos «Para el examen».
- **Verifique su comprensión** al final de cada tema.
- **Prueba del módulo** (15 preguntas al azar) y **examen de punto de control** por bloque de módulos, con
  cronómetro, navegación entre preguntas, resultado por objetivo y revisión de cada respuesta.
- **Simulacro de examen**: eliges módulos, cantidad de preguntas y cronómetro.
- Barra lateral con el esquema del curso, buscador y progreso por tema.

## Práctica

Desde cada módulo de la Teórica hay un botón **Práctica del módulo**, y cada ejercicio de la Práctica lleva de vuelta a
la teoría de su módulo.

Cada ejercicio genera un escenario al azar con un código (por ejemplo `K7Q2-M4XA`). El mismo código reproduce el
mismo escenario, así que alumno e instructor pueden ver exactamente el mismo ejercicio.

| Tipo | Ejercicios |
|---|---|
| Interactivo | Clasificar componentes y tipos de red, leer topologías, encapsular, capas OSI/TCP-IP, direcciones salto a salto, tabla MAC, dominios de colisión y difusión, difusiones con VLAN, DTP, subnetting |
| Consola IOS | Switch Catalyst 2960 simulado en el navegador: modos, abreviaturas, `?`, Tab, contraseñas, banner, SVI, SSH, VLAN, troncales, velocidad y dúplex, guardado |
| Diagnóstico | Una red con una falla al azar (conectividad básica, errores de interfaz, enrutamiento entre VLAN): el alumno lee las salidas de los comandos y encuentra la causa |
| Packet Tracer | Switch inicial, dos switches, router en doble pila con SSH, VLAN con troncal y router-on-a-stick. El alumno pega las salidas (`show startup-config`, `show vlan brief`, `show interfaces trunk`, `show ip ssh`, `ipconfig`, `ping`) y la app corrige cada requisito |

### Ejercicios de Packet Tracer: entrega y revisión

1. El alumno abre el ejercicio y recibe un escenario con su código, topología, tabla de direccionamiento y valores.
2. Lo implementa en Packet Tracer.
3. Pega (o sube como `.txt`) las salidas que se piden. La app las lee, descifra las contraseñas tipo 7, comprueba el
   hash del `enable secret` y marca cada requisito.
4. Descarga el **informe** (`.txt`) y se lo envía al instructor.
5. El instructor abre el mismo ejercicio, usa **Revisar un informe** y la app vuelve a corregir las salidas originales
   (y avisa si el encabezado del informe fue editado). Con el código ve también la solución.

No es un sistema antitrampas: un alumno con experiencia podría escribir las salidas a mano. Para una evaluación
formal, pide además el archivo `.pkt`.

## Versiones del examen

El selector v1.1 / v2.0 marca qué temas entran en cada versión. La v1.1 se puede rendir hasta el 2 de febrero de 2027
y la v2.0 desde el 3 de febrero de 2027.

## Estado

| Curso | Módulos con contenido |
|---|---|
| ITN · Introducción a las redes | 1 a 3, con pruebas y el examen de punto de control 1–3 |
| SRWE · Switching, enrutamiento y redes inalámbricas | 1 a 4, con pruebas y el examen de punto de control 1–4 |
| ENSA · Redes empresariales, seguridad y automatización | En preparación |

Las lecciones y laboratorios escritos antes de la reorganización están en `contenido-reserva/` y se integrarán en su
módulo.

## Material de Cisco

El repositorio es público. **No se suben** textos, capturas, preguntas ni archivos `.pka`/`.pdf` de Networking Academy:
el contenido sigue su índice, pero las explicaciones, diagramas y preguntas son propios. Las actividades de NetAcad se
mencionan por su número (por ejemplo, «2.9.1 Packet Tracer») con una guía propia.

## Desarrollo

Requiere Node.js 22 o superior.

```bash
npm install
npm run dev      # vista previa en http://localhost:4321/CCNA_4Dummies/
npm run build    # genera el sitio estático en dist/
```

```
src/content/teoria/<curso>/mNN/   temas en MDX (uno por archivo)
src/content/preguntas/            bancos de preguntas por módulo (YAML)
src/data/cursos.ts                cursos, módulos y puntos de control
src/data/practica.ts              catálogo de ejercicios de Práctica
src/components/teoria/            evaluación (verifique, pruebas, simulacro) y recursos didácticos
src/components/practica/          ejercicios de Práctica
src/lib/ios/                      consola IOS simulada, cifrado tipo 7, MD5-crypt y lector de configuraciones
src/lib/pt/                       escenarios y corrección de los ejercicios de Packet Tracer
public/labs/<id>/                 archivos .pkt de inicio (opcionales)
contenido-reserva/                material anterior a la reorganización
docs/                             guías para agregar contenido y plan del proyecto
```

Cada push a `main` publica el sitio con GitHub Actions.

## Aviso

CCNA, Cisco, Packet Tracer y Networking Academy son marcas de Cisco Systems, Inc. Este proyecto no está afiliado a
Cisco. El progreso del alumno se guarda solo en su navegador.
