import type {
  TrackingEvent,
  ProgressSnapshot,
  ActivityProgress,
  LeaderboardEntry,
  LessonStatRow,
  TrackedActivityType,
} from "@/shared/lib/tracking/types";
import { users, cohorts } from "./data";

// In-memory "БД" мокапа. Привязана к globalThis, чтобы переживать HMR в dev.
// В проде: ingest → event store (ClickHouse) → агрегация → этот же интерфейс.

interface Store {
  events: TrackingEvent[];
  progress: Map<string, ActivityProgress>; // key: userId::activityId
  seeded: boolean;
}

const g = globalThis as unknown as { __helios_tracking?: Store };
const store: Store =
  g.__helios_tracking ?? (g.__helios_tracking = { events: [], progress: new Map(), seeded: false });

// активности курса, участвующие в метриках
export const COURSE_ACTIVITIES: Record<
  string,
  { id: string; type: TrackedActivityType; title: string; totalPages?: number }[]
> = {
  "c-matan": [
    { id: "mv1", type: "video", title: "Видеолекция: Предел функции" },
    { id: "mp1", type: "presentation", title: "Презентация: Теоремы о пределах", totalPages: 14 },
    { id: "md1", type: "pdf", title: "Конспект: Непрерывность функции", totalPages: 8 },
    { id: "mq1", type: "quiz", title: "Тест: Пределы и непрерывность" },
  ],
};

export function activityCourse(activityId: string): string | null {
  for (const [courseId, list] of Object.entries(COURSE_ACTIVITIES)) {
    if (list.some((a) => a.id === activityId)) return courseId;
  }
  return null;
}

function userInfo(userId: string) {
  const u = users.find((x) => x.id === userId);
  return { name: u?.name ?? "Студент", group: u?.group };
}

function key(userId: string, activityId: string) {
  return `${userId}::${activityId}`;
}

// ---- сид: правдоподобная активность группы М1217 по курсу c-matan ----
function seed() {
  if (store.seeded) return;
  store.seeded = true;

  const roster = (cohorts.find((c) => c.name === "М1217")?.memberIds ?? []).filter(
    (id) => id !== "u-stud-2" // текущего пользователя оставим "в процессе", он наберёт сам
  );

  // профили вовлечённости: [videoCov, presPages, pdfPages, quizScore]
  const profiles: Record<string, [number, number, number, number]> = {
    "u-stud-1": [100, 14, 8, 95], // Соколова — отличница
    "u-stud-3": [96, 13, 8, 88], // Кузьмин
    "u-stud-5": [74, 9, 6, 70], // Орлов
    "u-stud-6": [88, 12, 7, 82], // Жукова
    "u-stud-7": [40, 5, 3, 55], // Белов — отстаёт
    "u-stud-8": [62, 10, 4, 64], // Морозова
  };

  const now = Date.now();
  for (const userId of roster) {
    const p = profiles[userId] ?? [50, 7, 4, 60];
    const [vCov, presPages, pdfPages, quiz] = p;
    upsert({
      sessionId: "seed", userId, activityId: "mv1", activityType: "video",
      coverage: vCov, activeTimeSec: Math.round((vCov / 100) * 700),
      completed: vCov >= 90, seeks: Math.floor(Math.random() * 4), pauses: Math.floor(Math.random() * 3),
      maxRate: Math.random() > 0.6 ? 1.5 : 1, durationSec: 720, ts: now - Math.random() * 4 * 86400000,
    });
    upsert({
      sessionId: "seed", userId, activityId: "mp1", activityType: "presentation",
      coverage: Math.round((presPages / 14) * 100), activeTimeSec: presPages * 25,
      completed: presPages / 14 >= 0.8, pagesViewed: presPages, totalPages: 14,
      ts: now - Math.random() * 3 * 86400000,
    });
    upsert({
      sessionId: "seed", userId, activityId: "md1", activityType: "pdf",
      coverage: Math.round((pdfPages / 8) * 100), activeTimeSec: pdfPages * 30,
      completed: pdfPages / 8 >= 0.8, pagesViewed: pdfPages, totalPages: 8,
      ts: now - Math.random() * 3 * 86400000,
    });
    upsert({
      sessionId: "seed", userId, activityId: "mq1", activityType: "quiz",
      coverage: quiz, activeTimeSec: 200 + Math.floor(Math.random() * 300),
      completed: true, ts: now - Math.random() * 2 * 86400000,
    });
  }

  // текущий пользователь (Вагулин) — частичный старт, остальное наберёт вживую
  upsert({
    sessionId: "seed", userId: "u-stud-2", activityId: "md1", activityType: "pdf",
    coverage: 50, activeTimeSec: 120, completed: false, pagesViewed: 4, totalPages: 8, ts: now - 86400000,
  });
}

