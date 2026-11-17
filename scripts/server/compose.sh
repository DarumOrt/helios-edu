#!/usr/bin/env bash
# docker compose для рабочего сервера: подставляет compose.prod.yaml, настройки (.env) и номер версии (.version).
#   bash scripts/server/compose.sh ps
#   bash scripts/server/compose.sh logs --tail 100 api
set -euo pipefail
cd "$(dirname "$0")/../.."
[ -f .env ] || { echo "Нет файла .env — скопируйте .env.prod.example в .env и заполните"; exit 1; }
args=(-f compose.prod.yaml --env-file .env)
[ -f .version ] && args+=(--env-file .version)
exec docker compose "${args[@]}" "$@"
