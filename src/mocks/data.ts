import type {
  Course,
  Program,
  QuizQuestion,
  Notification,
  GradeRow,
  Cohort,
  User,
  ScheduleSlot,
  PairTime,
} from "@/shared/types/domain";
import { dayMonth, daysAgo, dueInDays } from "./dates";

export const courses: Course[] = [
  {
    id: "c-matan",
    coverColor: "sky",
    code: "МАТ-101",
    title: "Математический анализ",
    description: "Пределы, производные и интегралы для студентов ИНЭК (группа М1217)",
    category: "Математика",
    tutorId: "u-tutor-1",
    enrolled: 28,
    progress: 35,
    sections: [
      {
        id: "s1",
        order: 1,
        title: "Модуль 1. Пределы и непрерывность",
        activities: [
          {
            id: "mv1",
            type: "video",
            title: "Видеолекция: Предел функции",
            durationMin: 12,
            src: "/media/lesson-matan.mp4",
          },
          {
            id: "mp1",
            type: "presentation",
            title: "Презентация: Теоремы о пределах",
            pages: 14,
          },
          {
            id: "md1",
            type: "pdf",
            title: "Конспект: Непрерывность функции",
            pages: 8,
          },
          {
            id: "mq1",
            type: "quiz",
            title: "Тест: Пределы и непрерывность",
            durationMin: 15,
            due: dueInDays(5),
          },
          {
            id: "ma1",
            type: "assignment",
            title: "Домашнее задание: вычисление пределов",
            due: dueInDays(9),
          },
        ],
      },
    ],
  },
  {
    id: "c-ped-101",
    coverColor: "teal",
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
          {
            id: "a3",
            type: "quiz",
            title: "Тест: основы",
            durationMin: 20,
            completed: false,
            due: dueInDays(-2),
          },
        ],
      },
      {
        id: "s2",
        order: 2,
        title: "Модуль 2. История педагогики",
        activities: [
          { id: "a4", type: "page", title: "Лекция 2", durationMin: 30 },
          { id: "a5", type: "assignment", title: "Эссе: Каменский", due: dueInDays(3) },
          { id: "a6", type: "forum", title: "Обсуждение: реформа образования" },
        ],
      },
    ],
  },
  {
    id: "c-info-201",
    coverColor: "iris",
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
          { id: "a3", type: "assignment", title: "Презентация урока", due: dueInDays(1) },
        ],
      },
    ],
  },
  {
    id: "c-psych-110",
    coverColor: "apricot",
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
  mq1: [
    {
      id: "mq1q1",
      type: "mcq",
      text: "Чему равен предел sin(x)/x при x → 0?",
      options: ["0", "1", "∞", "не существует"],
      correct: 1,
    },
    {
      id: "mq1q2",
      type: "boolean",
      text: "Функция, непрерывная на отрезке, ограничена на нём.",
      correct: true,
    },
    {
      id: "mq1q3",
      type: "short",
      text: "Как называется точка разрыва, в которой существуют конечные односторонние пределы?",
      correct: "первого рода",
    },
  ],
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
    body: `Эссе по курсу М1217 — до ${dayMonth(dueInDays(3))}`,
    createdAt: daysAgo(0, 3),
    read: false,
    link: "/courses/c-ped-101",
  },
  {
    id: "n2",
    type: "grade",
    title: "Оценка выставлена",
    body: "Тест по ИНФ-201: 87 из 100",
    createdAt: daysAgo(1, 2),
    read: false,
    link: "/gradebook",
  },
  {
    id: "n3",
    type: "announcement",
    title: "Расписание сессии",
    body: "Опубликовано расписание летней сессии 2026",
    createdAt: daysAgo(2, 5),
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
  "c-matan": [
    {
      userId: "u-stud-2",
      userName: "Иван Вагулин",
      items: [
        { itemId: "mq1", itemTitle: "Тест: Пределы", grade: null, max: 100 },
        { itemId: "ma1", itemTitle: "ДЗ: вычисление пределов", grade: null, max: 100 },
      ],
      total: 0,
    },
    {
      userId: "u-stud-1",
      userName: "Анастасия Соколова",
      items: [
        { itemId: "mq1", itemTitle: "Тест: Пределы", grade: 95, max: 100 },
        { itemId: "ma1", itemTitle: "ДЗ: вычисление пределов", grade: null, max: 100 },
      ],
      total: 47.5,
    },
    {
      userId: "u-stud-3",
      userName: "Кирилл Кузьмин",
      items: [
        { itemId: "mq1", itemTitle: "Тест: Пределы", grade: 88, max: 100 },
        { itemId: "ma1", itemTitle: "ДЗ: вычисление пределов", grade: null, max: 100 },
      ],
      total: 44,
    },
    {
      userId: "u-stud-6",
      userName: "Полина Жукова",
      items: [
        { itemId: "mq1", itemTitle: "Тест: Пределы", grade: 82, max: 100 },
        { itemId: "ma1", itemTitle: "ДЗ: вычисление пределов", grade: 88, max: 100 },
      ],
      total: 85,
    },
  ],
};