export function upsert(s: ProgressSnapshot) {
  const k = key(s.userId, s.activityId);
  const prev = store.progress.get(k);
  const info = userInfo(s.userId);
  const merged: ActivityProgress = {
    ...s,
    userName: info.name,
    group: info.group,
    firstAt: prev?.firstAt ?? s.ts,
    lastAt: s.ts,
    sessions: prev && prev.sessionId !== s.sessionId ? prev.sessions + 1 : prev?.sessions ?? 1,
    // покрытие/время не должны уменьшаться (объединение сессий)
    coverage: Math.max(prev?.coverage ?? 0, s.coverage),
    activeTimeSec: Math.max(prev?.activeTimeSec ?? 0, s.activeTimeSec),
    pagesViewed: Math.max(prev?.pagesViewed ?? 0, s.pagesViewed ?? 0),
    completed: (prev?.completed ?? false) || s.completed,
  };
  store.progress.set(k, merged);
}

export function ingest(events: TrackingEvent[]) {
  store.events.push(...events);
  if (store.events.length > 5000) store.events = store.events.slice(-5000);
}

export function getProgress(userId: string, activityId: string): ActivityProgress | null {
  seed();
  return store.progress.get(key(userId, activityId)) ?? null;
}

export function getActivityEvents(activityId: string, userId?: string): TrackingEvent[] {
  seed();
  return store.events
    .filter((e) => e.activityId === activityId && (!userId || e.userId === userId))
    .sort((a, b) => a.ts - b.ts);
}

// статистика по уроку (одна активность) — для преподавателя
export function lessonStats(activityId: string): LessonStatRow[] {
  seed();
  const courseId = activityCourse(activityId);
  const roster = rosterForCourse(courseId);
  return roster.map((userId) => {
    const p = store.progress.get(key(userId, activityId));
    const info = userInfo(userId);
    const status: LessonStatRow["status"] = !p
      ? "not_started"
      : p.completed
      ? "completed"
      : "in_progress";
    return {
      userId,
      userName: info.name,
      group: info.group,
      coverage: p?.coverage ?? 0,
      activeTimeSec: p?.activeTimeSec ?? 0,
      completed: p?.completed ?? false,
      seeks: p?.seeks,
      pagesViewed: p?.pagesViewed,
      totalPages: p?.totalPages,
      lastAt: p?.lastAt ?? null,
      status,
    };
  });
}

function rosterForCourse(_courseId: string | null): string[] {
  // в мокапе все метрики идут по М1217
  return (cohorts.find((c) => c.name === "М1217")?.memberIds ?? []).slice();
}

// агрегированная статистика курса: по каждой активности
export function courseStats(courseId: string) {
  seed();
  const acts = COURSE_ACTIVITIES[courseId] ?? [];
  const roster = rosterForCourse(courseId);
  return acts.map((a) => {
    const rows = roster.map((u) => store.progress.get(key(u, a.id)));
    const present = rows.filter(Boolean) as ActivityProgress[];
    const completed = present.filter((r) => r.completed).length;
    const avgCoverage = present.length
      ? Math.round(present.reduce((s, r) => s + r.coverage, 0) / present.length)
      : 0;
    const avgTime = present.length
      ? Math.round(present.reduce((s, r) => s + r.activeTimeSec, 0) / present.length)
      : 0;
    return {
      activityId: a.id,
      title: a.title,
      type: a.type,
      started: present.length,
      completed,
      total: roster.length,
      avgCoverage,
      avgTimeSec: avgTime,
    };
  });
}

// таблица лидеров по группе/курсу
export function leaderboard(courseId: string, currentUserId?: string): LeaderboardEntry[] {
  seed();
  const acts = COURSE_ACTIVITIES[courseId] ?? [];
  const content = acts.filter((a) => a.type !== "quiz");
  const quizzes = acts.filter((a) => a.type === "quiz");
  const roster = rosterForCourse(courseId);

  const entries = roster.map((userId) => {
    const info = userInfo(userId);
    const contentCovs = content.map((a) => store.progress.get(key(userId, a.id))?.coverage ?? 0);
    const avgCoverage = contentCovs.length
      ? Math.round(contentCovs.reduce((s, c) => s + c, 0) / contentCovs.length)
      : 0;
    const quizScores = quizzes
      .map((a) => store.progress.get(key(userId, a.id))?.coverage)
      .filter((v): v is number => v != null);
    const quizAvg = quizScores.length
      ? Math.round(quizScores.reduce((s, c) => s + c, 0) / quizScores.length)
      : null;
    const materialsCompleted = acts.filter(
      (a) => store.progress.get(key(userId, a.id))?.completed
    ).length;

    // композитный балл: 50% покрытие материалов + 30% тесты + 20% доля завершённого
    const completionRate = (materialsCompleted / acts.length) * 100;
    const score = Math.round(
      avgCoverage * 0.5 + (quizAvg ?? 0) * 0.3 + completionRate * 0.2
    );

    // streak — псевдослучайный, но стабильный по id
    const streak = (userId.charCodeAt(userId.length - 1) % 6) + (materialsCompleted > 2 ? 4 : 1);

    return {
      userId,
      userName: info.name,
      group: info.group ?? "—",
      score,
      materialsCompleted,
      materialsTotal: acts.length,
      avgCoverage,
      quizAvg,
      streak,
      isCurrentUser: userId === currentUserId,
    };
  });

  entries.sort((a, b) => b.score - a.score || b.avgCoverage - a.avgCoverage);
  return entries.map((e, i) => ({ ...e, rank: i + 1 }));
}
