#!/usr/bin/env bash
# Выкладка версии на рабочем сервере (запускает GitHub Actions «Выкладка на сервер», руками — только при аварии):
#   bash scripts/server/deploy.sh 0.1.0
# Порядок: копия базы → скачать образы версии → запустить → дождаться, что сайт и API отвечают.
# Откат — та же команда с прежним номером версии (база при этом не откатывается, см. docs/deploy.md).
set -euo pipefail
cd "$(dirname "$0")/../.."
version=${1:-}
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Номер версии — три числа через точку, например 0.1.0"; exit 1; }
compose() { bash scripts/server/compose.sh "$@"; }

# Копия перед выкладкой: новая версия может изменить структуру базы. При первом запуске базы ещё нет.
if [ -f .version ] && [ -n "$(compose ps -q db 2>/dev/null)" ]; then
  echo "== копия базы перед выкладкой"
  bash scripts/server/backup.sh --no-files
fi

previous=$(sed -n 's/^HELIOS_VERSION=//p' .version 2>/dev/null || true)
echo "== версия ${previous:-—} → $version"
# Скачиваем до переключения: если образов этой версии нет, работающий сайт не трогаем.
HELIOS_VERSION=$version compose pull --quiet
# Откуда образы (форк организации) — запоминаем вместе с версией: копии и перезапуски берут их из .version.
images=${HELIOS_IMAGES:-$(sed -n 's/^HELIOS_IMAGES=//p' .version 2>/dev/null || true)}
echo "HELIOS_VERSION=$version" > .version
if [ -n "$images" ]; then echo "HELIOS_IMAGES=$images" >> .version; fi
compose up -d --remove-orphans

echo "== жду, пока сайт и API ответят"
for _ in $(seq 1 90); do
  if compose exec -T web wget -q -O /dev/null http://api:8080/api/health/ready 2>/dev/null &&
     compose exec -T web wget -q -O /dev/null http://127.0.0.1:3000/api/health 2>/dev/null; then
    docker image prune -f >/dev/null
    echo "ГОТОВО: работает версия $version"
    exit 0
  fi
  sleep 2
done
echo "ОШИБКА: версия $version не поднялась. Последние строки журнала:"
compose logs --tail 60 api web
[ -n "$previous" ] && echo "Вернуть прежнюю: выкладка версии $previous с выключенной сборкой образов"
exit 1
