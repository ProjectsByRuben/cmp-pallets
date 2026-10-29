# CMP Pallets

El proyecto contiene dos entradas independientes: **la aplicación React con acceso
real a Odoo**, activa en CMP/VPN, y **la demo de lector QR** conservada en `dist/`.
La demo publicada en Sites no se ha sustituido ni conectado a datos reales.

## Servicio compilado para CMP/VPN

El 29 de octubre de 2026 se preparó el proyecto Docker independiente **cmp-pallets**,
servicio `web`, contenedor `cmp-pallets-web-1`. Sirve una compilación de React mediante
Nginx en **`http://192.168.1.50:4180`**, destino interno para el proxy de entrada.
Tiene reinicio `unless-stopped`, usuario sin privilegios, imagen con sistema de
archivos de sólo lectura y temporales en memoria. No monta el código de desarrollo:
editar `src/` no cambia esta versión hasta volver a compilar y desplegar.

La URL operativa es **`https://pallets.cmp3.es`**, con DNS y HTTPS configurados en
192.168.1.110 y servicio local comprobado por la IP LAN. Su
API exige el hostname y marcador HTTPS del proxy y no admite iniciar sesión entrando
directamente por la IP HTTP. La ruta `/healthz` sí responde `200` y `ok` para comprobar
la conexión interna. El puerto 4184 sigue siendo sólo el desarrollo local con Vite.

Los datos exactos y el ejemplo para el responsable de red están en
[deploy/PARA_CONFIGURAR_DNS_Y_PROXY.md](deploy/PARA_CONFIGURAR_DNS_Y_PROXY.md).
El equipo debe seguir encendido con Docker Desktop en ejecución. Su IP actual es
192.168.1.50 y conviene que permanezca reservada. El reinicio automático del contenedor
actúa cuando Docker está disponible, no enciende el ordenador ni inicia Windows.

Operación desde `/home/rubenfernandez/CMP/cmp-pallets`:

```bash
# Compilar, validar la configuración, desplegar y comprobar el servicio.
./deploy/up.sh

# Ver estado y logs (sin cuerpos JSON ni parámetros de URL).
docker compose -f compose.yaml -p cmp-pallets ps
docker compose -f compose.yaml -p cmp-pallets logs --tail 50 web

# Detener exclusivamente Pallets.
docker compose -f compose.yaml -p cmp-pallets stop web

# Volver a la imagen que estaba ejecutándose antes de la última actualización.
./deploy/rollback.sh
```

`up.sh` conserva una referencia `cmp-pallets-web:previous` a la imagen en ejecución
antes de actualizar. Es una etiqueta del código compilado, no una copia de la base
ni del filestore. No se elimina ninguna imagen automáticamente. `rollback.sh` requiere
que exista esa referencia anterior. La compilación usa dependencias bloqueadas e
imágenes base fijadas por digest. El runtime no necesita Node ni el servidor Vite.

Dentro de Docker Desktop, Nginx conecta únicamente las rutas autorizadas con
`host.docker.internal:16069`; el proyecto no depende de los nombres o redes Compose
de Doodba. Odoo tiene ahora `PROXY_MODE=true` en su configuración de infraestructura
validada para reconocer el esquema HTTPS enviado por el proxy. No se ha cambiado
la base, usuarios, PIN, filestore o código de OdooClaw por este despliegue.

La configuración incluye CSP, cámara restringida al propio origen, cookies Secure /
HttpOnly / SameSite=Lax, rechazo de Origin ajeno y ausencia de caché en API. El proxy
central debe preservar Host y X-Forwarded-Proto, mantener el acceso CMP/VPN y dirigir
todas las rutas de ese dominio a 4180. La publicación de Sites permanece separada.

`python3 deploy/check_service.py` verifica el servicio sin contraseñas o PIN: versión
compilada, cabeceras, rutas limitadas, bloqueo del acceso HTTP a API y sesión anónima
de Odoo simulando las cabeceras HTTPS de entrada. También pasó contra
`--url http://192.168.1.50:4180`. La configuración Nginx pasó su comprobación nativa,
y las 3 pruebas HTTP/Chromium de regresión del addon pasaron con `proxy_mode=True`,
fixtures revertidos y limpieza de filestore desactivada. La prueba final del dominio,
certificado e iPhone queda pendiente de la configuración del proxy central.

