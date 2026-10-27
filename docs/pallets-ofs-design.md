# Aplicación de pallets y OFs conectada a Odoo — diseño acordado

Se diseñará una aplicación web para PDA, con una interfaz propia de escaneo y Odoo como sistema de registro, que permita encontrar material de órdenes de fabricación durante los pasos intermedios de sus órdenes de trabajo. Una OF puede aparecer en varios pallets sin desglose de cantidades; cada soporte conserva una secuencia legible y un QR entre usos, y su contenido y ubicación mantienen historial. La propuesta técnica es React con TypeScript y un addon Odoo 16 que concentre datos, permisos y operaciones; incluye consulta desde la propia OF y confirmación de destino al finalizar OTs individuales o en lote. El [prototipo interactivo](./pallets-ofs-visual.html) representa el flujo con datos ficticios y simulaciones de PIN, servidor e impresión. Este documento define comportamiento y comprobaciones pendientes: no acredita que la aplicación esté implementada, instalada o desplegada.

## Términos

- **OF**: Orden de fabricación de Odoo que puede estar asociada a varios pallets; no se desglosan cantidades ni piezas por pallet. Evitar: «pedido», «orden de trabajo», «cantidad en el pallet».
- **Pallet**: Soporte físico reutilizable identificado por un código único y un QR estables; su contenido y ubicación cambian y se conservan en el historial. Evitar: «ID de base de datos», «agrupación desechable».
- **Asociación OF–pallet**: Registro de que hay material de una OF en un pallet, sin especificar cuánto ni qué piezas; una OF y un pallet pueden tener varias asociaciones. Evitar: «OF completa», «lote», «existencias».
- **Ubicación de planta**: Lugar físico donde está un pallet para localizar sus OFs, sin generar movimientos de inventario. Evitar: «traslado de inventario», «ajuste de existencias».
- **Trasladar una asociación**: Registrar la OF en el pallet de destino y retirar sólo su asociación con el origen si el operario indica que allí ya no queda material. Evitar: «mover la OF completa», «mover existencias».
- **Guardado**: Operación confirmada por Odoo; ante falta de conexión se conserva lo escaneado para reintentar sin indicar éxito. Evitar: «sincronizado después», «guardado sólo en la PDA».
- **Operario verificado**: Empleado identificado mediante su PIN en una PDA compartida; se registra junto al usuario Odoo y no amplía sus permisos. Evitar: «usuario Odoo nuevo», «permisos por PIN».
- **Ubicación de una OF**: Conjunto de las ubicaciones actuales de todos los pallets asociados a esa OF; si no hay pallets registrados no se deduce una ubicación directa. Evitar: «ubicación única de la OF», «ubicación directa sin pallet».
- **OT**: orden de trabajo de Odoo que describe un paso de una OF. Evitar: usar OT y OF como sinónimos.
- **Contenido actual**: conjunto de asociaciones OF–pallet activas. Evitar: confundirlo con lo que hubo en usos anteriores.
- **Dividir / fusionar**: redistribuir asociaciones de OF entre pallets, conservando o retirando cada origen según lo indicado por el operario. Evitar: asumir un reparto de cantidades.

## Por qué

En fábrica «caen» varias OFs en un mismo pallet. Hoy esos soportes se identifican de maneras informales, por ejemplo por iniciales de planos o referencias de pedidos de cliente. El problema expresado es que no se sabe dónde están los pallets ni qué OFs contiene cada uno. Cuando alguien necesite una OF, debe poder abrirla y ver todos sus pallets y sus ubicaciones actuales.

Rubén busca aplicaciones web con mejor UX/UI para trabajar con Odoo desde una interfaz propia. La prioridad de esta aplicación es el escaneo rápido en planta. El encargo aclara que no trata del empaquetado del producto terminado: sigue el material entre pasos de las OTs. Esto exige una relación de presencia y localización, sin introducir un control de piezas o existencias que el operario no necesita mantener.

## Decisiones fijadas

Las siguientes decisiones representan los compromisos que resultarían costosos o sorprendentes de cambiar sin su contexto. Las valoraciones se conservan como fueron registradas en la entrevista: good / mixed / poor; «—» significa que no se valoró ese eje. Coste se refiere al funcionamiento repetido, no al esfuerzo de desarrollar la opción.

### Q1. ¿Una misma OF puede estar repartida entre varios pallets?

**Decisión: Una OF puede aparecer en varios pallets sin registrar cantidades ni detalle de piezas.**

Una OF puede figurar simultáneamente en varios pallets. La relación sólo afirma presencia de material; no identifica piezas, cantidades, lotes ni proporciones. Una búsqueda de OF debe mostrar todos sus pallets y sus ubicaciones, incluso cuando la misma ubicación se repita en varios soportes.

| Opción | UX | Corrección | Riesgo | Coste recurrente |
| --- | --- | --- | --- | --- |
| A. Cada OF completa sólo puede estar en un pallet a la vez; un pallet admite varias OFs. | good | mixed | mixed | good |
| B. Una OF puede repartirse entre pallets, registrando cantidades en cada uno. | mixed | good | mixed | good |
| C. El pallet contiene piezas o lotes; la OF se conserva como origen de esas piezas. | mixed | good | mixed | good |
| **D. Una OF puede aparecer en varios pallets sin registrar cantidades ni detalle de piezas.** | good | good | mixed | good |

Motivo y contrapartida: Tu aclaración define una relación de varios a varios entre OFs y pallets, orientada a localización. El punto más débil es riesgo: el sistema no podrá comprobar si se ha trasladado todo el material ni detectar cantidades olvidadas. Es una limitación aceptada del alcance, no una razón para pedir cantidades que no necesitáis.

Opciones descartadas:

- **A. Cada OF completa sólo puede estar en un pallet a la vez; un pallet admite varias OFs.** Exigir un único pallet por OF contradice el caso real de material repartido entre varios soportes.
- **B. Una OF puede repartirse entre pallets, registrando cantidades en cada uno.** Añadir cantidades no aporta el dato requerido y obliga al operario a mantener información que el alcance excluye.
- **C. El pallet contiene piezas o lotes; la OF se conserva como origen de esas piezas.** Modelar piezas o lotes cambiaría la unidad de seguimiento y el trabajo cotidiano; aquí sólo se necesita presencia de una OF en un pallet.

### Q2. ¿Cambiar la ubicación debe mover también existencias en Odoo?

**Decisión: Sólo localizar OFs y pallets en planta; sin validar movimientos de inventario.**

La aplicación localiza material durante pasos intermedios de fabricación. Las operaciones de agrupar, retirar, dividir, fusionar o reubicar pallets no crearán traslados ni ajustes de existencias. El cierre de una OT conservará sus efectos nativos en Odoo: esta restricción no elimina validaciones ni efectos que el proceso de fabricación ya tenga.

| Opción | UX | Corrección | Riesgo | Coste recurrente |
| --- | --- | --- | --- | --- |
| **A. Sólo localizar OFs y pallets en planta; sin validar movimientos de inventario.** | good | mixed | mixed | good |
| B. Mover el pallet debe registrar también el traslado de sus existencias en Odoo. | mixed | good | mixed | mixed |
| C. Depende de la fase: en producción localización; al entrar en almacén, inventario. | mixed | good | mixed | mixed |

Motivo y contrapartida: Para organizar OFs en curso empezaría por localización, siempre que eso describa vuestro proceso. Sus puntos débiles son corrección y riesgo: la ubicación de la app podría diferir del inventario si esperáis que también lo mueva. B o C son preferibles si estos escaneos deben sustituir traslados de almacén.

Opciones descartadas:

- **B. Mover el pallet debe registrar también el traslado de sus existencias en Odoo.** Los traslados de existencias no representan la localización del material entre OTs y quedan fuera de este flujo.
- **C. Depende de la fase: en producción localización; al entrar en almacén, inventario.** No se ha pedido una transición de esta app hacia operaciones de almacén; incorporar ambas semánticas haría ambiguos sus escaneos.

### Q4. Al trasladar material de una OF entre pallets, ¿qué debe ocurrir con el pallet de origen?

**Decisión: El operario elige: añadir también al destino, o trasladar quitando sólo la asociación con el pallet de origen.**

Al llevar material de P1 a P4, el operario debe indicar si también queda material en P1. Si queda, se conservan ambas asociaciones; si no queda, se retira exclusivamente OF–P1 y se añade OF–P4. Las asociaciones con P2, P3 y cualquier otro pallet se conservan. No es posible deducir esta decisión sin cantidades.

| Opción | UX | Corrección | Riesgo | Coste recurrente |
| --- | --- | --- | --- | --- |
| **A. El operario elige: añadir también al destino, o trasladar quitando sólo la asociación con el pallet de origen.** | mixed | good | mixed | good |
| B. Trasladar quita siempre la asociación con el origen; para repartir se usa una acción distinta de añadir. | good | mixed | mixed | good |
| C. Añadir al destino conserva siempre el origen; retirar del origen se hace en una operación aparte. | mixed | good | mixed | good |

Motivo y contrapartida: Sin cantidades, el operario es quien sabe si ha vaciado el origen. Propongo dos opciones claras: «También queda en origen» y «Ya no queda en origen», guardadas en una única operación. Sus puntos débiles son UX y riesgo: exige una decisión adicional y se puede marcar mal; a cambio evita que la app borre o conserve una ubicación por suposición.

Opciones descartadas:

- **B. Trasladar quita siempre la asociación con el origen; para repartir se usa una acción distinta de añadir.** Borrar siempre el origen pierde ubicaciones cuando todavía queda material allí.
- **C. Añadir al destino conserva siempre el origen; retirar del origen se hace en una operación aparte.** Separar siempre la retirada en otra operación favorece que queden asociaciones antiguas si el operario olvida el segundo paso.

### Q5. ¿Qué representan las ubicaciones donde dejaréis los pallets?

**Decisión: Una lista propia de zonas o puestos de planta, con código y QR para cada ubicación.**

Se mantendrá un catálogo controlado de zonas y puestos de planta con nombre, código y QR. Una ubicación pertenece al seguimiento de fabricación; no se convertirá automáticamente en una ubicación de inventario ni generará movimientos de stock. Los responsables administran ese catálogo.

| Opción | UX | Corrección | Riesgo | Coste recurrente |
| --- | --- | --- | --- | --- |
| **A. Una lista propia de zonas o puestos de planta, con código y QR para cada ubicación.** | good | good | mixed | good |
| B. Las ubicaciones de almacén que ya existen en Odoo; sus códigos identifican también dónde está el pallet. | good | mixed | mixed | good |
| C. El operario escribe libremente la ubicación cada vez. | mixed | mixed | poor | good |

Motivo y contrapartida: Para localizar OFs en curso propongo un catálogo controlado de zonas de planta que se pueda escanear. Su eje más débil es riesgo: hay que mantenerlo y evitar duplicar lugares que ya estén bien definidos en Odoo. Si las ubicaciones actuales de almacén representan exactamente esos lugares, elegiría B y las reutilizaría.

Opciones descartadas:

- **B. Las ubicaciones de almacén que ya existen en Odoo; sus códigos identifican también dónde está el pallet.** El alcance confirmado usa zonas propias de planta; no se ha demostrado que el catálogo de almacén represente esos mismos lugares.
- **C. El operario escribe libremente la ubicación cada vez.** El texto libre produce variantes y errores de escritura, impide un escaneo fiable y dificulta buscar todos los pallets de una zona.

### Q6. ¿Se puede exigir conexión a Odoo para guardar cada operación?

**Decisión: Sí: sólo confirmar una operación cuando Odoo la haya guardado; sin conexión, avisar y conservar lo escaneado para reintentar.**

