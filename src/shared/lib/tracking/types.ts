// Модель событий трекинга, вдохновлённая xAPI (actor + verb + object + result + context).
// В мокапе сериализуется на /api/tracking/events.

export type TrackedActivityType = "video" | "pdf" | "presentation" | "quiz";

export type TrackingVerb =
  | "opened"
  | "played"
  | "paused"
  | "seeked"
  | "ratechanged"
  | "heartbeat"
  | "page_viewed"
  | "completed"
  | "closed";

export interface TrackingEvent {
  id: string;
  sessionId: string;
  userId: string;
  activityId: string;
  activityType: TrackedActivityType;
  verb: TrackingVerb;
  /** Видео: секунда; документ: индекс страницы */
  position?: number;
  payload?: Record<string, unknown>;
  ts: number;
}

/** Снимок прогресса, который клиент периодически шлёт (сервер — источник истины в проде; здесь мок). */
export interface ProgressSnapshot {
  sessionId: string;
  userId: string;
  activityId: string;
  activityType: TrackedActivityType;
  /** 0..100 — покрытие материала (просмотренные сегменты/страницы) */
  coverage: number;
  /** активное время с фокусом, сек */
  activeTimeSec: number;
  completed: boolean;
  // детализация
  seeks?: number;
  pauses?: number;
  maxRate?: number;
  pagesViewed?: number;
  totalPages?: number;
  durationSec?: number;
  ts: number;
}

/** Агрегат на сервере: один на (userId, activityId). */
export interface ActivityProgress extends ProgressSnapshot {
  userName: string;
  group?: string;
  firstAt: number;
  lastAt: number;
  sessions: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  group: string;
  score: number;
  materialsCompleted: number;
  materialsTotal: number;
  avgCoverage: number;
  quizAvg: number | null;
  streak: number;
  isCurrentUser?: boolean;
}

export interface LessonStatRow {
  userId: string;
  userName: string;
  group?: string;
  coverage: number;
  activeTimeSec: number;
  completed: boolean;
  seeks?: number;
  pagesViewed?: number;
  totalPages?: number;
  lastAt: number | null;
  status: "completed" | "in_progress" | "not_started";
}
