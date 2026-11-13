# Модуль «admin» — пользователи, группы, карточки курсов, настройки, журнал действий

Устав и отчёт модуля (≤40 строк). Сессия модуля читает этот файл вместо истории; в конце задачи обновляет
«Готово», «Ловушки», «Что осталось». Общие файлы (см. AGENTS.md → «Модули») — не трогать, а описать правку здесь
в «Для основной сессии».

## Зона
- C#: `backend/HeliosEdu.Api/Management/`, `Mail/`, `Audit/AuditEndpoints.cs`, `Audit/AuditModels.cs`
- Next: `src/features/admin/`, `src/app/(app)/admin/`, `src/app/api/users|cohorts|settings|audit|mail/`,
  `src/shared/auth/management.ts`, `src/shared/lib/management-validation.ts`, моки users/cohorts/settings/audit
- Тесты: `backend/tests/management.test.mjs`, `settings.test.mjs`, `audit.test.mjs`, `bulk-mail.test.mjs`

## Контракт
- `docs/backend/p1-management.md`, `docs/backend/p3-p4-notes.md`, удаление и сброс пароля — `p8-trash-accounts.md`,
  импорт и почта — `bulk-import-mail.md`

## Проверки модуля
`npm test -- management` · `bash scripts/dotnet.sh build` · тесты бэкенда (management/settings/audit/bulk-mail) — только через `npm run test:backend` у основной сессии

## Готово
- Общий курс назначается нескольким группам из карточки, старые связи и результаты сохраняются
- CSV: mapping, preview, частичные ошибки, отчёт, повторы по email/UUID, одноразовые приглашения
- SMTP и рассылки: настройки без раскрытия пароля, аудитория, предпросмотр, история, очередь и автособытия
- Пользователи, группы и состав, курсы; организатор не трогает администраторов
- Настройки в C# (неизвестные поля — 400), журнал с «было → стало», фильтрами и страницами
- Удаление (обезличивание) и сброс пароля в диалоге пользователя

## Ловушки
- SMTP/импорт — только admin и режим «Сервер»; нужен `MAIL_PUBLIC_URL` и резервная копия volume `mail_keys`
- `AuditLog.Write` вызывать до `SaveChanges` изменения; новые коды действий — в `AuditLog.cs` и `audit-labels.ts` (общие)

## Что осталось
- Почта: проверить доставку через настоящий ящик; `Message-Id` сейчас `…@helios.invalid` — риск спама,
  взять домен отправителя
- Рассылка — 1 письмо в секунду с новым подключением на каждое (1000 писем ≈ 20 минут): держать соединение
- История рассылок (`GET /api/mail/campaigns`) читает всех получателей 100 рассылок — считать в базе
- Обязательное ревью и CODEOWNERS в защите `main` (решение команды)

## Для основной сессии
—
