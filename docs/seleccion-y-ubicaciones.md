# Selección y ubicación de pallets

Implementación del incremento 29/10/2026. La decisión de Rubén es asociar las OFs a
un único pallet elegido, aunque se hayan leído varios. Los cambios de ubicación
sí actúan sobre todo el grupo de pallets seleccionado.

## Uso

Leer OFs y pallet en cualquier orden prepara la asociación. Se pueden añadir más
OFs después del pallet. Con varios pallets, elegir uno en «Pallet de destino para
las OFs». Confirmar asociación mantiene las otras relaciones existentes de las OFs.

Leer ubicación y pallets en cualquier orden prepara el traslado. Se acumulan hasta
100 pallets, sin duplicar relecturas. El resumen muestra ubicación actual y destino.
Los que ya están allí se indican y no producen traslados ficticios. Si todos están en
el destino, se informa y no se ofrece una escritura innecesaria.

Cuando están presentes OFs, pallets y ubicación, la pantalla ofrece acciones distintas:
asociar las OFs al único destino elegido o mover los pallets con su contenido actual.
Una confirmación no realiza la otra operación. Asociar conserva la ubicación de un
pallet ya ubicado; para cambiarla se confirma un traslado. Un pallet sin ubicación
puede recibir ubicación y OFs juntas con la confirmación de asociación.

Cada registro seleccionado tiene Quitar; la ubicación también. Cancelar selección
elimina sólo lo pendiente. «Ver» abre una consulta relacionada sin añadir lecturas.
Tras elegir el destino para las OFs se devuelve el foco al lector. La navegación de
consulta no borra selecciones. Un éxito confirmado por Odoo vuelve a Inicio.

## Errores y reintentos

Odoo valida grupo, perfil, compañías, permisos y estado vigente. Un error o conflicto
impide el movimiento parcial. Un conflicto solicita nuevas lecturas. Un error de
negocio conserva la selección para corregirla. Si se pierde la respuesta, se bloquean
cambios de selección y se reintenta la misma petición; no se anuncia éxito anticipado.
Las selecciones y peticiones viven en memoria: si se cierra o recarga la pestaña antes
de conocer el resultado, comprobar el historial de Odoo antes de repetir la operación.

## Validación y activación

npm test y npm run build validan React y la demo conservada. El runner nativo del
addon valida modelo, permisos, auditoría, rollback y rutas HTTP con fixtures
reversibles en cmpslu y GC desactivada. Nginx permite sólo la ruta específica de
movimiento, junto a las existentes; no se expone escritura ORM genérica.

Activado en pallets.cmp3.es el 29/10/2026 con autorización de Rubén: actualización
sólo de cmp_mrp_packages a 16.0.1.7.0, reinicio de Odoo y rebuild del contenedor web.
Comprobados certificado HTTPS, bundle publicado y bloqueo de las rutas sin sesión.
No se declaran implementadas etiquetas, vaciado, retirada de OFs o cierres de OT.

Validación posterior al despliegue: 4 pruebas HTTP/Chromium correctas, sin errores,
fallos ni saltos; fixtures sin cambios y GC de filestore desactivada.
