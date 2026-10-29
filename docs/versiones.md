# Versiones de la demo CMP Pallets

## Inicio de React — 29 de octubre de 2026

La pantalla React de acceso se desarrolla en `src/`, con salida de compilación
`build/`. La demo existente permanece íntegra en `dist/`, sin cambios de fuentes ni
de almacenamiento. Su base completa está guardada en el commit
`2519722` del repositorio, anterior a este hito. Puede consultarse ese commit sin
restaurarlo sobre trabajo nuevo. La publicación de Sites continúa en su versión
anterior: no se ha desplegado React ni conectado Sites a Odoo.

Para seguir usando la demo local, servir `dist/` o ejecutar `npm run demo`.
Para el acceso React de pruebas, ejecutar `npm run dev` y abrir 127.0.0.1:4184.

## Versión 4 — antes del ajuste visual

Guardada a petición de Rubén el 26 de octubre de 2026. Incluye lector Bluetooth HID, cámara, asociación de varias OFs, traslado de uno o varios pallets, retirada de selecciones, Volver e Inicio y estilo CMP.

- Commit fuente: `c1de498578473dc2a2469dddb61465e381d13838`.
- Proyecto Sites: `appgprj_6adf193f8eec8191824f5f62c24d1307`.
- Versión Sites guardada: `appgprj_6adf193f8eec8191824f5f62c24d1307~appgver_66e6f0d9f21881918f36515557a96c3c` (número 4, archivo y fuente conservados).
- Archivo de despliegue local original: `/tmp/cmp-pallets-multiple-deploy.tar.gz` (temporal; la recuperación no depende de él).
- SHA-256 de la copia: `2721f9e53c927a8ca53e29b081c43b936765a85d40ce18d55544ce156b93a9d4`.
- Copia de código independiente: `/home/rubenfernandez/CMP/recovery/cmp-pallets-versiones/pallets-v4-20261026-c1de498.tar.gz`, fuera del repositorio. Incluye fuentes, assets, pruebas y manifiesto; excluye `.git`, credenciales y datos del navegador.

Para volver exactamente a la versión publicada, desplegar la versión Sites guardada indicada arriba en este mismo proyecto, manteniendo su audiencia pública. No es necesario recrear el sitio ni restablecer datos locales. Alternativamente se puede abrir la copia fuente en otra carpeta o recuperar ese commit en el repositorio de la demo. No ejecutar restauraciones destructivas sobre cambios posteriores sin revisarlos.

Los datos de prueba de cada navegador se conservan fuera de estas versiones en localStorage y son compatibles con ambas interfaces.


## Asociación real OF → pallet preparada — 29/10/2026

Implementación en los worktrees de desarrollo, sin nuevo commit ni despliegue.
React selecciona OFs, prepara pallet/ubicación y pide confirmación. El addon
`cmp_mrp_packages` 16.0.1.6.0 aplica permisos, revisiones e idempotencia y guarda
relación e historial juntos. Validación: 88 pruebas Odoo/HTTP/Chromium, 42 React,
33 de demo, build y sintaxis Nginx correctos. Fixtures revertidos y GC desactivada.
Falta actualizar sólo ese addon en cmpslu, reiniciar Odoo y reconstruir el proyecto
Docker `cmp-pallets`, con autorización de despliegue. Ver `asociacion-of-pallet-plan.md`.


## Asociación activada — 29/10/2026

Rubén autorizó actualizar el addon y el contenedor web en la conversación.
Actualizado únicamente `cmp_mrp_packages` a 16.0.1.6.0 en cmpslu, sin operaciones
pendientes de otros módulos; Odoo reiniciado y enlace del addon conservado.
`./deploy/up.sh` completó build, validación Nginx y comprobación del servicio.
Contenedor `cmp-pallets-web-1` saludable. HTTPS y certificado correctos en
https://pallets.cmp3.es; el bundle `/assets/index-CQWLHx3b.js` coincide con el build
validado y la ruta de asociación exige autenticación.

