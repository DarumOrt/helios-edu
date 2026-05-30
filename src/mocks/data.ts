import type {
  Course,
  Program,
  QuizQuestion,
  Notification,
  GradeRow,
  Cohort,
  User,
} from "@/shared/types/domain";

export const courses: Course[] = [
  {
    id: "c-ped-101",
    code: "ПЕД-101",
    title: "Введение в педагогику",
    description: "Базовый курс для студентов 1 курса педагогического направления",
    category: "Педагогика",
    tutorId: "u-tutor-1",
    enrolled: 124,
    progress: 45,
    sections: [
      {
        id: "s1",
        order: 1,
        title: "Модуль 1. Основы педагогики",
        activities: [
          { id: "a1", type: "page", title: "Введение в дисциплину", durationMin: 10, completed: true },
          { id: "a2", type: "file", title: "Лекция 1 (PDF)", completed: true },
          { id: "a3", type: "quiz", title: "Тест: основы", durationMin: 20, completed: false, due: "2026-05-12" },
        ],
      },
      {
        id: "s2",
        order: 2,
        title: "Модуль 2. История педагогики",
        activities: [
          { id: "a4", type: "page", title: "Лекция 2", durationMin: 30 },
          { id: "a5", type: "assignment", title: "Эссе: Каменский", due: "2026-05-20" },
          { id: "a6", type: "forum", title: "Обсуждение: реформа образования" },
        ],
      },
    ],
  },
  {
    id: "c-info-201",
    code: "ИНФ-201",
    title: "Информационные технологии в образовании",
    description: "Цифровые инструменты для будущего педагога",
    category: "Информатика",
    tutorId: "u-tutor-1",
    enrolled: 87,
    progress: 70,
    sections: [
      {
        id: "s1",
        order: 1,
        title: "Модуль 1. Цифровая среда",
        activities: [
          { id: "a1", type: "page", title: "Обзор LMS", durationMin: 15, completed: true },
          { id: "a2", type: "quiz", title: "Тест по цифровым инструментам", completed: true },
          { id: "a3", type: "assignment", title: "Презентация урока", due: "2026-05-18" },
        ],
      },
    ],
  },
  {
    id: "c-psych-110",
    code: "ПСХ-110",
    title: "Возрастная психология",
    description: "Развитие личности от младенчества до зрелости",
    category: "Психология",
    tutorId: "u-tutor-1",
    enrolled: 156,
    progress: 20,
    sections: [
      {
        id: "s1",
        order: 1,
        title: "Модуль 1. Введение",
        activities: [
          { id: "a1", type: "page", title: "Предмет психологии", durationMin: 20 },
          { id: "a2", type: "file", title: "Хрестоматия", completed: false },
        ],
      },
    ],
  },
];

export const programs: Program[] = [
  {
    id: "p-ped-bachelor",
    title: "Бакалавриат: Педагогическое образование",
    description: "Очная форма, 4 года",
    courseIds: ["c-ped-101", "c-psych-110", "c-info-201"],
    rule: "sequential",
  },
  {
    id: "p-it-teacher",
    title: "Учитель информатики",
    description: "Профессиональная переподготовка",
    courseIds: ["c-info-201", "c-ped-101"],
    rule: "any-order",
  },
];

export const quizQuestions: Record<string, QuizQuestion[]> = {
  a3: [
    {
      id: "q1",
      type: "mcq",
      text: "Кто считается основоположником научной педагогики?",
      options: ["Аристотель", "Я. А. Коменский", "К. Д. Ушинский", "Ж.-Ж. Руссо"],
      correct: 1,
    },
    {
      id: "q2",
      type: "boolean",
      text: "Дидактика — это раздел педагогики, изучающий обучение.",
      correct: true,
    },
    {
      id: "q3",
      type: "short",
      text: "Назовите автора труда «Великая дидактика».",
      correct: "Коменский",
    },
  ],
};

export const notifications: Notification[] = [
  {
    id: "n1",
    type: "deadline",
    title: "Скоро дедлайн",
    body: "Эссе по курсу М1217 — до 20 мая",
    createdAt: "2026-05-04T09:30:00Z",
    read: false,
    link: "/courses/c-ped-101",
  },
  {
    id: "n2",
    type: "grade",
    title: "Оценка выставлена",
    body: "Тест по ИНФ-201: 87 из 100",
    createdAt: "2026-05-03T14:10:00Z",
    read: false,
    link: "/gradebook",
  },
  {
    id: "n3",
    type: "announcement",
    title: "Расписание сессии",
    body: "Опубликовано расписание летней сессии 2026",
    createdAt: "2026-05-02T08:00:00Z",
    read: true,
  },
];

export const gradebook: Record<string, GradeRow[]> = {
  "c-ped-101": [
    {
      userId: "u-stud-1",
      userName: "Анастасия Соколова",
      items: [
        { itemId: "a3", itemTitle: "Тест: основы", grade: 85, max: 100 },
        { itemId: "a5", itemTitle: "Эссе: Каменский", grade: null, max: 100 },
      ],
      total: 42.5,
    },
    {
      userId: "u-stud-2",
      userName: "Иван Вагулин",
      items: [
        { itemId: "a3", itemTitle: "Тест: основы", grade: 73, max: 100 },
        { itemId: "a5", itemTitle: "Эссе: Каменский", grade: 90, max: 100 },
      ],
      total: 81.5,
    },
    {
      userId: "u-stud-3",
      userName: "Кирилл Кузьмин",
      items: [
        { itemId: "a3", itemTitle: "Тест: основы", grade: 95, max: 100 },
        { itemId: "a5", itemTitle: "Эссе: Каменский", grade: 88, max: 100 },
      ],
      total: 91.5,
    },
  ],
};

export const cohorts: Cohort[] = [
  { id: "co-1", name: "М1217", memberIds: ["u-stud-1", "u-stud-2", "u-stud-3"] },
  { id: "co-2", name: "1237", memberIds: ["u-stud-4"] },
  { id: "co-3", name: "ПСХ-23-1", memberIds: [] },
];

export const users: User[] = [
  { id: "u-stud-1", name: "Анастасия Соколова", email: "sokolova@student.pspu.ru", role: "student", tenantId: "pspu", faculty: "ИНЭК", group: "М1217" },
  { id: "u-stud-2", name: "Иван Вагулин", email: "vagulin@student.pspu.ru", role: "student", tenantId: "pspu", faculty: "ИНЭК", group: "М1217" },
  { id: "u-stud-3", name: "Кирилл Кузьмин", email: "kuzmin@student.pspu.ru", role: "student", tenantId: "pspu", faculty: "ИНЭК", group: "М1217" },
  { id: "u-stud-4", name: "Ольга Иванова", email: "ivanova@student.pspu.ru", role: "student", tenantId: "pspu", faculty: "ИНЭК", group: "ЭК-1237" },
  { id: "u-tutor-1", name: "Казаринова Наталья Леонидовна", email: "kazarinova@pspu.ru", role: "tutor", tenantId: "pspu", faculty: "ИНЭК" },
  { id: "u-org", name: "Анна Лебедева", email: "organizer@pspu.ru", role: "organizer", tenantId: "pspu", faculty: "ИНЭК" },
  { id: "u-admin", name: "Иван Морозов", email: "admin@pspu.ru", role: "admin", tenantId: "pspu", faculty: "ИНЭК" },
];