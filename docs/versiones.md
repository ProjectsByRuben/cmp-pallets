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


## Creación y etiquetas QR — 29/10/2026

Addon 16.0.1.9.0, fuente funcional cc8f537. «＋ Crear pallet» permite confirmar un
pallet vacío con ubicación escaneada opcional y abre su etiqueta. Conserva las OFs
seleccionadas para la asociación explícita posterior y protege el reintento de una
respuesta perdida con el diario privado existente. «Ver QR / Imprimir etiqueta» en
el detalle permite reimprimir la misma identidad. El QR tipado no incorpora contenido
ni ubicación variables. Descarga PNG y diálogo de impresión/PDF, sin servicios externos.

Rubén confirma A4 e impresora actual: etiqueta 100 × 60 mm para recortar, al 100 %
y sin encabezados/pies. La impresora dedicada y su papel se definirán más adelante.

Validación previa: 109 pruebas Odoo y 63 React + 33 de la demo correctas; build
correcto. Fixtures, secuencia real y filestore protegidos. QR leído con jsQR y PDF
verificado con Chromium/pypdf: una página A4, con código y sin interfaz ni controles.
No se ha probado la salida física de papel. El proxy sólo añade las rutas create/label
con las mismas protecciones de origen, método, sesión y cabeceras.


Activado en cmpslu y https://pallets.cmp3.es: addon instalado 16.0.1.9.0,
Nginx validado y contenedor saludable. Smoke test correcto, incluidas create/label
con sesión obligatoria; bundle HTTPS `/assets/index-idsKuTRj.js` idéntico al build.

- Imagen activa: `sha256:023ed54ad02f96345a268afaa4bc6dfa356b01785e578aa0482555e01641177f`.
- Imagen anterior: `sha256:85f6b024968d0d3d1f02b50bb7bb7a87c158504752073d7ea86f2cdf2368a37f`.
- Rollback web: `./deploy/rollback.sh`; no borra pallets ni cambia su código en Odoo.
- Sin bases/copias nuevas ni altas reales para verificar el incremento; pruebas con
  fixtures reversibles y secuencia privada.


## Consultar cualquiera de los registros seleccionados — 29/10/2026

Los códigos de los pallets/OFs seleccionados y la ubicación son botones para abrir
su detalle actualizado. «Viendo» identifica el detalle visible; «Ver» permite cambiar
la consulta y desplaza la página al detalle. «Quitar» continúa separado. No cambia
el grupo ni el destino explícito de la asociación y no escribe operaciones en Odoo.
Prueba de regresión con tres pallets, una OF y una ubicación: consulta cualquiera,
conserva destino y selección y confirma el traslado con el mismo grupo completo.

Validación: 64 pruebas React y 33 de la demo correctas, build y smoke test correctos.
Activado en https://pallets.cmp3.es, contenedor saludable; bundle `/assets/index-DMzN7eep.js`
idéntico al build validado. Imagen activa: `sha256:2cdb250de530a4361780d0f965091714f053b107845614902cae28ba7835a580`.
La imagen anterior conserva creación/etiquetas; este incremento sólo cambia la web.


## Limpiar detalle al vaciar la selección — 29/10/2026

Quitar el último elemento seleccionado (pallet, OF o ubicación) vuelve al estado
inicial: cierra el detalle anterior y limpia el historial de consultas. Las pruebas
cubren los tres tipos como último elemento y permiten volver a escanear de inmediato.

Validado: 67 pruebas React y 33 de la demo, build y smoke test correctos. Activado
en HTTPS con bundle `/assets/index-_F_wTgHc.js`, idéntico al build.


## Ubicación existente al crear y resolución obligatoria al escanear — 30/10/2026

Addon 16.0.1.10.0 (8b79716). El selector permite buscar por código/nombre, paginar y
escanear una ubicación existente al crear; la ubicación ya seleccionada se propone.
Crear vacío sin ubicación sigue permitido, con impresión de etiqueta primero.