- Imagen activa: `sha256:71cae52277c1d2886ea3e3267d3fb637cc77b88f143afa25245725096d8fd82a`.
- Imagen anterior conservada: `cmp-pallets-web:previous`,
  `sha256:6fe1f75e5120d1ebf99bab588df68209a99f0187cb1a04a87b3a7cd0fa2f2918`.
- Reversión web: `./deploy/rollback.sh`. Conserva los datos e historial en Odoo.
- Sin commits ni push; sin bases nuevas ni copias de base/filestore.

Validación posterior al despliegue: 88 pruebas Odoo/HTTP/Chromium correctas,
0 errores, 0 fallos y 0 omitidas; recuentos de fixtures sin cambios y GC de filestore
desactivada. La comprobación incluye el esquema instalado del registro de peticiones.


## Selección flexible y traslado múltiple preparados — 29/10/2026

Incremento con addon 16.0.1.7.0: lecturas de OF/pallet y ubicación/pallet en ambos
órdenes, acumulación y retirada de pallets, elección de un único destino para las
OFs y confirmación de traslado del grupo. Se conservan asociaciones e historial;
no hay movimientos de inventario ni cantidades por pallet. La nueva ruta POST move
está limitada por el mismo proxy y controles de identidad. La activación del servicio
publicado está pendiente de autorización para este incremento.


## Selección flexible y traslado múltiple activados — 29/10/2026

Rubén autorizó actualizar addon y contenedor web. Addon cmp_mrp_packages 16.0.1.7.0
instalado en cmpslu y Odoo reiniciado con el enlace original de custom/src conservado.
Deploy independiente cmp-pallets completado, Nginx y smoke test correctos, contenedor
saludable. Certificado HTTPS y bundle `/assets/index-CYO-Xp2o.js` comprobados en
https://pallets.cmp3.es; coincide con el build validado. Las rutas lookup, associate
y move exigen sesión. Sin nuevas bases ni copias de datos/filestore.

- Imagen activa: `sha256:e29a968ea2b0d9318c93d38332df1c2528a2d71970d33363d2c40486f879e801`.
- Imagen anterior: `cmp-pallets-web:previous`, `sha256:71cae52277c1d2886ea3e3267d3fb637cc77b88f143afa25245725096d8fd82a`.
- Rollback web: `./deploy/rollback.sh`; conserva las operaciones ya guardadas en Odoo.
- Fuente funcional web: d8639f5; addon: 550b5f8. Las actualizaciones documentales
  posteriores no cambian la compilación desplegada.

Validación posterior al despliegue: 4 pruebas HTTP/Chromium correctas, sin errores,
fallos ni saltos; fixtures sin cambios y GC de filestore desactivada.


## Formato de pallets P26-00001 — 29/10/2026

Cambio solicitado por Rubén antes de probar: dos cifras de año, guion y contador
anual con cinco dígitos mínimos. Autorizada la conversión de los tres identificadores
anteriores y sustitución de sus QR. Addon 16.0.1.8.0 con migración auditada y pruebas
que no consumen numeración real. React reconoce el código nuevo también sin Enter.

Aplicado en cmpslu y publicado en https://pallets.cmp3.es. Los tres registros
existentes se conservan con P26-00001, P26-00002 y P26-00003, auditando cada cambio;
la vista previa nativa del siguiente código es P26-00004. Sustituir los QR anteriores.

Validación: 102 pruebas Odoo y 57 React + 33 de la demo correctas; build correcto.
Secuencia real y fixtures sin cambios por las pruebas; GC del filestore desactivada.
Smoke test del servicio correcto, contenedor saludable y bundle HTTPS
`/assets/index-CRjtBe59.js` idéntico al build validado.

- Imagen activa: `sha256:85f6b024968d0d3d1f02b50bb7bb7a87c158504752073d7ea86f2cdf2368a37f`.
- Imagen anterior web: `sha256:e29a968ea2b0d9318c93d38332df1c2528a2d71970d33363d2c40486f879e801`.
- Addon funcional: a62146d, versión 16.0.1.8.0.
- El rollback web no revierte los códigos ni los eventos auditados en Odoo.
