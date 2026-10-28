# P7. Трекинг изучения, аналитика, лидерборд и расписание

Код — `backend/HeliosEdu.Api/Tracking/`, тесты — `backend/tests/tracking.test.mjs`. В режиме «Сервер» Next
пересылает запросы в C#; в демо — моки `src/mocks/tracking-store.ts` с тем же контрактом (типы —
`src/shared/lib/tracking/types.ts`, сверка — `src/shared/types/contract.ts`).

Материал всегда задаётся парой **курс + id** (id уникальны только внутри курса). Ученик — из сессии;
`userId` в теле и в адресе C# не использует. Время в ответах — миллисекунды Unix (как `Date.now()` в браузере).

## Таблицы

| Таблица | Что | Правила |
| --- | --- | --- |
| `ActivityProgress` | прогресс ученика по материалу (видео, PDF, презентация, тест): покрытие, активное время, перемотки, паузы, страницы, место остановки, завершено | одна строка на ученика + курс + материал; слияние одним `INSERT … ON CONFLICT`: покрытие, время, страницы, скорость — максимум, «завершено» не снимается, новая сессия — `+1` к `Sessions` |
| `TrackingEvents` | события просмотра: `opened`, `played`, `paused`, `seeked`, `ratechanged`, `page_viewed`, `completed`, `closed` | «пульс» (`heartbeat`) не хранится — он только обновляет прогресс; хранится бессрочно (когда событий станут миллионы — ClickHouse, см. ROADMAP) |
| `ScheduleSlots` | пары группы на неделю | по названию группы, как `Account.Group` |

Засчитанный трекингом материал считается «пройдено» и в прогрессе курса (`CourseProgress`), и в P5 (`AdaptiveEngine.Completed`).

## Эндпоинты

| Метод и путь | Права | Тело и ответ |
| --- | --- | --- |
| `POST /api/tracking/progress` | кто видит курс | `{ courseId, activityId, sessionId, coverage, activeTimeSec, completed, seeks?, pauses?, maxRate?, pagesViewed?, totalPages?, durationSec?, position? }` → `200 { ok, accepted }`. Курс не виден или материал не из курса / не отслеживается — `404`; нет `sessionId` — `400` |
| `GET /api/tracking/progress?courseId=&activityId=` | кто видит курс | свой `ProgressInfo` или `null` |
| `POST /api/tracking/events` | кто видит курс | `{ courseId, events: [{ sessionId, activityId, activityType, verb, position?, payload?, ts }] }` → `200 { ok, accepted }`; больше 200 — `400`; чужие материалы и неизвестные глаголы пропускаются |
| `GET /api/analytics/course/{courseId}` | преподаватель своего курса, организатор, администратор (студент — `403`, чужой курс — `404`) | `{ activities: [{ activityId, title, type, started, completed, total, avgCoverage, avgTimeSec }] }` — по ученикам групп курса |
| `GET /api/analytics/lesson/{activityId}?courseId=&userId=` | те же | `{ rows: LessonStatRow[], events? }` — с `userId` его строка и лента событий |
| `GET /api/hub/leaderboard?courseId=` | кто видит курс | `{ courseId, entries: LeaderboardEntry[] }` — вся группа курса с именами |
| `GET /api/schedule?group=` | студент — только своя группа (`403`), остальные — любая | `{ group, pairs, slots }`; без группы — `400` |

**Балл лидерборда:** 50% — среднее покрытие видео и документов, 30% — средний лучший результат тестов
(попытки P5 и трекинг), 20% — доля пройденных материалов (правило прогресса курса). **Серия** — дни подряд
(до сегодня или вчера), когда ученик занимался курсом: события просмотра, прогресс, события P5.

Демо-данные (`Database:SeedDemoData`): прогресс группы М1227 по ЦОР-201 и её недельное расписание.
