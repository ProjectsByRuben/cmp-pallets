# CMP Pallets: módulo Odoo y aplicación React

Diseño acordado el 27 de octubre de 2026. Se creará el addon **cmp_mrp_packages**
para registrar pallets de fabricación, ubicaciones y asociaciones con OF en Odoo 16.
La aplicación **React con TypeScript** tendrá código y servicio independientes y se
abrirá en **https://pallets.cmp3.es**, desde la red CMP o una VPN autorizada. Odoo será
la fuente de datos y permisos; las OT consultarán los pallets de su OF. Este documento
concreta el [diseño funcional anterior](pallets-ofs-design.md) y conserva sus requisitos,
incluido el cierre de OT con destino confirmado. No acredita una implementación,
instalación ni publicación: la demo actual continúa separada y con datos ficticios.
No se solicitó un nuevo visual en esta entrevista.

## Términos

- **Pallet:** soporte físico reutilizable con código automático y QR estables,
  contenido de varias OF y una ubicación actual. Evitar: «paquete de stock» e
  «ID visible de base de datos».
- **Ubicación:** zona o puesto de planta del catálogo `mrp.package.location`, sin
  movimientos de inventario. Evitar: «texto libre de última ubicación» y
  «stock.location por defecto».
- **Relación OF–pallet:** presencia de material de una OF en un pallet, varios a
  varios y sin cantidades. Evitar: «OF completa en un único pallet».
- **Addon:** módulo `cmp_mrp_packages` que guarda y valida los datos y operaciones
  dentro de Odoo 16. Evitar: «aplicación React dentro de Odoo».
- **Aplicación React:** interfaz independiente para operarios que consulta y modifica
  datos mediante operaciones autenticadas de Odoo. Evitar: «segunda base de datos de
  pallets» y «credenciales de servicio en el navegador».
- **OF:** orden de fabricación, modelo existente `mrp.production`. Evitar confundirla
  con una OT, un producto o una cantidad de material.
- **OT:** orden de trabajo, modelo existente `mrp.workorder`, vinculada a una OF por
  `production_id`. Evitar tratar sus pallets como otra asignación independiente.
- **Guardado:** resultado confirmado por el servidor. Evitar usar esa palabra para
  una selección de códigos, una propuesta sin confirmar o un reintento pendiente.

## Por qué

Rubén quiere organizar las OF que hay físicamente en pallets y encontrar ese material
durante la fabricación. Hoy no existe un registro de esos soportes. Los operarios
deben poder escanear OF, pallets y ubicaciones, asociar material, trasladarlo y
consultarlo desde móvil, PDA o PC mediante una interfaz más directa. El siguiente paso
solicitado es definir `cmp_mrp_packages`, con los modelos `mrp.package` y
`mrp.package.location`, evitando duplicados y generando un código como `P202600001`.
La web debe tener dominio propio, `pallets.cmp3.es`, y comunicarse con Odoo. Quien
consulte una OF dentro de Odoo también debe poder ver todos sus pallets y ubicaciones.

## Decisiones fijadas

Las valoraciones reproducen las opciones de la entrevista. `good`, `mixed` y `poor`
expresan las valoraciones originales; coste se refiere al funcionamiento recurrente,
no al esfuerzo de programación. No se han añadido puntuaciones retrospectivas.

### Q1. Las OT consultan los pallets de su OF

**Decisión: A. Las OT consultan los pallets actuales de su OF. La asignación se
mantiene una sola vez; el historial indica la OT cuando corresponda.**

| Opción | UX | Corrección | Riesgo | Coste |
| --- | --- | --- | --- | --- |
| **A. Las OT consultan los pallets actuales de su OF.** | good | good | mixed | good |
| B. Cada OT necesita sus propios pallets actuales. | mixed | good | mixed | mixed |

Una OF puede aparecer en varios pallets y un pallet contener varias OF. Si la OF tiene
las OT Corte y Soldadura, ambas consultan el mismo conjunto actual de pallets. Un
evento puede guardar la OT desde la que se confirmó la operación, pero eso no crea
otra asignación vigente por OT. El punto débil de A es el riesgo de interpretar esta
consulta como seguimiento separado por fase: no permite distinguir qué subconjunto
del material de una OF está en cada etapa simultánea. Esa necesidad reabriría el modelo.

