# AGENTS.md — правила проекта HeliosEDU

Единый источник правил для людей и ИИ-агентов (Codex читает этот файл, Claude Code — через `CLAUDE.md`).
Если правило меняется — меняем здесь, а не в чате.

## Проект

Учебная LMS (аналог Moodle / «Прометей») на стадии пилота: Next.js App Router + C# API и PostgreSQL,
четыре роли (student / tutor / organizer / admin), конструктор курсов, адаптивное обучение, трекинг,
оценки, хаб группы, файлы и почта. Демо отдельно работает на моках ПГГПУ (ИНЭК, М1227).
Интерфейс, комментарии и общение с владельцем — на русском, объяснения — простым языком.

## Начало и конец задачи (Codex и Claude Code)

- В начале прочитать `docs/STATUS.md` и нужные `docs/modules/<модуль>.md`, проверить ветку,
  `git status` и текущий diff. Различать состояние `main`, текущей ветки и опубликованного сайта.
  Сохранять чужие и незавершённые правки. Код читать по задаче, а не заново исследовать весь проект.
- В конце обновить состояние и непроверенное в `docs/STATUS.md` и отчёте затронутого модуля в том же PR.
  Для изменений рабочего процесса обновлять `docs/session-orchestration.md` и `docs/codex.md`.
  Проверить `npm run check` и `npm run build`; при изменении C# — `npm run build:backend`
  и перед PR `npm run test:backend`. Изменение контракта требует `npm run api:types`.
- Итог владельцу: что изменилось, как проверено, что не проверено, что потребуется после слияния.
  Не выдавать успешные тесты API за проверку интерфейса или настоящей доставки почты.
- Одна задача — один основной чат. Новая тема — новый чат с контекстом из файлов.
  Главный агент ведёт Git, зависимости, миграции, общие файлы и полные проверки.
  Дополнительные агенты — по явному запросу владельца; их границы — `docs/session-orchestration.md`.
- Владелец хочет сам пользоваться базовыми кнопками запуска и проверок. Оставлять команды и результат
  видимыми, объяснять первый запуск; не перекладывать на него обязательные проверки выполненной агентом работы.
- Слияние PR делает владелец после просмотра. Выкладка на рабочий сервер — отдельная задача по его запросу.
  Не включать автоматические выкладки, наблюдение за PR или ночные копии без нового решения.
- При работе с API Next.js сверять поведение с документацией установленной версии в
  `node_modules/next/dist/docs/`. Автогенерация блока правил Next отключена: общие инструкции ведём здесь.

## Стек (версии зафиксированы точно в package.json)

Node 24 LTS · npm 11 · Next.js 16 (Turbopack) · React 19 · TypeScript 6 · Tailwind CSS 4 · SWR · Zustand ·
ESLint 9 (flat config) · Prettier 3.

Бэкенд: ASP.NET Core (.NET 10) · EF Core · PostgreSQL. NuGet-версии — в
`backend/HeliosEdu.Api/HeliosEdu.Api.csproj` и `packages.lock.json`.

## Команды

```bash
npm ci              # установка строго по lock-файлу (не npm install!)
npm run dev         # http://localhost:3000
npm run check       # typecheck + lint + format:check + test — то же, что в CI
npm test            # модульные тесты (Vitest): права, валидация, формулы — рядом с кодом, *.test.ts
npm run api:types   # типы из описания C# API (нужен запущенный API) → docs/api/openapi.json, src/shared/types/api.gen.ts
npm run test:backend   # все тесты бэкенда в порядке CI на отдельном стеке (6–8 минут, по одному на машину)
npm run verify:backend # сборка Next + все тесты бэкенда (кнопка «Тесты API»)
npm run build:backend  # сборка C# через Docker; на Windows автоматически выбирается Git Bash
bash scripts/dotnet.sh build | migration <Имя>   # сборка C# и миграции без локального .NET (через Docker)
npm run lint:fix    # автоисправление ESLint
npm run format      # Prettier на весь проект
npm run build       # production-сборка
docker compose --profile backend up -d --build db storage api   # сервер: база, хранилище файлов, C# API
docker compose --profile web up --build                         # собранный сайт в Docker (только демо, по желанию)
node --test backend/tests/auth.test.mjs
```

**Definition of done:** `npm run check` и `npm run build` проходят без ошибок и предупреждений.

Кнопки Codex и порядок ручной работы — `docs/codex.md`. В PowerShell для `.sh` использовать
`node scripts/run-bash.mjs scripts/dotnet.sh migration <Имя>`: системный `bash` может вести в WSL.
Dev-сервер и сборку в одной рабочей копии не запускать одновременно. Тесты бэкенда и сборку C# —
по одному на всю машину: у рабочих копий общий локальный Docker-стек.

## Структура и границы слоёв

