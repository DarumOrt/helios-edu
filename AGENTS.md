# AGENTS.md — правила проекта HeliosEDU

Единый источник правил для людей и ИИ-агентов (Codex читает этот файл, Claude Code — через `CLAUDE.md`).
Если правило меняется — меняем здесь, а не в чате.

## Проект

LMS-мокап (аналог Moodle / «Прометей»): Next.js App Router, мок-бэкенд в Route Handlers, ролевая модель
(student / tutor / organizer / admin), трекинг изучения видео/PDF/презентаций, хаб группы с лидербордом.
Данные — моки (ПНИПУ, факультет ИНЭК, группа М1217). Интерфейс и комментарии — на русском.

## Стек (версии зафиксированы точно в package.json)

Node 24 LTS · npm 11 · Next.js 16 (Turbopack) · React 19 · TypeScript 6 · Tailwind CSS 4 · SWR · Zustand ·
ESLint 9 (flat config) · Prettier 3.

Бэкенд: ASP.NET Core (.NET 10) · EF Core · PostgreSQL. NuGet-версии — в
`backend/HeliosEdu.Api/HeliosEdu.Api.csproj` и `packages.lock.json`.

## Команды

```bash
npm ci              # установка строго по lock-файлу (не npm install!)
npm run dev         # http://localhost:3000
npm run check       # typecheck + lint + format:check — то же, что в CI
npm run lint:fix    # автоисправление ESLint
npm run format      # Prettier на весь проект
npm run build       # production-сборка
docker compose up --build
docker compose --profile backend up -d --build db api
node --test backend/tests/auth.test.mjs
```

**Definition of done:** `npm run check` и `npm run build` проходят без ошибок и предупреждений.

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
  Любая новая фича должна работать в обоих режимах; `backendRequest` возвращает `null` в демо.
- Управление (пользователи, группы, курсы): один контракт для моков и C# — `features/admin/api.ts`,
  правила ролей — `shared/auth/management.ts`, поля — `shared/lib/management-validation.ts`.
  В серверном режиме маршруты Next пересылают запрос в C# (`backendForward`); пока эндпоинта нет — `501`.
  Задания для бэкенда с контрактом и тестами — `docs/backend/*.md`.
- Id модулей и материалов уникальны **только внутри курса** (исходные `a2`, `a3` повторяются в разных курсах).
  Всё, что ссылается на материал (вопросы тестов, сданные работы, аналитика урока), — по паре `courseId` + `activityId`.
  Новые id в конструкторе — глобально уникальные (`s-…`, `a-…`).
- Правила регистрации — в `shared/lib/registration.ts` и зеркально в `AuthEndpoints.ValidateRegistration` (C#):
  меняются вместе. Самостоятельно регистрируется только студент без группы; роль и группу клиент не задаёт.

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
- Новые зависимости — только при реальной необходимости, с точной версией (`npm i -E`). Lock-файл не править руками.

## Git-процесс (работаем вдвоём + агенты)

- В `main` напрямую не пушим. Ветка → PR → зелёный CI → ревью человеком → squash merge.
- Имена веток: `feat/…`, `fix/…`, `chore/…`; агентские — с префиксом `codex/…` или `claude/…`.
- Коммиты в стиле Conventional Commits: `feat: …`, `fix: …`, `chore: …`, `refactor: …`.
- Одна задача — один PR. Не смешивать рефакторинг/форматирование с фичей.
- Перед началом работы — `git pull --rebase` из `main`; при конфликте в `package-lock.json` —
  взять версию из `main` и выполнить `npm install`, а не мержить файл руками.
- Окончания строк — LF (`.gitattributes`). Не коммитить `.next/`, `*.tsbuildinfo`, `next-env.d.ts`, локальные настройки агентов.

## Чего не делать

- Не обновлять мажорные версии (Next, React, TypeScript, ESLint, Tailwind) в рамках фичи — отдельный PR.
  TypeScript ограничен `<6.1` (typescript-eslint), ESLint — 9.x (eslint-plugin-react / import ещё без поддержки 10).
- Не удалять и не перегенерировать `public/media/*` (демо-видео).
- Не добавлять реальные секреты, токены и персональные данные — только моки. Переменные окружения описывать в `.env.example`.
