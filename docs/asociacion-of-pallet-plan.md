# Siguiente hito: asociar OFs a un pallet

Propuesta de implementación del 29/10/2026. Este documento concreta el siguiente
paso; no declara implementadas las escrituras de la aplicación.

## Comportamiento

- Leer una OF consulta sus datos y la añade a una selección pendiente. Leer otras
  OFs amplía esa selección; releer una no la duplica.
- Leer un pallet con OFs pendientes prepara el destino. Se muestra el resumen de
  OFs, pallet y ubicación antes de ofrecer «Confirmar asociación».
- Si falta ubicación, pedir una ubicación válida antes de confirmar. Si ya existe,
  conservarla: asociar OFs no traslada un pallet que ya está localizado.
- Quitar una OF, cambiar el destino o pulsar Inicio cancela únicamente selecciones
  pendientes. Ninguna lectura por sí sola modifica Odoo.
- Confirmar añade las relaciones seleccionadas y conserva las asociaciones de esas
  OFs con otros pallets. Trasladar material entre pallets será un hito distinto.
- Un éxito confirmado por Odoo limpia la selección, vuelve a Inicio y muestra el
  resultado. Un error conserva la propuesta para corregirla o reintentar.
- Consultar un pallet sin OFs pendientes mantiene la consulta actual.

## Responsabilidad de cada componente

React conserva sólo la propuesta pendiente en memoria y presenta la confirmación.
El addon valida identidad verificada, sesión, compañías, registros activos,
ubicación y permisos nativos antes de guardar. Se mantiene la relación Many2many
existente: no se crea otra tabla de presencia ni se guardan cantidades por pallet.

Añadir una operación privada del servicio y una ruta POST específica para asociar,
protegida como las rutas actuales por sesión Odoo, CSRF y origen. Ampliar únicamente
esa ruta en las listas permitidas de Vite y Nginx. No exponer escritura ORM genérica.

La confirmación requiere una identidad de petición y un registro técnico de su
resultado, ligado al empleado, cuenta, compañía y contenido de la operación. Este
registro es distinto de los eventos de historial: permite repetir una petición cuya
respuesta se perdió sin ejecutar otra vez sus efectos. No devuelve resultados de
otro operario ni permite reutilizar una identidad con contenido diferente.

Validar el estado vigente en servidor y detectar cambios concurrentes desde la
preparación. Ejecutar ubicación opcional, asociaciones, resultado de petición y
auditoría de forma atómica. Conservar la atribución al empleado mediante el ámbito
verificado existente, sin confiar en identificadores de actor enviados por React.
Reforzar la regla de ubicación obligatoria para pallets con contenido tanto en la
escritura desde pallet como desde OF. Evitar duplicados y eventos ficticios cuando
una relación ya existe. No cambiar cierres de OT ni movimientos de inventario.

## Archivos previstos

- Addon `cmp_mrp_packages`: servicio de operaciones, registro de peticiones,
  controlador, validaciones de `mrp.package` y `mrp.production`, seguridad del
  registro técnico, manifiesto/documentación y pruebas.
- React: `src/api.ts`, selección y confirmación en `src/ScanWorkspace.tsx`, estilos
  puntuales y pruebas de interacción.
- Entrada de red: listas de rutas de `vite.config.mts` y
  `deploy/nginx.conf.template`; comprobación de servicio y documentación.

## Comprobaciones de aceptación

1. Asociar una o varias OFs, conservar otros pallets y reflejar la relación en OF/OT.
2. Quitar lecturas, cancelar, evitar duplicados y volver a Inicio sólo tras éxito.
3. Pallet sin ubicación: guardar ubicación y asociación juntas o no guardar ninguna.
4. Rechazar sesión/PIN/perfil inválidos, registros inaccesibles, otras compañías,
   ubicaciones o pallets archivados y peticiones con CSRF/origen incorrectos.
5. Repetición de la misma petición sin duplicar historia; rechazar reutilización con
   otros datos. Detectar conflicto entre confirmaciones concurrentes.
6. Simular pérdida de respuesta y reintentar la misma petición sin anunciar éxito
   antes de recibir confirmación.
7. Ejecutar pruebas React y regresión de la demo, compilación y pruebas nativas con
   fixtures reversibles en `cmpslu`, sin crear bases ni copias y con GC desactivada.

Orden de trabajo: primero operación segura en Odoo y sus pruebas; después conectar
la selección React, probar el conjunto y actualizar el servicio de pruebas conforme
a la autorización de la conversación. Las OFs reales no se modificarán para las
pruebas automatizadas.

## Estado del incremento

Implementado en los worktrees de backend y React. La validación incluye pruebas
nativas con rollback y GC desactivada, interacción React y build. No se ejecuta
una actualización permanente del esquema ni del contenedor desde estas pruebas.
La activación requiere actualizar sólo el addon, reiniciar Odoo y reconstruir
el servicio web independiente. No hay cantidades por pallet ni traslados en este hito.

Validación del 29/10/2026: 88 pruebas Odoo/HTTP/Chromium, 42 pruebas React y 33 de
regresión de la demo correctas; build TypeScript/Vite y `nginx -t` correctos.
Recuentos de fixtures sin cambios y GC de filestore desactivada. El registro técnico
se creó y revirtió dentro de la transacción de pruebas. Comprobación previa de
compatibilidad en cmpslu: cero pallets con contenido sin ubicación. Las pruebas
comprueban revisiones obsoletas de pallet/OF y repetición de peticiones de forma
determinista; no se ha realizado una prueba de carga con operarios simultáneos.
No se han hecho commits, push ni actualización del contenedor publicado en este hito.

## Activación autorizada — 29/10/2026

Addon 16.0.1.6.0 actualizado en cmpslu, Odoo reiniciado y contenedor React
reconstruido mediante `./deploy/up.sh`. Servicio saludable, Nginx y smoke test
correctos; certificado HTTPS y bundle validado comprobados en pallets.cmp3.es.
La imagen web anterior se conserva para rollback; no se hicieron copias de datos.
Referencias de imagen y reversión en `versiones.md`.

Validación posterior al despliegue: 88 pruebas Odoo/HTTP/Chromium correctas,
0 errores, 0 fallos y 0 omitidas; recuentos de fixtures sin cambios y GC de filestore
desactivada. La comprobación incluye el esquema instalado del registro de peticiones.
