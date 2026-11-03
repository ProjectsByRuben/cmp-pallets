#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker compose -f compose.yaml -p cmp-pallets config --quiet
container=$(docker compose -f compose.yaml -p cmp-pallets ps -q web)
if [ -n "$container" ]; then
    python3 deploy/save_runtime.py "$container"
    current_image=$(docker inspect --format '{{.Image}}' "$container")
    if ! docker image inspect "$current_image" --format '{{.Id}}' > /dev/null 2>&1; then
        : "${CMP_PREVIOUS_IMAGE:?Running image is missing; provide a verified rebuilt image for rollback}"
        current_image=$CMP_PREVIOUS_IMAGE
        docker image inspect "$current_image" --format '{{.Id}}' > /dev/null
    fi
    docker image tag "$current_image" cmp-pallets-web:previous
fi
docker compose -f compose.yaml -p cmp-pallets build
docker compose -f compose.yaml -p cmp-pallets run --rm --no-deps web --check
docker compose -f compose.yaml -p cmp-pallets up -d --wait
python3 deploy/check_service.py
