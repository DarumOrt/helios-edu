#!/usr/bin/env bash
# Копия данных рабочего сервера: база, ключи почты и файлы (курсы, работы студентов).
#   bash scripts/server/backup.sh             полная копия; хранилище файлов на время копирования останавливается
#   bash scripts/server/backup.sh --no-files  только база и ключи (быстро, без остановки) — так делает выкладка
# Копии лежат в BACKUP_DIR (по умолчанию /var/backups/heliosedu), старше BACKUP_KEEP_DAYS дней удаляются.
# Копия на том же сервере не спасает от потери сервера: задайте BACKUP_UPLOAD_CMD (docs/deploy.md → «Копии»).
set -euo pipefail
cd "$(dirname "$0")/../.."
compose() { bash scripts/server/compose.sh "$@"; }
setting() { sed -n "s/^$1=//p" .env | tail -n 1; }

dir=$(setting BACKUP_DIR); dir=${dir:-/var/backups/heliosedu}
keep=$(setting BACKUP_KEEP_DAYS); keep=${keep:-14}
upload=$(setting BACKUP_UPLOAD_CMD)
out="$dir/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$out"
chmod 700 "$dir" "$out"

# База: формат pg_dump -Fc (сжатый, восстанавливается pg_restore).
compose exec -T db pg_dump -U helios -d helios_edu -Fc > "$out/db.dump"
# Ключи почты: без них пароль SMTP и письма в очереди из базы не прочитать.
compose exec -T api tar -C /var/helios-mail-keys -cf - . > "$out/mail-keys.tar"
sed -n 's/^HELIOS_VERSION=//p' .version > "$out/version.txt"

if [ "${1:-}" != "--no-files" ]; then
  # Файлы копируем при остановленном хранилище, иначе копия может получиться битой.
  storage=$(compose ps -aq storage)
  image=$(docker inspect -f '{{.Config.Image}}' "$storage")
  compose stop storage >/dev/null
  trap 'compose start storage >/dev/null' EXIT
  docker run --rm --volumes-from "$storage" --entrypoint tar "$image" -C /data -cf - . > "$out/storage.tar"
  compose start storage >/dev/null
  trap - EXIT
fi

# Пустой файл — признак сбоя: такую копию не оставляем.
for file in "$out"/db.dump "$out"/mail-keys.tar; do
  [ -s "$file" ] || { echo "ОШИБКА: пустой файл $file"; rm -rf "$out"; exit 1; }
done
echo "Копия: $out ($(du -sh "$out" | cut -f1))"

if [ -n "$upload" ]; then
  $upload "$out"
  echo "Копия отправлена: $upload"
fi
find "$dir" -mindepth 1 -maxdepth 1 -type d -mtime +"$keep" -exec rm -rf {} +