La primera versión necesita conexión a Odoo para registrar cambios. La pantalla distingue claramente escaneado, pendiente, guardando, guardado y error. Ante un corte se conserva el grupo preparado para reintentar; no se ejecutan movimientos desconectados ni se anuncia éxito anticipadamente. Un reintento debe consultar o reutilizar la misma operación para evitar duplicados.

| Opción | UX | Corrección | Riesgo | Coste recurrente |
| --- | --- | --- | --- | --- |
| **A. Sí: sólo confirmar una operación cuando Odoo la haya guardado; sin conexión, avisar y conservar lo escaneado para reintentar.** | mixed | good | good | good |
| B. No: permitir registrar movimientos sin conexión y sincronizarlos después, señalando pendientes y conflictos. | good | mixed | mixed | mixed |
| C. Aún no sabemos cómo es la cobertura; probar las PDA en planta antes de cerrar esta decisión. | mixed | good | good | good |

Motivo y contrapartida: Para la primera versión prefiero que «Guardado» signifique que Odoo ya lo ha confirmado, y que un reintento no duplique la operación. Su eje más débil es UX: una zona sin cobertura interrumpe el trabajo. Si esas zonas son habituales, B puede ser necesaria; si no se ha medido la cobertura, conviene C antes de prometer un flujo sólo conectado.

Opciones descartadas:

- **B. No: permitir registrar movimientos sin conexión y sincronizarlos después, señalando pendientes y conflictos.** Una cola desconectada exige resolver conflictos entre operarios y puede presentar información atrasada como ubicación actual; se excluye de esta primera versión.
- **C. Aún no sabemos cómo es la cobertura; probar las PDA en planta antes de cerrar esta decisión.** La necesidad de medir cobertura permanece como validación, pero Rubén eligió explícitamente un flujo conectado, no dejar sin decidir su semántica de guardado.

### Q7. ¿Cómo se repartirán las PDA y la identificación de los operarios?

**Decisión: PDA compartidas: sesión Odoo autorizada y cada operario se identifica con su PIN; cambio rápido de operario.**

Las PDA se comparten. Se utiliza una sesión Odoo autorizada y el empleado se identifica mediante su PIN nativo. La auditoría identifica al usuario Odoo y al operario verificado. El PIN no crea un usuario Odoo ni concede permisos adicionales; los permisos efectivos y las compañías siguen siendo los de la cuenta Odoo.

| Opción | UX | Corrección | Riesgo | Coste recurrente |
| --- | --- | --- | --- | --- |
| **A. PDA compartidas: sesión Odoo autorizada y cada operario se identifica con su PIN; cambio rápido de operario.** | good | good | mixed | good |
| B. Cada operario usa su cuenta Odoo personal existente y su propia sesión. | mixed | good | good | good |
| C. Habrá ambos casos: cuenta personal o cuenta compartida con identificación del operario. | mixed | good | mixed | good |

Motivo y contrapartida: Si las PDA pasan entre operarios, recomiendo identificación rápida con PIN y registro tanto del usuario Odoo como del operario verificado. Su eje más débil es riesgo: hay que aislar los cambios de operario y no atribuir movimientos al anterior. La identidad del operario no ampliará los permisos de la cuenta Odoo. Si cada uno ya tiene cuenta y dispositivo propios, B encaja mejor.

Opciones descartadas:

- **B. Cada operario usa su cuenta Odoo personal existente y su propia sesión.** No corresponde al reparto confirmado de dispositivos y cuentas compartidas; tampoco se crearán usuarios de pago para obtener trazabilidad de empleado.
- **C. Habrá ambos casos: cuenta personal o cuenta compartida con identificación del operario.** No se ha solicitado una combinación de ambos mecanismos en esta aplicación; no se añade esa complejidad al alcance confirmado.

### Q8. El encargo dice «efímeros»: ¿mantenemos el mismo QR al reutilizar el pallet?

**Decisión: Mantener lo elegido: el soporte conserva código y QR; sus agrupaciones cambian y se conserva el historial de cada uso.**

El código y el QR identifican al soporte físico durante sus distintos usos. El contenido es efímero: las asociaciones activas cambian, pero se conserva el historial. La interpretación fue confirmada expresamente después de contrastar el término «efímeros» del encargo. Vaciar el pallet retira su contenido registrado actual sin borrar los usos anteriores ni emitir otra identidad.

| Opción | UX | Corrección | Riesgo | Coste recurrente |
| --- | --- | --- | --- | --- |
| **A. Mantener lo elegido: el soporte conserva código y QR; sus agrupaciones cambian y se conserva el historial de cada uso.** | good | good | mixed | good |
| B. Cada agrupación es temporal y tiene código y QR propios; al acabar se archiva y el siguiente uso recibe otra etiqueta. | mixed | good | good | mixed |

Motivo y contrapartida: Mantendría tu elección explícita: interpretar «efímero» como el contenido del pallet, conservando la etiqueta del soporte. Su eje más débil es riesgo: deben quedar bien separados el contenido actual y los usos anteriores, y vaciar un pallet tiene que retirar sus asociaciones activas. Si el encargo pretende identificar cada agrupación temporal por separado, corresponde B; no lo deduciré sin confirmarlo.

Opciones descartadas:

- **B. Cada agrupación es temporal y tiene código y QR propios; al acabar se archiva y el siguiente uso recibe otra etiqueta.** Una etiqueta distinta por cada carga contradice la reutilización del mismo QR confirmada por Rubén y añade impresión repetida. El contenido cambia y se audita sin sustituir la identidad física.

### Q10. ¿Hay que seguir localizando una OF después de marcarla como terminada en Odoo?

**Decisión: Sí: una OF terminada puede seguir asociada a pallets hasta que el operario retire su material.**

Una OF terminada puede seguir teniendo material en planta. Sus asociaciones se mantienen hasta que el operario registre la retirada. Ni el cierre de una OT ni el estado terminado de una OF deben borrar automáticamente su localización. La aplicación tampoco cambiará el estado de fabricación al limitarse a escanear o mover material.

