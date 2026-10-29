#!/bin/sh
set -eu

: "${CMP_ODOO_UPSTREAM:?Missing Odoo upstream}"
: "${CMP_ODOO_DB:?Missing Odoo database}"
case "$CMP_ODOO_UPSTREAM" in
  *[!a-zA-Z0-9._:-]*|'') echo 'Invalid Odoo upstream' >&2; exit 1 ;;
esac
case "$CMP_ODOO_DB" in
  *[!a-zA-Z0-9_-]*|'') echo 'Invalid Odoo database' >&2; exit 1 ;;
esac
if [ "$CMP_ODOO_DB" != "$(cat /opt/cmp/build-db)" ]; then
  echo 'The compiled frontend and proxy must use the same database' >&2
  exit 1
fi
mkdir -p /tmp/client-body /tmp/proxy /tmp/fastcgi /tmp/uwsgi /tmp/scgi
envsubst '${CMP_ODOO_UPSTREAM} ${CMP_ODOO_DB}' < /opt/cmp/nginx.conf.template > /tmp/cmp-nginx.conf
nginx -t -c /tmp/cmp-nginx.conf
if [ "${1:-}" = "--check" ]; then exit 0; fi
exec nginx -c /tmp/cmp-nginx.conf -g 'daemon off;'
