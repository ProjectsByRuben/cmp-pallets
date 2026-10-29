# CMP Pallets: operaciones, historial y acceso por empleado

Diseño acordado el 28 de octubre de 2026. Concreta la siguiente fase del addon
`cmp_mrp_packages` y su futura conexión con React: acceso por empleado, administración
de ubicaciones dentro de la aplicación, correcciones trazables y resolución segura de
QR de OF o producto. Complementa [el diseño funcional](pallets-ofs-design.md) y
[el diseño del módulo y dominio](cmp-mrp-packages-design.md). Conserva sus requisitos
salvo las concreciones explícitas de este documento. La consulta de pallets en OF y
OT ya está instalada en `cmpslu`; los nuevos permisos, operaciones auditadas y la
conexión React descritos aquí siguen pendientes de implementación. No se solicitó
visual en esta entrevista.

## Términos

- **Pallet:** soporte físico con código y QR estables, una ubicación actual y presencia
  de cero o varias OF. Evitar: «paquete de stock» y «cantidad de piezas».
- **Vaciar:** retirar las asociaciones actuales de OF de un pallet sin borrar el soporte
  ni su historial. Evitar: «borrar el pallet» y «crear otro QR».
- **Corrección:** nueva operación registrada que corrige el estado actual sin borrar
  eventos anteriores. Evitar: «editar el historial» y «volver atrás sin validar cambios
  posteriores».
- **Responsable:** persona autorizada para mantener ubicaciones y resolver incidencias,
  respetando los permisos de la cuenta Odoo y la identidad verificada. Evitar:
  «cualquiera que elija otro nombre de empleado» y «permisos concedidos por el PIN».
- **Acceso a CMP Pallets:** nivel asignado al empleado: Sin acceso, Operario o
  Administrador. Evitar: «permiso global de la cuenta compartida» y «administrador de
  todo Odoo».
- **QR de OF:** código que resuelve una orden de fabricación concreta de forma
  inequívoca entre los registros autorizados. Evitar: «cualquier código del producto».
- **QR de producto:** código que identifica un producto y puede corresponder a varias
  OF. Evitar: «OF más reciente» como regla de resolución y «cantidad deducida del QR».
- **Guardado:** resultado confirmado por Odoo. Evitar usarlo para lecturas preparadas,
  propuestas pendientes o respuestas de red cuyo resultado todavía se desconoce.

## Por qué

Rubén quiere una aplicación independiente, limpia y centrada en escanear: consultar
OF y pallets, agrupar material y mover uno o varios pallets a una ubicación. Los
operarios trabajarán desde PDA, iPhone o PC sin depender de las pantallas habituales
de Odoo. Odoo mantendrá los datos y validará las operaciones. Rubén pide que la propia
aplicación permita a administradores mantener zonas y que cada persona tenga un
desplegable de acceso, junto a su identificación por PIN. También quiere evitar
selecciones que se queden en pantalla después de guardar y poder corregir lecturas
antes de confirmar. Esta fase resuelve las reglas que faltaban antes de implementar
los permisos y el registro de operaciones y conectar React.

## Decisiones fijadas

Las valoraciones reproducen la entrevista: `good`, `mixed`, `poor` y `—` si no aplica.
Coste significa consumo o pasos recurrentes durante el uso, no esfuerzo de desarrollo.
La negrita identifica la opción elegida. Las referencias Q corresponden a esta
entrevista, no a las numeraciones de los documentos anteriores.

### Q2. Corregir operaciones confirmadas mediante el flujo habitual

**Decisión A: no ofrecer un botón Deshacer automático. El operario vuelve a escanear
y confirma la operación correcta.**

| Opción | UX | Corrección | Riesgo | Coste |
| --- | --- | --- | --- | --- |
| **A. Corregir mediante otra operación normal.** | mixed | good | good | good |
| B. Deshacer la última operación compatible si no hubo cambios posteriores. | good | good | mixed | good |