| Opción | UX | Corrección | Riesgo | Coste recurrente |
| --- | --- | --- | --- | --- |
| **A. Sí: una OF terminada puede seguir asociada a pallets hasta que el operario retire su material.** | good | good | mixed | good |
| B. No: la pantalla de trabajo sólo localiza OFs en curso; al terminar pasan al historial. | mixed | mixed | mixed | good |

Motivo y contrapartida: Prefiero que la ubicación represente lo que queda físicamente en planta, aunque la fabricación ya esté terminada. Su eje más débil es riesgo: las asociaciones pueden quedar antiguas si nadie registra la retirada. Se resolverá con una acción clara de retirar material y con historial, sin borrar ubicaciones automáticamente por un cambio de estado Odoo.

Opciones descartadas:

- **B. No: la pantalla de trabajo sólo localiza OFs en curso; al terminar pasan al historial.** Ocultar automáticamente una OF terminada puede hacer desaparecer material que sigue físicamente en un pallet.

### Q15. ¿También habrá que localizar material de una OF que no esté en ningún pallet?

**Decisión: Sólo a través de pallets. Si la OF no está asociada a ninguno, se muestra «Sin pallet registrado», sin inventar una ubicación.**

La ubicación de una OF se obtiene exclusivamente a través de todos sus pallets asociados. No se registra una ubicación directa para piezas sobre una mesa o máquina sin pallet. Si no hay asociaciones activas, la interfaz muestra «Sin pallet registrado»; si un pallet no tiene ubicación conocida, se explicita esa falta de información.

| Opción | UX | Corrección | Riesgo | Coste recurrente |
| --- | --- | --- | --- | --- |
| **A. Sólo a través de pallets. Si la OF no está asociada a ninguno, se muestra «Sin pallet registrado», sin inventar una ubicación.** | good | mixed | mixed | good |
| B. También permitir asociar la OF directamente a una zona, además de poder estar en varios pallets. | mixed | good | mixed | good |

Motivo y contrapartida: Para el alcance inicial que has descrito mantendría la ubicación en el pallet. Sus ejes más débiles son corrección y riesgo: el sistema no localizará material que se deje fuera de todos los pallets. Si eso ocurre habitualmente y necesitáis encontrarlo, B debe entrar en el diseño desde ahora; la aplicación distinguiría ubicaciones directas de las heredadas de pallets.

Opciones descartadas:

- **B. También permitir asociar la OF directamente a una zona, además de poder estar en varios pallets.** Ampliaría el seguimiento a material sin soporte y añadiría otra fuente de localizaciones. Rubén confirmó mantener el alcance basado únicamente en pallets.

### Q17. ¿Debe ser obligatorio confirmar pallet y ubicación para dar por terminada una OT?

**Decisión: Sí: confirmar pallet(s) y ubicación antes de completar el cierre; permitir confirmar que sigue en el destino actual.**

En los puntos de finalización identificados en el encargo, la asignación de pallet(s) y ubicación debe confirmarse antes de completar el cierre de la OT. Se puede confirmar que el material sigue donde estaba, pero no escoger arbitrariamente un pallet cuando la OF ya aparece en varios. El proceso conservará los controles nativos de fabricación, calidad, permisos y errores de Odoo.

| Opción | UX | Corrección | Riesgo | Coste recurrente |
| --- | --- | --- | --- | --- |
| **A. Sí: confirmar pallet(s) y ubicación antes de completar el cierre; permitir confirmar que sigue en el destino actual.** | mixed | good | good | good |
| B. Mostrar la selección, pero permitir cerrar la OT sin asignarla y dejar una incidencia pendiente de localización. | good | mixed | mixed | mixed |

Motivo y contrapartida: Si la meta es encontrar el material al acabar cada paso, recomiendo que cierre y localización formen una operación confirmada, usando valores actuales sólo cuando sean inequívocos y el operario los confirme. Su eje más débil es UX: añade un paso incluso cuando no cambia el destino. B evita ese bloqueo, pero permite que una OT terminada siga sin una ubicación fiable y exige trabajo posterior.

Opciones descartadas:

- **B. Mostrar la selección, pero permitir cerrar la OT sin asignarla y dejar una incidencia pendiente de localización.** Permitir terminar y dejar la ubicación para después mantiene precisamente la falta de localización que pretende resolver el encargo; requiere además perseguir incidencias pendientes.

### Q18. Cuando se terminan varias OTs juntas, ¿pueden acabar en pallets diferentes?

**Decisión: Proponer un destino común, permitiendo excepciones por OF y varios pallets cuando haga falta antes de confirmar.**

Al terminar un lote se propone un destino común y se permiten excepciones por OF, incluidas varias asociaciones de pallet para la misma OF. Varias OTs de una misma OF se presentan sin duplicar esa OF. La confirmación describe exactamente a qué OF afecta cada destino; no reparte cantidades ni interpreta que una operación logística ha movido toda la fabricación.

| Opción | UX | Corrección | Riesgo | Coste recurrente |
| --- | --- | --- | --- | --- |
| A. Un destino común para cada cierre en lote; si hay destinos distintos, el operario separa los cierres. | good | mixed | mixed | good |
| **B. Proponer un destino común, permitiendo excepciones por OF y varios pallets cuando haga falta antes de confirmar.** | mixed | good | mixed | good |

Motivo y contrapartida: Mantiene la rapidez de asignar un destino común y permite reflejar lotes cuyo material se separa físicamente. Sus ejes más débiles son UX y riesgo: hay más información en pantalla y se puede aplicar un destino común a una OF que no corresponde. La pantalla deberá mostrar claramente las OFs afectadas y sus excepciones, evitando repetir la misma OF por cada OT.

Opciones descartadas:

- **A. Un destino común para cada cierre en lote; si hay destinos distintos, el operario separa los cierres.** Obliga a separar cierres que ya se ejecutan juntos cuando sus materiales tienen destinos distintos. Se admite un destino común como valor inicial, pero no como restricción del lote.

## Elecciones habituales

