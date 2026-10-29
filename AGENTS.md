# CMP Pallets

Antes de actuar, leer `/home/rubenfernandez/CMP/GUIA_DE_TRABAJO_CMP.md`
y `/home/rubenfernandez/CMP/AGENTS.md`, además de estas instrucciones.

Proyecto independiente con dos entradas. `dist/` conserva la demo de OFs, pallets
y ubicaciones con datos ficticios en localStorage, sin conexión Odoo. `src/` contiene
el acceso y consulta React/TypeScript conectados al addon de pruebas mediante rutas limitadas
en el mismo origen. No añadir credenciales, sesiones, tokens ni datos reales a Git.
No mezclar las operaciones simuladas de la demo con la sesión real. La siguiente
integración de operaciones de modificación debe usar los controles de identidad/permiso
del servidor. Escanear consulta y prepara selección temporal: nunca añade escrituras implícitas.
La asociación explícita usa `/cmp_pallets/associate`, sólo tras confirmación, con
revisiones e identidad de petición. Conservar el mismo contenido/identidad al
reintentar una respuesta perdida y bloquear cambios mientras se desconoce el resultado.

Antes de actuar: `git status --short`, `git branch --show-current` y
`git worktree list`. Trabajar en `/home/rubenfernandez/CMP/cmp-pallets`, rama
`main`. Es el repositorio original y la única carpeta de trabajo de la web.
Rubén autorizó trabajar directamente en main y publicar cambios definitivos en su
fork, sin crear ramas de desarrollo ni PR para Pallets. Revisar diffs y pruebas.
Abrir `CMP-Pallets.code-workspace` para web y addon juntos, o
`CMP-Pallets-Web.code-workspace` para editar sólo React. Las tareas nunca se ejecutan
al abrir el workspace: se lanzan expresamente desde el editor.
Los planes futuros no aprobados se conservan fuera de Git en
`/home/rubenfernandez/CMP/datos-locales/cmp-pallets/planificacion/`. No usar un worktree de Doodba como Git
de esta aplicación.

Validación: `npm test` y `npm run build` para React y regresión de la demo.
`node --test tests/*.test.mjs` sigue validando la demo sin instalar dependencias.
React compila en `build/`, nunca sobre `dist/`. Servir la demo `dist` sin build.
`npm run dev` abre React en 127.0.0.1:4184 con proxy local al Odoo de pruebas.
No modificar PIN, roles o usuarios reales para probar: usar mocks en React y el
runner de fixtures reversibles del addon para sus comprobaciones autenticadas.
Mantener el token del operario sólo en memoria por pestaña; no guardarlo en
localStorage/sessionStorage ni inferir que la cookie del dominio Odoo se comparte.
Conservar la identidad del proyecto Sites y la versión anterior documentada.
Hacer commit/push y despliegue sólo con autorización en la conversación.
GitHub y Sites son destinos distintos; un push no despliega.

Servicio compilado preparado el 29/10/2026: proyecto Docker **cmp-pallets**, archivo
`compose.yaml`, puerto LAN 4180 en 192.168.1.50. `deploy/up.sh` actualiza sólo ese
proyecto y guarda la referencia de imagen anterior; `deploy/rollback.sh` la restaura.
No ejecutar Compose de Doodba para gestionar Pallets. El runtime no monta `src/`;
requiere nueva compilación para adoptar cambios. `deploy/check_service.py` comprueba
la entrada sin credenciales ni escrituras de negocio.
DNS y HTTPS de `pallets.cmp3.es` están operativos y se verificaron el 29/10/2026.
Asociación explícita activada ese día con addon 16.0.1.6.0, reinicio de Odoo y nueva
imagen web. Ver `docs/versiones.md` para referencias de imagen y rollback. Odoo necesita conservar `PROXY_MODE=true`.


Selección flexible: OFs, pallets, ubicación y consulta tienen estados independientes.
La asociación usa un único pallet de destino explícito si hay varios; el traslado
usa el grupo completo mediante `/cmp_pallets/move`. Conservar el orden libre de
lecturas, la separación de confirmaciones y las revisiones. «Ver» no selecciona.
Bloquear todos los cambios mientras una respuesta perdida esté pendiente y reintentar
la misma operación/identidad; nunca sustituirla por la acción de otro tipo.
