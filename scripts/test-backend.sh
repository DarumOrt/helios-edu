#!/usr/bin/env bash
# Все тесты бэкенда в порядке CI (.github/workflows/ci.yml) на отдельном стеке heliostest:
# своя база, хранилище и API; ваша база (стек heliosedu) только останавливается и потом запускается снова.
# Нужны: Docker, собранный Next (`npm run build`). Занимает 6–8 минут. Запускать по одному на машину.
#   npm run test:backend
# Подробный вывод каждого набора — в .test-backend/<набор>.log (папка в .gitignore).
set -u
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1
LOGS=.test-backend
mkdir -p "$LOGS"
export COMPOSE_PROJECT_NAME=heliostest
export TEST_WEB_URL=http://127.0.0.1:3100

wait_api() {
  for _ in $(seq 1 90); do curl -fsS http://127.0.0.1:8080/api/health/ready >/dev/null 2>&1 && return 0; sleep 1; done
  echo "API не поднялся"; return 1
}
restart_api() { docker compose -f compose.yaml -f compose.testing.yaml --profile backend restart api >/dev/null 2>&1; wait_api; }

if [ ! -f .next/standalone/server.js ]; then echo "Сначала: npm run build"; exit 1; fi

echo "== останавливаю ваш стек и поднимаю тестовый"
COMPOSE_PROJECT_NAME=heliosedu docker compose --profile backend stop api storage db >/dev/null 2>&1
docker compose -f compose.yaml -f compose.testing.yaml --profile backend down -v >/dev/null 2>&1
docker compose -f compose.yaml -f compose.testing.yaml --profile backend up -d --build db storage api 2>&1 | grep -iE " error" || true
wait_api || exit 1

echo "== типы из описания API"
node scripts/api-types.mjs && git --no-pager diff --stat -- docs/api/openapi.json src/shared/types/api.gen.ts

rm -rf .next/standalone/public .next/standalone/.next/static
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
BACKEND_API_URL=http://127.0.0.1:8080 HOSTNAME=127.0.0.1 PORT=3100 node .next/standalone/server.js > "$LOGS/next.log" 2>&1 &
NEXT_PID=$!
for _ in $(seq 1 30); do curl -fsS http://127.0.0.1:3100/api/health >/dev/null 2>&1 && break; sleep 1; done

failed=()
run() {
  node --test "backend/tests/$1" > "$LOGS/$1.log" 2>&1
  local pass fail
  pass=$(grep -oE "^ℹ pass [0-9]+" "$LOGS/$1.log" | grep -oE "[0-9]+")
  fail=$(grep -oE "^ℹ fail [0-9]+" "$LOGS/$1.log" | grep -oE "[0-9]+")
  printf "%-26s pass %-4s fail %s\n" "$1" "${pass:-?}" "${fail:-?}"
  [ "${fail:-1}" = 0 ] || failed+=("$1")
}

# порядок и перезапуски API (сброс лимита входов 60/мин) — как в ci.yml
run api.test.mjs
run auth.test.mjs
run lifecycle.test.mjs
run management.test.mjs
run course-builder.test.mjs
run adaptive.test.mjs
run catalog.test.mjs
run enrollment.test.mjs
restart_api
run grades.test.mjs
run notifications.test.mjs
run files.test.mjs
restart_api
run settings.test.mjs
run audit.test.mjs
run tracking.test.mjs
restart_api
run trash.test.mjs
run accounts.test.mjs
restart_api
run bulk-mail.test.mjs
run api.test.mjs

kill $NEXT_PID 2>/dev/null
docker compose -f compose.yaml -f compose.testing.yaml --profile backend down -v >/dev/null 2>&1
COMPOSE_PROJECT_NAME=heliosedu docker compose --profile backend start db storage api >/dev/null 2>&1
echo "== ваш стек снова запущен"
if [ ${#failed[@]} -eq 0 ]; then echo "ИТОГ: всё зелёное"; else echo "ИТОГ: упали — ${failed[*]} (подробно в $LOGS/)"; exit 1; fi