- **Q3 — ¿Con qué dispositivos escanearán principalmente los operarios?** PDA industrial con lector QR integrado como dispositivo principal. Hay que comprobar cómo entrega las lecturas al navegador; no se presupone cámara ni una marca concreta.
- **Q9 — ¿Qué texto contiene actualmente el QR de una OF?** Se recibió un ejemplo real de QR cuyo contenido es texto, distinto de la URL de acceso a la OF. Se conservará completo y opaco al resolverlo. La correspondencia exacta con el campo de Odoo y su unicidad siguen pendientes de verificar; este documento no reproduce identificadores ni enlaces internos de producción.
- **Q11 — ¿Quién podrá crear pallets y quién administrará las ubicaciones?** Los operarios autorizados crean pallets, reimprimen etiquetas y mueven material. Los responsables administran las ubicaciones y corrigen incidencias mediante operaciones auditadas. Todo está subordinado a los permisos Odoo de la cuenta utilizada.
- **Q12 — ¿Dónde se imprimirán las etiquetas QR de los pallets?** Se elige imprimir directamente desde la PDA a una impresora portátil de etiquetas. Se descarta como flujo principal acudir a un puesto fijo o descargar un PDF para imprimir manualmente. La integración real depende del equipo que se elija.
- **Q13 — ¿Qué PDA e impresora usaréis para imprimir directamente?** Rubén aún no conoce los dispositivos: la elección de PDA e impresora portátil se hará posteriormente. No se fija fabricante, transporte, tamaño de etiqueta, aplicación auxiliar ni servicio de impresión sin una prueba real.
- **Q14 — Después de escanear las OFs y el pallet, ¿se guarda automáticamente o se confirma una vez?** Se escanean primero las OFs y después el pallet; se revisa el conjunto y se pulsa una sola vez Confirmar. No hay confirmación repetida por cada OF ni guardado automático al leer por accidente el QR de destino.
- **Q16 — ¿Podemos contrastar el diseño con el encargo de proyecto.txt?** Se ha contrastado íntegramente el contenido aportado de proyecto.txt. Su alcance es el material entre OTs, no el empaquetado final. Incluye crear y etiquetar, localizar desde la OF, capturar destino al terminar OTs en todas las entradas citadas, cambiar ubicaciones, cambiar asociaciones, dividir, fusionar y revisar contenido. La secuencia legible solicitada en la conversación prevalece sobre la posibilidad de usar el ID mencionada en el texto inicial.

### Propuesta técnica y límites de la interfaz

Se recomienda React con TypeScript para la web propia. Angular también permitiría construir este flujo; no hay evidencia de que uno garantice por sí mismo mejor UX. Se elige React como criterio técnico delegado por Rubén para una interfaz de escaneo con componentes reutilizables en futuras apps. La calidad se validará con el dispositivo real, pulsaciones, lectura de errores y tiempos de respuesta. Vite es una opción de construcción del frontend, no un requisito de negocio ya impuesto.

Odoo conserva los datos y la lógica. El addon ofrece operaciones de negocio acotadas; no se replica su base de datos ni se entregan credenciales de servicio al navegador. Servir frontend y API bajo el mismo origen HTTPS es la propuesta inicial para aprovechar la sesión Odoo y evitar introducir otro inicio de sesión o una segunda fuente de verdad. La ubicación de los repositorios, el nombre definitivo del addon y el despliegue se prepararán cuando se autorice desarrollo; no se convierte la infraestructura en un monorepo.

La alternativa de una pantalla Owl personalizada dentro de Odoo existe y no está limitada a formularios estándar. La web propia se propone por el objetivo explícito de tener una interfaz externa reutilizable. Las integraciones en la ficha de OF y en el cierre de OTs siguen siendo necesarias en Odoo; compartirán las mismas operaciones y validaciones que la web. No se duplicará la lógica entre ambas interfaces.

Se propone un modelo propio de pallet de fabricación, con nombre técnico provisional mrp.package. Antes de crearlo hay que comprobar que no colisiona con módulos presentes. La preferencia proviene del encargo y del alcance de fabricación intermedia. No se declara que ese modelo ya exista ni se instala el módulo de Odoo 17 enlazado como referencia.

### Datos y reglas del dominio

- **Pallet físico**: código público único, compañía, ubicación de planta actual, estado operativo, autor de creación, asociaciones activas e historial. El ID interno puede existir para relaciones, pero no es la identificación que tendrá que manejar el operario.
- **Ubicación de planta**: nombre, código inequívoco, compañía y disponibilidad. Su catálogo es administrado por responsables; no se escribe una ubicación nueva libremente al escanear. No se eliminan referencias históricas al desactivar una zona.
- **Asociación activa OF–pallet**: una pareja única entre OF y pallet dentro de los límites de compañía y permisos. No contiene cantidades, piezas, lotes o porcentajes. Una OF admite varios pallets y un pallet varias OFs.
- **Historial**: eventos de crear, añadir, retirar, trasladar, dividir, fusionar, vaciar, reubicar y reimprimir, con usuario Odoo, operario verificado, fecha/hora, origen/destino y contexto de OT cuando proceda. Las correcciones añaden nuevos eventos; no borran lo anterior. Los usos de un pallet quedan distinguibles en la consulta.
- **Confirmación de OT**: relación entre las OTs seleccionadas, sus OFs, los destinos confirmados y la operación que se ejecuta. No se almacenan unidades por pallet. Varias OTs de la misma OF se deduplican para presentar y actualizar asociaciones.
- **Invariantes**: cada pallet tiene como máximo una ubicación actual. Dos OFs del mismo pallet no pueden situarlo simultáneamente en lugares distintos. Una asignación a ese pallet muestra su ubicación; cambiarla reubica el pallet entero y afecta a todas las OFs que contiene. La interfaz debe explicar ese efecto antes de confirmar.
- **Búsqueda de OF**: mostrar cada pallet y su ubicación, con enlaces de consulta; no colapsar la respuesta en un único «último lugar». Se pueden agrupar visualmente ubicaciones repetidas sin ocultar los distintos pallets. OF sin asociaciones: «Sin pallet registrado». Pallet sin ubicación conocida: aviso explícito.
- **Integridad**: las operaciones se validan en servidor, con aislamiento de compañía y permisos nativos. Se evita que un escaneo repetido cree otra asociación idéntica o que una respuesta de red perdida duplique una operación ya confirmada.

