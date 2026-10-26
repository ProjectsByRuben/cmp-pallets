# Pallets — demo de cámara para iPhone

Prueba móvil guiada con datos ficticios. No llama a Odoo ni a otro backend. Las imágenes de cámara se procesan localmente con jsQR 1.4.0 y se descartan. Los cambios se conservan en localStorage sólo en ese navegador; no se comparten entre teléfonos, ordenador o perfiles.

## Probar

1. Abrir el enlace HTTPS publicado en Safari del iPhone. El sitio es privado y puede pedir iniciar sesión con la cuenta propietaria de ChatGPT.
2. Abrir `/codigos.html` en el ordenador o imprimir la hoja. Su QR de acceso abre la demo; los QR de etiquetas contienen texto, no enlaces.
3. Escanear OF/26/0042 desde la propia demo, continuar al pallet, escanear P202600001 y confirmar. Consultar el contenido.
4. Mover ese pallet escaneando LOC-CALIDAD y confirmar. La OF se localizará en Control de calidad. Sus asociaciones en otros pallets se conservan.
5. Reiniciar prueba vuelve al estado inicial. Los datos y permisos Odoo reales no se utilizan.

La cámara requiere HTTPS, permiso del navegador y un dispositivo con cámara. Se solicita la cámara trasera y se incluye `playsinline` para Safari. Se cierran las pistas al terminar la lectura, cancelar, cambiar de pestaña o salir. La entrada manual sirve para comprobar el flujo sin cámara.

## Alcance

Esta demo está centrada en agrupar, consultar y reubicar mediante QR. El prototipo de entrevista y el diseño completo de OTs, PIN e impresión se conservan separados. Aquí no se autentica un empleado, no se cierran OTs y no se imprime mediante una impresora portátil.

El lector acepta sólo los códigos sintéticos de la hoja; no intenta interpretar QR reales de la empresa. La lectura del QR no guarda una agrupación o un traslado hasta que se confirma el resumen.

## Comprobaciones

`node --test tests/*.test.mjs`

Incluye lectura de matrices QR reales con jsQR (también rotadas), asociaciones de una OF en varios pallets, idempotencia de contenido, rechazo de códigos ajenos, derivación de ubicaciones, validación de estado y cancelación de permisos de cámara pendientes.

## Dependencias incorporadas

Se incluyen las distribuciones exactas de npm de jsqr 1.4.0 (Apache-2.0) y qrcode-generator 1.4.4 (MIT), verificadas contra la integridad del registro. Los archivos y avisos de licencia están en `dist/vendor/`. No hay dependencias de CDN durante la prueba.

La prueba en un iPhone físico sigue siendo necesaria para confirmar la cámara y el enfoque en ese dispositivo. La comprobación de sintaxis o una cámara simulada no acreditan acceso a hardware real.