Se descarta B porque introduce asignaciones que el alcance confirmado no requiere,
obliga a definir su agregación en la OF y añade posibilidades de contradicción. La
elección fue explícita; no se infiere de una limitación técnica de Odoo.

### Q3. Acceso desde CMP o VPN

**Decisión: A. Sólo desde la red de CMP o una VPN autorizada; el móvil se conecta
a esa Wi-Fi o VPN.**

| Opción | UX | Corrección | Riesgo | Coste |
| --- | --- | --- | --- | --- |
| **A. Sólo red CMP o VPN autorizada.** | mixed | good | good | good |
| B. También desde Internet con autenticación y HTTPS. | good | good | mixed | mixed |
| C. Decidir el alcance después de verificarlo con informática. | mixed | good | good | good |

La dirección propia no implica publicar la aplicación en Internet. Se preparará
resolución DNS y acceso para los dispositivos de CMP/VPN, con HTTPS. El punto débil
es UX: un iPhone sólo con datos móviles y sin VPN no tiene acceso garantizado.

Se descarta B en esta fase porque el acceso externo no es el alcance elegido y exige
operar una exposición adicional. C deja de ser la decisión funcional porque Rubén
ha elegido A; verificar la infraestructura real sigue siendo una tarea técnica pendiente.
No se abrirán puertos públicos como consecuencia de esta entrevista.

### Q4. Código global único de ubicación

**Decisión: A. El código de ubicación es único en toda la aplicación; el nombre
descriptivo puede repetirse.**

| Opción | UX | Corrección | Riesgo | Coste |
| --- | --- | --- | --- | --- |
| **A. Código global único y nombre repetible.** | good | good | good | good |
| B. Ni código ni nombre pueden repetirse. | mixed | good | mixed | good |
| C. Código único sólo dentro de cada compañía. | mixed | good | mixed | good |

Por ejemplo, `CORTE-01` y `CORTE-02` pueden tener el nombre visible «Corte». No pueden
existir dos ubicaciones con código `CORTE-01`. Los códigos de pallet también serán
globalmente únicos, incluidas identidades archivadas. Releer un QR no crea otra
asociación OF–pallet idéntica. La unicidad de código no sustituye las reglas de acceso
por compañía: una etiqueta inequívoca no autoriza a consultar ni modificar su registro.

A está mejor o empatada en los cuatro ejes para el alcance planteado. B se descarta
porque impedir nombres descriptivos repetidos no mejora la identidad del escaneo y
obliga a alterar etiquetas de lugares distintos que legítimamente se llaman igual.
C se descarta porque permite repetir la misma etiqueta entre compañías y exige otro
contexto para resolverla. No se ha elegido un catálogo compartido sin compañía.

### Q6. Dominio propio para la aplicación

**Decisión: B, concretada por Rubén como https://pallets.cmp3.es, con React independiente
y conexión a Odoo.** La respuesta fue texto libre: «quiero que tenga un dominio propio
ya que al final va a ser una aplicacion totalmente independiente de odoo por ejemplo
quiero que se llame pallets.cmp3.es y que esa aplicacion se conecte con odoo».

| Opción | UX | Corrección | Riesgo | Coste |
| --- | --- | --- | --- | --- |
| A. Ruta propia bajo el dominio actual de Odoo. | good | good | good | good |
| **B. Nombre propio en DNS, como pallets.cmp3.es.** | good | good | mixed | mixed |

La recomendación inicial era A, por la sencillez de aprovechar el mismo origen y
sesión. Rubén eligió B para tener una dirección propia de la aplicación. Ese criterio
de producto decide la elección aunque A tenga valoraciones técnicas iguales o mejores;
las valoraciones no se han cambiado para ocultar la contrapartida. B requiere mantener
DNS, certificado, encaminamiento y autenticación de ese dominio. Sus puntos débiles
son riesgo y coste recurrente por esas piezas adicionales.

A queda descartada como URL de entrada porque no cumple la preferencia explícita.
La independencia de React se mantiene tanto en código como en servicio; Odoo sigue
guardando los datos de negocio. Dominio independiente no significa base de datos
duplicada ni desaparición del addon.

## Elecciones habituales

