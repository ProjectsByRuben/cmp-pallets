#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker image inspect cmp-pallets-web:previous --format '{{.Id}}' > /dev/null
docker image tag cmp-pallets-web:previous cmp-pallets-web:local
docker compose -f compose.yaml -p cmp-pallets up -d --no-build --force-recreate --wait web
python3 deploy/check_service.py