// исходные группы; курсы групп задаёт mocks/cohorts-store
export const cohorts: Omit<Cohort, "courseIds">[] = [
  {
    id: "co-1",
    name: "М1217",
    memberIds: ["u-stud-1", "u-stud-2", "u-stud-3", "u-stud-5", "u-stud-6", "u-stud-7", "u-stud-8"],
  },
  { id: "co-2", name: "ЭК-1237", memberIds: ["u-stud-4"] },
  { id: "co-3", name: "ПСХ-23-1", memberIds: [] },
];

export const users: User[] = [
  {
    id: "u-stud-1",
    name: "Анастасия Соколова",
    email: "sokolova@student.pspu.ru",
    role: "student",
    tenantId: "pspu",
    faculty: "ИНЭК",
    group: "М1217",
  },
  {
    id: "u-stud-2",
    name: "Иван Вагулин",
    email: "vagulin@student.pspu.ru",
    role: "student",
    tenantId: "pspu",
    faculty: "ИНЭК",
    group: "М1217",
  },
  {
    id: "u-stud-3",
    name: "Кирилл Кузьмин",
    email: "kuzmin@student.pspu.ru",
    role: "student",
    tenantId: "pspu",
    faculty: "ИНЭК",
    group: "М1217",
  },
  {
    id: "u-stud-5",
    name: "Дмитрий Орлов",
    email: "orlov@student.pspu.ru",
    role: "student",
    tenantId: "pspu",
    faculty: "ИНЭК",
    group: "М1217",
  },
  {
    id: "u-stud-6",
    name: "Полина Жукова",
    email: "zhukova@student.pspu.ru",
    role: "student",
    tenantId: "pspu",
    faculty: "ИНЭК",
    group: "М1217",
  },
  {
    id: "u-stud-7",
    name: "Артём Белов",
    email: "belov@student.pspu.ru",
    role: "student",
    tenantId: "pspu",
    faculty: "ИНЭК",
    group: "М1217",
  },
  {
    id: "u-stud-8",
    name: "Софья Морозова",
    email: "morozova@student.pspu.ru",
    role: "student",
    tenantId: "pspu",
    faculty: "ИНЭК",
    group: "М1217",
  },
  {
    id: "u-stud-4",
    name: "Ольга Иванова",
    email: "ivanova@student.pspu.ru",
    role: "student",
    tenantId: "pspu",
    faculty: "ИНЭК",
    group: "ЭК-1237",
  },
  {
    id: "u-tutor-1",
    name: "Казаринова Наталья Леонидовна",
    email: "kazarinova@pspu.ru",
    role: "tutor",
    tenantId: "pspu",
    faculty: "ИНЭК",
  },
  {
    id: "u-org",
    name: "Анна Лебедева",
    email: "organizer@pspu.ru",
    role: "organizer",
    tenantId: "pspu",
    faculty: "ИНЭК",
  },
  {
    id: "u-admin",
    name: "Иван Морозов",
    email: "admin@pspu.ru",
    role: "admin",
    tenantId: "pspu",
    faculty: "ИНЭК",
  },
];

// Звонки — условные, для мокапа. Для реального ПНИПУ взять из расписания вуза.
export const pairTimes: PairTime[] = [
  { n: 1, start: "08:00", end: "09:35" },
  { n: 2, start: "09:45", end: "11:20" },
  { n: 3, start: "11:30", end: "13:05" },
  { n: 4, start: "13:55", end: "15:30" },
  { n: 5, start: "15:40", end: "17:15" },
];

// Расписание группы М1217 на неделю
export const schedule: Record<string, ScheduleSlot[]> = {
  М1217: [
    { id: "sl1", courseId: "c-matan", weekday: 1, pair: 1, kind: "lecture", room: "Г-312" },
    { id: "sl2", courseId: "c-psych-110", weekday: 1, pair: 3, kind: "lecture", room: "К-105" },
    { id: "sl3", courseId: "c-ped-101", weekday: 2, pair: 2, kind: "lecture", room: "К-201" },
    { id: "sl4", courseId: "c-info-201", weekday: 2, pair: 3, kind: "practice", room: "Г-415" },
    { id: "sl5", courseId: "c-matan", weekday: 3, pair: 1, kind: "practice", room: "Г-310" },
    { id: "sl6", courseId: "c-ped-101", weekday: 3, pair: 4, kind: "seminar", room: "К-204" },
    { id: "sl7", courseId: "c-info-201", weekday: 4, pair: 2, kind: "lecture", room: "Г-401" },
    { id: "sl8", courseId: "c-psych-110", weekday: 4, pair: 4, kind: "seminar", room: "К-108" },
    { id: "sl9", courseId: "c-matan", weekday: 5, pair: 2, kind: "practice", room: "Г-310" },
    { id: "sl10", courseId: "c-info-201", weekday: 5, pair: 3, kind: "practice", room: "Г-415" },
  ],
};