Si se registró P1 en Soldadura cuando físicamente está en Corte, se vuelve a leer P1
y Corte y se confirma el traslado corrector. El historial conserva los dos eventos,
sus responsables y sus fechas. La corrección valida el estado actual, los permisos
y la compañía igual que cualquier otra operación. No borra eventos ni revierte
automáticamente cierres de OT o sus efectos de negocio.

La desventaja aceptada es UX: requiere más lecturas que un botón rápido. Se descarta
B porque necesita verificar que nadie haya modificado después todos los registros
afectados para evitar pisar trabajo ajeno. No significa eliminar Volver, Inicio o
Quitar lectura: esos controles siguen cancelando selecciones antes de guardar.

### Q4. Admitir QR de OF y QR de producto, con selección explícita

**Decisión C: el QR inequívoco de OF abre directamente esa orden; el QR de producto
pide elegir la OF y nunca la adivina.**

| Opción | UX | Corrección | Riesgo | Coste |
| --- | --- | --- | --- | --- |
| A. Exigir etiquetas inequívocas de OF y rechazar producto para asociar. | mixed | good | good | good |
| B. Usar etiquetas de producto y pedir siempre elegir la OF. | mixed | good | mixed | mixed |
| **C. Admitir ambos tipos según su significado.** | good | good | mixed | mixed |

Ejemplo: si OF-001 y OF-002 fabrican el mismo producto y sus etiquetas tienen el
mismo QR de producto, ese escaneo no distingue entre ellas. La aplicación mostrará
una selección de OF autorizadas para ese producto, con referencias y datos que
permitan distinguirlas. Sólo una elección explícita prepara la OF para la operación.
Cancelar la selección no añade ninguna OF ni escribe asociaciones. El servidor
validará de nuevo el producto, la OF seleccionada, la compañía y los permisos.

Si el código identifica directamente una OF, se abre su detalle sin ese selector.
No se elige automáticamente la más reciente ni se convierte un fragmento del código
en una cantidad. Los códigos desconocidos o cuya interpretación siga siendo ambigua
no preparan escrituras: requieren una resolución inequívoca. La resolución no debe
revelar datos de OF inaccesibles o de otra compañía. El formato técnico exacto de los
identificadores y las colisiones entre tipos se validarán durante la implementación.

Los puntos débiles aceptados son riesgo y coste de uso: el selector introduce una
posibilidad de elección humana equivocada y una consulta y paso adicionales. A sería
más simple si se sustituyeran todas las etiquetas antiguas, pero impide aprovechar
las actuales. B conserva esas etiquetas, pero obliga a seleccionar incluso allí donde
ya hay un QR inequívoco de OF. C mantiene ambos caminos sin adivinar identidades.

La primera respuesta fue «no entiendo esta pregunta de los qr». Se reformuló con el
ejemplo de dos OF del mismo producto y después Rubén aceptó C. La duda quedó resuelta;
no se interpreta la primera respuesta como una elección funcional.

### Q5. Asignar el nivel de acceso al empleado

**Decisión A: cada empleado tendrá Acceso a CMP Pallets, con los niveles Sin acceso,
Operario y Administrador, aunque comparta cuenta Odoo con otras personas.**

| Opción | UX | Corrección | Riesgo | Coste |
| --- | --- | --- | --- | --- |
| **A. Nivel por empleado identificado.** | good | good | good | mixed |
| B. Nivel por cuenta Odoo compartido por todos sus operarios. | good | good | mixed | good |

El campo se situará en la ficha del empleado. El PIN existente confirma la identidad;
no concede por sí mismo el nivel de acceso. El servidor comprobará la identidad, el
nivel del empleado, la sesión, la compañía y los permisos nativos de la cuenta Odoo.
Una cuenta personal resolverá su empleado vinculado; en una cuenta compartida se
usará la identificación por PIN. Una identidad ausente, ambigua o sin autorización
no puede convertirse por defecto en un operario o administrador.