- **Q2:** no habrá un icono de aplicación nuevo en Odoo. Habrá consulta desde OF y OT,
  y administración del catálogo reservada a responsables. La herramienta cotidiana del
  operario será React. `application=False` no convierte el módulo en secreto ni elimina
  su presencia en la administración técnica de módulos.
- **Q5:** código `P` + año de creación + contador de cinco dígitos mínimos, con reinicio
  anual. Ejemplo: `P202600123`; primer alta de 2027: `P202700001`. El código de un
  soporte antiguo no cambia con el año, el contenido o la ubicación. El relleno mínimo
  no impone un máximo: al superar cinco cifras la secuencia crece. Se aceptan huecos;
  no se reutilizan códigos ni se usa `max + 1` como generador concurrente.

### Esquema técnico propuesto

Los nombres de campo siguientes son una propuesta de implementación, subordinada a la
revisión de colisiones y a las convenciones del repositorio antes de programar. Los dos
modelos de negocio pedidos son los de pallet y ubicación. Las relaciones y la auditoría
necesitan además almacenamiento auxiliar; no se promete una implementación limitada a
exactamente dos tablas PostgreSQL.

| Modelo | Campos o relaciones previstos | Responsabilidad |
| --- | --- | --- |
| `mrp.package.location` | `code`, `name`, `company_id`, `active` | Catálogo controlado de zonas, código único y nombre descriptivo. |
| `mrp.package` | `name`, `company_id`, `location_id`, `production_ids`, `active` | Identidad del soporte, una ubicación actual y presencia de OF. |
| `mrp.production` existente | `package_ids`, consulta derivada de ubicaciones y contador de pallets | Relación inversa y acceso a todos los pallets de la OF. |
| `mrp.workorder` existente | `package_ids` relacionados con `production_id.package_ids` y consulta derivada de ubicaciones | Consultar el conjunto actual de su OF, sin otra asignación. |
| Almacenamiento auxiliar de operaciones e historial | Identificador de petición, tipo, registros afectados, usuario, operario, fecha, origen y destino | Auditoría, reintentos sin duplicación y contexto de OT. |

En PostgreSQL, los nombres de tabla habituales de los modelos nuevos serán
`mrp_package` y `mrp_package_location`. En Odoo se usarán los nombres con puntos.
No se usará herencia por delegación para convertir un pallet en una OF: se extenderán
los modelos existentes con relaciones.

**Identificador del pallet.** Se propone guardar la secuencia en el campo habitual
`name`, con etiqueta «Código de pallet» o «Secuencia», en vez de mantener otro campo
de texto independiente llamado `secuencias`. La generación corresponde a `ir.sequence`
en servidor, con prefijo anual e intervalos anuales, y una restricción SQL de unicidad.
Se fijará una política coherente de fecha para el cambio de año. La generación debe
funcionar en altas múltiples y simultáneas. Duplicar un registro no copia su identidad.

**Ubicación.** `location_id` será una relación `Many2one`: cada soporte tiene como
máximo una ubicación actual. Si aún no se conoce, se mostrará explícitamente «Sin
ubicación registrada»; no se inventará una zona por defecto. Antes de completar el
cierre de una OT se necesita el destino confirmado que exige el diseño funcional.
Los códigos de ubicación se normalizarán de forma consistente antes de validarlos,
por ejemplo quitando espacios exteriores y usando mayúsculas. Una restricción en
base de datos debe proteger también dos altas simultáneas. Archivar no libera el código.

**Presencia de OF.** Se propone una relación `Many2many` con tabla de relación
explícita y una única pareja OF–pallet por asociación. La OF y el pallet consultan
esa misma relación en sentidos inversos. No se guardan cantidades. Las ubicaciones de
la OF se calculan a partir de sus pallets; un resumen de zonas no debe ocultar qué
pallets concretos hay en cada una. Sin asociaciones se muestra «Sin pallet registrado».

**Consulta en OT.** La cadena `production_id.package_ids` permite consultar la
relación de su OF. No se encadenarán campos `Many2many` en un `related` para agregar
ubicaciones: se utilizará el cálculo apropiado y se probará su búsqueda si se ofrece
un filtro por ubicación. Las consultas derivadas deben respetar permisos y compañía;
un cálculo en modo elevado no debe revelar registros inaccesibles.

