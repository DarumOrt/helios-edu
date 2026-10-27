# P3–P4 · Что пока живёт в Next и как переносить в C#

Срочной работы в C# здесь нет: настройки и журнал действий хранятся в моках Next **в обоих режимах**,
права в серверном режиме проверяет `src/proxy.ts` через сессию C#. Перенос — когда дойдут руки, по этим контрактам.

| Раздел | Маршруты Next (контракт) | Права | Хранилище сейчас |
| --- | --- | --- | --- |
| Настройки системы | `GET /api/settings`, `PUT /api/settings { allowRegistration?, announcementsEnabled? }` | менять — только admin (`system.manage`) | `src/mocks/settings-store.ts` |
| Журнал действий | `GET /api/audit` → `{ at, actorName, actorRole, action, target }[]` | только admin | `src/mocks/audit-store.ts` |

**Важно для C#:**
- `allowRegistration: false` Next проверяет **до** пересылки `POST /api/auth/register`; при переносе настроек в C#
  объедините с `Auth:AllowRegistration` (одна настройка, а не две).
- Журнал сейчас пишет Next, в т.ч. после успешных пересланных в C# запросов (`auditIfOk`). При переносе — append-only
  таблица, запись в той же транзакции, что и изменение; Next перестаёт писать сам.
- Экспорт журнала оценок в CSV делается в браузере из `GET /api/gradebook` — бэкенду ничего не нужно.

Программы обучения убраны: вместо них — поиск курсов (`GET /api/catalog`, C# — `Courses/CatalogEndpoints.cs`),
направления и профили хранятся в группах.
