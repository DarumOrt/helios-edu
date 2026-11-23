import type { ProgressSnapshot } from "./types";

// Полуоткрытые интервалы. Видео и активное время измеряются в мс, PDF — в страницах с нуля.
export interface MediaRanges {
  watched: number[][];
  active: number[][];
  positionAt: number;
}

export function union(left: number[][], right: number[][]) {
  const ranges: number[][] = [];
  for (const [start, end] of [...left, ...right].sort((a, b) => a[0] - b[0])) {
    if (!(start < end)) continue;
    const last = ranges.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else ranges.push([start, end]);
  }
  return ranges;
}

const length = (ranges: number[][]) => ranges.reduce((sum, [start, end]) => sum + end - start, 0);

export function mediaProgress(prior: ProgressSnapshot | null | undefined, snapshot: ProgressSnapshot) {
  const incoming = snapshot.media!;
  const previous = prior?.media;
  const watched = union(previous?.watched ?? [], incoming.watched);
  const active = union(previous?.active ?? [], incoming.active);
  const paged = snapshot.activityType !== "video";
  const limit = paged ? snapshot.totalPages : Math.round((snapshot.durationSec ?? 0) * 1000);
  const covered = length(watched);
  const coverage = Math.max(
    prior?.coverage ?? 0,
    limit ? Math.min(100, Math.round((covered * 100) / limit)) : 0,
  );
  return {
    coverage,
    completed: Boolean(prior?.completed) || coverage >= (paged ? 80 : 90),
    activeTimeSec: Math.min(
      604800,
      (prior?.activeTimeSec ?? 0) +
        Math.floor(length(active) / 1000) -
        Math.floor(length(previous?.active ?? []) / 1000),
    ),
    pagesViewed: paged ? Math.max(prior?.pagesViewed ?? 0, covered) : undefined,
    position:
      snapshot.position !== undefined && incoming.positionAt >= (previous?.positionAt ?? 0)
        ? snapshot.position
        : prior?.position,
    media: { watched, active, positionAt: Math.max(previous?.positionAt ?? 0, incoming.positionAt) },
  };
}
