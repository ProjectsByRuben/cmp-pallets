# Organización actual de CMP Pallets

Actualizada el 29/10/2026 por encargo de Rubén. Web y addon tienen Git independiente
con main como rama de trabajo. Los repositorios originales se mantienen en su sitio;
no se mueven sus .git ni se crean clones. Los worktrees antiguos de Pallets se retiran.

## Dónde trabajar

- Web: `/home/rubenfernandez/CMP/cmp-pallets`.
- Addon: `/home/rubenfernandez/CMP/doodba-cmp/odoo/custom/src/odoo-cmp-custom/cmp_mrp_packages`.
- Infraestructura Odoo: `/home/rubenfernandez/CMP/doodba-cmp`.
- Planes locales: `/home/rubenfernandez/CMP/datos-locales/cmp-pallets/planificacion/`.

## Qué abrir en el editor

Abrir `CMP-Pallets.code-workspace` en la raíz de la web para trabajar en los dos
componentes y el plan local fuera de Git. `CMP-Pallets-Web.code-workspace` abre sólo React. El workspace del addon
está en `odoo-cmp-custom/CMP-Pallets-Backend.code-workspace` y abre sólo el módulo,
para evitar editar accidentalmente otros módulos con fuentes de integración distintas.
También hay accesos locales en `/home/rubenfernandez/CMP/workspaces/`:
`CMP-Pallets`, `CMP-Pallets-Web` y `CMP-Pallets-Odoo` (todos .code-workspace).
El acceso anterior en la raíz Doodba se actualiza a las mismas carpetas, por compatibilidad.

Abrir un workspace no arranca ni actualiza servicios. En Terminal > Ejecutar tarea
están desarrollo, pruebas, build, comprobación/estado web y pruebas Odoo con rollback.
La tarea de desplegar web se lanza expresamente; no usarla sólo para revisar código.
Cada Git se guarda por separado. No crear ramas de desarrollo para Pallets.

## Operación

Desde la raíz web: `npm test`, `npm run build`, `npm run dev` (127.0.0.1:4184),
`python3 deploy/check_service.py` y `./deploy/up.sh` para desplegar cuando esté autorizado.
El proyecto Docker es cmp-pallets y usa el compose.yaml del repositorio original.
La web compilada corre en cmp-pallets-web-1 y no monta src. El proxy de entrada
sirve https://pallets.cmp3.es con las mismas restricciones de origen y autenticación.

Desde la raíz Doodba: `docker compose exec -T odoo python3
/opt/odoo/auto/addons/cmp_mrp_packages/tests/run_cmpslu.py --browser`.
El hook 58 restablece el enlace a custom/src/odoo-cmp-custom/cmp_mrp_packages.
Los demás módulos mantienen integracion/local y los worktrees de PR.
No actualizar la base ni copiar datos/filestore para reorganizar fuentes.

Los documentos de diseño y versiones conservan las rutas históricas como contexto;
esta guía y AGENTS.md describen las ubicaciones vigentes.

## Conexión por dominio HTTPS (03/11/2026)

Por petición de Rubén, el contenedor compilado usa rubenfernandez.cmp3.es:443 y la
base cmpslu. Sigue siendo el Odoo local restaurado; no apunta a odoo.cmp3.es ni a la
instancia oficial. compose.yaml define CMP_ODOO_UPSTREAM (servidor:puerto),
CMP_ODOO_HOST (nombre TLS/Host canónico) y CMP_ODOO_DB (también en build.args).
Nginx utiliza HTTPS, SNI y verificación de certificado y nombre con la CA del sistema.

La web sigue en https://pallets.cmp3.es y valida el Origin del navegador contra ese
origen antes de reenviar. Después traduce Host, X-Forwarded-Host y el Origin no vacío
al origen canónico HTTPS de Odoo. Un Origin ausente permanece ausente. Esto permite
pasar por el proxy del dominio sin eliminar las comprobaciones del addon ni abrir
CORS. Mantiene X-Forwarded-Proto: https, cookies Secure/HttpOnly/SameSite y las rutas
limitadas. La preparación de base reescribe las redirecciones de login hacia la ruta
local de preparación de sesión.

El proxy Vite de desarrollo mantiene su conexión local por defecto; esta actualización
cambia el servicio Docker publicado. No es necesario cambiar src/api.ts para elegir
el servidor del servicio publicado.

Pruebas de proxy aisladas: construir la imagen y ejecutar
`python3 deploy/test_https_proxy.py`. Utiliza la imagen Odoo local sólo como intérprete
Python de un servidor TLS sintético, sin arrancar Odoo ni acceder a su base. Prueba
SNI/Host, traducción de Origin, bloqueo de Origin ajeno, rutas, cookies y rechazo de
certificados no confiables o con nombre incorrecto. Elimina sus contenedores/red y
claves sintéticas al terminar. Puede seleccionarse otra imagen de intérprete mediante
CMP_PROXY_TEST_BACKEND_IMAGE.

up.sh preserva la imagen y únicamente las variables públicas de conexión del
contenedor anterior en .deploy-state/previous-runtime.yaml (ignorado por Git).
rollback.sh combina esa configuración con la imagen anterior; así el retorno a una
imagen que usaba HTTP local no conserva por error el nuevo destino HTTPS. No se
exportan contraseñas, PIN, cookies, sesiones ni archivos runtime de Odoo.