Al escanear después un pallet sin ubicar se abre una petición obligatoria de ubicación.
Otras lecturas no se añaden y no se puede cambiar la selección hasta confirmar o
cancelar. Las OFs ya seleccionadas y la ubicación se guardan con una sola asociación
atómica. Sin OFs, se asigna ubicación únicamente a ese pallet, sin mover el resto.
El destino leído antes se propone, pero siempre exige confirmación. Un resultado
incierto congela ubicación y grupo para reintentar la misma identidad de petición.

Validación: 111 pruebas Odoo y 74 React + 33 demo correctas, build correcto. Catálogo
protegido por sesión, perfil, CSRF, compañía y reglas nativas; sólo lectura y 20
resultados por página. Se conserva rollback/GC desactivada y numeración real intacta.
Pruebas de selección bloqueada, OFs múltiples con ubicación, reintento idéntico,
cancelación, ubicación al crear y creación sin ubicación seguida de escaneo obligatorio.

Activado en cmpslu y https://pallets.cmp3.es, addon 16.0.1.10.0 instalado,
contenedor saludable y smoke test correcto, incluida locations con sesión obligatoria.
Bundle HTTPS `/assets/index-Dsv9_4-2.js` idéntico al build validado.
Imagen activa: `sha256:4921d7ba4c89100bc0162d90e1b9624e940a175c584f9092f731cfd74948f41e`.


## Lector activo al abrir Crear pallet — 30/10/2026

El campo de ubicación recibe el foco al abrir la creación; el botón de confirmar
ya no le roba el foco. Usa el mismo control de foco que el lector principal y muestra
su indicador de disponibilidad. Enter y Tab aceptan el QR de ubicación sin crear
el pallet automáticamente. La carga del catálogo no descarta una lectura. Durante
un alta pendiente o un resultado incierto sigue bloqueado. Validación: 76 pruebas
React y 33 de la demo correctas; build correcto.

Activado en HTTPS: `/assets/index-DyZ4jYtL.js` coincide con el build; contenedor saludable
y smoke test correcto.


## Corregir lecturas del selector de ubicación — 30/10/2026

El campo consume y limpia cada lectura de inmediato, también ante códigos desconocidos,
OFs, pallets o ubicaciones archivadas. Sólo acepta una ubicación activa, reemplazando
la anterior si se lee otra válida. «Quitar ubicación» permite dejarla sin seleccionar
y devuelve el foco al lector. Las respuestas antiguas de consultas superadas no
sobrescriben una lectura posterior. Catálogo y validación del QR tienen generaciones
independientes, para que limpiar/buscar no anule el resultado del escaneo.
Validación: 82 pruebas React y 33 de la demo correctas; build correcto. Incluye
lecturas erróneas seguidas de correctas, sustitución, retirada y respuestas fuera de orden.

Activado en HTTPS, bundle `/assets/index-yonhv_YP.js` verificado contra el build,
contenedor saludable y smoke test correcto.


## Cambiar cuenta sin error de respuesta — 30/10/2026

Odoo 16 /web/session/destroy devuelve None y su despachador JSON omite result.
El adaptador trataba el cierre correcto como respuesta inválida y no alcanzaba el
formulario de acceso ni limpiaba su preparación/CSRF. Se acepta únicamente el sobre
void esperado de ese endpoint (jsonrpc=2.0, id=1, sin error); las otras rutas siguen
exigiendo result. Una sesión ya caducada también permite volver al acceso; errores
reales de red o respuestas malformadas se siguen mostrando. Tras cierre confirmado
se limpian CSRF y preparación de sesión para la siguiente cuenta.

Validación: 86 pruebas React y 33 de la demo correctas; build correcto. Incluye
cambio de cuenta con el adaptador real, respuesta void nativa, segundo acceso sin
recarga, renovación de CSRF, sesión caducada y rechazo de respuestas inválidas.

Activado en HTTPS con bundle `/assets/index-BvY8EKst.js` idéntico al build validado,
contenedor saludable y smoke test correcto.