## Aplicación React: acceso de operarios

La aplicación implementa la entrada (cuenta Odoo, empleado y PIN) y la consulta real
por QR de OF, pallet o ubicación. Después de identificar al operario abre **Escanear**.
Las asociaciones, creación de pallets y movimientos todavía no están conectados a
React; leer un QR en esta versión no modifica material. No se presentan las operaciones
simuladas de la demo como si fueran operaciones reales.

### Consulta real por QR

El Eyoyo actúa como teclado HID: escribe en el campo del lector y termina con Enter
o Tab, sin pulsar un botón. El campo recupera foco después de consultar, pulsar fuera
y volver a la ventana o pestaña. Si el lector empieza con un botón enfocado, se
recupera también su primer carácter. Se conserva la navegación por Tab y no se roba
foco a la entrada manual, cámara u otros campos editables. La pestaña debe estar
activa; el navegador no puede capturar texto enviado a otra aplicación.
El indicador es verde sólo cuando la página está activa y la casilla tiene foco;
pasa a naranja al salir de la ventana/pestaña, perder el foco o pausar el lector.
El texto distingue activar la página, seleccionar la casilla y lector en pausa.
Esto no verifica la conexión Bluetooth. También se admite entrada manual y cámara con el lector jsQR
local de la demo. La cámara requiere HTTPS en móvil, no sube imágenes y se detiene
al leer, cerrar, desmontar la vista u ocultar la pestaña.

Una referencia exacta de OF abre producto, estado, cantidad total de la OF, lote si
existe y sus pallets con ubicación. Esa cantidad no es una cantidad por pallet.
Un pallet muestra ubicación y OF visibles. Una ubicación muestra sus pallets.
Los elementos relacionados se pueden abrir pulsando su código. Volver consulta de
nuevo el registro anterior en Odoo; Inicio descarta la lectura y navegación sin
cambiar datos. Los resultados extensos se cargan en páginas de 50 con Ver más.

Se aceptan los QR existentes con referencia de OF, además de códigos de pallet y
ubicación; los prefijos `CMP:OF:`, `CMP:PALLET:` y `CMP:LOC:` identifican el tipo
cuando hace falta. No se adivina una OF por producto ni se abren URLs escaneadas.
Los códigos ambiguos, inexistentes o inaccesibles producen un aviso. Un error de
red retira el detalle para evitar mostrarlo como recién consultado. La identidad se
comprueba en servidor en cada lectura, sin elevar permisos de fabricación.

Requiere Node 24 o superior y el addon `cmp_mrp_packages` 16.0.1.5.0 instalado en
la instancia de pruebas `cmpslu`. Desde este worktree:

```bash
npm ci --ignore-scripts
npm run dev
```

Abrir **http://127.0.0.1:4184/** en el ordenador. El servidor escucha sólo en loopback;
este acceso no publica la aplicación ni sirve para entrar desde otro móvil. Se detiene
con Ctrl+C en la terminal que lo ejecuta. El futuro acceso CMP/VPN con HTTPS bajo
`pallets.cmp3.es` requiere su despliegue y configuración propios.

En un navegador nuevo, la aplicación prepara la selección de base mediante la entrada
nativa de Odoo y solicita la cuenta del equipo si aún no hay sesión. En cuentas
compartidas muestra únicamente empleados autorizados por el servidor y solicita su
PIN. Las cuentas personales usan su empleado vinculado sin un segundo PIN. Si no hay
empleados habilitados o la cuenta no está autorizada, muestra el bloqueo; no concede
permisos ni elige a otra persona automáticamente. Un responsable deberá asignar
Operario o Administrador a los empleados reales que vayan a utilizarla.

El PIN se crea y confirma sólo cuando el servidor indica que aún está vacío. Un PIN
existente nunca se reemplaza desde este formulario. Los errores se muestran sin
reintentar automáticamente una verificación, para no incrementar intentos por un
reintento invisible. Las contraseñas y los PIN se limpian tras el envío.

