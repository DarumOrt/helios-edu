# HeliosEDU — LMS Frontend Mockup

Next.js (App Router) + TypeScript + Tailwind + SWR + Zustand.
Минимальный, запускаемый мокап LMS-системы (аналог Moodle + Прометей).

## Запуск

```bash
npm install
npm run dev
```

Открыть http://localhost:3000

## Переключение роли

В верхнем правом углу — `RoleSwitcher`. Доступные роли: `admin`, `organizer`, `tutor`, `student`.
Навигация и доступ к разделам меняются динамически.

## Структура

```
src/
├── app/                    # Next.js App Router
│   ├── (app)/              # Авторизованная зона (sidebar+header)
│   │   ├── dashboard/
│   │   ├── courses/
│   │   ├── programs/
│   │   ├── gradebook/
│   │   └── admin/
│   └── api/                # Route handlers (mock backend)
├── features/               # Feature-модули (DDD-подобно)
│   ├── dashboard/
│   ├── courses/
│   ├── quiz/
│   ├── assignment/
│   ├── gradebook/
│   ├── programs/
│   ├── admin/
│   └── notifications/
├── shared/                 # Общее ядро
│   ├── ui/                 # UI-kit
│   ├── auth/               # RoleGate, permissions
│   ├── layout/             # Sidebar, Header
│   ├── lib/                # api-client, утилиты
│   └── types/              # Доменные типы
├── stores/                 # Zustand stores
└── mocks/                  # Mock данные (PGGPU Perm)
```

## Архитектурные решения

- **API-first**: все данные идут через `/api/*` route handlers, контракт совпадает с будущим внешним backend
- **Server state**: SWR с per-feature `api.ts`
- **Client state**: Zustand (session, ui)
- **RBAC**: `<RoleGate>` + `can()` + серверная проверка в route handlers
- **Real-time**: SSE через `/api/notifications/stream`, polling fallback
