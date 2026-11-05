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
sirve https://rubenpallets.cmp3.es con las mismas restricciones de origen y autenticación.

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

La web sigue en https://rubenpallets.cmp3.es y valida el Origin del navegador contra ese
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

Si Docker ha retirado la imagen del contenedor aún en ejecución, up.sh se detiene
antes de reemplazarlo. Sólo se acepta CMP_PREVIOUS_IMAGE como recuperación explícita
con una imagen de la versión anterior reconstruida y verificada; no se omite la
reserva de recuperación. No utilizar una imagen de otra base o versión desconocida.

## Conexión configurable sólo desde compose (03/11/2026, revisión posterior)

Esta revisión sustituye CMP_ODOO_UPSTREAM/CMP_ODOO_HOST y la base compilada por:

```yaml
environment:
  CMP_APP_URL: https://rubenpallets.cmp3.es
  CMP_ODOO_URL: https://rubenfernandez.cmp3.es
  CMP_ODOO_DB: cmpslu
```

CMP_ODOO_URL admite una URL HTTPS raíz de DNS/IPv4, con puerto opcional y sin
credenciales, rutas, consultas ni fragmentos. El arranque deriva destino, puerto,
SNI, Host y Origin canónico. CMP_APP_URL configura el origen público permitido de la
web (y puerto si lo tiene); ya no hay que editar Nginx para otro dominio de la web.
La conexión actual sigue siendo rubenfernandez.cmp3.es y cmpslu. No se ha conectado
con el Odoo oficial. El Odoo destino necesita addon compatible instalado y usuarios,
compañías y operarios configurados; cambiar compose no instala módulos ni crea bases.

El contenedor genera /runtime-config.js con los únicos datos públicos de conexión,
lo sirve con no-store y lo carga antes de React. La misma imagen sirve para otras
bases y dominios. No hay base de datos fija en el JavaScript ni ARG de base en Docker.
Falta de configuración bloquea el acceso antes de enviar credenciales. Al recargar,
un cambio de Odoo/base descarta identidad y selección de la pestaña anterior; recargar
sin cambiar entorno conserva el trabajo y su validación habitual.

Después de instalar esta versión una vez, editar los valores y ejecutar desde la web:

```sh
docker compose -f compose.yaml -p cmp-pallets config --quiet
docker compose -f compose.yaml -p cmp-pallets run --rm --no-deps web --check
docker compose -f compose.yaml -p cmp-pallets up -d --force-recreate --no-build --wait
python3 deploy/check_service.py
```

No basta docker compose restart: debe recrearse para aplicar el entorno. Cambiar
configuración no requiere npm run build ni editar src/api.ts. Recargar las pestañas
tras el cambio. No ejecutar operaciones en la instancia oficial sin el despliegue
expresamente acordado. El rollback conserva variables antiguas y nuevas; la revisión
anterior con base compilada utiliza la comprobación --legacy-config únicamente al
recuperar esa imagen anterior.

Vite genera la misma configuración pública para desarrollo. Acepta CMP_ODOO_URL (o
CMP_ODOO_TARGET heredado), CMP_ODOO_DB y CMP_APP_URL al arrancar npm run dev; su destino
por defecto sigue siendo HTTP local en 127.0.0.1:16069. Con un destino HTTPS usa
verificación TLS y cabeceras canónicas. Ese servidor de desarrollo no es el servicio
Docker publicado.

La selección de empleados de cuentas compartidas del addon aún usa la política
SHARED_DEPARTMENTS en Python. Esta revisión parametriza la conexión de la web y no
modifica esa política de autorización ni los permisos nativos de Odoo.


## Separación de dominios, 05/11/2026

El Compose de este repositorio corresponde al PC y cmpslu: su URL es
https://rubenpallets.cmp3.es. La web desplegada en 192.168.1.239 utiliza
https://pallets.cmp3.es y conserva su configuración local para odoo.cmp3.es/cmp_gim.
No sustituir el Compose del servidor por el de pruebas durante una actualización.
La instalación del addon en el Odoo oficial 192.168.1.252 la gestiona su responsable.