Sin acceso impide usar las funciones de la aplicación con esa identidad. Operario
permite las funciones operativas habituales. Administrador añade la administración
del catálogo de ubicaciones. No significa ser administrador general de Odoo. Cambiar
estos niveles queda reservado a responsables autorizados en Odoo; un administrador
de Pallets no podrá concederse otros permisos ni modificar niveles mediante una API
operativa sin autorización específica.

El punto débil aceptado es el coste recurrente de resolver y verificar al empleado
en cada sesión autorizada. B puede resultar suficiente con una cuenta por persona,
pero en una PDA compartida daría el mismo acceso a todos. La decisión no crea usuarios
de pago, no cambia el PIN nativo ni permite ampliar permisos de la cuenta para
resolver bloqueos. Si los permisos nativos impiden una operación, ésta se deniega y
se diagnostica la configuración antes de cambiarla.

### Q6. Exigir ubicación al asociar material por primera vez

**Decisión A: un pallet vacío puede crearse sin ubicación; para guardar su primera
asociación de OF debe tener una ubicación válida.**

| Opción | UX | Corrección | Riesgo | Coste |
| --- | --- | --- | --- | --- |
| **A. Pedir ubicación antes de la primera asociación.** | mixed | good | good | mixed |
| B. Permitir OF en pallets sin ubicación y mostrar el aviso. | good | good | mixed | good |

Si se escanea una OF y un pallet nuevo sin ubicación, el flujo solicita leer o elegir
una ubicación válida antes de confirmar. La asignación de ubicación y la asociación
deben formar un resultado coherente: no se anuncia que la OF quedó guardada si falta
la localización requerida. Un pallet que ya tiene ubicación no exige repetir esa
lectura sólo por añadir otra OF. No se podrá dejar sin ubicación un pallet con OF
asociadas mediante otra entrada de escritura.

Esta regla debe protegerse en servidor, no sólo ocultando botones de React. Los
pallets vacíos siguen pudiendo existir sin zona mientras se crean o etiquetan. No se
inventará una ubicación por defecto. El cierre de OT mantiene su regla anterior de
destino confirmado, incluso cuando éste no cambia.

Los puntos débiles aceptados son UX y coste de uso: hay una lectura adicional y se
bloquea la confirmación si aún no hay una zona válida. Se descarta B porque guardar
agrupaciones sin ubicación deja sin cumplir el objetivo de encontrar el material.

## Elecciones habituales

- **Q1:** al retirar la última OF, el pallet vacío conserva su ubicación hasta que se
  registre su traslado. Vaciar no mueve físicamente el soporte. El código y QR tampoco
  cambian. La ubicación puede quedar antigua si alguien lo mueve sin registrarlo;
  borrar siempre la ubicación también perdería información que puede seguir vigente.
- **Q3:** las ubicaciones se crean, renombran o archivan en una sección administrativa
  de la aplicación React. Las consultas actuales de Odoo se mantienen. Se eligió esta
  vía frente a mantener el catálogo en Configuración de Fabricación o duplicar su
  administración en ambos sitios. El código estable de ubicación no se cambia al
  renombrar su descripción. Se mantienen las restricciones de archivo e integridad.
- Los nombres visibles de los niveles serán **Sin acceso**, **Operario** y
  **Administrador**, bajo el campo **Acceso a CMP Pallets**. El valor inicial deberá
  ser Sin acceso; no se migrarán empleados concediéndoles acceso automáticamente.

### Alcance operativo que se conserva

Una OF puede estar en varios pallets, y un pallet contener varias OF, sin cantidades,
piezas, porcentajes ni movimientos de inventario por localización. Las OT consultan
el conjunto actual de pallets de su OF; no mantienen una segunda asignación. Cada
pallet tiene una sola ubicación actual y cambiarla afecta a todo su contenido.

