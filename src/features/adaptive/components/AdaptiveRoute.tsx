"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowRight, Lock, PartyPopper, Pin, Route, SkipForward, Sparkles } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { activityHref } from "@/shared/lib/activity-href";
import { cn } from "@/shared/lib/utils";
import { Badge, Button, Card, CardBody, Progress, Skeleton } from "@/shared/ui";
import type {
  Activity,
  AdaptiveNext,
  AdaptiveProgress,
  Course,
  ReasonCode,
  SkillStatus,
} from "@/shared/types/domain";
import { adaptiveApi, adaptiveKeys, masteryPercent } from "../api";

const reasonIcon: Record<ReasonCode, typeof Route> = {
  pinned_by_teacher: Pin,
  linear_order: Route,
  weakest_skill: Sparkles,
  review_material: Route,
  all_mastered: PartyPopper,
};

const statusLabel: Record<SkillStatus, { label: string; tone: "success" | "primary" | "neutral" }> = {
  mastered: { label: "освоен", tone: "success" },
  learning: { label: "изучается", tone: "primary" },
  locked: { label: "закрыт", tone: "neutral" },
};

// Адаптивный маршрут ученика по курсу: что делать дальше и почему, освоение навыков, что повторить.
export function AdaptiveRoute({ course }: { course: Course }) {
  const router = useRouter();
  const next = useSWR<AdaptiveNext>(adaptiveKeys.next(course.id), fetcher);
  const progress = useSWR<AdaptiveProgress>(adaptiveKeys.progress(course.id), fetcher);
  const activities = new Map<string, Activity>(
    (course.sections ?? []).flatMap((s) => s.activities).map((a) => [a.id, a]),
  );
  // курс без доступа к адаптации (например, не зачислен в C#) — блок просто не показываем
  if (next.error || progress.error) return null;

  const rec = next.data?.recommendation;
  const target = rec?.activityId ? activities.get(rec.activityId) : undefined;
  const Icon = rec ? reasonIcon[rec.reasonCode] : Route;
  const weak = (next.data?.personal ?? []).filter((p) => p.activityIds.length);

  async function go() {
    if (!rec || !target) return;
    await adaptiveApi.react(rec.id, "accepted").catch(() => undefined);
    router.push(activityHref(course.id, target));
  }

  async function skip() {
    if (!rec) return;
    await adaptiveApi.react(rec.id, "skipped").catch(() => undefined);
    await next.mutate();
  }

  return (
    <Card className="mb-6">
      <CardBody className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="route-title">
          <h2 id="route-title" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Route size={16} aria-hidden /> Ваш маршрут
          </h2>
          {!rec ? (
            <Skeleton className="mt-3 h-24" />
          ) : (
            <div className="mt-3 rounded-xl bg-primary-soft/60 p-4">
              <p className="flex items-start gap-2 text-sm">
                <Icon size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <span>{rec.reasonText}</span>
              </p>
              {target && <p className="mt-2 text-lg font-semibold">{target.title}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {target && (
                  <Button onClick={go}>
                    Перейти <ArrowRight size={16} aria-hidden />
                  </Button>
                )}
                {target && rec.reasonCode !== "pinned_by_teacher" && (
                  <Button variant="ghost" onClick={skip}>
                    <SkipForward size={16} aria-hidden /> Другое задание
                  </Button>
                )}
              </div>
            </div>
          )}

          {weak.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-medium text-muted-foreground">Стоит повторить</h3>
              <ul className="mt-1.5 space-y-1">
                {weak.flatMap((p) =>
                  p.activityIds
                    .map((id) => activities.get(id))
                    .filter((a): a is Activity => Boolean(a))
                    .map((a) => (
                      <li key={`${p.skillId}-${a.id}`}>
                        <Link
                          href={activityHref(course.id, a)}
                          className="text-sm text-primary underline-offset-4 hover:underline"
                        >
                          {a.title}
                        </Link>
                      </li>
                    )),
                )}
              </ul>
            </div>
          )}
        </section>

        <section aria-labelledby="skills-title" className="lg:border-l lg:pl-6">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="skills-title" className="text-sm font-medium text-muted-foreground">
              Освоение навыков
            </h2>
            {progress.data && (
              <span className="font-mono text-2xl font-semibold tabular-nums">{progress.data.progress}%</span>
            )}
          </div>
          {progress.data && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Материалов пройдено: {progress.data.materials.done} из {progress.data.materials.total}
            </p>
          )}
          <ul className="mt-3 space-y-3">
            {!progress.data && [0, 1, 2].map((i) => <Skeleton key={i} className="h-8" />)}
            {progress.data?.skills.map((s) => (
              <li key={s.id}>
                <div className="flex items-start justify-between gap-2 text-sm">
                  <span className={cn("min-w-0", s.status === "locked" && "text-muted-foreground")}>
                    {s.status === "locked" && <Lock size={12} className="mr-1 inline" aria-hidden />}
                    {s.code && <span className="mr-1 font-mono text-xs text-muted-foreground">{s.code}</span>}
                    {s.title}
                  </span>
                  <Badge tone={statusLabel[s.status].tone} className="shrink-0">
                    {statusLabel[s.status].label}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Progress
                    value={s.pKnown * 100}
                    tone={s.status === "mastered" ? "success" : "primary"}
                    className="flex-1"
                  />
                  <span className="w-10 text-right font-mono text-xs text-muted-foreground tabular-nums">
                    {masteryPercent(s.pKnown)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </CardBody>
    </Card>
  );
}
