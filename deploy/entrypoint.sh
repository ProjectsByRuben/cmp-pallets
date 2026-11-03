#!/bin/sh
set -eu

: "${CMP_ODOO_URL:?Missing Odoo HTTPS URL}"
: "${CMP_ODOO_DB:?Missing Odoo database}"
: "${CMP_APP_URL:?Missing application HTTPS URL}"

# Only root HTTPS URLs with DNS/IPv4 host and optional port. No credentials,
# paths, query strings or Nginx/JavaScript metacharacters are accepted.
parse_url() {
    case "$1" in https://*) authority=${1#https://} ;; *) echo 'Use an HTTPS URL' >&2; exit 1 ;; esac
    authority=${authority%/}
    case "$authority" in *[!a-zA-Z0-9.:-]*|'') echo 'Invalid HTTPS authority' >&2; exit 1 ;; esac
    parsed_host=${authority%%:*}
    case "$parsed_host" in *[!a-zA-Z0-9.-]*|'') echo 'Invalid HTTPS hostname' >&2; exit 1 ;; esac
    case "$authority" in *:*) parsed_port=${authority#*:} ;; *) parsed_port=443 ;; esac
    case "$parsed_port" in *[!0-9]*|''|0*|??????*) echo 'Invalid HTTPS port' >&2; exit 1 ;; esac
    if [ "$parsed_port" -lt 1 ] || [ "$parsed_port" -gt 65535 ]; then echo 'Invalid HTTPS port' >&2; exit 1; fi
    parsed_authority=$parsed_host
    if [ "$parsed_port" != 443 ]; then parsed_authority=$parsed_host:$parsed_port; fi
    parsed_origin=https://$parsed_authority
}
case "$CMP_ODOO_DB" in
  *[!a-zA-Z0-9_-]*|'') echo 'Invalid Odoo database' >&2; exit 1 ;;
esac
parse_url "$CMP_ODOO_URL"
CMP_ODOO_HOST=$parsed_host
CMP_ODOO_AUTHORITY=$parsed_authority
CMP_ODOO_UPSTREAM=$parsed_host:$parsed_port
CMP_ODOO_ORIGIN=$parsed_origin
parse_url "$CMP_APP_URL"
CMP_APP_HOST=$parsed_host
CMP_APP_AUTHORITY=$parsed_authority
CMP_APP_ORIGIN=$parsed_origin
CMP_APP_ALT_HOST_LINE=
if [ "$parsed_port" = 443 ]; then CMP_APP_ALT_HOST_LINE="\"$parsed_host:443|https\" 1;"; fi
export CMP_ODOO_HOST CMP_ODOO_AUTHORITY CMP_ODOO_UPSTREAM CMP_ODOO_ORIGIN
export CMP_APP_HOST CMP_APP_AUTHORITY CMP_APP_ORIGIN CMP_APP_ALT_HOST_LINE
if [ "$CMP_APP_ORIGIN" = "$CMP_ODOO_ORIGIN" ]; then echo 'Application and Odoo origins must be different' >&2; exit 1; fi
CMP_ENVIRONMENT=$(printf '%s\n%s\n%s' "$CMP_ODOO_ORIGIN" "$CMP_ODOO_DB" "$CMP_APP_ORIGIN" | sha256sum | cut -d ' ' -f 1)
export CMP_ENVIRONMENT
mkdir -p /tmp/client-body /tmp/proxy /tmp/fastcgi /tmp/uwsgi /tmp/scgi
printf 'window.CMP_CONFIG = {"database":"%s","backend":"%s","appOrigin":"%s","environment":"%s"};\n' "$CMP_ODOO_DB" "$CMP_ODOO_ORIGIN" "$CMP_APP_ORIGIN" "$CMP_ENVIRONMENT" > /tmp/runtime-config.js
envsubst '${CMP_ODOO_UPSTREAM} ${CMP_ODOO_HOST} ${CMP_ODOO_AUTHORITY} ${CMP_ODOO_ORIGIN} ${CMP_ODOO_DB} ${CMP_APP_HOST} ${CMP_APP_AUTHORITY} ${CMP_APP_ORIGIN} ${CMP_APP_ALT_HOST_LINE} ${CMP_ENVIRONMENT}' < /opt/cmp/nginx.conf.template > /tmp/cmp-nginx.conf
nginx -t -c /tmp/cmp-nginx.conf
if [ "${1:-}" = "--check" ]; then exit 0; fi
exec nginx -c /tmp/cmp-nginx.conf -g 'daemon off;'