El token de identidad permanece **sólo en memoria de la pestaña**. No se guarda en
localStorage, sessionStorage ni en URL; recargar requiere volver a identificar al
operario. Cada pestaña inicia su propio perfil, incluso al duplicarla. La sesión de
cuenta Odoo utiliza su cookie nativa HttpOnly. Cambiar operario revoca sólo ese perfil;
Cambiar cuenta cierra la sesión de cuenta del origen de esta aplicación, afectando a
sus otras pestañas. La identidad se vuelve a validar al enfocar la pestaña y cada minuto;
las futuras operaciones deberán validarla de nuevo en servidor antes de ejecutarse.
Si falla la red, no se muestra una identidad como verificada ni se simula acceso.

### Fuentes, compilación y conexión

- `src/App.tsx`: formularios y estados de acceso, identificación y cambio de operario.
- `src/api.ts`: cliente JSON-RPC, preparación de sesión y envío del CSRF del servidor.
- `src/ScanWorkspace.tsx`: lector, detalles reales y navegación de consultas.
- `src/Camera.tsx`: ciclo de vida React del lector de cámara existente.
- `src/style.css`: vista responsive que reutiliza los tokens y el logo CMP de la demo.
- `vite.config.mts`: compilación y proxy local limitado a las rutas de acceso.
- `build/`: resultado generado por `npm run build`; está excluido de Git.
- `dist/`: demo histórica, mantenida como fuente y sin sobrescribir al compilar React.

El proxy de desarrollo apunta por defecto a `http://127.0.0.1:16069` y `cmpslu`.
`CMP_ODOO_TARGET` y `CMP_ODOO_DB` permiten configurar **otro entorno de pruebas
autorizado** al arrancar/compilar; no son credenciales. No se ha creado ni modificado
ningún archivo de secretos. El navegador utiliza sólo rutas del origen de la aplicación:

| Ruta de la aplicación | Destino limitado en Odoo |
| --- | --- |
| `/api/session/prepare` | `/web/login?db=cmpslu`, para seleccionar la base y establecer su sesión nativa. La respuesta HTML nunca se ejecuta ni se inserta en la página. |
| `/api/web/session/authenticate` | Autenticación nativa de la cuenta con la base configurada. |
| `/api/web/session/destroy` | Cierre nativo de la sesión de cuenta. |
| `/api/cmp_pallets/access/*` | Sólo bootstrap, unlock, setup_pin, profile y lock. |
| `/api/cmp_pallets/lookup` | Consulta autenticada de una OF, pallet o ubicación por código. |

El proxy conserva Host y Origin para las validaciones del addon; no habilita CORS ni
una API genérica de ejecución de métodos. El futuro proxy de producción debe reproducir
estas rutas limitadas, usar la misma base para preparación/autenticación y conservar
correctamente host/esquema HTTPS. `vite preview` o un servidor de archivos estáticos
por sí solos no configuran esta conexión. La cookie de otro dominio Odoo no se hereda
automáticamente: este origen debe establecer su propia sesión.

