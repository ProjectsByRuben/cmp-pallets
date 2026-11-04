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
Por petición expresa de Rubén del 30/10/2026, restaurar tras recarga mediante
sessionStorage de esta pestaña: token verificado, pantalla y borrador. Esta instrucción
sustituye la antigua regla de token sólo en memoria. Nunca guardar PIN/contraseña,
CSRF ni usar localStorage/URLs. Validar cuenta y perfil en Odoo antes de restaurar,
y registros antes de mostrarlos. No inferir cookies compartidas con el dominio Odoo.
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
Selección flexible y traslado múltiple activados ese día con addon 16.0.1.7.0,
reinicio de Odoo y nueva imagen web. Ver `docs/versiones.md` para referencias de imagen y rollback. Odoo necesita conservar `PROXY_MODE=true`.


Selección flexible: OFs, pallets, ubicación y consulta tienen estados independientes.
La asociación usa un único pallet de destino explícito si hay varios; el traslado
usa el grupo completo mediante `/cmp_pallets/move`. Conservar el orden libre de
lecturas, la separación de confirmaciones y las revisiones. «Ver» no selecciona.
Bloquear todos los cambios mientras una respuesta perdida esté pendiente y reintentar
la misma operación/identidad; nunca sustituirla por la acción de otro tipo.


Creation and printing: createPallet uses the private server journal and a stable UUID;
freeze its modal after any unknown outcome, allowing only the same request retry.
Never print an invented/preview identifier. Creation opens its real label, preserves
selected OFs and never associates implicitly. Reprint only from a readable active
pallet and use the authenticated label endpoint. QR payload is CMP:PALLET:<code>.
Printing targets one full portrait A4, two equal A5 faces with the upper rotated 180 degrees;
use browser printing/PDF and QR PNG download. No direct printer integration or claim
of physical print success. Do not expose generic Odoo report/RPC routes to get images.


Unlocated-pallet workflow: creation includes the protected active-location picker
but can remain empty/unlocated. A subsequent new pallet scan requires location
resolution before any other selections. Never add scanned OFs/pallets while waiting.
Already selected OFs plus location use one existing associate request atomically;
without OFs use one move request for that pallet only. Do not move unrelated selected
pallets. Preserve unknown-outcome retry freezing and allow cancellation before saving.
Location catalog is read-only, paginated and restricted to the current company.


Reload persistence: tabState stores only an explicit allowlist, never form secrets.
RecoverWorkspace re-reads pending records with current ACLs before rendering them.
Mutation IDs/payloads are saved synchronously before dispatch and restored as explicit
retries, never auto-submitted; creation drafts follow the same rule. Logout, operator
switch, invalid identity and account changes clear prior state. Reload never issues a
new operator token to extend its lifetime. PIN screen restores employee but no digits.

Creation and printing since 04/11/2026 supersede the commercial-label workflow:
allow empty pallets with optional location and creation with selected OFs (0–100).
A nonempty creation still requires location and saves everything atomically. Different
customers are allowed. Label data is only identity/QR, no commercial reads. Print two
copies of the same QR and code on one portrait A4, upper half rotated 180 degrees,
with a central fold guide. Wait for both images before enabling print. Contents and
location changes do not require reprinting or automatically open the label dialog.
Codes use P26-0001 (minimum four digits); longer numbers are never truncated.
Preserve stable UUID, revision, native ACL, company and recovery protections.

HTTPS backend since 03/11/2026: published Docker web targets
rubenfernandez.cmp3.es:443 with CMP_ODOO_HOST=rubenfernandez.cmp3.es and DB cmpslu.
This remains the local test Odoo, never the official odoo.cmp3.es. Validate browser
Origin before canonical backend Origin translation; preserve foreign-origin rejection,
CSRF, allowlist and verified TLS/SNI. deploy/test_https_proxy.py uses disposable Docker
TLS fixtures without Odoo credentials or business writes. up/rollback preserve only
public connection variables under ignored .deploy-state, together with the old image.

Runtime connection configuration supersedes compiled database and separate upstream/
TLS-host settings: compose now supplies CMP_APP_URL, CMP_ODOO_URL and CMP_ODOO_DB.
Only root HTTPS DNS/IPv4 URLs with optional port are supported by the container.
/runtime-config.js carries public values, no-store, before React. Never compile a
production database fallback or put credentials there. Reconfiguration recreates the
container without rebuilding; no change to the current Odoo unless explicitly asked.
Checkpoint identity is scoped to backend/database on reload. Preserve verified TLS,
canonical upstream headers and browser-origin allowlist. The addon now stores shared-account scopes in administrator-only res.users fields,
never a login/department-name mapping in Python.

Security audit 03/11/2026: send X-CMP-Environment from the initially loaded runtime
configuration on every API request, including session preparation. Nginx rejects
missing/stale fingerprints with 409 before upstream forwarding. This public fingerprint
is configuration coherence, never authentication. A stale tab must reload; never update
its fingerprint automatically or replay writes against a different environment.
Vite development must supply the same runtime fields. Preserve TLS mock rejection tests.


Optional information since 16.0.1.15.0: keep empty creation and mixed customers.
Print-preview checkbox defaults false; only an explicit checked request reads OF
root/customer/reference via include_info. No project guessing: x_root_mo is an OF.
Do not store optional text in tab checkpoints; retain only includeInfo and re-read
through protected label on restoration. Clearing the checkbox immediately disables
printing and clears prior text; ignore outdated responses. Native ACL denials for
optional info remain local, allowing blank printing without logging out. Do not
truncate overflowing text: fit within 19–8 pt and block if it still does not fit.
Code above, handwriting/info left, smaller QR lower right on both folded A5 faces.
