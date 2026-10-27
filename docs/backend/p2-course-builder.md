# P2 · Конструктор курса в C# API

Задание для бэкенда (CodeWizaard + Codex), продолжение [P1](p1-management.md). Фронтенд и моки готовы:
в режиме «Демо» конструктор работает на моках Next, в режиме «Сервер» Next **пересылает запросы
модулей и материалов в C#** и до их появления отвечает `501 { notImplemented: true }`.

Что **остаётся в Next** (в обоих режимах, переносить сейчас не нужно): вопросы тестов, сданные работы,
объявления, трекинг. Они ссылаются на материалы по паре `courseId` + `activityId`.

| Что | Где смотреть |
| --- | --- |
| Контракт | `src/features/course-builder/api.ts`, `src/shared/types/domain.ts` (`Section`, `Activity`) |
| Права | `canEditCourse` в `src/shared/auth/management.ts` |
| Поля по типам и тексты ошибок | `src/shared/lib/content-validation.ts` (`ACTIVITY_FIELDS`, `validateSection`, `validateActivity`) |
| Эталон (моки) | `src/app/api/courses/[id]/sections/**`, `src/app/api/courses/[id]/activities/[activityId]/route.ts`, `src/mocks/course-store.ts` |

## 1. Модель данных (миграция `CourseBuilderP2`)

`Section` и `Activity` уже есть (owned-коллекции `Course`). Добавить в `Activity`:
- `Description` (`string?`, до 4000) — условие задания;
- `MaxGrade` (`int?`, 1–1000) — для задания; при создании задания без значения — `100`.

`Due` сейчас строка — **храните ISO 8601 с часовым поясом** (`DateTimeOffset` и сериализация в ISO тоже подходят,
главное — в ответе ISO-строка). Клиент присылает `due` уже в ISO с поясом; `null` — убрать срок.

**Id:** новые модули — `s-xxxxxxxx`, материалы — `a-xxxxxxxx` (8 hex из GUID). Исходные id уникальны только внутри
курса — не меняйте их и не делайте глобальных проверок уникальности по старым данным.

**Внимание к ключу:** сейчас ключ материала — `(CourseId, SectionId, Id)`. Перенос материала в другой модуль
(`PATCH … { sectionId }`) меняет ключ — для owned-сущности EF это удаление и добавление; сохраните поля и `Position`.

## 2. Права

Изменять содержимое курса могут: **admin и organizer — любой курс, tutor — только свой** (`TutorId == id`).
Студент — `403`. Курс, который пользователю не виден, — `404 { "error": "not found" }` (как сейчас для GET).
Все изменяющие запросы — с проверкой `X-Helios-Client: web` (иначе `403`), как `/api/auth`.

## 3. Эндпоинты

Ответы в формате `{ error, fields? }`; `400` поля, `403` права, `404` нет курса/модуля/материала, `409` конфликт.

| Метод и путь | Тело | Ответ |
| --- | --- | --- |
| `POST /api/courses/{id}/sections` | `{ title }` | `201 Section` (в конец, `order = n + 1`, `activities: []`) |
| `PATCH /api/courses/{id}/sections/{sectionId}` | `{ title }` | `200 Section` |
| `DELETE /api/courses/{id}/sections/{sectionId}` | — | `204`; есть материалы → `409 { error: "В модуле есть материалы — сначала удалите или перенесите их" }` |
| `PUT /api/courses/{id}/sections/order` | `{ sectionIds }` — все модули курса по одному разу | `200 Section[]` (с пересчитанным `order` 1…n); иначе `400 fields.sectionIds = "Неверный порядок модулей"` |
| `POST /api/courses/{id}/sections/{sectionId}/activities` | `{ type, title, …поля типа }` | `201 Activity` (в конец модуля) |
| `PUT /api/courses/{id}/sections/{sectionId}/activities/order` | `{ activityIds }` — все материалы модуля | `200 Activity[]`; иначе `400 fields.activityIds = "Неверный порядок материалов"` |
| `PATCH /api/courses/{id}/activities/{activityId}` | `{ title?, …поля типа, sectionId? }` | `200 Activity`; `type` в теле, отличный от текущего → `400 fields.type = "Тип материала изменить нельзя"`; нет модуля → `400 fields.sectionId = "Такого модуля нет"` |
| `DELETE /api/courses/{id}/activities/{activityId}` | — | `204` |

`GET /api/courses/{id}` должен отдавать `description` и `maxGrade` материалов, модули — по `order`, материалы — по `Position`.

