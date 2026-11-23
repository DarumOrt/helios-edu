import { describe, expect, it } from "vitest";
import { mediaProgress } from "./media";
import type { ProgressSnapshot } from "./types";

const pdf: ProgressSnapshot = {
  sessionId: "tab1",
  userId: "student",
  activityId: "doc",
  activityType: "pdf",
  coverage: 0,
  completed: false,
  activeTimeSec: 0,
  totalPages: 5,
  position: 1,
  ts: 6000,
  media: { watched: [[0, 2]], active: [[1000, 6000]], positionAt: 6000 },
};
const merge = (prior: ProgressSnapshot | null, next: ProgressSnapshot) => ({
  ...next,
  ...mediaProgress(prior, next),
});

describe("просмотр PDF и видео в нескольких вкладках", () => {
  it("объединяет страницы и время, повтор и запоздалый снимок сохраняют последнее место", () => {
    const tab2 = {
      ...pdf,
      sessionId: "tab2",
      position: 4,
      media: { watched: [[3, 5]], active: [[4000, 9000]], positionAt: 9000 },
    };
    const result = merge(merge(null, tab2), pdf);
    expect(result).toMatchObject({
      coverage: 80,
      completed: true,
      pagesViewed: 4,
      activeTimeSec: 8,
      position: 4,
    });
    expect(merge(result, tab2)).toMatchObject({ media: result.media, activeTimeSec: 8, coverage: 80 });
  });

  it("перемотка и повтор не закрывают промежуток между отрезками", () => {
    const video: ProgressSnapshot = {
      ...pdf,
      activityType: "video",
      durationSec: 10,
      media: {
        watched: [
          [0, 3000],
          [2000, 4000],
          [6000, 10000],
        ],
        active: [[2000, 3000]],
        positionAt: 3000,
      },
    };
    const first = merge(null, video);
    expect(first).toMatchObject({ coverage: 80, completed: false });
    expect(merge(first, { ...video, media: { ...video.media!, watched: [[4000, 5000]] } })).toMatchObject({
      coverage: 90,
      completed: true,
      activeTimeSec: 1,
    });
  });

  it("сохраняет прежний агрегат без предположений о номерах просмотренных страниц", () => {
    const prior = { ...pdf, media: undefined, coverage: 60, activeTimeSec: 15, pagesViewed: 3 };
    expect(merge(prior, pdf)).toMatchObject({
      coverage: 60,
      pagesViewed: 3,
      activeTimeSec: 20,
      completed: false,
      media: { watched: [[0, 2]] },
    });
  });
});