Operario podrá consultar, crear pallets, obtener y reimprimir etiquetas, asociar o
retirar OF, trasladar material entre pallets, dividir o fusionar asociaciones, vaciar
y mover uno o varios pallets. Se mantienen las confirmaciones sobre si queda material
en el origen. Administrador añade la gestión del catálogo de zonas; otras funciones
administrativas sugeridas sin concretar no se dan por autorizadas automáticamente.
Las consultas de OF y OT en Odoo no se retiran a quien carezca de acceso a React si
sus permisos nativos ya las permiten: el nuevo nivel regula la aplicación y sus
operaciones, y no amplía la lectura empresarial general.

Las lecturas preparan propuestas y no guardan cambios por sí mismas. Las relecturas
no duplican la selección. Volver, Inicio y Quitar lectura permiten cancelar o corregir
lo pendiente; al guardar con confirmación de Odoo se limpian selecciones y navegación
pendiente y se vuelve al inicio con el resultado. Un movimiento de varios pallets a
un mismo destino valida el conjunto antes de escribir; los que ya están allí no
generan traslados ficticios.

Los eventos de creación, asociación, retirada, traslado, división, fusión, vaciado,
corrección y solicitud/reimpresión de etiqueta conservan actor, cuenta Odoo, compañía,
fecha, registros afectados, origen y destino, y contexto de OT cuando exista. La
confirmación física de impresión sólo puede afirmarse cuando el hardware la soporte.
Ni operario ni administrador de la aplicación pueden editar o borrar el historial
para corregir errores. También deben auditarse los cambios de catálogo y permisos
relevantes. Las rutas ORM autorizadas deben compartir las validaciones; la API de
React no puede ser la única entrada que mantenga integridad o historia.

Sin conexión se conservan lecturas pendientes, sin anunciar guardado ni prometer
sincronización desconectada. Ante una respuesta perdida se consulta o reintenta la
misma operación con idempotencia, sin duplicar efectos. La identidad de petición debe
vincularse al contenido, actor y compañía; no se reutiliza para otra operación.
Las modificaciones concurrentes requieren validar el estado vigente y devolver un
conflicto comprensible antes de pisar trabajo de otro operario.

### Separación técnica y próximos hitos

Odoo es la fuente de verdad. El addon guarda modelos, reglas de negocio, permisos y
auditoría. React con TypeScript será un frontend independiente en su propio Git,
servido bajo `https://pallets.cmp3.es` desde CMP o VPN. Se conserva la propuesta de
proxy de API bajo ese origen, con sesión autenticada propia: no se presupone que la
cookie del dominio actual de Odoo autentique automáticamente el dominio Pallets.
No se necesitan cuentas de ChatGPT ni Sites para la aplicación real.

Primero se revisará y construirá el acceso por empleado y la capa de operaciones
auditadas con pruebas nativas. Después se conectará React a operaciones explícitas,
sin exponer una API genérica de escritura o credenciales técnicas al navegador. La
integración con los distintos cierres de OT se realizará como hito propio,
inventariando las rutas individual, múltiple, tablet, anidados y lotes y respetando
fabricación y calidad nativas. No se afirma que esta fase ya cubra esos cierres.

Las pruebas se harán sólo en `cmpslu`, sin crear bases nuevas ni copias de base o
filestore y con limpieza de filestore desactivada. Se emplearán fixtures reversibles
para evitar cambios duraderos en datos de negocio. No se operará en producción.
La autorización para publicar código o desplegar se revisará en la conversación
correspondiente; terminar esta entrevista no ordena esas acciones.

### Criterios de aceptación para la implementación

1. Dos empleados bajo la misma cuenta Odoo tienen niveles distintos. Sin acceso no
   opera; Operario no mantiene zonas ni cambia roles; Administrador puede mantener
   zonas sólo cuando también lo permiten la cuenta y compañía autorizadas. Manipular
   el cliente o llamar directamente a la API no evita esas comprobaciones.
2. El cambio de empleado, sesión o compañía invalida la atribución anterior y no
   transfiere operaciones pendientes. Se mantiene la política existente de PIN,
   bloqueo tras cinco fallos durante cinco minutos y perfiles de ocho horas. No se
   registran PIN ni secretos en eventos o respuestas de error.
