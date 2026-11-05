# Entrada de CMP Pallets en CMP/VPN

Entrada original configurada el 29 de octubre de 2026; dominio de pruebas
actualizado a rubenpallets.cmp3.es y comprobado por HTTPS el 05/11/2026.
Este documento conserva los datos para mantenimiento o reinstalación.

## Datos concretos

| Elemento | Valor |
| --- | --- |
| URL de entrada | `https://rubenpallets.cmp3.es` |
| Registro DNS interno A | `rubenpallets.cmp3.es` → `192.168.1.110` |
| Proxy central existente | `192.168.1.110`, misma entrada que `rubenfernandez.cmp3.es` |
| Protocolo del destino | **HTTP** (el HTTPS termina en el proxy central) |
| IP del destino | **192.168.1.50** |
| Puerto del destino | **4180** |
| Destino completo | **`http://192.168.1.50:4180`** |
| Comprobación desde el proxy | `http://192.168.1.50:4180/healthz` debe responder `200` y `ok` |

Mantener reservada la IP 192.168.1.50 para este ordenador. El servicio depende de que
el equipo y Docker Desktop estén en ejecución. El contenedor reinicia automáticamente
cuando Docker vuelve a estar disponible, salvo que se haya detenido manualmente.

## Configuración a solicitar

Crear la entrada HTTPS para `rubenpallets.cmp3.es`, con certificado válido para los
navegadores de CMP, y dirigir **todas sus rutas** al destino HTTP anterior. Incluye
los archivos estáticos y `/api/`; el contenedor local ya encamina las rutas limitadas
necesarias hacia Odoo. No enviar `/api/` a otro dominio ni a otro upstream.

Preservar `Host: rubenpallets.cmp3.es`, enviar `X-Forwarded-Proto: https` y conservar la
dirección original del cliente en `X-Forwarded-For`. No almacenar en caché respuestas
de API ni retirar sus cookies. El servicio local fuerza cookies de sesión Secure,
HttpOnly y SameSite=Lax y rechaza API por un origen HTTP directo o un Origin ajeno.
El servidor Odoo local ya tiene `proxy_mode=True`.

Ejemplo del bloque de encaminamiento dentro del host HTTPS gestionado por el
responsable (el certificado y la escucha TLS se configuran en ese proxy):

```nginx
location / {
    proxy_pass http://192.168.1.50:4180;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_cache off;
    proxy_connect_timeout 5s;
    proxy_read_timeout 60s;
}
```

El acceso debe quedar dentro de CMP/VPN. El upstream 4180 es la conexión interna del
proxy; las credenciales de los usuarios se introducen en la URL HTTPS final. Enlazar
el DNS no basta para usar la aplicación: también se necesita el host HTTPS anterior.

## Comprobaciones finales tras configurar el dominio

- Resolución de `rubenpallets.cmp3.es` a 192.168.1.110 desde CMP y VPN.
- Certificado confiable y carga de React por HTTPS desde PC e iPhone.
- Inicio de sesión, empleado y PIN, consulta de una OF y cierre/cambio de operario.
- Lectura con Eyoyo y permiso de cámara en el iPhone real.

El destino no es el servidor Vite 4184. La demo Sites anterior continúa separada y
no se ha modificado con este despliegue.

## Destino Odoo tras el cambio del 03/11/2026

La entrada de Pallets descrita arriba sigue siendo la misma. El cambio es el salto
siguiente: el contenedor Pallets ahora llama por HTTPS a rubenfernandez.cmp3.es:443,
base cmpslu, con certificado verificado. CMP_ODOO_HOST configura el nombre TLS y Host.
La validación del Origin del navegador permanece en Pallets; sólo después de esa
validación se traduce al origen HTTPS del backend. Este proxy del dominio debe
conservar correctamente X-Forwarded-Proto. El destino no es odoo.cmp3.es.

## Variables simplificadas (revisión posterior del 03/11/2026)

Usar CMP_APP_URL para el dominio HTTPS de Pallets, CMP_ODOO_URL para la URL HTTPS raíz
del backend y CMP_ODOO_DB para su base. El arranque calcula upstream, puerto, TLS y
orígenes desde estas variables. Sustituyen los antiguos CMP_ODOO_HOST/UPSTREAM y la
base repetida en build.args. Cambios de configuración requieren recrear el contenedor,
sin recompilar React. La entrada del proxy central debe corresponder a CMP_APP_URL;
el addon sigue siendo necesario en cada Odoo destino.


## Separación de producción, 05/11/2026

Los datos anteriores corresponden a la web de pruebas del PC. El dominio
pallets.cmp3.es queda reservado para producción: su entrada independiente en el
proxy central apunta a http://192.168.1.239:4180, con Host pallets.cmp3.es y HTTPS.
No enviar el dominio de pruebas al servidor de producción ni intercambiar los
backends de los Compose. Producción configura https://odoo.cmp3.es y cmp_gim;
pruebas conserva https://rubenfernandez.cmp3.es y cmpslu. Cada dominio necesita
resolución DNS y certificado válidos. Recargar las pestañas al cambiar el origen.