**Historial.** Se guardará contexto de OT cuando exista, además de los cambios de
contenido y ubicación. Las correcciones añadirán eventos; el operario no podrá editar
o borrar el historial. El mecanismo exacto de modelos auxiliares se concretará antes
de codificar. Una tabla de relación vigente por sí sola no sustituye esa auditoría.
Archivar soportes o zonas debe conservar referencias y no ocultar material activo por
accidente; se definirán y probarán sus condiciones. Los registros con historia no se
borrarán para corregir un error operativo.

### Aplicación y comunicación con Odoo

Se propone la siguiente separación de responsabilidades:

1. El dispositivo resuelve `pallets.cmp3.es` mediante el DNS accesible desde CMP/VPN.
2. El proxy recibe HTTPS con un certificado válido y confiable en iPhone y PC.
3. La raíz sirve el frontend React; una ruta limitada como `/api/` encamina las
   operaciones necesarias al addon de Odoo de pruebas.
4. El addon valida identidad, permisos, compañía, datos y concurrencia y ejecuta la
   operación de negocio mediante el ORM de Odoo.
5. La respuesta confirma el resultado persistido. Sólo entonces React muestra éxito
   y vuelve a Inicio.

Este encaminamiento es una propuesta técnica, no una configuración ya aplicada.
El navegador se comunica con el origen de la aplicación. Si el proxy envía la API a
Odoo por la red de servicios, no hace falta abrir desde el navegador una conexión entre
los dos dominios ni añadir CORS permisivo. Si se eligiera otra topología, habrá que
revisar expresamente cookies, CORS y protección frente a peticiones no autorizadas.
No se expondrá por defecto una API genérica de ejecución de métodos ni la base de datos.

La sesión de `rubenfernandez.cmp3.es` no se considera automáticamente disponible en
`pallets.cmp3.es`. Se preparará una sesión propia y autenticada para la aplicación
contra la misma cuenta Odoo autorizada, y la identificación del operario ya acordada.
El proxy no sustituye la autenticación. Se validarán el inicio y cierre de sesión,
cookies, caducidad, protección de escrituras, límites de intentos y ausencia de caché
de respuestas privadas. No se pondrán contraseñas o claves técnicas en el JavaScript,
repositorio, QR, URL ni almacenamiento persistente del navegador.

No se necesita una cuenta ChatGPT ni Sites para usar esta aplicación alojada en CMP.
La demo Sites permanece como demostración; su audiencia pública no es la política de
acceso a los datos reales de la nueva aplicación.

### Requisitos funcionales anteriores que se mantienen

Estas reglas siguen vigentes aunque se implementen y validen por fases:

- Una OF puede tener material en varios pallets y un pallet puede contener varias OF,
  sin piezas, cantidades, porcentajes ni movimientos de inventario por localización.
- Cada soporte conserva código y QR entre usos. El QR contiene una identidad estable,
  no una lista de OF ni una credencial. Se distinguirán tipos de código al resolverlos.
- Escanear consulta o prepara una propuesta; no aplica cambios por sí solo. Varias OF
  y un pallet requieren una confirmación conjunta. También se admite pallet y luego OF.
- Una OF puede añadirse al destino conservando sus otros pallets. Al trasladar desde
  un origen concreto, el operario indica si también queda allí material o ya no queda.
  Nunca se eliminan por ese movimiento todas las otras asociaciones de la OF.
- Se pueden mover uno o varios pallets a una misma ubicación. Las relecturas no
  duplican seleccionados y se puede quitar cualquiera antes de confirmar. Se valida
  el conjunto antes de guardar; los que ya estén en destino no generan otro traslado.
- «Quitar lectura», «Volver» e «Inicio» permiten corregir la selección pendiente.
  No borran contenido confirmado. Tras una operación guardada se limpian selecciones
  e historial de navegación pendiente y se vuelve a Inicio con el aviso de resultado.
- Dividir y fusionar redistribuye asociaciones sin cantidades y conserva la historia.
  Retirar o vaciar sólo afecta al soporte señalado, con confirmación; permite reutilizar
  su misma identidad y distinguir el contenido actual de los usos anteriores.
