# P1 · Управление пользователями, группами и курсами в C# API

Задание для бэкенда (исполнитель — CodeWizaard + Codex). Фронтенд и моки уже готовы:
в режиме «Демо» всё работает на моках Next, в режиме «Сервер» Next **пересылает запросы в C#**.
Пока эндпоинта нет, Next отвечает `501 { error, notImplemented: true }` и интерфейс пишет
«На сервере эта функция ещё не подключена». Задача — реализовать эндпоинты ниже так, чтобы
интерфейс заработал в серверном режиме без правок фронтенда.

Эталон поведения — моковые маршруты Next. Если спецификация и мок расходятся, прав мок; сообщите об этом в PR.

| Что | Где смотреть |
| --- | --- |
| Контракт (типы запросов и ответов) | `src/features/admin/api.ts`, `src/shared/types/domain.ts` |
| Правила ролей | `src/shared/auth/management.ts`, `src/shared/auth/permissions.ts` |
| Правила полей и тексты ошибок | `src/shared/lib/management-validation.ts` |
| Эталонная реализация (моки) | `src/app/api/users/**`, `src/app/api/cohorts/**`, `src/app/api/courses/**` |
| Как Next пересылает в C# | `backendForward` в `src/shared/lib/backend.ts`, `src/proxy.ts` |

## 1. Модель данных (одна миграция `ManagementP1`)

**Account** (есть): добавить `Status` (`"active"` | `"blocked"`, по умолчанию `"active"`).
`Group` остаётся строкой — **названием группы** (так уже работают одногруппники и расписание).

**Course** (есть): добавить
- `Status` (`"draft"` | `"published"` | `"archived"`). Существующим строкам — `"published"` (default в миграции), новые курсы создаются `"draft"`;
- `CoverColor` (`string?`, один из `sky`, `teal`, `apricot`, `iris`, `sun`, `rose`) — при создании выбирается случайно и дальше хранится.

**Cohort** (новая): `Id` (string, `co-…`), `Name`, `NormalizedName` (уникальный индекс в пределах `TenantId`), `Faculty?`, `TenantId`.

**CohortCourse** (новая): ключ `(CohortId, CourseId)`, FK на обе таблицы, каскадное удаление со стороны группы.

**Сид** (через `DemoData`, как остальное — не перезаписывать существующее):
`co-1` М1227 (все 4 курса), `co-2` 1237 и `co-3` 1247 (без курсов) и ещё 17 групп ИНЭК из `Data/cohorts.json`.

**Состав группы не хранится отдельно:** студенты группы — `Account` с `Role == "student"` и `Group == Cohort.Name`.
При переименовании группы в той же транзакции обновить `Account.Group` её студентов.

## 2. Видимость курсов (`AccessRules.VisibleCourses`)

| Роль | Видит |
| --- | --- |
| admin, organizer | все курсы, любой статус |
| tutor | свои (`TutorId == id`), любой статус |
| student | только `Status == "published"` **и** (есть `Enrollment` **или** курс в `CohortCourse` его группы) |

Невидимый курс неотличим от несуществующего: `404 { "error": "not found" }`.
Новый студент без группы видит пустой список — это ожидаемо.

## 3. Права

| Действие | Кто |
| --- | --- |
| `GET /api/users` | admin, organizer (уже есть) |
| создать/изменить пользователя | admin, organizer. **Организатор не может**: назначать роль `admin`, менять учётные записи администраторов |
| никто | не меняет **свою** роль и не блокирует **себя** |
| `GET /api/cohorts*` | admin, organizer, tutor |
| изменения групп | admin, organizer |
| создать курс, изменить карточку курса | admin, organizer (tutor — `403`) |

Политики: удобно добавить `AccessRules.ManageCohorts` (admin, organizer) и `ManageCourses` (admin, organizer)
по аналогии с `ManageUsers`. Все POST/PUT/PATCH/DELETE — внутри группы с фильтром `X-Helios-Client: web`
(как `/api/auth`), иначе `403`.

## 4. Эндпоинты

Формат ошибок везде: `{ "error": "…", "fields"?: { "<поле>": "…" } }`. Статусы: `400` поля, `403` права,
`404` нет объекта, `409` конфликт (дубликат, непустая группа). JSON — camelCase, `null`-поля не писать (как сейчас).

