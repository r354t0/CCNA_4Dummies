# Plan del proyecto

## Objetivo

Una app web que prepare para el CCNA 200-301 desde lo básico hasta lo avanzado. Como el examen, se divide en una parte
**Teórica** (contenido y evaluaciones) y una **Práctica** (ejercicios con escenarios al azar y laboratorios en Packet
Tracer). Cubre las dos versiones del examen: v1.1 hasta el 2 de febrero de 2027 y v2.0 desde el 3 de febrero de 2027.

## Decisiones

- **Astro + MDX + React en GitHub Pages.** Sin servidor ni costo; el contenido es texto versionable.
- **La Teórica sigue el índice de Networking Academy** (ITN, SRWE, ENSA) con contenido propio. Nada de material de
  Cisco en el repositorio público.
- **La Práctica genera escenarios al azar** reproducibles con un código, para practicar sin repetir y para que el
  instructor vea el mismo ejercicio que el alumno.
- **Packet Tracer con corrección automática**: el alumno pega las salidas de sus equipos y la app corrige; el informe
  descargable permite que el instructor lo vuelva a corregir.
- **Progreso en el navegador** (localStorage), sin cuentas.

## Fases

1. **Base** (hecha): diseño, temas claro y oscuro, selector de versión, topologías, entrenador de subnetting.
2. **Reorganización en Teórica y Práctica** (hecha): ITN módulos 1 a 3 con pruebas, punto de control y simulacro;
   ejercicios interactivos, consola IOS, diagnóstico y Packet Tracer con corrección.
3. **Contenido por partes**, a medida que llega el material de cada parte del curso:
   - SRWE 1 a 4 (hecho): configuración básica, switching, VLAN y enrutamiento entre VLAN, con consola de SSH y VLAN,
     diagnósticos y tres laboratorios de Packet Tracer con corrección.
   - ITN 4 a 17 (capa física a red pequeña), con sus ejercicios.
   - SRWE 5 a 16 y ENSA.
   - Integrar `contenido-reserva/` en los módulos que corresponda.
4. **Más Práctica**: consola de router, plantillas de Packet Tracer para VLANs, enrutamiento, OSPF, ACL y NAT.
5. **Opcional**: cuentas y panel del instructor para seguir a un grupo.

## Pendiente del instructor

- Enviar la siguiente parte de cada curso (ITN 4 en adelante, SRWE 5 en adelante).
- Opcional: subir archivos `.pkt` de inicio para los ejercicios de Packet Tracer (ver `docs/CREAR-LABS.md`).
