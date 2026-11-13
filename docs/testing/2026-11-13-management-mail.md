# Проверка управления курсами, CSV и SMTP — 13.11.2026

## Реализовано

- Несколько групп в карточке нового и существующего курса, поиск, снятие назначений, общий контент.
- Серверный CSV-импорт: UTF-8/BOM, разделители, mapping, preview, частичные ошибки, отчёты,
  защита повторного импорта, перевод существующих студентов и одноразовые приглашения.
- SMTP: зашифрованный пароль, STARTTLS/SSL, проверка, тестовое письмо, настройки автособытий.
- Рассылки: выбор пользователей/групп/всех с подтверждением, HTML+текст, предпросмотр,
  дедупликация, очередь PostgreSQL, статусы, безопасные ошибки, retry и ограничения скорости.

## База и API

Миграция `20261113124812_BulkImportAndMail` добавляет пять таблиц, не изменяя прежние учебные данные.
Many-to-many курсов и групп уже существовала; миграция связей не нужна.
Контракт API, формат CSV с примером, настройка SMTP и ограничения —
[руководство](../backend/bulk-import-mail.md), решение — [ADR 0002](../adr/0002-mail-outbox.md).

## Результаты

- `npm run check`: 55 модульных тестов, проверка типов, ESLint и Prettier.
- `npm run build` внутри штатного Dockerfile: успешно, без предупреждений сборки Next.
  На Windows локальная попытка встретила недоступность Google Fonts, затем сбой дочернего процесса Turbopack;
  исходный код для обхода этой проблемы не меняли.
- Серверная Release-сборка, locked NuGet restore, применение миграций к отдельной PostgreSQL: успешно.
- Все 140 прежних серверных тестов — C# и Next.js, в порядке CI с перезапусками API: успешно.
- 10 новых серверных тестов: три группы/общий курс/права, CSV и повторные запросы,
  SMTP, отправка, дедупликация, одновременная активация, постоянная и временная ошибка,
  автоматические события, отзыв ссылок. Дополнительно проверены одновременные PATCH назначений
  и ограничение скорости очереди при двух экземплярах API.
- OpenAPI и TypeScript перегенерированы из работающего API; новые ответы сверены в `contract.ts`.
- Браузер: вход администратора, раздел SMTP, форма CSV, выбор группы и предпросмотр рассылки с количеством
  получателей. Ошибок JavaScript при проверке страницы импорта нет.
- Проведено read-only ревью прав, миграции, активации и конкурентных операций; замечания исправлены.

## Что требуется после слияния

1. Развернуть миграцию, пересобрать API и сайт.
2. Задать `MAIL_PUBLIC_URL` (HTTPS в production), сохранить и резервировать `mail_keys` вместе с БД.
3. Ввести SMTP в разделе администратора, проверить подключение и тестовое письмо.
4. Выбрать автоматические уведомления. При необходимости загрузить CSV-шаблон и провести preview.

Реальные SMTP-доступы отсутствуют: внешний провайдер и доставка в ящики не проверены.
Студент по прежнему состоит в одной группе; явный выбор изменения группы при импорте переводит его.
История интерфейса — последние 100 рассылок, в БД сохраняется целиком.
SMTP-подтверждение не равно доставке; неизвестная после аварии отправка автоматически не повторяется.

## Изменённые и новые файлы

### Изменены

- `.env.example`
- `.github/workflows/ci.yml`
- `.gitignore`
- `backend/Dockerfile`
- `backend/HeliosEdu.Api/Audit/AuditLog.cs`
- `backend/HeliosEdu.Api/Auth/AuthEndpoints.cs`
- `backend/HeliosEdu.Api/Data/LearningDbContext.cs`
- `backend/HeliosEdu.Api/HeliosEdu.Api.csproj`
- `backend/HeliosEdu.Api/Management/CohortEndpoints.cs`
- `backend/HeliosEdu.Api/Management/CourseEndpoints.cs`
- `backend/HeliosEdu.Api/Migrations/LearningDbContextModelSnapshot.cs`
- `backend/HeliosEdu.Api/Program.cs`
- `backend/HeliosEdu.Api/packages.lock.json`
- `backend/README.md`
- `compose.yaml`
- `docs/STATUS.md`
- `docs/api/openapi.json`
- `docs/modules/admin.md`
- `docs/modules/auth.md`
- `scripts/test-backend.sh`
- `src/app/(app)/admin/courses/page.tsx`
- `src/app/(app)/admin/layout.tsx`
- `src/app/(app)/admin/users/page.tsx`
- `src/app/api/courses/[id]/route.ts`
- `src/app/api/courses/route.ts`
- `src/features/admin/api.ts`
- `src/features/admin/components/CourseDialog.tsx`
- `src/mocks/cohorts-store.ts`
- `src/proxy.ts`
- `src/shared/auth/management.test.ts`
- `src/shared/auth/management.ts`
- `src/shared/auth/permissions.test.ts`
- `src/shared/auth/permissions.ts`
- `src/shared/lib/audit-labels.ts`
- `src/shared/lib/backend.ts`
- `src/shared/lib/management-validation.test.ts`
- `src/shared/lib/management-validation.ts`
- `src/shared/types/api.gen.ts`
- `src/shared/types/contract.ts`
- `src/shared/types/domain.ts`

### Созданы

- `backend/HeliosEdu.Api/Mail/MailEndpoints.cs`
- `backend/HeliosEdu.Api/Mail/MailEvents.cs`
- `backend/HeliosEdu.Api/Mail/MailModels.cs`
- `backend/HeliosEdu.Api/Mail/MailService.cs`
- `backend/HeliosEdu.Api/Mail/MailWorker.cs`
- `backend/HeliosEdu.Api/Management/CourseGroups.cs`
- `backend/HeliosEdu.Api/Management/CsvImport.cs`
- `backend/HeliosEdu.Api/Migrations/20261113124812_BulkImportAndMail.Designer.cs`
- `backend/HeliosEdu.Api/Migrations/20261113124812_BulkImportAndMail.cs`
- `backend/tests/bulk-mail.test.mjs`
- `compose.testing.yaml`
- `docs/adr/0002-mail-outbox.md`
- `docs/backend/bulk-import-mail.md`
- `docs/testing/2026-11-13-management-mail.md`
- `src/app/(app)/admin/mail/page.tsx`
- `src/app/(app)/admin/mail/settings/page.tsx`
- `src/app/(app)/admin/users/import/page.tsx`
- `src/app/activate/page.tsx`
- `src/app/api/auth/activate/route.ts`
- `src/app/api/mail/[[...path]]/route.ts`
- `src/app/api/users/import/[[...path]]/route.ts`
- `src/features/admin/components/CheckList.tsx`
- `src/features/admin/components/ImportUsers.tsx`
- `src/features/admin/components/Mailings.tsx`
- `src/features/admin/components/ServerAdmin.tsx`
- `src/features/admin/components/SmtpSettings.tsx`
- `src/features/admin/import-csv.test.ts`
- `src/features/admin/import-csv.ts`
- `src/features/admin/mail.ts`

