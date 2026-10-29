#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker compose -f compose.yaml -p cmp-pallets config --quiet
container=$(docker compose -f compose.yaml -p cmp-pallets ps -q web)
if [ -n "$container" ]; then
    current_image=$(docker inspect --format '{{.Image}}' "$container")
    docker image tag "$current_image" cmp-pallets-web:previous
fi
docker compose -f compose.yaml -p cmp-pallets build
docker compose -f compose.yaml -p cmp-pallets run --rm --no-deps web --check
docker compose -f compose.yaml -p cmp-pallets up -d --wait
python3 deploy/check_service.py