3. Un pallet vacío sin zona puede crearse y etiquetarse. Añadirle OF exige ubicación.
   Un error deja la operación sin confirmar y sin asociación parcial. Se rechaza
   retirar la zona de un pallet con contenido desde cualquier entrada admitida.
4. Vaciar conserva código, QR, ubicación e historia. Trasladar el soporte vacío
   actualiza la ubicación. Reutilizarlo muestra sólo su contenido vigente y conserva
   los eventos de usos anteriores.
5. Corregir una ubicación genera otro evento y conserva el original. No aparece un
   Deshacer automático de movimientos ni cierres de OT. Los controles previos a
   guardar continúan cancelando únicamente lo pendiente.
6. Dos OF del mismo producto demuestran que el QR de producto abre un selector y no
   elige la última. Cancelar no añade OF. Elegir una referencia válida prepara esa
   orden. El QR inequívoco abre directamente su OF. Se rechazan códigos desconocidos,
   interpretaciones ambiguas y registros inaccesibles sin filtrar información.
7. Los traslados múltiples y las asociaciones respetan compañía, unicidad, archivo,
   concurrencia e idempotencia. Una respuesta perdida no duplica eventos efectivos.
   Una operación fallida no se presenta como guardada ni cambia parcialmente el grupo.
8. Se mantiene la consulta OF/OT instalada: acceso desde el campo Pallet y la pestaña
   al mismo detalle, sin errores de metadatos. Tras guardar en React se vuelve a Inicio
   sin un pallet seleccionado residual. No aparecen movimientos de stock por ubicar.

## Hechos verificados

- El addon `cmp_mrp_packages` 16.0.1.1.1 está instalado en la instancia local de
  pruebas `cmpslu`. Registra pallets y ubicaciones y permite consultar desde OF y OT.
  La última validación previa de esta capa fue de 34 pruebas nativas, sin errores,
  fallos ni saltos, con fixtures revertidos y limpieza de filestore desactivada. Esa
  validación no acredita todavía la futura capa operativa o la conexión React.
- El error anterior de acceso a OF/OT se resolvió conservando el enlace del addon
  al reiniciar y cargando las definiciones en el servidor HTTP. El hook
  `scripts/organizacion/entrypoint/58-cmp-pallets-links` mantiene esa fuente instalada.
  Rubén confirmó que la consulta funciona antes de iniciar esta entrevista.
- La fuente del addon es el worktree
  `doodba-cmp/odoo/custom/worktrees/odoo-cmp-custom/cmp-mrp-packages`, rama
  `feat/cmp_mrp_packages/initial`. El frontend permanece en
  `/home/rubenfernandez/CMP/worktrees/cmp-pallets/desarrollo`, rama `dev/local`.
  No deben sustituirse en bloque las fuentes de integración de otros módulos MRP.
- La demo actual es JavaScript modular con datos ficticios del navegador; todavía no
  es la aplicación React conectada a Odoo. Publicar Git y publicar Sites son acciones
  distintas. Esta entrevista no cambió ninguno de esos despliegues.
- El QR original se contrastó en `cmpslu` mediante una transacción de sólo lectura:
  coincide con el código de barras del producto de la OF de ejemplo, no con su
  referencia de OF. Hay 15 OF del mismo producto en esa compañía y ninguna referencia
  de OF coincide exactamente con ese texto. No se incluyen aquí códigos reales,
  identificadores internos ni datos exportados.
- Los informes revisados tienen significados de QR distintos:
  `cmp_mrp_custom/reports/mrp_workorder_templates.xml` usa
  `doc.production_id.display_name`, mientras
  `cmp_mrp_custom/reports/mrp_production_templates.xml` usa `doc.product_id.barcode`.
  Esto justifica resolver el tipo de código; no autoriza reemplazar etiquetas usadas
  en otros procesos ni demuestra todos los informes efectivos de planta.
