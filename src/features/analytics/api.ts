import type { LessonStatRow, TrackingEvent } from "@/shared/lib/tracking/types";

export interface CourseActivityStat {
  activityId: string;
  title: string;
  type: string;
  started: number;
  completed: number;
  total: number;
  avgCoverage: number;
  avgTimeSec: number;
}

export interface LessonStatsResponse {
  rows: LessonStatRow[];
  events?: TrackingEvent[];
}

export interface CourseStatsResponse {
  activities: CourseActivityStat[];
}
