# P5 · Навыки, попытки и адаптивное обучение в C# API

Задание для бэкенда (CodeWizaard + Codex). Это серверная часть темы практики Ивана:
«педагогические и серверные механизмы адаптивной образовательной платформы». **Без ИИ** — только понятные
алгоритмы: модель навыков, BKT (как в Cognitive Tutor) и правила выбора следующего задания.

Фронтенд (страницы, пересылка из Next в C#, моки для режима «Демо») делает Иван отдельно, по контрактам ниже.
**Здесь — только C#, миграция и тесты API.**

## Коротко: что и зачем

Сейчас курс устроен как «курс → модуль → материал», а тесты проверяются в памяти Next: попытки нигде не
сохраняются, система не знает, что ученик уже умеет. Нужно добавить:

1. **Навыки курса** — что именно проверяет каждое задание (из РПД: «уметь вычислять пределы» и т. п.).
2. **Тесты и попытки в базе** — вопросы, ответы, подсказки, баллы.
3. **Журнал образовательных событий** — всё, что делал ученик, в одной таблице.
4. **Модель ученика** — вероятность освоения каждого навыка (BKT) и прогресс по курсу.
5. **Адаптивный выбор** — какое задание дать следующим и **почему**.
6. **Контроль преподавателя** — видит решения системы и может их отменить.

| Что | Где смотреть |
| --- | --- |
| Права на курс | `AccessRules.CanEditCourse` (admin и organizer — любой курс, tutor — только свой) |
| Ученики курса | `AccessRules.CourseStudents`: студенты групп, которым назначен курс (таблица `Enrollments` удалена) |
| Вопросы тестов сейчас | `src/mocks/quiz-store.ts`, `src/mocks/data.ts` (`quizQuestions.mq1`), тип `QuizQuestion` в `src/shared/types/domain.ts` |
| Проверка ответа сейчас | `scoreAnswers` в `src/mocks/quiz-store.ts`, маршрут `src/app/api/quiz/[id]/submit/route.ts` |
| Формат ошибок и защита | как в P1/P2: `{ error, fields? }`, изменяющие запросы — с `X-Helios-Client: web`, иначе `403` |

**Важно про id:** id модулей и материалов уникальны **только внутри курса** (`mq1` — это `c-matan/mq1`).
Всё, что ссылается на материал, — по паре `CourseId` + `ActivityId`. Новые id — `sk-xxxxxxxx`, `q-xxxxxxxx`,
`at-xxxxxxxx`, `rec-xxxxxxxx` (8 hex из GUID).

**Пользователь — только из серверной сессии**, никаких `userId` в теле запроса.

---

## 1. Модель данных (миграция `AdaptiveP5`)

### Навыки

**`Skills`** — навыки курса.

| Поле | Тип | Заметка |
| --- | --- | --- |
| `Id` | string | `sk-…` |
| `CourseId` | string | FK на `Courses` |
| `SectionId` | string? | модуль, к которому относится навык |
| `Code` | string? | код из РПД, например `ОПК-1.2`, до 20 |
| `Title` | string | 2–200 |
| `Description` | string? | до 1000 |
| `Order` | int | порядок в курсе |
| `IsAuto` | bool | создан системой автоматически (см. ниже) |
| `PInit`, `PLearn`, `PSlip`, `PGuess` | double | параметры BKT, по умолчанию `0.3`, `0.15`, `0.1`, `0.2` |

**`SkillPrerequisites`** — что нужно освоить до навыка: `SkillId`, `RequiresSkillId` (оба из одного курса).

**`ActivitySkills`** — какие навыки проверяет материал: `CourseId`, `ActivityId`, `SkillId`.

**Навык по умолчанию.** Преподаватель может вообще ничего не размечать. Если у модуля нет ни одного навыка,
сервер сам создаёт навык с `IsAuto = true`, `Title` = название модуля, `SectionId` = этот модуль. Делать это
лениво — при `GET …/skills` и при первом ответе в тесте этого модуля. Когда преподаватель создаёт в модуле свой
навык, авто-навык модуля не удаляем (на нём могут быть данные учеников), но и не создаём заново.

**Какой навык проверяет вопрос** (по порядку, первое найденное):
1. `QuizQuestion.SkillId`, если задан;
2. навыки материала из `ActivitySkills` (если их несколько — ответ обновляет каждый);
3. навыки модуля материала (`Skills.SectionId`), включая авто-навык.

### Тесты и попытки

**`QuizQuestions`** — перенос вопросов из Next.

| Поле | Тип | Заметка |
| --- | --- | --- |
| `Id` | string | `q-…` (исходные `mq1q1` и т. п. — оставить как есть) |
| `CourseId`, `ActivityId` | string | материал типа `quiz` |
| `Type` | string | `mcq` / `short` / `boolean` |
| `Text` | string | 1–2000 |
| `Options` | jsonb | для `mcq`: 2–8 вариантов |
| `Correct` | jsonb | индекс / строка / bool |
| `Hints` | jsonb | 0–3 подсказки, строки до 500 |
| `SkillId` | string? | уточняет навык именно этого вопроса |
| `Order` | int | |

**`QuizAttempts`**: `Id`, `UserId`, `CourseId`, `ActivityId`, `StartedAt`, `SubmittedAt?`, `Score?`, `Max`.

**`AttemptAnswers`**: `AttemptId`, `QuestionId`, `Given` (jsonb), `IsCorrect`, `HintsUsed` (int), `AnsweredAt`.
Ключ — `(AttemptId, QuestionId)`: на вопрос в попытке отвечают один раз.

### Журнал событий

**`LearningEvents`** — только добавление, никаких изменений и удалений.

| Поле | Тип |
| --- | --- |
| `Id` | bigint, identity |
| `At` | timestamptz |
| `UserId` | string — ученик, к которому относится событие |
| `ActorId` | string — кто сделал (ученик или преподаватель) |
| `CourseId` | string |
| `ActivityId`, `SkillId` | string? |
| `Type` | string |
| `Payload` | jsonb |

Типы событий:

| `Type` | Когда | `Payload` |
| --- | --- | --- |
| `activity.viewed` / `activity.completed` | присылает клиент (просмотр видео/PDF) | `{ coverage? }` |
| `attempt.started` / `attempt.submitted` | начал / завершил тест | `{ attemptId, score?, max? }` |
| `answer.submitted` | ответ на вопрос | `{ attemptId, questionId, isCorrect, hintsUsed }` |
| `hint.requested` | взял подсказку | `{ attemptId, questionId, level }` |
| `skill.updated` | пересчитан BKT | `{ before, after }` |
| `skill.mastered` | навык освоен | `{ pKnown }` |
| `recommendation.shown` / `.accepted` / `.skipped` | рекомендация | `{ recommendationId, reason }` |
| `teacher.override` | преподаватель изменил решение | `{ action, reason }` |

Событие пишется **в той же транзакции**, что и само действие.

### Модель ученика и рекомендации

**`SkillMastery`**: `UserId`, `SkillId`, `PKnown` (double), `Attempts`, `Correct`, `Status`
(`locked` / `learning` / `mastered`), `UnlockedByTeacher` (bool), `MasteredAt?`, `UpdatedAt`.
Ключ — `(UserId, SkillId)`. Нет строки = ещё не начинал, `PKnown = PInit`.

**`Recommendations`**: `Id`, `UserId`, `CourseId`, `ActivityId?`, `SkillId?`, `ReasonCode`, `ReasonText`,
`Status` (`shown` / `accepted` / `skipped` / `overridden`), `CreatedAt`.

**`StudentPins`** — задание, закреплённое преподавателем: `UserId`, `CourseId`, `ActivityId`, `Reason`,
`CreatedBy`, `CreatedAt`. Ключ — `(UserId, CourseId)`.

**`Course.AdaptiveEnabled`** (bool, по умолчанию `true`) — адаптивный режим курса.

---

## 2. Алгоритмы

### 2.1. BKT — пересчёт освоения после ответа

Для каждого навыка вопроса (`p` = текущий `PKnown`, `S` = `PSlip`, `G` = угадывание, `T` = `PLearn`):

```
если ответ верный и подсказок не было:
    p' = p·(1−S) / ( p·(1−S) + (1−p)·G )
иначе (ошибка или взята подсказка — как в Cognitive Tutor):
    p' = p·S / ( p·S + (1−p)·(1−G) )

PKnown = p' + (1−p')·T
```

- Угадывание `G` зависит от вопроса: `mcq` — `1 / число вариантов`, `boolean` — `0.5`, `short` — `0.05`.
  `Skills.PGuess` используется, только если тип вопроса неизвестен.
- `PKnown ≥ 0.95` → `Status = mastered`, `MasteredAt`, событие `skill.mastered`. Освоенный навык обратно в
  `learning` сам не возвращается (только преподаватель — «сбросить»).
- Результат округлять до 4 знаков при сохранении.

### 2.2. Статус навыка

- `mastered` — освоен (по BKT или отметил преподаватель);
- `learning` — все пререквизиты освоены **или** `UnlockedByTeacher = true`;
- `locked` — иначе.

### 2.3. Прогресс по курсу

```
skillsShare    = освоенные навыки / все навыки курса
materialsShare = материалы с activity.completed или завершённой попыткой / все материалы курса
progress       = round(100 · (0.7·skillsShare + 0.3·materialsShare))
```

Если в курсе нет материалов типа `quiz` (навыки нечем проверять) — `progress = round(100 · materialsShare)`.

### 2.4. Выбор следующего задания

По порядку, первое сработавшее правило:

| # | Правило | `ReasonCode` | Пример `ReasonText` |
| --- | --- | --- | --- |
| 1 | Есть закреп преподавателя → его материал | `pinned_by_teacher` | «Задание назначил преподаватель: {reason}» |
| 2 | `AdaptiveEnabled = false` → первый незавершённый материал по порядку курса | `linear_order` | «Следующий материал по порядку курса» |
| 3 | Среди навыков `learning` берём с минимальным `PKnown` (при равенстве — по `Order`). Для него — тест, где больше всего вопросов этого навыка и меньше всего верных ответов ученика | `weakest_skill` | «Навык «{title}» освоен на 42%, пререквизиты пройдены» |
| 4 | По слабому навыку теста нет (или все вопросы уже решены верно) → непросмотренный видео/PDF/презентация этого навыка | `review_material` | «Повторите материал по навыку «{title}»» |
| 5 | Все навыки освоены | `all_mastered` | «Все навыки курса освоены» (`ActivityId = null`) |

**Персональные рекомендации:** для каждого навыка `learning` с `PKnown < 0.6` — материалы этого навыка, которые
ученик ещё не завершил (видео/PDF/презентации). Это просто список, в `Recommendations` не пишется.

**Без дублей:** если последняя рекомендация ученика по курсу в статусе `shown` и указывает на тот же материал —
вернуть её, а не создавать новую (`reasonCode`, `reasonText` и `skillId` обновить по текущему освоению). Иначе — новая запись и событие `recommendation.shown`.

---

## 3. Эндпоинты

Ответы ошибок — `{ error, fields? }`: `400` поля, `403` права, `404` нет курса/навыка/материала/попытки,
`409` конфликт. Курс, который пользователю не виден, — `404`. Изменяющие запросы — с `X-Helios-Client: web`.

**Права:** «преподаватель курса» = `AccessRules.CanEditCourse`. «Ученик курса» = `AccessRules.IsCourseStudent` (курс назначен его группе);
иначе на `/api/me/…` — `403 { error: "Вы не записаны на этот курс" }`.

### 3.1. Навыки (преподаватель курса; читать могут и ученики курса)

| Метод и путь | Тело | Ответ |
| --- | --- | --- |
| `GET /api/courses/{id}/skills` | — | `200 Skill[]` с `prerequisiteIds` и `activityIds`, по `order` |
| `POST /api/courses/{id}/skills` | `{ title, code?, description?, sectionId?, prerequisiteIds? }` | `201 Skill` |
| `PATCH /api/courses/{id}/skills/{skillId}` | те же поля, все необязательны | `200 Skill` |
| `DELETE /api/courses/{id}/skills/{skillId}` | — | `204`; есть данные учеников в `SkillMastery` → `409 { error: "По навыку уже есть результаты учеников" }` |
| `POST /api/courses/{id}/skills/import` | `{ text, sectionId? }` — по навыку на строку; `ОПК-1.2 Уметь …` → `code` + `title` | `201 Skill[]`; пустые строки пропускать; больше 50 строк → `400` |
| `PUT /api/courses/{id}/activities/{activityId}/skills` | `{ skillIds }` | `200 { activityId, skillIds }` |

### 3.2. Вопросы тестов

| Метод и путь | Кто | Ответ |
| --- | --- | --- |
| `GET /api/courses/{id}/quizzes/{activityId}/questions` | преподаватель — всё; ученик — без `correct` и `hints`, но с `hintsCount` | `200 Question[]` |
| `PUT /api/courses/{id}/quizzes/{activityId}/questions` | преподаватель | тело — весь список; `200 Question[]`. Материал не `quiz` → `400 fields.activityId = "Это не тест"` |

### 3.3. Попытки (ученик курса)

| Метод и путь | Тело | Ответ |
| --- | --- | --- |
| `POST /api/courses/{id}/quizzes/{activityId}/attempts` | — | `201 { attemptId, questions }` (вопросы как для ученика). Есть незавершённая попытка этого теста — вернуть её, `200`. Завершено `maxAttempts` попыток — `409 { error: "Попытки закончились" }` |
| `GET /api/courses/{id}/quizzes/{activityId}/attempts` | — | `200 AttemptsSummary { maxAttempts?, used, open, bestPercent? }` — свои попытки (только ученик), попытку не начинает |
| `POST /api/attempts/{attemptId}/answers` | `{ questionId, given }` | `200 { isCorrect, correct, skills: [{ skillId, before, after, status }] }`. Повторный ответ → `409`; попытка завершена → `409` |
| `POST /api/attempts/{attemptId}/hint` | `{ questionId }` | `200 { level, text, hintsLeft }`; подсказок больше нет → `409 { error: "Подсказок больше нет" }` |
| `POST /api/attempts/{attemptId}/submit` | — | `200 { score, max, percent }`; вопросы без ответа считаются неверными, но BKT по ним **не** пересчитывается |

Чужая попытка → `404`. Проверка ответа — как `scoreAnswers` в `src/mocks/quiz-store.ts`
(`short`: ответ содержит правильный, без учёта регистра и пробелов по краям).

### 3.4. Ученик: прогресс и следующее задание

| Метод и путь | Ответ |
| --- | --- |
| `GET /api/me/courses/{id}/progress` | `{ progress, skills: [{ id, title, code, pKnown, status }], materials: { done, total } }` |
| `GET /api/me/courses/{id}/next` | `{ recommendation: { id, activityId, skillId, reasonCode, reasonText }, personal: [{ skillId, activityIds }] }` |
| `POST /api/me/recommendations/{id}` | тело `{ status: "accepted" \| "skipped" }` → `204` |
| `POST /api/me/courses/{id}/events` | тело `{ type: "activity.viewed" \| "activity.completed", activityId, coverage? }` → `204`. Другие типы → `400` |

### 3.5. Преподаватель: контроль адаптации

| Метод и путь | Тело | Ответ |
| --- | --- | --- |
| `GET /api/courses/{id}/adaptive` | — | `{ enabled, skills, students: [{ id, name, progress, skills: { [skillId]: { pKnown, status, unlockedByTeacher } }, pin? }] }` |
| `PATCH /api/courses/{id}/adaptive` | `{ enabled }` | `200 { enabled }` |
| `PUT /api/courses/{id}/adaptive/students/{userId}/skills/{skillId}` | `{ action: "master" \| "reset" \| "unlock", reason }` | `200` строка `SkillMastery`. `reset` → `PKnown = PInit`, `learning`/`locked` |
| `PUT /api/courses/{id}/adaptive/students/{userId}/pin` | `{ activityId, reason }`, `activityId: null` — снять | `200` или `204` |
| `GET /api/courses/{id}/events?userId=&type=&limit=` | — | `200 Event[]`, новые сверху, `limit` до 500 (по умолчанию 100). Ученик может звать только со своим `userId` |

Каждое действие преподавателя — событие `teacher.override`, а текущая рекомендация ученика по курсу в статусе
`shown` → `overridden`. **Решение преподавателя всегда важнее алгоритма.** `userId` не ученик курса → `404`.

---

## 4. Валидация — тексты дословно

| Поле | Правило | Текст |
| --- | --- | --- |
| skill.title | 2–200 после trim | Название навыка — от 2 до 200 символов |
| skill.code | до 20 | Код — до 20 символов |
| skill.description | до 1000 | Описание — до 1000 символов |
| skill.sectionId | модуль этого курса | Такого модуля нет |
| prerequisiteIds | навыки этого курса | Пререквизит должен быть навыком этого курса |
| prerequisiteIds | без циклов и без самого себя | Пререквизиты не должны образовывать цикл |
| skillIds | навыки этого курса | Навык должен быть из этого курса |
| question.text | 1–2000 | Текст вопроса — до 2000 символов |
| question.options | `mcq`: 2–8 непустых | У вопроса с выбором — от 2 до 8 вариантов |
| question.correct | соответствует типу | Укажите правильный ответ |
| question.hints | 0–3, каждая до 500 | Не больше 3 подсказок до 500 символов |
| override.reason | 3–500 | Укажите причину — от 3 до 500 символов |

Ошибки поля вопроса — в `fields` с ключом `questions.{index}.{поле}`.

---

## 5. Демо-данные (сид)

В курсе `c-matan`, модуль `s1`:

| Id | Код | Навык | Пререквизиты | Материалы |
| --- | --- | --- | --- | --- |
| `sk-lim-def` | ОПК-1.1 | Понимать определение предела функции | — | `mv1` |
| `sk-lim-thm` | ОПК-1.2 | Применять теоремы о пределах | `sk-lim-def` | `mp1` |
| `sk-cont` | ОПК-1.3 | Исследовать функцию на непрерывность | `sk-lim-def` | `md1` |
| `sk-lim-calc` | ОПК-1.4 | Вычислять пределы | `sk-lim-thm` | `ma1` |

- Перенести вопросы `quizQuestions.mq1` из `src/mocks/data.ts` в `QuizQuestions`, раскидать по этим навыкам,
  добавить к каждому 2–3 подсказки (от намёка к почти готовому решению).
- Добить тест `mq1` до 12 вопросов, по 3 на навык, чтобы адаптацию было видно на демонстрации.
- `c-matan.AdaptiveEnabled = true`.

---

## 6. Тесты — `backend/tests/adaptive.test.mjs`

Пока только против C# (`apiUrl` из `client.mjs`), Next добавим позже. Подключить в `ci.yml`.
**Работать на отдельном курсе и отдельных учениках**, созданных в начале теста через P1 (как в
`management.test.mjs`) — `c-matan` не трогать, на него опираются другие тесты. Сид проверить только чтением.

1. **Навыки:** преподаватель курса создаёт навыки и пререквизиты; цикл `A → B → A` → `400`; навык чужого
   курса в `skillIds` → `400`; ученик — `403` на запись; чужой преподаватель — `404`.
2. **Импорт:** три строки `ОПК-1.1 Уметь …` → три навыка с `code`.
3. **Авто-навык:** у модуля без навыков после `GET …/skills` появляется навык с `isAuto: true`.
4. **Вопросы:** ученик не видит `correct` и `hints`, видит `hintsCount`; кривой `mcq` (1 вариант) → `400`.
5. **BKT:** верный ответ повышает `pKnown`, неверный — понижает; верный с подсказкой считается как неверный;
   значения совпадают с формулой раздела 2.1 до 4 знаков.
6. **Освоение:** серия верных ответов доводит навык до `mastered`; появляются события `skill.mastered`.
7. **Пререквизиты:** пока `A` не освоен, `B` — `locked` и в `next` не попадает; после освоения `A` — `learning`.
8. **Рекомендация:** `next` выбирает самый слабый навык, `reasonCode = weakest_skill`, запись в `Recommendations`;
   повторный `next` без изменений возвращает ту же рекомендацию (без дублей).
9. **Преподаватель:** `pin` → `next` отдаёт закреплённое с `pinned_by_teacher`; `master` → навык `mastered`,
   событие `teacher.override`; `PATCH adaptive { enabled: false }` → `linear_order`.
10. **Права:** чужая попытка → `404`; ученик не видит события другого ученика; не зачисленный → `403`;
    повторный ответ на вопрос → `409`; без `X-Helios-Client` → `403`.
11. **Журнал:** после сценария в `events` есть `attempt.started`, `answer.submitted`, `hint.requested`,
    `attempt.submitted` в правильном порядке.
12. **Прогресс:** считается по формуле раздела 2.3.

---

## 7. Готово, когда

- [ ] миграция `AdaptiveP5`, `dotnet build` без предупреждений
- [ ] сид раздела 5
- [ ] эндпоинты раздела 3 с правами и текстами раздела 4, алгоритмы раздела 2
- [ ] `adaptive.test.mjs` проходит, старые тесты зелёные, подключён в CI
- [ ] `backend/README.md` дополнен разделом про адаптивный модуль (кратко: модель, BKT, правила выбора)

---

## 8. Промпт для Codex

Скопируй целиком. Если файла ещё нет в репозитории — сначала положи этот документ в `docs/backend/p5-adaptive.md`.

```text
Прочитай AGENTS.md, docs/backend/p5-adaptive.md, а для примеров — docs/backend/p1-management.md,
docs/backend/p2-course-builder.md и backend/tests/management.test.mjs.

Реализуй в C# API (backend/HeliosEdu.Api) адаптивный модуль по p5-adaptive.md, без ИИ:
- миграция AdaptiveP5: Skills, SkillPrerequisites, ActivitySkills, QuizQuestions, QuizAttempts,
  AttemptAnswers, LearningEvents (только добавление), SkillMastery, Recommendations, StudentPins,
  Course.AdaptiveEnabled;
- авто-навык модуля (раздел 1), BKT, статусы, прогресс и выбор следующего задания строго по разделу 2;
- эндпоинты раздела 3 с правами (AccessRules.CanEditCourse для преподавателя, CourseStudents для ученика,
  пользователь только из сессии, X-Helios-Client: web на изменяющих запросах) и текстами ошибок раздела 4;
- каждое действие пишет событие в LearningEvents в той же транзакции;
- сид раздела 5 для c-matan (перенеси вопросы quizQuestions.mq1 из src/mocks/data.ts, добавь подсказки,
  доведи до 12 вопросов).
Новый код клади в папку backend/HeliosEdu.Api/Adaptive, в стиле существующих Courses/ и Management/.
Фронтенд и src/ не меняй. Напиши backend/tests/adaptive.test.mjs по разделу 6 на отдельном курсе
и отдельных учениках, подключи в CI. Ветка codex/feat/backend-adaptive, один PR, чек-лист раздела 7.
Если в документе что-то противоречит коду — не угадывай, опиши вопрос в описании PR.
```