- El código actual permite que un pallet vacío conserve ubicación. La nueva regla
  que exige ubicación al asociar OF todavía debe implementarse y probarse; no se
  confunde el comportamiento de consulta existente con las decisiones nuevas.

## Riesgos

- **Roles bajo cuenta compartida:** la identidad del empleado debe estar verificada
  en servidor y ligada a sesión y compañía. Un campo o PIN enviados desde el cliente
  no son autorización. Una elevación indiscriminada para sortear permisos Odoo
  invalidaría el diseño.
- **Dependencia del PIN de OdooClaw:** se revisará qué puede reutilizarse sin acoplar
  Pallets a conversaciones, cuotas o atajos de permisos de otra aplicación. No se
  presupone que la API actual sea reutilizable sin adaptación.
- **Selección de OF por producto:** aunque el servidor valide la referencia elegida,
  el operario puede escoger una OF válida pero físicamente incorrecta. Mostrar
  referencias y contexto claros reduce el riesgo; una etiqueta inequívoca lo evita.
- **Ubicaciones desactualizadas:** la regla de conservar zona al vaciar registra el
  último lugar confirmado, no detecta movimientos físicos no comunicados.
- **Auditoría incompleta:** guardar sólo la relación actual o registrar únicamente
  peticiones React dejaría otras escrituras sin historia. Las validaciones, eventos
  y efectos deben ser coherentes y transaccionales, sin bypass por contexto cliente.
- **Concurrencia y cierres:** una corrección no puede pisar cambios posteriores sin
  revisión; un cierre de OT con destinos contradictorios no debe completarse por
  una ruta alternativa. La cobertura real de los cierres sigue pendiente.
- **Red e impresión:** sin cobertura no hay guardado confirmado. Sin hardware probado
  no se garantiza impresión portátil ni confirmación física de salida de etiqueta.
- **Despliegue y carga de campos:** aprobar pruebas en otro proceso no prueba que
  el servidor HTTP cargó los mismos modelos. Se actualizará sólo el módulo necesario,
  se verificará la carga tras reiniciar y se conservará su enlace de arranque.

## Pendiente o aplazado

No se aplazó ninguna de las seis preguntas de esta entrevista. Permanecen tareas
técnicas y alcance no concretado:

- Implementar y probar roles, verificación de empleado, operaciones auditadas,
  concurrencia, idempotencia y API. Revisar primero los permisos nativos y las rutas
  de identidad existentes; elegir nombres de modelos auxiliares según el repositorio.
- Desarrollar React sin perder los flujos de escaneo, corrección de selecciones y
  vuelta a Inicio ya aceptados. Validar físicamente Eyoyo EY-032 por Bluetooth con
  iPhone y su comportamiento como teclado; cámara como alternativa cuando proceda.
- Elegir y probar impresora/PDA, transporte y formato de etiqueta. La elección de
  hardware ya estaba aplazada; se reabre cuando haya equipos candidatos disponibles.
- Inventariar todas las entradas reales de cierre de OT antes de hacer obligatoria
  la captura de destino. No confundir el cierre decidido con una integración ya hecha.
- Preparar DNS, HTTPS, proxy, sesión y acceso CMP/VPN para `pallets.cmp3.es`, con la
  autorización de despliegue que corresponda. No se han abierto puertos ni cambiado DNS.
- Concretar otras funciones exclusivas de Administrador sólo cuando se identifique
  una necesidad. La sugerencia de «alguna cosa» adicional no define un permiso abierto.

## Hilos abiertos

No quedan decisiones funcionales sin responder entre las preguntas planteadas. La
duda sobre el significado del QR se aclaró antes de aceptar el comportamiento mixto.
La gestión de ubicaciones en React y los tres niveles se concretaron por empleado,
sin sustituir los permisos de la cuenta Odoo. El siguiente hito requiere revisar y
presentar el esquema de acceso y auditoría antes de programarlo de forma incremental.
Este documento cierra la entrevista y no declara terminada esa implementación.
