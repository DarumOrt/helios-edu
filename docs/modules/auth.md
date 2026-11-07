# Модуль «auth» — вход, регистрация, сессии, пароли

Устав и отчёт модуля (≤40 строк). Сессия модуля читает этот файл вместо истории; в конце задачи обновляет
«Готово», «Ловушки», «Что осталось». Общие файлы (см. AGENTS.md → «Модули») — не трогать, а описать правку здесь
в «Для основной сессии».

## Зона
- C#: `backend/HeliosEdu.Api/Auth/` (кроме `AccessRules.cs` — общий)
- Next: `src/features/auth/`, `src/app/login/`, `src/app/register/`, `src/app/api/auth/`, `src/shared/lib/registration.ts`
- Тесты: `backend/tests/auth.test.mjs`, `lifecycle.test.mjs`, `accounts.test.mjs`

## Контракт
- Сессия в httpOnly-cookie `helios-auth`, `/api/auth/login|register|logout|me|password` — `docs/backend/p8-trash-accounts.md`
- Правила регистрации и пароля — `shared/lib/registration.ts` = `AuthEndpoints.ValidateRegistration` / `PasswordError`

## Проверки модуля
`npm test -- registration` · `bash scripts/dotnet.sh build` · тесты бэкенда (`node --test backend/tests/auth.test.mjs`) — только через `npm run test:backend` у основной сессии

## Готово
- Вход по паролю, регистрация студента без группы, блокировка закрывает сессии
- Лимит входов 60/мин на адрес (общий на сервер Next); неудачные входы — в журнал
- Смена пароля, временный пароль → `mustChangePassword`, плашка в кабинете

## Ловушки
- Лимит входов общий для тестов: длинные наборы делать после `restart api` (так в CI)

## Что осталось
- Лимит попыток входа по адресу пользователя (сейчас все запросы идут с адреса сервера Next)
- Сброс пароля по почте — нужен почтовый сервер

## Для основной сессии
—
