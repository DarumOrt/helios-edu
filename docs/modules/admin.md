# Модуль «admin» — пользователи, группы, карточки курсов, настройки, журнал действий

Устав и отчёт модуля (≤40 строк). Сессия модуля читает этот файл вместо истории; в конце задачи обновляет
«Готово», «Ловушки», «Что осталось». Общие файлы (см. AGENTS.md → «Модули») — не трогать, а описать правку здесь
в «Для основной сессии».

## Зона
- C#: `backend/HeliosEdu.Api/Management/`, `Audit/AuditEndpoints.cs`, `Audit/AuditModels.cs`
- Next: `src/features/admin/`, `src/app/(app)/admin/`, `src/app/api/users|cohorts|settings|audit/`,
  `src/shared/auth/management.ts`, `src/shared/lib/management-validation.ts`, моки users/cohorts/settings/audit
- Тесты: `backend/tests/management.test.mjs`, `settings.test.mjs`, `audit.test.mjs`

## Контракт
- `docs/backend/p1-management.md`, `docs/backend/p3-p4-notes.md`, удаление и сброс пароля — `p8-trash-accounts.md`

## Проверки модуля
`npm test -- management` · `bash scripts/dotnet.sh build` · тесты бэкенда (management/settings/audit) — только через `npm run test:backend` у основной сессии

## Готово
- Пользователи, группы и состав, курсы; организатор не трогает администраторов
- Настройки в C# (неизвестные поля — 400), журнал с «было → стало», фильтрами и страницами
- Удаление (обезличивание) и сброс пароля в диалоге пользователя

## Ловушки
- `AuditLog.Write` вызывать до `SaveChanges` изменения; новые коды действий — в `AuditLog.cs` и `audit-labels.ts` (общие)

## Что осталось
- Обязательное ревью и CODEOWNERS в защите `main` (решение команды)

## Для основной сессии
—
