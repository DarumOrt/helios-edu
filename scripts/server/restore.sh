#!/usr/bin/env bash
# Восстановление рабочего сервера из копии (scripts/server/backup.sh). ТЕКУЩИЕ ДАННЫЕ ЗАМЕНЯЮТСЯ данными копии.
#   bash scripts/server/restore.sh /var/backups/heliosedu/20261114-030000 --yes
# Версия сайта должна быть та же, на которой снята копия (она записана в version.txt внутри копии):
# сначала выкладка этой версии, потом восстановление.
set -euo pipefail
cd "$(dirname "$0")/../.."
compose() { bash scripts/server/compose.sh "$@"; }
src=${1:-}
[ -s "$src/db.dump" ] && [ -s "$src/mail-keys.tar" ] || { echo "Укажите папку копии: в ней должны быть db.dump и mail-keys.tar"; exit 1; }
[ "${2:-}" = "--yes" ] || { echo "Текущие данные будут заменены копией $src. Для подтверждения добавьте --yes"; exit 1; }
src=$(cd "$src" && pwd)

echo "== останавливаю сайт"
compose stop caddy web api >/dev/null

echo "== база"
compose up -d db >/dev/null
for _ in $(seq 1 60); do compose exec -T db pg_isready -U helios -d helios_edu >/dev/null 2>&1 && break; sleep 1; done
compose exec -T db dropdb -U helios --if-exists --force helios_edu
compose exec -T db createdb -U helios -O helios helios_edu
compose exec -T db pg_restore -U helios -d helios_edu --no-owner < "$src/db.dump"

echo "== ключи почты"
api=$(compose ps -aq api)
image=$(docker inspect -f '{{.Config.Image}}' "$api")
docker run --rm -i --volumes-from "$api" --user 0 --entrypoint sh "$image" -c \
  'find /var/helios-mail-keys -mindepth 1 -delete && tar -C /var/helios-mail-keys -xf - && chown -R "$APP_UID:$APP_UID" /var/helios-mail-keys' \
  < "$src/mail-keys.tar"

if [ -s "$src/storage.tar" ]; then
  echo "== файлы"
  storage=$(compose ps -aq storage)
  image=$(docker inspect -f '{{.Config.Image}}' "$storage")
  compose stop storage >/dev/null
  docker run --rm -i --volumes-from "$storage" --entrypoint sh "$image" -c \
    'find /data -mindepth 1 -delete && tar -C /data -xf -' < "$src/storage.tar"
else
  echo "== файлов в копии нет (копия без файлов): хранилище не трогаю"
fi

echo "== запускаю"
compose up -d >/dev/null
echo "ГОТОВО: данные из $src. Проверьте вход на сайт."