- Mover un pallet cambia la ubicación de todo el contenido. Se rechazan destinos
  incompatibles para el mismo soporte, incluido un cierre de OT con varias OF.
- Una OF terminada sigue siendo localizable mientras conserve asociaciones. El cierre
  de una OT o el estado terminado de la OF no vacían automáticamente su pallet.
- Al finalizar una OT se confirman pallets y ubicación antes de completar el cierre.
  Es válido confirmar que el destino no cambia. Se preservan los controles nativos de
  fabricación, calidad y permisos. El resultado debe ser transaccionalmente coherente.
- En cierres de varias OT se propone destino común y se permiten excepciones por OF,
  incluso varios pallets. La misma OF no se presenta repetida por cada una de sus OT.
- Deben inventariarse las rutas reales de cierre individual, múltiple, tablet,
  anidados y lotes. No se da por hecho que sobrescribir un método cubre todas.
- Sin conexión se conservan las lecturas para reintentar, sin anunciar éxito ni prometer
  sincronización desconectada. Si se pierde la respuesta de un guardado posible, el
  reintento recupera el resultado de esa operación sin ejecutarla dos veces.
- El diseño seguirá la marca CMP ya incorporada en la demo: vista limpia y centrada,
  iconos visibles con etiquetas, controles táctiles grandes y texto operativo breve.
- El lector Eyoyo EY-032 usado por Rubén se empareja por Bluetooth con el iPhone. Se
  conserva el enfoque de entrada como teclado HID y las comprobaciones físicas de su
  configuración. La cámara es otra vía; no sustituye el lector ni garantiza su firmware.
- Los QR actuales de OF deben verificarse con los informes activos. No se buscará una
  OF arbitraria a partir de un código de producto que pueda corresponder a varias.
- Los operarios autorizados crean pallets, reimprimen y trasladan. Los responsables
  mantienen ubicaciones y corrigen incidencias mediante operaciones auditadas.
- Se conserva la elección de impresión portátil desde PDA, pero su transporte y
  equipo siguen pendientes de prueba física; una reimpresión no crea otro soporte.

### Identidad y permisos

Las PDA compartidas usan una cuenta Odoo autorizada y el PIN nativo del empleado para
identificar al operario. La auditoría registra ambas identidades. Si el PIN está vacío,
el operario lo crea y confirma una sola vez, con 4 a 8 dígitos; si existe se verifica
sin sobrescribirlo. El restablecimiento corresponde a responsables con los permisos
nativos de RRHH. Se conservan cinco fallos antes de un bloqueo de cinco minutos y
perfiles con límite de ocho horas, ligados a usuario, sesión y compañías.

El PIN no amplía permisos de negocio. No se crean usuarios de pago ni se elevan permisos
para resolver identidad. Una cuenta compartida no debe permitir hacerse responsable
sólo eligiendo otro empleado: la política de roles se valida en servidor. Cambiar
operario cancela o descarta explícitamente lo pendiente del anterior. No se registran
PIN ni secretos en la auditoría. La infraestructura de identidad existente en OdooClaw
es una referencia que debe revisarse; este diseño no afirma que pueda importarse sin
adaptación ni autoriza acoplar toda esa aplicación a Pallets.

### Orden de trabajo previsto

1. **Preparar la tarea en Git.** Frontend en el Git independiente de `cmp-pallets`;
   addon dentro de `odoo-cmp-custom`, con rama y worktree de tarea. Revisar qué base
   permite desarrollar el módulo nuevo y probarlo con la integración local vigente.
   No fusionar en bloque integración a `main` ni tocar ramas de los ocho PR existentes.
2. **Presentar y validar el esquema concreto.** Resolver nombres y almacenamiento
   auxiliar, revisar colisiones y dependencias y mostrar a Rubén el modelo antes de
   crear archivos funcionales, conforme a las instrucciones del entorno.
3. **Construir el addon por capas.** Estructura y manifiesto, modelos y secuencia,
   relaciones, restricciones, seguridad e historial. `mrp` es la dependencia funcional
   central; otras dependencias se justifican tras revisar la identidad y las rutas de
   cierre reales. No añadir todas las personalizaciones CMP por comodidad.
4. **Añadir la consulta Odoo.** OF y OT muestran pallets y ubicaciones con acceso
   restringido según permisos; responsables administran el catálogo. Revisar el campo
   anterior de última ubicación sin eliminarlo o migrarlo automáticamente.
