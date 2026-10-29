# Entrada de CMP Pallets en CMP/VPN

Preparación local verificada el 29 de octubre de 2026. El DNS y el proxy HTTPS
central todavía requieren la configuración del responsable de red.

## Datos concretos

| Elemento | Valor |
| --- | --- |
| URL de entrada | `https://pallets.cmp3.es` |
| Registro DNS interno A | `pallets.cmp3.es` → `192.168.1.110` |
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

Crear la entrada HTTPS para `pallets.cmp3.es`, con certificado válido para los
navegadores de CMP, y dirigir **todas sus rutas** al destino HTTP anterior. Incluye
los archivos estáticos y `/api/`; el contenedor local ya encamina las rutas limitadas
necesarias hacia Odoo. No enviar `/api/` a otro dominio ni a otro upstream.

Preservar `Host: pallets.cmp3.es`, enviar `X-Forwarded-Proto: https` y conservar la
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

- Resolución de `pallets.cmp3.es` a 192.168.1.110 desde CMP y VPN.
- Certificado confiable y carga de React por HTTPS desde PC e iPhone.
- Inicio de sesión, empleado y PIN, consulta de una OF y cierre/cambio de operario.
- Lectura con Eyoyo y permiso de cámara en el iPhone real.

El destino no es el servidor Vite 4184. La demo Sites anterior continúa separada y
no se ha modificado con este despliegue.
