#!/usr/bin/env bash
# C# без установленного .NET SDK: сборка и миграции в контейнере mcr.microsoft.com/dotnet/sdk:10.0.
#   bash scripts/dotnet.sh build              — сборка (предупреждения = ошибки, как в Dockerfile)
#   bash scripts/dotnet.sh migration <Имя>    — новая миграция EF Core в backend/HeliosEdu.Api/Migrations
# Папки bin/obj после запуска удаляются: их создаёт контейнер (Linux), локальной сборке они не нужны.
# Одновременно запускать не больше одного раза — папка проекта общая.
set -euo pipefail
cd "$(dirname "$0")/../backend"
# Git Bash на Windows переписывает пути вида /src — для docker это нужно отключить
export MSYS_NO_PATHCONV=1
SRC="$(pwd -W 2>/dev/null || pwd)"
run() {
  docker run --rm -v "$SRC:/src" -w /src/HeliosEdu.Api \
    -e ConnectionStrings__Database="Host=x;Database=x;Username=x;Password=x" \
    mcr.microsoft.com/dotnet/sdk:10.0 bash -c "$1; status=\$?; rm -rf bin obj; exit \$status"
}
case "${1:-}" in
  build)
    run "dotnet build -nologo -v q 2>&1 | grep -E 'error|warn|Build succeeded' | sed 's|/src/HeliosEdu.Api/||' | sort -u; test \${PIPESTATUS[0]} -eq 0"
    ;;
  migration)
    name="${2:?Укажите имя миграции: bash scripts/dotnet.sh migration ИмяМиграции}"
    run "dotnet tool install -g dotnet-ef --version 10.0.4 >/dev/null && export PATH=\$PATH:/root/.dotnet/tools && dotnet restore >/dev/null && dotnet ef migrations add $name"
    ;;
  *)
    echo "Использование: bash scripts/dotnet.sh build | migration <Имя>" >&2
    exit 2
    ;;
esac
