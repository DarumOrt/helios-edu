# Модуль «courses» — каталог, страница курса, конструктор, корзины, файлы

Устав и отчёт модуля (≤40 строк). Сессия модуля читает этот файл вместо истории; в конце задачи обновляет
«Готово», «Ловушки», «Что осталось». Общие файлы (см. AGENTS.md → «Модули») — не трогать, а описать правку здесь
в «Для основной сессии».

## Зона
- C#: `backend/HeliosEdu.Api/Courses/`, `Files/`
- Next: `src/features/courses/`, `course-builder/`, `search/`, `src/app/(app)/courses/` (кроме страниц плеера),
  `src/app/api/courses/`, `catalog/`, `files/`, `src/shared/lib/content-validation.ts`, `file-rules.ts`, `upload.ts`
- Тесты: `backend/tests/course-builder.test.mjs`, `catalog.test.mjs`, `files.test.mjs`, `trash.test.mjs`, `api.test.mjs`

## Контракт
- `docs/backend/p2-course-builder.md`, `p6-files.md`, `p8-trash-accounts.md`; хранилище — `docs/adr/0001-object-storage.md`

## Проверки модуля
`npm test -- content-validation file-rules` · `bash scripts/dotnet.sh build` · тесты бэкенда (files/trash/course-builder) — только через `npm run test:backend` у основной сессии

## Готово
- Конструктор модулей и материалов, обложка (цвет и картинка) в C#
- Загрузка видео/PDF/обложек/файлов работ в SeaweedFS по временной ссылке, корзина файлов 7 дней
- Корзина курса (материалы) и корзина курсов, удаление курса с предупреждением о результатах
- Создание курса преподавателем, вкладка «Участники»: несколько групп, индивидуально, кодовое слово; [контракт](../backend/course-enrollment.md)

## Ловушки
- Id материалов уникальны только внутри курса; курс в корзине скрыт везде, кроме «Моих оценок»
- Состав курса — объединение групп и CourseEnrollments, без дублей. Смена слова не отменяет запись.

## Что осталось
- Встроенный просмотр PDF (вместе с модулем learning)

## Для основной сессии
—