Como formato inicial de etiqueta se propone P + año + contador con un mínimo de cinco dígitos, por ejemplo P202600001. La secuencia se asigna en servidor al crear el soporte y no se recalcula al cambiar el año o el contenido. El contador debe soportar concurrencia; los huecos no se interpretan como un error. No se recicla un código que ya haya identificado un soporte. El formato exacto es un detalle técnico flexible según la indicación original de Rubén.

El QR lleva identidad estable, no la lista mutable de OFs ni una credencial. Se propone diferenciar tipos con prefijos de lectura, por ejemplo CMP:PALLET:P202600001 y CMP:LOC:CORTE-01, siempre que se validen con el lector y la impresora elegidos. El código legible permanece impreso. Escanear identifica el objeto y la consulta autenticada recupera su contenido actual. Una etiqueta perdida se reimprime con la misma identidad; una reimpresión no crea otro pallet.

El texto de los QR actuales de OF se considera opaco hasta verificar su origen. No se interpreta un sufijo decimal como una cantidad ni se deduce una OF a partir de un producto. La resolución tiene que ser inequívoca dentro de los registros autorizados y la compañía; ante código desconocido, ambiguo, de otro tipo o sin permiso, no se guarda el cambio. Si el código no identifica una OF por sí mismo, hará falta acordar y validar un identificador o selector inequívoco antes de ponerlo en uso.

### Flujos operativos

1. **Inicio y cambio de operario.** Abrir la web en la PDA dentro de una sesión Odoo válida, identificar al empleado por PIN y mostrar claramente al operario activo. Al cambiar de operario se descartan o se cancelan explícitamente las operaciones preparadas del anterior; no se atribuyen al nuevo. Se conservan las restricciones de usuario, sesión y compañías.
2. **Crear y etiquetar.** Crear el registro de pallet una sola vez y recibir su código del servidor. Obtener la etiqueta con ese código y QR y solicitar impresión portátil desde la PDA. Sólo marcar la impresión con la confirmación que permita el equipo real. Si falla la impresión, el pallet ya creado conserva su identidad y se puede reintentar; no se crea otro por cada fallo. La configuración exacta queda pendiente del hardware.
3. **Agrupar.** Escanear una o varias OFs; validar cada lectura y evitar duplicados dentro del grupo. Escanear el pallet de destino. Revisar OFs, pallet y ubicación y pulsar Confirmar una vez. Añadir asociaciones sin retirar las que esas OFs ya tengan en otros pallets. Mostrar Guardado sólo cuando Odoo haya confirmado.
4. **Cambiar de pallet.** Seleccionar explícitamente el origen cuando haya varios. Escanear el destino e indicar si también queda material en origen. Confirmar conjuntamente las altas y, cuando corresponda, las bajas de asociaciones. Eliminar únicamente el origen señalado; preservar todos los demás.
5. **Mover un pallet.** Leer el pallet y una ubicación válida. Mostrar origen y destino y que se reubica todo su contenido registrado. Confirmar el movimiento de localización e historial. No generar un traslado de inventario por esta acción.
6. **Dividir.** Desde el contenido de un pallet, seleccionar las OFs que aparecerán en otro pallet, nuevo o existente. Para cada asociación afectada se confirma si sigue habiendo material en el origen. Puede quedar una OF en ambos; no se piden cantidades. El resto del contenido del origen se conserva.
7. **Fusionar.** Reunir en un destino las asociaciones seleccionadas de uno o varios pallets de origen. Las OFs repetidas no se duplican. Se hace explícito qué asociaciones de origen se retiran porque ya no queda material allí. Los soportes que queden vacíos siguen disponibles para reutilización con su mismo QR; se conserva todo el historial.
8. **Vaciar o retirar.** Retirar una OF sólo del pallet indicado cuando ya no quede allí su material. Vaciar un pallet requiere confirmar el conjunto que se retira; registra el evento y conserva identidad e historial. El sistema no deduce dónde fue el material fuera del alcance de los pallets registrados.
9. **Consultar.** Desde la web y desde la ficha de OF de Odoo, ver todos sus pallets y sus ubicaciones actuales. Desde el pallet digital, ver contenido actual, ubicación e historial de usos. Buscar por código sin depender de conocer IDs internos. Mantener localizables las OFs terminadas que aún tengan asociaciones.
10. **Terminar una OT.** Antes de completar el cierre, capturar pallet(s), ubicación y la información sobre permanencia en origen que corresponda. Se puede confirmar explícitamente el destino que no ha cambiado. Cierre y asignación deben tener un resultado coherente: si falla validación o guardado, no mostrar ambos como completados. Se respetan los controles y efectos nativos de Odoo.
11. **Terminar varias OTs.** Admitir un destino común y excepciones por OF, incluyendo varios pallets. Presentar cada OF una sola vez aunque haya varias OTs de ella. Rechazar destinos contradictorios para un mismo pallet físico y mostrar el efecto sobre cualquier contenido que ya tenga. Validar el conjunto antes de confirmar el cierre.
12. **Cobertura de entradas Odoo.** Revisar e integrar el botón de ejecutar una OT, ejecutar varias, la vista tablet, los anidados y los lotes de OTs. Ninguna entrada equivalente debe omitir la confirmación elegida. La lista de métodos y personalizaciones concretas todavía requiere inventario técnico; no se supone que una sola sobreescritura cubra todas esas rutas.
13. **Red y reintentos.** Sin conexión, conservar los escaneos preparados y ofrecer reintento; no ejecutar operaciones desconectadas ni presentar ubicación actualizada que no esté confirmada. Si el servidor pudo haber guardado pero se perdió la respuesta, recuperar el resultado de la misma operación antes de intentar otra. Detectar cambios concurrentes y pedir revisión del estado vigente.

