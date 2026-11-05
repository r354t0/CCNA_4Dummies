# Plan del proyecto

## Objetivo

Una app web que lleve a un estudiante del nivel básico al avanzado del CCNA 200-301 combinando teoría, laboratorios
en Packet Tracer y GNS3, y práctica de examen. El contenido cubre las dos versiones del examen (v1.1 hasta el
2 de febrero de 2027, v2.0 desde el 3 de febrero de 2027) y está pensado para seguir vigente después del cambio.

## Decisiones

- **Astro + MDX en GitHub Pages.** El contenido es texto versionable y editable sin programar; la interactividad
  (quiz, entrenador) va en componentes React. Sin servidor ni costo.
- **Cada tema se etiqueta con su dominio en cada versión** del examen. El selector de versión oculta o atenúa lo que
  no corresponde.
- **Packet Tracer para los niveles 1 a 4; GNS3 cuando hace falta IOS real** (automatización con Ansible). No se
  distribuyen imágenes de IOS.
- **Progreso en el navegador** (localStorage). Las cuentas quedan para una fase posterior.

## Fases

1. **Base y MVP** (hecha): estructura, diseño, selector de versión, entrenador de subnetting, nivel 1 completo con
   6 lecciones y 4 laboratorios.
2. **Contenido**: niveles 2 a 5 con sus laboratorios. Pendientes del nivel 1: virtualización y nube, y principios de
   wireless.
3. **Diferenciadores**: verificador de salidas `show` (el alumno pega su salida y la app la revisa), simulacro de
   examen ponderado por dominio según la versión elegida, laboratorio integrador final.
4. **Opcional**: cuentas de usuario y panel del instructor para seguir el avance de un grupo.

## Pendiente del instructor

- Construir y subir los archivos `.pkt` de los laboratorios del nivel 1 (ver `docs/CREAR-LABS.md`).
- Activar GitHub Pages con origen GitHub Actions.