5. **Definir y probar las operaciones autenticadas.** Resolver códigos, consultar,
   crear, asociar, retirar, trasladar varios pallets y auditar. Compartir validaciones
   entre las entradas de Odoo y la web. Probar idempotencia y concurrencia.
6. **Construir React conservando la demo.** Reutilizar comportamiento y marca
   validados, con servicio API separado de los datos ficticios. No dar por hecha una
   migración a React: el código actual es JavaScript modular sin framework.
7. **Integrar los cierres de OT.** Implementar y probar las entradas inventariadas y
   los destinos comunes con excepciones. Una primera fase de modelos no equivale a
   haber terminado este requisito del alcance completo.
8. **Preparar el despliegue de pruebas.** Verificar quién gestiona DNS/proxy/TLS,
   resolver `pallets.cmp3.es`, preparar el servicio React y el encaminamiento limitado
   a Odoo de pruebas. Validar desde PC y iPhone en CMP/VPN. No actuar sobre el oficial.
9. **Revisar e integrar por etapas verificadas.** Documentar, ejecutar hooks y pruebas
   y aplicar las autorizaciones de commit, push, instalación y despliegue que existan
   para cada etapa. Terminar la entrevista no ejecuta esas operaciones.

### Criterios de aceptación para la implementación

- Dos altas simultáneas y altas múltiples generan códigos distintos. Se comprueba el
  cambio de año, el relleno mínimo, ausencia de reciclaje e identidad estable al copiar,
  reutilizar o reimprimir un soporte. No se usa una comprobación previa como única
  protección contra duplicados concurrentes.
- Dos códigos de ubicación equivalentes tras la normalización se rechazan; dos nombres
  iguales con códigos distintos son válidos. Se prueba también el archivo de registros.
- Una OF asociada a tres pallets muestra los tres y sus ubicaciones en React, OF y OT.
  Agregar un cuarto no retira los anteriores. Quitar el último muestra el estado vacío.
- Repetir la misma asociación no duplica presencia ni genera otra operación idéntica por
  el mismo identificador de petición. Dos OF del mismo producto se resuelven sin elegir
  una arbitrariamente al leer códigos ambiguos.
- El traslado entre pallets conserva o retira sólo el origen indicado según decisión
  del operario. Se prueban división, fusión, vaciado y preservación de la historia.
- El traslado múltiple permite quitar selecciones y valida todos los registros antes
  de guardar. Un código inválido o sin permiso impide resultados parciales. Se cubren
  destinos ya coincidentes, fallos de red y cambios concurrentes.
- Cambiar la ubicación se refleja en todas las OF del pallet, sin movimientos de stock
  generados por la localización ni actualización destructiva de datos anteriores.
- El cierre de OT exige destino confirmado y preserva el comportamiento nativo. Se
  prueban todas las entradas reales, calidad, errores, lotes con excepciones y varias
  OT de la misma OF. Una OF terminada conserva material registrado hasta su retirada.
- Cambios de operario, sesión y compañía no cruzan pendientes o identidades. Usuarios
  sin permiso no leen ni escriben registros aunque conozcan el QR. Se verifican los
  límites de PIN y que el historial no admita edición por el operario.
- React sólo indica éxito tras confirmación del servidor y vuelve a Inicio sin pallets
  ni OF seleccionados. El lector no confirma cambios al enviar Enter o Tab. Se prueban
  retroceso, retirada de lecturas, lector físico y cámara por HTTPS en iPhone.
- `pallets.cmp3.es` funciona desde PC y móvil en CMP/VPN con certificado confiable,
  sesión válida y reautenticación controlada. No depende de una cuenta ChatGPT/Sites
  ni de que exista previamente una cookie del dominio de Odoo.
- Se valida impresión y lectura físicas con la impresora elegida antes de dar por
  implementada la impresión portátil.
- Se ejecutan las pruebas nativas Odoo del módulo en un entorno de pruebas preparado,
  las de la interfaz y las de integración necesarias. Las pruebas actuales de la demo
  no acreditan esta nueva conexión. No se sustituyen por comprobaciones de sintaxis.

## Hechos verificados