### Пользователи

**`POST /api/users`** `{ name, email, role, group?, faculty? }` → `201 { user, temporaryPassword }`
- `user` — `UserInfo` + `status`. Добавьте `Status` в `UserInfo` (старые клиенты поле просто игнорируют).
- `temporaryPassword` — 12 случайных символов (буквы и цифры, без похожих `0O1lI`), хеш — через `IPasswordHasher`,
  в ответе **один раз**, в логи не писать.
- `email` уникален без учёта регистра → `409 fields.email`. `group` — только для `student` и только существующая
  группа (по названию без учёта регистра; сохранять каноническое название группы).

**`PATCH /api/users/{id}`** `{ name?, email?, role?, group?: string|null, faculty?: string|null, status? }` → `200 UserInfo`
- Передано только то, что меняется. `group: null` — убрать из группы.
- Смена роли со `student` на другую снимает группу.
- `status: "blocked"` — **удалить все `LoginSessions` пользователя** (выход со всех устройств).
- Вход заблокированного: `POST /api/auth/login` → `403 { "error": "Учётная запись заблокирована. Обратитесь к организатору." }`
  (проверять **после** проверки пароля, чтобы не раскрывать блокировку без пароля). `SessionAuthentication`
  тоже должен отклонять сессию заблокированного.

### Группы

**`GET /api/cohorts`** → `Cohort[]`, **`GET /api/cohorts/{id}`** → `Cohort`, где
`Cohort = { id, name, faculty?, memberIds: string[], courseIds: string[] }`.

**`POST /api/cohorts`** `{ name, faculty? }` → `201 Cohort`. Дубликат названия → `409 fields.name`.

**`PATCH /api/cohorts/{id}`** `{ name?, faculty?: string|null, courseIds?: string[] }` → `200 Cohort`.
`courseIds` — полный список курсов группы; неизвестный курс → `400 fields.courseIds`.

**`PUT /api/cohorts/{id}/members`** `{ memberIds: string[] }` → `200 Cohort`. Состав **целиком**:
добавленные переходят из прежних групп, убранные остаются без группы. Не-студент в списке →
`400 fields.memberIds = "В группу можно добавить только студентов"`.

**`DELETE /api/cohorts/{id}`** → `204`. В группе есть студенты → `409 { error: "В группе есть студенты — сначала уберите их из группы" }`.

### Курсы

**`POST /api/courses`** `{ code, title, category, description, tutorId }` → `201 CourseSummary`
(с `status: "draft"`, `coverColor`). `code` приводится к верхнему регистру, уникален → `409 fields.code`.
`tutorId` — существующий пользователь с ролью `tutor`, иначе `400 fields.tutorId = "Выберите преподавателя"`.

**`PATCH /api/courses/{id}`** `{ title?, category?, description?, tutorId?, status? }` → `200 CourseSummary`.
Передан `code` → `400 fields.code = "Код курса изменить нельзя"`.

`CourseSummary` и `CourseDetail` дополнить полями `status` и `coverColor`.

## 5. Валидация — те же правила и тексты, что во фронтенде

Скопируйте тексты дословно: интерфейс показывает их у полей.

| Поле | Правило | Текст |
| --- | --- | --- |
| user.name | 2–100 символов после trim | Укажите имя и фамилию — от 2 до 100 символов |
| user.email | `^[^\s@]+@[^\s@]+\.[^\s@]+$`, до 254 | Почта выглядит неполной, например name@pspu.ru |
| user.role | один из 4 | Выберите роль |
| user.role (организатор → admin) | | Эту роль может назначить только администратор |
| user.role (свою) | | Свою роль изменить нельзя |
| user.status | active/blocked | Неизвестный статус |
| user.status (себя blocked) | | Себя заблокировать нельзя |
| user.group (не студенту) | | Группу можно назначить только студенту |
| user.group (нет такой) | | Такой группы нет |
| user.faculty | до 50 | Факультет — до 50 символов |
| email занят | | Эта почта уже зарегистрирована |
| cohort.name | `^[\p{L}\d][\p{L}\d -]{1,29}$` | Название — от 2 до 30 символов: буквы, цифры, дефис, например М1227 |
| cohort.name занято | | Группа с таким названием уже есть |
| course.code | `^[А-ЯЁA-Z]{2,6}-\d{3}$` | Код — заглавные буквы, дефис и три цифры, например МАТ-101 |
| course.code занят | | Курс с таким кодом уже есть |
| course.title | 3–120 | Название — от 3 до 120 символов |
| course.category | 2–50 | Укажите направление, например Математика |
| course.description | до 1000 | Описание — до 1000 символов |
| course.tutorId | не пусто / tutor | Назначьте преподавателя / Выберите преподавателя |
| course.status | draft/published/archived | Неизвестный статус |
| организатор меняет админа | `403` | Учётные записи администраторов меняет только администратор |