```
src/app/        маршруты (страницы + app/api — мок-бэкенд). Тонкие: собирают features.
src/features/   фичи (dashboard, courses, player, quiz, gradebook, submissions, analytics, hub, …)
src/shared/     ui-кит, auth (permissions, role-meta, RoleGate), lib, types, layout
src/stores/     zustand (session, ui)
src/mocks/      данные и in-memory stores (живут на globalThis, переживают HMR)
backend/HeliosEdu.Api/   C# API, серверные сессии, права, EF Core и миграции
backend/tests/          проверки API на настоящем PostgreSQL
```

- `shared` **не импортирует** `features` и `app` (проверяет ESLint). Исключение — `shared/layout`.
- Фича не лезет во внутренности другой фичи; общее — выносим в `shared`.
- Все данные — только через `/api/*` (API-first). Компоненты не импортируют `@/mocks` напрямую.
- Права интерфейса — через `shared/auth/permissions.ts` (`can`, `navForRole`) и `RoleGate`. Не проверять `role === "..."` в разметке там, где есть право.
- Серверные права — через `backend/HeliosEdu.Api/Auth/AccessRules.cs` и `RequireAuthorization`.
  Проверки интерфейса не заменяют серверные. Пользователь и роль берутся из серверной сессии,
  а не из `userId`, `role` в теле запроса или localStorage.