- La guía de organización mantiene dos Git independientes: el frontend en
  `/home/rubenfernandez/CMP/cmp-pallets` y los addons en
  `doodba-cmp/odoo/custom/src/odoo-cmp-custom`.
- El worktree del frontend es
  `/home/rubenfernandez/CMP/worktrees/cmp-pallets/desarrollo`, rama `dev/local`,
  base revisada `2519722`. Allí se guarda este diseño, sin editar la base estable.
- Los módulos tienen un worktree `desarrollo`, rama `dev/local`, base revisada
  `91ab295`; la instancia carga explícitamente `integracion/local`. No se ha
  seleccionado aún la base definitiva ni creado la rama del addon nuevo.
- La demo actual es JavaScript modular bajo `dist/`, usa datos ficticios en
  `localStorage` y no tiene backend Odoo. React es el destino acordado para la
  aplicación conectada, no una descripción del código que ya está desplegado.
- El diseño anterior conserva los requisitos de cierre de OT, historial, PIN,
  impresión, división/fusión y conexión confirmada. No se volvieron a preguntar.
- En las personalizaciones revisadas, `cmp_mrp_custom/models/mrp_production.py`
  declara `last_production_location` como texto y `mrp_workorder.py` lo consulta por
  `production_id`. No representa el conjunto plural de pallets propuesto.
- El código base revisado de `mrp.workorder` tiene una relación `production_id`
  obligatoria a `mrp.production`. No hace falta inventar ese enlace para consultar
  los pallets de la OF.
- No se encontraron definiciones de `mrp.package` ni `mrp.package.location` en el
  worktree de módulos propios revisado. Falta verificar el registro efectivo y las
  dependencias instaladas antes de crear modelos; esta búsqueda no demuestra que
  ningún otro addon del entorno pueda definirlos.
- `getent ahostsv4 rubenfernandez.cmp3.es` resolvió a `192.168.1.110` desde este
  Ubuntu. No se ha demostrado resolución en el iPhone, alcance externo, certificado
  actual ni configuración del proxy que atiende ese dominio.
- Los contenedores locales revisados publican Odoo mediante el proxy Doodba en
  puertos `16069` y `16072`. No se ha identificado ni modificado el servicio que
  recibe el dominio solicitado en HTTP/HTTPS.
