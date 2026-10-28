import type { AuditCategory } from "@/shared/types/domain";

// Действия журнала — те же коды, тексты и разделы, что в C# (Audit/AuditLog.cs, AuditLog.Actions).
// Демо пишет журнал теми же кодами, страница журнала фильтрует по разделам.

export const AUDIT_ACTIONS = {
  "auth.login": ["Вход", "auth"],
  "auth.login_failed": ["Неудачный вход", "auth"],
  "auth.logout": ["Выход", "auth"],
  "auth.registered": ["Регистрация", "auth"],
  "user.created": ["Добавлен пользователь", "users"],
  "user.updated": ["Изменён пользователь", "users"],
  "user.blocked": ["Заблокирован пользователь", "users"],
  "user.unblocked": ["Разблокирован пользователь", "users"],
  "user.deleted": ["Удалён пользователь", "users"],
  "password.reset": ["Сброшен пароль", "users"],
  "password.changed": ["Сменён пароль", "auth"],
  "cohort.created": ["Создана группа", "cohorts"],
  "cohort.updated": ["Изменена группа", "cohorts"],
  "cohort.members": ["Изменён состав группы", "cohorts"],
  "cohort.deleted": ["Удалена группа", "cohorts"],
  "course.created": ["Создан курс", "courses"],
  "course.updated": ["Изменён курс", "courses"],
  "course.cover": ["Изменена обложка", "courses"],
  "course.deleted": ["Курс в корзине", "courses"],
  "course.restored": ["Восстановлен курс", "courses"],
  "announcement.created": ["Объявление", "courses"],
  "section.created": ["Добавлен модуль", "content"],
  "section.renamed": ["Переименован модуль", "content"],
  "section.deleted": ["Удалён модуль", "content"],
  "section.reordered": ["Изменён порядок модулей", "content"],
  "section.restored": ["Восстановлен модуль", "content"],
  "activity.created": ["Добавлен материал", "content"],
  "activity.updated": ["Изменён материал", "content"],
  "activity.deleted": ["Удалён материал", "content"],
  "activity.reordered": ["Изменён порядок материалов", "content"],
  "activity.restored": ["Восстановлен материал", "content"],
  "quiz.questions": ["Изменены вопросы теста", "content"],
  "skill.created": ["Добавлен навык", "adaptive"],
  "skill.updated": ["Изменён навык", "adaptive"],
  "skill.deleted": ["Удалён навык", "adaptive"],
  "skill.imported": ["Импорт навыков", "adaptive"],
  "activity.skills": ["Изменены навыки материала", "adaptive"],
  "adaptive.toggled": ["Адаптация курса", "adaptive"],
  "adaptive.override": ["Ручное решение по навыку", "adaptive"],
  "adaptive.pin": ["Закреплено задание ученику", "adaptive"],
  "submission.reviewed": ["Проверена работа", "grades"],
  "grade.updated": ["Изменена оценка", "grades"],
  "file.uploaded": ["Загружен файл", "files"],
  "file.cleanup": ["Очистка хранилища", "files"],
  "settings.updated": ["Изменены настройки", "settings"],
} as const satisfies Record<string, readonly [string, AuditCategory]>;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

/** Разделы для фильтра «Действие», в порядке показа */
export const AUDIT_CATEGORIES: { value: AuditCategory; label: string }[] = [
  { value: "auth", label: "Входы и выходы" },
  { value: "users", label: "Пользователи" },
  { value: "cohorts", label: "Группы" },
  { value: "courses", label: "Курсы" },
  { value: "content", label: "Содержание курсов" },
  { value: "adaptive", label: "Адаптивное обучение" },
  { value: "grades", label: "Оценки" },
  { value: "files", label: "Файлы" },
  { value: "settings", label: "Настройки" },
];
