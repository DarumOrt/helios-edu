"use client";

import { mutate } from "swr";

export function revalidateCourseProgress(courseId: string) {
  return Promise.all([
    mutate(`/api/courses/${courseId}`),
    mutate("/api/courses"),
    mutate("/api/courses?sections=1"),
  ]);
}