### Seguridad, auditoría y experiencia de uso

Los controles se adaptarán a pantalla de PDA, lectura frecuente y pocas pulsaciones: objetivos táctiles grandes, foco de lectura estable y mensajes breves que distingan lectura válida, tipo de QR incorrecto, duplicado, destino pendiente, operación en curso y guardado. El lector debe poder distinguir un error recuperable de un guardado definitivo. La consulta y la preparación de un grupo no deben disparar escrituras por accidente.

La identidad del operario se verificará en servidor. Conforme a las bases del proyecto, se preservan el PIN nativo del empleado, la creación y confirmación inicial cuando esté vacío, su verificación sin sobrescribir cuando exista, los permisos nativos de RRHH para restablecerlo, cinco intentos fallidos y bloqueo de cinco minutos, y perfiles ligados a usuario, sesión y compañías con el límite de ocho horas. No se da por reutilizable una integración de OdooClaw sin revisar su API y aislamiento para esta nueva aplicación.

Se conservarán permisos nativos Odoo para cada acción y lectura. El responsable del catálogo no obtiene acceso por llevar un nombre distinto en el PIN: debe estar autorizado también bajo la cuenta Odoo y la política de roles de la aplicación. Cuando una cuenta compartida impida distinguir autorizaciones necesarias, se resolverá el diseño sin ampliar sus permisos ni crear usuarios de pago por defecto. No se registran PIN, credenciales o tokens en el historial.

La solución compartirá reglas entre web y entradas de Odoo. El catálogo y la relación de pallets se validan en servidor; ocultar un botón no sustituye una comprobación de permisos. Reimpresión, corrección y cambios de ubicación dejan trazabilidad. No se eliminan soportes o zonas que tengan historia para corregir un error operativo.

### Criterios de aceptación y validación futura

- Registrar una OF en tres pallets y comprobar que la consulta, incluida la ficha Odoo, muestra los tres con sus ubicaciones. Agregar un cuarto sin perder ninguno de los anteriores.
- Trasladar desde P1 conservando origen y después desde P1 retirando origen; comprobar en ambos casos que las asociaciones ajenas al origen seleccionado permanecen.
- Reubicar un pallet con varias OFs y comprobar que todas derivan la nueva ubicación. Rechazar que el mismo soporte reciba dos ubicaciones distintas dentro de una confirmación.
- Dividir y fusionar con OFs repetidas, sin cantidades ni duplicados de asociación. Vaciar y reutilizar manteniendo el código y distinguiendo el historial anterior del contenido actual.
- Comprobar las OFs terminadas con material aún asociado y el estado Sin pallet registrado al retirar la última asociación. No inventar una ubicación directa ni borrar material por el estado de la OF.
- Comprobar las cinco rutas de cierre enumeradas en el encargo, incluida una selección con varias OTs de la misma OF, destinos comunes y excepciones. No completar el cierre si falta la confirmación obligatoria ni saltarse los controles nativos.
- Cortar la conexión antes del envío y después de un posible guardado; reintentar sin duplicar ni anunciar éxito antes de confirmación. Probar que dos PDA no pisan cambios concurrentes sin aviso.
- Verificar cada tipo de etiqueta real con el lector elegido. Probar dos OFs del mismo producto para demostrar que el código resuelve la OF concreta, un código desconocido, uno ambiguo, otra compañía y un registro sin permiso.
- Elegir PDA e impresora portátil y hacer una impresión y lectura físicas, incluida reimpresión y error de impresora. Fijar después transporte, servicio/controlador, tamaño, calidad y márgenes de etiqueta.
- Cambiar de operario, de sesión y de compañía; verificar atribución, caducidad y aislamiento entre pestañas. Comprobar límites de PIN y permisos sin elevar los de la cuenta Odoo.
- Comprobar que las acciones propias de localización no añaden movimientos de stock y que el cierre de OTs conserva el comportamiento nativo esperado.
- Ejecutar estas validaciones en un entorno de prueba explícito con repositorios y datos aislados. Esta entrevista y el prototipo no sustituyen pruebas funcionales ni autorizan inferencias con modelos, cambios de configuración o acceso directo de escritura a producción.

## Hechos verificados

