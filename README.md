# CMP Pallets — demo de lector QR

Prototipo independiente con datos ficticios. Muestra OFs, contenido de pallets y ubicaciones. No se conecta a Odoo ni realiza movimientos de inventario. Acceso público sin cuenta. El estado sigue en localStorage con la clave original; los cambios no se comparten entre teléfonos u ordenadores.

## Uso con Eyoyo por Bluetooth e iPhone

1. Emparejar el lector con iOS. Configurarlo según su manual en teclado HID, envío inmediato y sufijo Enter (o Tab). No usar carga de códigos acumulados ni modo SPP/BLE de integración propietaria.
2. Abrir el enlace HTTPS en Safari y mantener esa página activa. El campo `inputmode="none"` recibe teclado externo sin solicitar teclado táctil; se vuelve a enfocar tras lecturas y acciones. Si iOS no admite el enfoque automático, tocar el campo una vez. La página no puede verificar si el Bluetooth está conectado.
3. Escanear OF/26/0042: muestra producto y pallets. Leer más OFs prepara una selección sin duplicados. Escanear P202600001: propone asociar y requiere confirmar.
4. Tras confirmar se muestra el pallet y su contenido. Escanear LOC-CALIDAD: propone el traslado completo y requiere confirmar. Las OFs que también estén en otros pallets conservan esos enlaces.
5. También funciona en orden pallet → OF o ubicación → pallet. Pallet → pallet acumula una selección para traslado conjunto. Las relecturas del mismo pallet no lo duplican. «Inicio» descarta la selección y las propuestas sin confirmar. «Volver» recupera el paso anterior; tras guardar vuelve a Inicio, sin deshacer datos confirmados.
6. Para consultar algo sin iniciar una propuesta desde el registro activo, pulsar «Inicio». «Datos de prueba» permite simular las lecturas pulsando las etiquetas.

El colector acepta eventos de texto de iOS y Enter/Tab, filtra CRLF y, si no hay sufijo, sólo resuelve un código conocido tras 600 ms de pausa. Ante códigos desconocidos no borra la selección. La repetición inmediata del mismo código se ignora durante 1 segundo. Mientras existe propuesta, se debe confirmar o cancelar antes de leer más. Sólo el botón de confirmación aplica cambios; el Enter del lector no lo activa.

La compatibilidad depende de que el lector envíe el texto correcto como teclado. Si `/` u otros símbolos salen distintos, revisar idiomas de teclado de iOS/lector. La foto identifica EY-032 pero no permite comprobar su configuración o firmware. No se utiliza Web Bluetooth, WebHID ni se solicitan permisos de dispositivo al navegador.

## Cámara y etiquetas

`/codigos` contiene los QR sintéticos y una hoja imprimible. El QR de acceso abre la demo; las etiquetas contienen texto. Con cámara, usar «Usar cámara» para cada lectura y permitir acceso HTTPS. jsQR procesa la imagen localmente; se cierran las pistas al leer, cancelar, ocultar pestaña o salir. «Escribir código» ofrece teclado táctil.

## Estructura

- `dist/domain.mjs`: datos ficticios y operaciones OF ↔ pallet; modelo y almacenamiento conservados.
- `dist/workflow.mjs`: decide qué consultar o proponer según los códigos sucesivos. Confirmación separada de lectura.
- `dist/navigation.mjs`: historial de pasos sin guardar; Volver e Inicio. Al confirmar se limpia el historial anterior para no restaurar propuestas antiguas.
- `dist/hid.mjs`: colector de texto del lector, terminadores y control de parciales.
- `dist/app.mjs`: interfaz, enfoque y conexiones entre lector, cámara y operaciones.
- `dist/camera.mjs`: lectura de cámara con jsQR.
- `dist/brand/`: tokens y assets originales CMP, usados sin alterar el logotipo.

«Mover pallets» está visible en Inicio; desde una ficha, «Mover pallet» incorpora ese pallet a la selección. Permite escanear o elegir uno o varios pallets, después escanear o elegir la ubicación común y confirmar una sola vez. También se acumulan leyendo varios pallets directamente desde Inicio. Cada seleccionado muestra «Quitar», incluso si sólo hay uno. Quitar desde la confirmación vuelve a la selección y exige elegir de nuevo el destino. «Quitar lectura» de la OF sigue retirándola de su selección; ninguna de estas acciones elimina contenido ya guardado.

Los pallets que ya estén en destino se indican y no generan un traslado adicional. Si todos están allí, se rechaza la operación. Se valida todo el grupo antes de crear el nuevo estado y se guarda una sola vez: códigos o destino inválidos no mueven parcialmente el grupo. El contenido OF ↔ pallet se conserva. Tras confirmar varios pallets se muestra la ubicación destino con sus pallets; tras uno, su ficha.

La demo abarca consulta, asociación y localización. OTs, PIN e impresión portátil pertenecen al diseño completo anterior y no se implementan aquí. Reiniciar sólo afecta a datos de prueba del navegador. Si el almacenamiento falla, el cambio queda en memoria y se indica.

## Marca

Se incorpora `tokens/cmp.css` y el logotipo negativo, favicon e icono de aplicación de [CMP-TIC/cmp-brand](https://github.com/CMP-TIC/cmp-brand), commit `64a4c9b90d576e55dfbd4c333a7a89e9692f3729`, guía 1.0 de Eduardo Sanz (2026-10-26). Cabecera grafito, línea roja 3 px, rojo CMP para acciones, fuentes del sistema y componentes según la guía. La copia de tokens se mantiene literal; los ajustes propios están en `dist/style.css`.

## Validación y operación

`node --test tests/*.test.mjs`

Incluye decodificación real de todos los QR y versiones giradas, conservación de asociaciones y ubicaciones derivadas, estados de escaneo en ambos órdenes, cancelación y bloqueo de propuestas, navegación atrás e Inicio, retirada de lecturas, traslado de uno o varios pallets, validación conjunta y destinos parcialmente coincidentes, entrada HID con/sin sufijo, CRLF y ciclo de vida de cámara.

Sin build ni dependencias remotas. Para servir localmente: `python3 -m http.server 4183 --directory dist`. La cámara móvil exige HTTPS; para probar físicamente se utiliza el enlace publicado. El estado privado del navegador no se sube a la publicación.

La prueba con iPhone físico y lector emparejado debe realizarse en ese dispositivo; las pruebas automatizadas no verifican hardware. No hay backend ni logs de negocio remotos. Si una publicación falla se conserva la versión anterior hasta completar el despliegue; cada versión queda vinculada a su commit fuente.

## Dependencias

Distribuciones npm jsqr 1.4.0 (Apache-2.0) y qrcode-generator 1.4.4 (MIT), verificadas contra integridad del registro. Licencias en `dist/vendor/`. Sin CDN en ejecución.

## Vista de trabajo y versión anterior

Vista centrada con iconos SVG locales grandes y etiquetas, acceso directo a cámara, asociación de OFs y traslado de pallets. «Asociar OFs» prepara la pantalla para la misma secuencia de lectura existente. El catálogo de pallets está plegado en Inicio y la ayuda, etiquetas y datos de prueba se agrupan en «Opciones de prueba». Los controles de Volver, Inicio y Quitar continúan visibles en sus pantallas. No cambia la clave de almacenamiento ni las operaciones de negocio.

La versión anterior (4, commit `c1de498`) permanece guardada en Sites y tiene una copia fuente independiente. Identificadores y recuperación documentados en [docs/versiones.md](docs/versiones.md). Iconos en `dist/icons.mjs` y ajustes de esta vista en `dist/workspace.css`; los tokens CMP originales se conservan.