- Два источника данных — «Демо» (моки, вход выбором роли) и «Сервер» (C# API, вход по паролю).
  Текущий берётся только через `getDataSource()` из `shared/lib/backend.ts` (в `proxy.ts` — `resolveDataSource`),
  не через прямую проверку `process.env.BACKEND_API_URL`. Переключатель — cookie `helios-data-source`
  (`/api/data-source`). Без `BACKEND_API_URL` доступно только демо; `DEMO_MODE=off` запрещает демо.
  Приоритет новых возможностей — режим «Сервер»: их делаем в C# и PostgreSQL. Демо остаётся — в нём быстро
  смотреть интерфейс и дизайн без запуска сервера; то, что без сервера невозможно (например, загрузка файлов),
  показывает понятную заглушку «доступно в режиме „Сервер“», но не ломается. Полный переход на «Сервер» —
  когда сервис будет готов. `backendRequest` возвращает `null` в демо.
- Решения по архитектуре (что выбрали и почему) — в `docs/adr/`.
- Управление (пользователи, группы, курсы): один контракт для моков и C# — `features/admin/api.ts`,
  правила ролей — `shared/auth/management.ts`, поля — `shared/lib/management-validation.ts`.
  В серверном режиме маршруты Next пересылают запрос в C# (`backendForward`); пока эндпоинта нет — `501`.
  Задания для бэкенда с контрактом и тестами — `docs/backend/*.md`.
- Контракт Next ↔ C# проверяется типами: C# описывает ответы (`.Produces<T>()`, `/openapi/v1.json`),
  `npm run api:types` собирает `src/shared/types/api.gen.ts`, а `src/shared/types/contract.ts` сверяет его с `domain.ts`.
  Поменяли ответ в C# — перегенерируйте типы в том же PR; CI падает, если они устарели или разошлись с интерфейсом.
- Id модулей и материалов уникальны **только внутри курса** (исходные `a2`, `a3` повторяются в разных курсах).
  Всё, что ссылается на материал (вопросы тестов, сданные работы, аналитика урока), — по паре `courseId` + `activityId`.
  Новые id в конструкторе — глобально уникальные (`s-…`, `a-…`).
- Преподаватель может создавать свои курсы и управлять записью на них. Доступ студента объединяет назначенные
  группы и индивидуальную запись. Снятие индивидуальной записи сохраняет доступ по группе, оценки и работы
  ([ADR 0003](docs/adr/0003-course-enrollment.md)).
- Правила заявки на доступ — в `shared/lib/registration.ts` и `AuthEndpoints.ValidateRegistration` (C#).
  Заявитель указывает имя и почту. Роль назначает администратор или организатор, пароль устанавливается по приглашению.

## Модули и общие файлы

Состояние проекта и ключевые решения — `docs/STATUS.md`. Модуль — вертикальный срез (C# + Next + тесты);
у каждого файл `docs/modules/<модуль>.md`: зона, контракт, проверки, что сделано, ловушки, что осталось.

| Модуль | C# (`backend/HeliosEdu.Api/`) | Next (`src/`) | Тесты (`backend/tests/`) |
| --- | --- | --- | --- |
| auth | `Auth/` | `features/auth`, `app/login`, `app/register`, `app/activate`, `app/api/auth` | auth, lifecycle, accounts |
| admin | `Management/`, `Mail/`, `Audit/` | `features/admin`, `app/(app)/admin`, `app/api/users·cohorts·settings·audit·mail` | management, settings, audit, bulk-mail |
| courses | `Courses/`, `Files/` | `features/courses·course-builder·search`, `app/api/courses·catalog·files` | course-builder, catalog, files, trash, api |
| adaptive | `Adaptive/` | `features/adaptive`, моки adaptive | adaptive |
| grades | `Grades/`, `Notifications/` | `features/assignment·submissions·gradebook·notifications` | grades, notifications |
| learning | `Tracking/` | `features/player·analytics·hub·dashboard`, `shared/lib/tracking` | tracking |
| deploy | запуск на сервере | `compose.prod.yaml`, `Caddyfile`, `scripts/`, `docs/deploy.md` | — |
| e2e | — | `e2e/`, `docs/testing/` | Playwright (позже) |

**Общие файлы** меняет одна сессия за раз (параллельная правка = конфликт или «тихая» поломка контракта):
`LearningDbContext.cs` и `Migrations/`, `Program.cs`, `Auth/AccessRules.cs`, `Audit/AuditLog.cs` + `shared/lib/audit-labels.ts`,
`src/shared/types/domain.ts`, `contract.ts`, `api.gen.ts`, `docs/api/openapi.json`, `src/proxy.ts`,
`src/shared/auth/permissions.ts`, `src/shared/ui/`, `src/shared/layout/`, `src/app/globals.css`,
`.github/`, `compose.yaml`, `package.json` и lock-файл, `docs/STATUS.md`, `AGENTS.md`, `CLAUDE.md`.
Задачи, которым нужны одни и те же общие файлы, делаются по очереди, а не параллельно.

## Соглашения по коду

- Алиас импорта `@/…` → `src/…`. Типы — `import { type X }`.
- Серверное состояние — SWR (`fetcher` из `shared/lib/api-client`), клиентское — Zustand. Не дублировать данные API в Zustand.
- Next 16: `params`/`searchParams` — это `Promise` (в страницах `use(params)`, в route handlers `await params`).
  Вместо `middleware.ts` в Next 16 — `proxy.ts`.
- Tailwind 4: **нет `tailwind.config`**. Токены (цвета, радиусы, тени, анимации) — в `@theme` в `src/app/globals.css`.
  Цвета задаются CSS-переменными `--primary` и т. п. в `:root`. Градиенты — `bg-linear-to-*` (не `bg-gradient-to-*`).
- React (правила react-hooks v7):
  - не читать `ref.current` в рендере — для отображения держать `state`;
  - не вызывать `setState` синхронно в `useEffect` для «синхронизации с пропсами» — сбрасывать форму через `key`;
  - нечистые вызовы (`Date.now()`, `Math.random()`) — не в рендере (lazy `useState(() => …)` или эффект).
- `eslint-disable` — только точечно и с комментарием «почему».
- Правила (права, валидация, формулы) — с тестом рядом: `permissions.ts` → `permissions.test.ts`. Тексты ошибок в тестах
  совпадают с C#: меняя текст, меняйте и тест, и C#.
- Новые зависимости — только при реальной необходимости, с точной версией (`npm i -E`). Lock-файл не править руками.

## Git-процесс (работаем вдвоём + агенты)

- В `main` напрямую не пушим. Ветка → PR → зелёный CI → ревью человеком → squash merge.
- Имена веток: `feat/…`, `fix/…`, `chore/…`; агентские — с префиксом `codex/…` или `claude/…`.
- Коммиты в стиле Conventional Commits: `feat: …`, `fix: …`, `chore: …`, `refactor: …`.
- Одна задача — один коммит. Связанные задачи (например, исправления по одному отчёту) можно собрать
  в один PR — по коммиту на задачу, со списком задач в описании. Крупное (новая инфраструктура, перенос
  раздела в C#) — отдельным PR. Не смешивать рефакторинг/форматирование с фичей.
- Перед изменениями — обновить сведения `git fetch origin`. Чистый `main` обновлять через
  `git pull --rebase`; новую ветку создавать от актуального `origin/main`. В папке с незавершёнными
  правками не делать автоматический stash, reset или rebase; использовать подходящую отдельную рабочую копию.
  При конфликте в `package-lock.json` —
  взять версию из `main` и выполнить `npm install`, а не мержить файл руками.
- Коммиты от имени владельца подписывать его GitHub noreply-адресом; личную почту не публиковать.
  Не менять глобальную конфигурацию Git. Для второго разработчика сохранять его собственное авторство.
- Окончания строк — LF (`.gitattributes`). Не коммитить `.next/`, `*.tsbuildinfo`, `next-env.d.ts`, локальные настройки агентов.

## Чего не делать

- Не обновлять мажорные версии (Next, React, TypeScript, ESLint, Tailwind) в рамках фичи — отдельный PR.
  TypeScript ограничен `<6.1` (typescript-eslint), ESLint — 9.x (eslint-plugin-react / import ещё без поддержки 10).
- Не удалять и не перегенерировать `public/media/*` (демо-видео).
- Не добавлять реальные секреты, токены и персональные данные — только моки. Переменные окружения описывать в `.env.example`.