- El encargo original fue facilitado como texto dentro de Q16. Su nota excluye expresamente el empaquetado final y sitúa el problema entre OTs; exige consulta desde OF, agrupaciones, ubicaciones, creación/impresión, división/fusión y selección al finalizar una o varias OTs.
- El código local de cmp_mrp_custom/reports/mrp_workorder_templates.xml, en workorder_base_label_template, codifica doc.production_id.display_name en el QR. Las etiquetas de cmp_mrp_custom/reports/mrp_production_templates.xml codifican doc.product_id.barcode. Por tanto, existen etiquetas de significados distintos; esto no acredita qué informe activo emitió la muestra recibida.
- cmp_mrp_custom/models/mrp_production.py declara last_production_location como Char; cmp_mrp_custom/models/mrp_workorder.py ofrece un campo relacionado con él. No se ha verificado en runtime un campo denominado last_workorder_location. No se modifica ni se reemplaza automáticamente esa información existente.
- Los informes y pruebas locales hacen referencia al formato base_report_layout_custom_cmp.paperformat_dymo_57x32_horizontal. Eso no demuestra que una impresora Dymo esté disponible ni que sea compatible con la futura PDA; se eligió impresión portátil con hardware aún pendiente.
- [El paquete estándar de Odoo 16](https://github.com/odoo/odoo/blob/16.0/addons/stock/models/stock_quant.py) contiene quants y calcula su ubicación a partir de ellos. Este modelo no representa sin adaptación la presencia de OFs sin cantidades durante fabricación intermedia.
- [La documentación de Odoo 16](https://github.com/odoo/documentation/blob/16.0/content/developer/reference/frontend/framework_overview.rst) describe Owl y las posibilidades de extensión del cliente. La elección de una web propia es una decisión de producto y arquitectura, no la afirmación de que Odoo no permita una interfaz personalizada.
- [HelloLeo](https://helloleo.dev/) presenta aplicaciones y herramientas conectadas a ERPs, incluido Odoo. Es una referencia de la filosofía de interfaz propia sobre el ERP; no se ha elegido, contratado o conectado esa plataforma para este proyecto.
- [El módulo referenciado en el encargo](https://apps.odoo.com/apps/modules/17.0/mrp_production_packaging) corresponde a Odoo 17. [El hilo del foro referenciado](https://www.odoo.com/forum/help-1/how-to-pack-in-manufacturing-orders-solved-298070) plantea empaquetado después de fabricar y operaciones de inventario. No se ha validado ninguno como solución instalable de este seguimiento intermedio en Odoo 16.
- El frontend recomendado se basa en el modelo de componentes de [React](https://react.dev/learn). [Angular](https://angular.dev/overview) es una alternativa viable; no se han hecho comparativas de rendimiento con los dispositivos reales.
- El prototipo usa datos ficticios y simulaciones. Las revisiones se guardaron en la sesión de entrevista; no se ha ejecutado este flujo sobre la base de producción ni se han instalado nuevos modelos o módulos como parte del diseño.

## Riesgos

- **Confundir producto, OF y OT al leer un QR.** Hay etiquetas distintas en código. La implementación queda condicionada a demostrar la resolución exacta del ejemplo real y la ausencia de selección arbitraria. Nunca deducir una OF sólo por el producto o por una parte del texto.
- **Presencia sin cantidades.** No se puede saber qué proporción de material queda ni detectar automáticamente restos olvidados. El operario confirma permanencia en origen y retirada; el historial ayuda a investigar, pero no sustituye esa confirmación física.
- **Reutilización de etiqueta.** Una carga nueva puede arrastrar asociaciones anteriores si se omite el vaciado. Separar contenido actual de historia y ofrecer una retirada/vaciado explícitos, siempre con el mismo identificador del soporte.
- **Ubicación compartida por todo el pallet.** Cambiarla afecta a todas las OFs contenidas, no sólo a la OT que se está cerrando. Mostrar ese alcance y rechazar asignaciones contradictorias dentro del mismo lote.
- **Entradas de cierre heterogéneas.** Las personalizaciones de ejecución individual, tablet, anidado y lote pueden seguir rutas distintas. Inventariarlas y verificar cada una antes de afirmar que la captura es obligatoria en todas.
- **Cierre parcial o doble ejecución.** Separar mal el cierre y las asociaciones, o reintentar tras perder una respuesta, puede dejar estados incoherentes. Necesita validación en servidor, coherencia transaccional con el flujo Odoo y claves de idempotencia; no basta con bloquear el botón de la PDA.
- **Cobertura de red.** El modo conectado interrumpe el trabajo si no hay cobertura. Probar la planta y recuperar escaneos preparados; la primera versión no promete sincronización desconectada.
- **Impresión portátil sin hardware definido.** Puede necesitar servicios o componentes del fabricante y tiene costes de consumibles y mantenimiento. No prometer compatibilidad de una web genérica ni elegir un equipo sin una prueba real de ida y vuelta.
- **Identidad compartida y permisos.** Verificar PIN no transforma permisos Odoo. La integración debe evitar atribución a otro operario, operaciones pendientes cruzadas y acceso entre compañías; la reutilización de infraestructura de OdooClaw todavía necesita revisión técnica.
- **Dependencia de un Char de última ubicación.** Ese dato no representa varios pallets actuales. Debe mantenerse una relación de asociaciones y consulta plural, sin confundir historia o un resumen de compatibilidad con la fuente de verdad.
- **Alcance de los ejemplos y del prototipo.** Un QR facilitado y una simulación no acreditan todas las etiquetas, navegadores ni métodos activos. El diseño está acordado; la validación de la implementación permanece pendiente.

## Pendiente o aplazado

- **Hardware (Q13).** Se aplaza explícitamente elegir PDA e impresora portátil. Se reabre cuando haya candidatos o equipos disponibles para probar lector, navegador, sistema operativo, transporte, tamaño de etiqueta y servicio/controlador.
- **Resolución de QR real (Q9).** Se reabre durante el análisis técnico autorizado con la etiqueta/informe activo y los registros de prueba adecuados. Hay que comprobar qué campo representa, su estabilidad y su unicidad en compañía, sin escribir en producción ni exportar datos a Git.
- **Integraciones de cierre y acceso.** Antes de implementar se revisarán los puntos reales de finalización y la interfaz reutilizable de identidad/PIN. Las decisiones de negocio Q17 y Q18 están cerradas; falta demostrar cómo cumplirlas sobre el código activo.
- **Nombre y ubicación del addon, frontend y hosting.** La preferencia mrp.package y React con TypeScript está documentada. El nombre técnico definitivo, sus dependencias, las ramas/worktrees necesarios y un entorno de pruebas se concretan al autorizar desarrollo. No se crean de forma anticipada.
- **Desarrollo, pruebas integradas y despliegue.** No se han realizado. El diseño no constituye autorización de push, publicación, instalación, fusión o despliegue. Se mantienen separados los repositorios e historiales existentes y se respetarán sus reglas y las autorizaciones futuras.

## Hilos abiertos

No quedan decisiones funcionales sin responder en la entrevista. La discrepancia sobre «efímeros» se resolvió reabriendo Q8 y reconfirmando que el soporte conserva su QR mientras cambia el contenido. La duda sobre el QR real se mantiene como comprobación técnica de Q9, descrita arriba; no se ha convertido una hipótesis sobre su estructura en un hecho. El hardware se aplazó expresamente en Q13.

El prototipo final acompaña a este documento y debe leerse como demostración de UX con datos ficticios. Sus simulaciones de PIN, guardado, cierre e impresión no son pruebas de integración con Odoo ni con una impresora real.
