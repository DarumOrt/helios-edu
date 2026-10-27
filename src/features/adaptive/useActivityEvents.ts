"use client";

import { useEffect } from "react";
import { mutate } from "swr";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import { adaptiveApi, adaptiveKeys } from "./api";

// События просмотра материала для адаптивной модели (только ученик): открыл — viewed, досмотрел — completed.
export function useActivityEvents(courseId: string, activityId: string | undefined) {
  const role = useSession((s) => s.role);
  const learner = can(role, "quiz.take");

  useEffect(() => {
    if (learner && activityId) void adaptiveApi.event(courseId, "activity.viewed", activityId);
  }, [learner, courseId, activityId]);

  return (coverage: number) => {
    if (!learner || !activityId) return;
    void adaptiveApi.event(courseId, "activity.completed", activityId, coverage).then(() => {
      void mutate(adaptiveKeys.progress(courseId));
      void mutate(adaptiveKeys.next(courseId));
    });
  };
}