**Удаление задания со сданными работами** запрещает Next до пересылки (работы пока хранятся в Next) — в C# ничего делать не нужно.

### Поля по типам (лишние поля отбрасываются молча, как в моке)

| Тип | Поля | Обязательно при создании |
| --- | --- | --- |
| `video` | `title`, `src`, `durationMin` | `src` |
| `pdf`, `presentation` | `title`, `pages`, `src` | `pages` |
| `quiz` | `title`, `due`, `durationMin`, `maxAttempts` | `maxAttempts` — 1…20 или пусто (без ограничения): «Попыток — от 1 до 20 или без ограничения» |
| `assignment` | `title`, `due`, `description`, `maxGrade` | — (`maxGrade` по умолчанию 100) |

Создавать можно только эти 5 типов (`type` иначе → `400 fields.type = "Выберите тип материала"`).
Пустая строка в необязательном поле = `null` = поле не задано / убрать.

## 4. Валидация — тексты дословно

| Поле | Правило | Текст |
| --- | --- | --- |
| section.title | 2–120 после trim | Название модуля — от 2 до 120 символов |
| title | 2–120 | Название — от 2 до 120 символов |
| due | парсится как дата | Укажите дату и время сдачи |
| src | `^(https://\|/)\S+$`, до 500 | Ссылка на файл: https://… или путь /media/…, до 500 символов |
| src (video, пусто) | | Укажите ссылку на видеофайл |
| pages | целое 1–500 | Страниц — от 1 до 500 |
| pages (pdf/presentation, пусто) | | Укажите число страниц |
| durationMin | целое 1–600 | Длительность — от 1 до 600 минут |
| description | до 4000 | Условие — до 4000 символов |
| maxGrade | целое 1–1000 | Максимальная оценка — от 1 до 1000 |

## 5. Тесты — `backend/tests/course-builder.test.mjs`

Цикл `[["C#", apiUrl], ["Next.js", TEST_WEB_URL]]`, как в `auth.test.mjs`; подключить в `ci.yml`.
**Работайте на отдельном курсе**, созданном организатором в начале теста (P1, `POST /api/courses`), — не трогайте
`c-dor-ai`: на его содержимое опираются `api.test.mjs` и трекинг.

1. Преподаватель курса добавляет модуль и материалы всех 5 типов; студент — `403`; чужой преподаватель (создайте
   второго через P1) — `404`.
2. Валидация: видео без `src`, PDF без `pages`, `maxGrade: 0`, неизвестный `type` → `400` с нужным `fields`.
3. Задание без `maxGrade` → `100`; лишние поля (`maxGrade` у видео) не сохраняются.
4. Порядок модулей и материалов: корректный → `200` и новый порядок в `GET /api/courses/{id}`; неполный список → `400`.
5. Перенос материала в другой модуль сохраняет его поля; `type` в PATCH → `400`.
6. `due: null` убирает срок; `due` в ISO возвращается как дата того же момента.
7. Удаление: непустой модуль → `409`, пустой → `204`; материал → `204`.

## 6. Готово, когда

- [ ] миграция `CourseBuilderP2`, `dotnet build` без предупреждений
- [ ] эндпоинты раздела 3 с правами раздела 2 и текстами раздела 4
- [ ] `course-builder.test.mjs` проходит для C# и через Next, старые тесты зелёные
- [ ] в режиме «Сервер» конструктор работает под преподавателем курса без «ещё не подключено»
- [ ] `backend/README.md` дополнен

## 7. Промпт для Codex

```text
Прочитай AGENTS.md, docs/backend/p2-course-builder.md и docs/backend/p1-management.md (P1 нужен для тестов).
Реализуй конструктор курса в C# API: миграция CourseBuilderP2 (Activity.Description, Activity.MaxGrade, Due в ISO),
эндпоинты модулей и материалов из раздела 3 с правами раздела 2 (tutor — только свой курс) и текстами ошибок
раздела 4, поля по типам как ACTIVITY_FIELDS в src/shared/lib/content-validation.ts. Учти перенос материала между
модулями (ключ owned-сущности содержит SectionId). Эталон — моки src/app/api/courses/[id]/{sections,activities}/**
и src/mocks/course-store.ts; фронтенд не меняй. Напиши backend/tests/course-builder.test.mjs по разделу 5
на отдельном курсе и подключи в CI. Ветка codex/feat/backend-course-builder, один PR, чек-лист раздела 6.
```