Se usan [React](https://react.dev/reference/react-dom/client/createRoot) y la
[configuración de proxy de Vite](https://vite.dev/config/server-options#server-proxy).
Las versiones de dependencias están fijadas en package.json y package-lock.json;
no se descarga código de CDN durante el uso de la aplicación.

### Validación del hito

```bash
npm test
npm run build
```

37 pruebas de React/cliente API cubren sesión ausente, selección, PIN incorrecto,
creación inicial, cancelación, envíos duplicados, aislamiento sin almacenamiento,
cambio de operario, revocación, fallo de red y contrato de cookies/CSRF, además de
entrada HID, navegación, consulta manual, respuestas tardías y paginación. Se ejecutan
además las 33 pruebas existentes de la demo. La conexión local se comprobó también
sin credenciales reales: preparación de `cmpslu` y respuesta SessionExpiredException
de Odoo a bootstrap anónimo, atravesando el proxy. La identificación autenticada
del backend y la resolución real se validaron en 80 pruebas nativas con empleados
sintéticos y comprobaciones HTTP de la ruta de consulta.
No se ha usado un empleado real para iniciar sesión en estas verificaciones.

La prueba física de iPhone/Eyoyo y las operaciones de modificación permanecen pendientes.

## Demo de lector QR conservada

Prototipo independiente con datos ficticios. Muestra OFs, contenido de pallets y ubicaciones. No se conecta a Odoo ni realiza movimientos de inventario. Acceso público sin cuenta. El estado sigue en localStorage con la clave original; los cambios no se comparten entre teléfonos u ordenadores.

## Uso con Eyoyo por Bluetooth e iPhone

1. Emparejar el lector con iOS. Configurarlo según su manual en teclado HID, envío inmediato y sufijo Enter (o Tab). No usar carga de códigos acumulados ni modo SPP/BLE de integración propietaria.
2. Abrir el enlace HTTPS en Safari y mantener esa página activa. El campo `inputmode="none"` recibe teclado externo sin solicitar teclado táctil; se vuelve a enfocar tras lecturas y acciones. Si iOS no admite el enfoque automático, tocar el campo una vez. La página no puede verificar si el Bluetooth está conectado.
3. Escanear OF/26/0042: muestra producto y pallets. Leer más OFs prepara una selección sin duplicados. Escanear P202600001: propone asociar y requiere confirmar.
4. Tras confirmar vuelve al Inicio y limpia todas las selecciones, manteniendo el aviso de guardado. Volver a escanear el pallet y después LOC-CALIDAD: propone el traslado completo y requiere confirmar. Las OFs que también estén en otros pallets conservan esos enlaces.
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

Los pallets que ya estén en destino se indican y no generan un traslado adicional. Si todos están allí, se rechaza la operación. Se valida todo el grupo antes de crear el nuevo estado y se guarda una sola vez: códigos o destino inválidos no mueven parcialmente el grupo. El contenido OF ↔ pallet se conserva. Tras cualquier asociación o traslado confirmado vuelve automáticamente al Inicio, sin OFs, pallets, destinos ni propuestas seleccionados. La siguiente lectura empieza una operación independiente.

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

## Repositorio y desarrollo

Repositorio privado: https://github.com/ProjectsByRuben/cmp-pallets.
El repositorio original y la carpeta de trabajo son
`/home/rubenfernandez/CMP/cmp-pallets`, rama `main`. Abrir
`CMP-Pallets.code-workspace` para web y addon juntos, o
`CMP-Pallets-Web.code-workspace` para la web sola. Ambos están en esta carpeta.
Es un Git independiente de Doodba y de OdooClaw. No crear worktrees ni ramas de
desarrollo para Pallets. La antigua carpeta `worktrees/cmp-pallets/desarrollo` se
retira tras verificar las rutas; las dependencias y el build locales se conservan
en el repositorio original. Guía de carpetas y tareas: [docs/organizacion.md](docs/organizacion.md).

El código publicado actualmente en Sites corresponde al commit `4570ef1`; los cambios
de organización y documentación no requieren volver a desplegar.
La demo sigue en https://cmp-pallets-iphone-demo.cmp-grupo-7773.chatgpt.site.
Guardar en GitHub no publica automáticamente en Sites. Para cambiar la demo,
validar las pruebas y desplegar las fuentes en el proyecto Sites existente.
La versión anterior se conserva según `docs/versiones.md`.

### Asociación OF → pallet preparada

En React, leer OFs añade una selección temporal (máximo 100); leer el pallet prepara
el destino. «Quitar» y «Cancelar selección» no escriben. Si falta ubicación, leer una
antes de «Confirmar asociación». Sólo el POST de confirmación escribe en Odoo.
Se conservan otros pallets y la ubicación existente. El éxito vuelve al inicio.
Un conflicto exige nuevas lecturas; una respuesta perdida conserva y bloquea la
propuesta para «Reintentar confirmación» con la misma identidad de petición.
El token y la propuesta viven en memoria por pestaña. Si se cierra o recarga la
pestaña antes de recibir respuesta, consultar el historial de Odoo para comprobar el
resultado antes de preparar otra operación.

Activado con autorización el 29/10/2026: addon `cmp_mrp_packages` 16.0.1.6.0
actualizado en cmpslu, Odoo reiniciado y `./deploy/up.sh` ejecutado correctamente.
HTTPS verificado en https://pallets.cmp3.es; el bundle servido coincide con el build
validado. La imagen anterior se conserva en `cmp-pallets-web:previous`. Se mantiene la lista limitada de rutas
API: no se expone RPC genérico. Pruebas: `npm test` y `npm run build`, más runner
nativo del addon. El despliegue debe comprobarse con `deploy/check_service.py`.

### Trabajo definitivo en main — 29/10/2026

Por instrucción de Rubén se trabaja directamente en `main`, en
`/home/rubenfernandez/CMP/cmp-pallets`. El contenedor web usa el `compose.yaml`
de esta carpeta. El addon se mantiene en su Git independiente dentro de Doodba.
No crear nuevas ramas de desarrollo ni PR para Pallets. Cada cambio se revisa,
prueba y guarda en main antes de publicarlo en ProjectsByRuben/cmp-pallets.
GitHub conserva el código; el despliegue del contenedor sigue siendo una acción
separada y debe seguir las autorizaciones de la conversación. La planificación
pendiente de selección flexible y ubicaciones se conserva sólo en local, fuera de
Git, en `/home/rubenfernandez/CMP/datos-locales/cmp-pallets/planificacion/`.

### Selección flexible y traslados activos

El nuevo incremento conserva OFs, pallets y ubicación en cualquier orden de lectura.
Con varios pallets, elegir uno como destino de las OFs. Para ubicaciones, confirmar
el traslado de todo el grupo; los pallets ya ubicados allí no generan cambios ficticios.
Asociar y mover son acciones independientes. Ver
[selección y ubicaciones](docs/seleccion-y-ubicaciones.md) para uso y reintentos.
Activado con autorización de Rubén el 29/10/2026: addon 16.0.1.7.0 actualizado en
cmpslu, Odoo reiniciado y servicio web reconstruido. HTTPS, sesión y ruta de
movimiento comprobados en pallets.cmp3.es; el bundle servido coincide con el build.

### Códigos de pallet

Formato: **P26-00001**, P26-00002, etc., con año de dos cifras y contador anual.
El lector reconoce el formato nuevo con Enter, Tab y lectura sin sufijo; también
reconoce etiquetas antiguas cuando el servidor todavía conserve esos identificadores.
La actualización del addon convierte los tres pallets de pruebas con autorización
de Rubén, conservando sus registros e historial. Sus QR antiguos deben sustituirse.


## Crear pallets e imprimir QR

«＋ Crear pallet» solicita el siguiente código a Odoo y crea un pallet vacío. Si
hay una ubicación escaneada, puede aceptarse para el alta; las OFs se conservan en
la selección y se asocian después mediante la confirmación habitual. No se elige
manualmente el código. Ante una respuesta perdida, usar «Reintentar creación»;
la misma petición no crea un segundo pallet.

Al crear se abre su etiqueta. Al consultar un pallet activo, «Ver QR / Imprimir
etiqueta» permite reimprimir la misma identidad sin crear otro registro. El QR
contiene CMP:PALLET:<código>, con el código legible en grande; no contiene OFs,
ubicaciones cambiantes ni credenciales. La imagen se genera en el Odoo de pruebas
sin servicios externos y pasa por una ruta limitada con perfil y permisos nativos.

Por decisión de Rubén, inicialmente se imprime una etiqueta de 100 × 60 mm sobre
una hoja A4, con borde para recortar: escala 100 % y sin encabezados/pies. El diálogo
del navegador permite escoger la impresora conectada o guardar como PDF. «Descargar
QR» guarda sólo el PNG del QR. No se envían trabajos directamente a una impresora
ni se confirma su salida física. El formato para impresora de etiquetas dedicada
se definirá más adelante.