## 6. Тесты (обязательно, новый файл `backend/tests/management.test.mjs`)

Тем же приёмом, что `auth.test.mjs`: цикл по `[["C#", apiUrl], ["Next.js", TEST_WEB_URL]]`, `login()` из `client.mjs`.
Подключить в `.github/workflows/ci.yml` рядом с `auth.test.mjs`. Минимальный набор:

1. Организатор создаёт студента с группой → `201`, есть `temporaryPassword`; этим паролем можно войти.
2. Организатор: роль `admin` → `400 fields.role`; PATCH администратора → `403`; своя роль → `400`; блок себя → `400`.
3. Студент и преподаватель: `POST /api/users`, `POST /api/cohorts`, `POST /api/courses` → `403`.
4. Дубликаты: почта (в другом регистре), код курса, название группы → `409` с нужным `fields`.
5. Блокировка: после `status: blocked` старая cookie → `401`, вход с верным паролем → `403`; разблокировка возвращает вход.
6. Курс: создан → `draft`; студент М1227 его не видит (в т.ч. `GET /api/courses/{id}` → `404`); после публикации — не видит,
   пока курс не в группе; после `PATCH /api/cohorts/co-1 { courseIds: [...,id] }` — видит.
7. Группа: создать → `PUT members` с не-студентом → `400`; перевод студента из другой группы меняет его `group`;
   переименование сохраняет состав; `DELETE` непустой → `409`, пустой → `204`.
8. Преподаватель видит свои курсы в любом статусе.

Тесты создают данные с уникальными именами (`Date.now()`) и не ломают сид: `api.test.mjs` сверяет список курсов
**студента**, поэтому созданные курсы оставляйте черновиками или вне групп, а состав `co-1` возвращайте как был.

## 7. Готово, когда

- [ ] миграция `ManagementP1` + сид групп; `dotnet build` без предупреждений (`TreatWarningsAsErrors`)
- [ ] все эндпоинты раздела 4 с правами раздела 3
- [ ] `management.test.mjs` проходит для C# и через Next; старые тесты зелёные
- [ ] в режиме «Сервер» админка работает без сообщений «ещё не подключено» (проверить вручную под организатором)
- [ ] `backend/README.md`: эндпоинты и правила блокировки
- [ ] в PR — ссылка на этот документ и что из него не сделано, если что-то отложено

## 8. Промпт для Codex

```text
Прочитай AGENTS.md и docs/backend/p1-management.md. Реализуй раздел P1 в C# API (backend/HeliosEdu.Api):
миграция ManagementP1 (Account.Status, Course.Status и CoverColor, Cohort, CohortCourse) и сид групп,
эндпоинты /api/users (POST, PATCH /{id}), /api/cohorts (GET, POST, GET/PATCH/DELETE /{id}, PUT /{id}/members),
/api/courses (POST, PATCH /{id}) строго по контракту, правам и текстам ошибок из документа;
обнови AccessRules.VisibleCourses и вход заблокированных. Эталон поведения — моковые маршруты
src/app/api/{users,cohorts,courses}; фронтенд (src/) не меняй. Напиши backend/tests/management.test.mjs
по разделу 6 и подключи его в CI. Проверь: dotnet build, docker compose --profile backend up -d --build db api,
node --test backend/tests/*.test.mjs. Работай в ветке codex/feat/backend-management, один PR,
в описании — чек-лист раздела 7.
```