- La implementación local de `ir.sequence` tiene `padding`, `use_date_range` y
  generación por intervalos. Puede comprobarse también en el
  [código oficial de Odoo 16](https://github.com/odoo/odoo/blob/16.0/odoo/addons/base/models/ir_sequence.py).
- La [documentación del ORM de Odoo 16](https://www.odoo.com/documentation/16.0/developer/reference/backend/orm.html)
  respalda las relaciones y restricciones propuestas y advierte de los límites de
  encadenar relaciones múltiples en campos relacionados.
- La [documentación de getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
  exige un contexto seguro para acceder a la cámara. HTTPS y el permiso del usuario
  deben probarse en el dominio real; Bluetooth HID y cámara son entradas diferentes.
- Esta entrevista sólo ha creado su sesión local y el documento de diseño. No se ha
  instalado el addon, cambiado DNS/proxy/Compose, reiniciado servicios, copiado base o
  filestore, publicado código ni modificado las ramas de los PR existentes.

## Riesgos

- **Confundir interfaz independiente con datos independientes.** La aplicación React
  se despliega aparte, pero sigue dependiendo de Odoo para datos y permisos. Un corte
  de Odoo no permite registrar movimientos como si ya estuvieran guardados.
- **Sesión entre dominios.** No se hereda por suposición la cookie de Odoo. Hay que
  preparar autenticación, proxy y protección de escrituras y probar la caducidad real.
- **DNS sin servicio o sin certificado.** Un registro DNS sólo resuelve un nombre.
  Faltan el servicio web, HTTPS confiable y las rutas necesarias. La IP de un entorno
  WSL no debe fijarse sin revisar su estabilidad y el encaminamiento del anfitrión.
- **Unicidad global y compañías.** El contador debe ser compatible con códigos únicos
  globales; no se crearán secuencias por compañía que emitan identidades iguales. Las
  restricciones no deben filtrar información de otra compañía en mensajes de error.
- **Año y concurrencia.** Una política de fecha incoherente o un contador calculado con
  búsquedas puede crear errores al cambiar de año o ante altas simultáneas. Se probará
  la secuencia nativa con restricción de unicidad; los huecos no se tratarán como fallo.
- **Material sin cantidades.** El sistema registra presencia. No puede decidir cuánto
  material se trasladó ni saber si queda en origen; depende de la confirmación física.
- **OT sin asignación propia.** No se distingue la localización de subconjuntos de una
  misma OF por etapa. El historial de OT no convierte ese alcance en seguimiento por OT.
- **Reutilización y archivo.** Vaciar mal un pallet puede dejar asociaciones antiguas.
  Archivar una ubicación o soporte no debe hacer desaparecer material de las consultas.
- **Reintentos y concurrencia.** Es insuficiente bloquear el botón del navegador: el
  servidor debe evitar duplicar operaciones y detectar revisiones que ya no sean válidas.
- **Cierres heterogéneos.** No se garantiza el requisito obligatorio de destino hasta
  revisar y probar todas las entradas de finalización y sus personalizaciones nativas.
- **PIN y cuenta compartida.** Identificar a un empleado no concede los permisos de
  otro usuario. Reutilizar código de OdooClaw sin comprobar aislamiento puede atribuir
  operaciones a otro operario o acoplar innecesariamente ambas aplicaciones.
- **Etiquetas y hardware.** Un QR de producto puede ser ambiguo para identificar una
  OF. La foto del lector no valida el firmware ni una impresión portátil genérica.
- **Integración Git y esquema local.** El `main` personal y la integración de módulos
  contienen diferencias previas. No se resuelven fusionándolos en bloque ni tocando
  las ramas de los ocho PR. La instalación nueva requiere revisar el esquema de prueba.

## Pendiente o aplazado

- **Desarrollo por capas.** Este documento es el resultado de diseño solicitado.
  El siguiente paso es revisar y validar el esquema concreto y preparar la tarea del
  addon en su worktree; terminar la entrevista no ha ejecutado esa implementación.
- **Rama base y pruebas Odoo.** Antes del primer archivo funcional se revisarán el
  registro efectivo, las colisiones de campos/modelos y la base apropiada. No se carga
  automáticamente el worktree de desarrollo ni se ejecuta `-u all`.
- **Infraestructura del dominio.** Se concretarán DNS de CMP, destino estable,
  responsable del proxy, certificado y acceso VPN cuando se prepare el despliegue.
  La decisión de dirección y acceso ya está cerrada; falta demostrar su configuración.
- **Autenticación e identidad compartida.** Se revisará qué parte de la verificación
  nativa puede compartirse sin depender de todo OdooClaw. Se reabre el diseño técnico
  si la interfaz disponible no permite el aislamiento acordado.
- **Resolución de QR real.** Se reabre con etiquetas e informes activos y registros
  autorizados de prueba. No se usarán datos reales en la demo pública ni en Git.
- **PDA e impresora portátil.** Siguen pendientes de elección y prueba de impresión y
  lectura completas. El iPhone con Eyoyo permite probar el flujo, pero no decide la
  impresora industrial ni su integración.
- **Material por etapa independiente.** Se reabre Q1 sólo si aparece la necesidad de
  localizar subconjuntos de una OF de forma independiente para cada OT.
- **Acceso directo desde Internet.** Fuera de esta fase. Reabrir Q3 si hace falta usar
  datos móviles sin VPN; antes revisar autenticación, exposición y operación del servicio.
- **Producción oficial.** No forma parte de esta entrevista ni del primer despliegue.
  La instancia actual es de pruebas, restaurada del oficial. Se conserva la instrucción
  de no copiar base ni filestore por la organización anterior; aquí tampoco se han copiado.

## Hilos abiertos

No quedan preguntas funcionales abiertas en esta entrevista: las seis fueron respondidas
y Rubén envió Finish. La preferencia de Q6 reemplaza expresamente la propuesta inicial
de compartir el dominio de Odoo por `pallets.cmp3.es`. El encaminamiento de API y la
autenticación descritos son propuestas técnicas pendientes de verificación, no un
despliegue probado. Los pendientes concretos están enumerados arriba y no equivalen
a una nueva autorización de instalación, publicación o intervención en producción.
