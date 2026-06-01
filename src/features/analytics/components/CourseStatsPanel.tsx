"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Video,
  FileText,
  Presentation,
  ClipboardCheck,
  Users,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { Card, CardBody, DataState, Progress, Badge } from "@/shared/ui";
import { fmtDuration } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { LessonStatsPanel } from "./LessonStatsPanel";
import type { CourseStatsResponse, CourseActivityStat } from "../api";

const typeIcon: Record<string, LucideIcon> = {
  video: Video,
  pdf: FileText,
  presentation: Presentation,
  quiz: ClipboardCheck,
};

export function CourseStatsPanel({ courseId }: { courseId: string }) {
  const { data, error, isLoading } = useSWR<CourseStatsResponse>(
    `/api/analytics/course/${courseId}`,
    fetcher,
    { refreshInterval: 5000 }
  );
  const [selected, setSelected] = useState<string | null>(null);

  const activities = data?.activities ?? [];
  const selectedAct = activities.find((a) => a.activityId === selected);

  return (
    <div className="space-y-5">
      <DataState loading={isLoading} error={error} empty={!activities.length}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activities.map((a) => (
            <ActivityStatCard
              key={a.activityId}
              stat={a}
              active={selected === a.activityId}
              onClick={() => setSelected(selected === a.activityId ? null : a.activityId)}
            />
          ))}
        </div>
      </DataState>

      {selectedAct && (
        <div className="animate-fade-in">
          <LessonStatsPanel
            activityId={selectedAct.activityId}
            title={`Детально: ${selectedAct.title}`}
          />
        </div>
      )}
      {!selectedAct && activities.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Выберите материал выше, чтобы увидеть, кто и как его изучил
        </p>
      )}
    </div>
  );
}

function ActivityStatCard({
  stat,
  active,
  onClick,
}: {
  stat: CourseActivityStat;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = typeIcon[stat.type] ?? FileText;
  const completionPct = stat.total ? Math.round((stat.completed / stat.total) * 100) : 0;
  return (
    <Card
      className={cn(
        "cursor-pointer transition hover:shadow-elevate",
        active && "ring-2 ring-primary/40 border-primary/40"
      )}
      onClick={onClick}
    >
      <CardBody>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
            <Icon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-sm truncate">{stat.title}</h4>
              <Badge tone={completionPct >= 70 ? "success" : completionPct >= 40 ? "warning" : "danger"}>
                {completionPct}%
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 size={12} /> {stat.completed}/{stat.total} изучили
              </span>
              <span className="flex items-center gap-1">
                <Users size={12} /> {stat.started} начали
              </span>
              {stat.type !== "quiz" && (
                <span>⌀ {fmtDuration(stat.avgTimeSec)}</span>
              )}
            </div>
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>средн. покрытие группы</span>
                <span className="tabular-nums">{stat.avgCoverage}%</span>
              </div>
              <Progress value={stat.avgCoverage} tone={stat.avgCoverage >= 70 ? "success" : "primary"} />
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
