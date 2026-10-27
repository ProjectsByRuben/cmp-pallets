# CMP Pallets

Antes de actuar, leer `/home/rubenfernandez/CMP/GUIA_DE_TRABAJO_CMP.md`
y `/home/rubenfernandez/CMP/AGENTS.md`, además de estas instrucciones.

Demo independiente de OFs, pallets y ubicaciones. Datos ficticios en localStorage,
sin backend ni conexión Odoo. No añadir credenciales ni datos reales.

Antes de actuar: `git status --short`, `git branch --show-current` y
`git worktree list`. Trabajar en el worktree propio
`/home/rubenfernandez/CMP/worktrees/cmp-pallets/desarrollo`,
rama `dev/local`, o una rama de tarea autorizada. La base estable es `main`
en `/home/rubenfernandez/CMP/cmp-pallets`. No usar un worktree de Doodba como Git
de esta aplicación.

Validación: `node --test tests/*.test.mjs`. Servir `dist` sin build.
Conservar la identidad del proyecto Sites y la versión anterior documentada.
Hacer commit/push y despliegue sólo con autorización en la conversación.
GitHub y Sites son destinos distintos; un push no despliega.
