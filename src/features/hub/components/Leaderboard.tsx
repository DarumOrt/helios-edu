"use client";

import useSWR from "swr";
import { Flame, Trophy, Medal, Crown, BookOpen, Target } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { Card, CardBody, DataState, Avatar, Badge, Progress } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import type { LeaderboardEntry } from "@/shared/lib/tracking/types";

interface Resp {
  courseId: string;
  entries: LeaderboardEntry[];
}

export function Leaderboard({ courseId }: { courseId: string }) {
  const user = useSessionStore((s) => s.user);
  const { data, error, isLoading } = useSWR<Resp>(
    `/api/hub/leaderboard?courseId=${courseId}&userId=${user.id}`,
    fetcher,
    { refreshInterval: 5000 },
  );

  const entries = data?.entries ?? [];
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const me = entries.find((e) => e.isCurrentUser);

  return (
    <DataState loading={isLoading} error={error} empty={!entries.length}>
      {/* Подиум топ-3 */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[top3[1], top3[0], top3[2]].map((e, i) =>
          e ? <PodiumCard key={e.userId} entry={e} place={[2, 1, 3][i]} /> : <div key={i} />,
        )}
      </div>

      {/* Личная карточка */}
      {me && me.rank > 3 && (
        <Card className="mb-4 border-primary/40 bg-primary-soft/40">
          <CardBody className="py-3">
            <RowContent entry={me} />
          </CardBody>
        </Card>
      )}

      {/* Остальные */}
      <Card>
        <CardBody className="divide-y p-0">
          {rest.map((e) => (
            <div key={e.userId} className={cn("px-4 py-3", e.isCurrentUser && "bg-primary-soft/40")}>
              <RowContent entry={e} />
            </div>
          ))}
        </CardBody>
      </Card>
    </DataState>
  );
}

function PodiumCard({ entry, place }: { entry: LeaderboardEntry; place: number }) {
  const ring = place === 1 ? "ring-highlight" : "ring-border";
  const Icon = place === 1 ? Crown : place === 2 ? Trophy : Medal;
  const iconColor = place === 1 ? "text-warning" : "text-muted-foreground";
  return (
    <Card
      className={cn(
        "text-center transition",
        place === 1 ? "border-foreground/20" : "",
        entry.isCurrentUser && "border-primary/50",
      )}
    >
      <CardBody className="flex flex-col items-center py-5">
        <div className="relative">
          <div className={cn("rounded-full ring-2 ring-offset-2", ring)}>
            <Avatar name={entry.userName} size={place === 1 ? 56 : 46} />
          </div>
          <Icon size={place === 1 ? 22 : 18} className={cn("absolute -top-2 -right-1", iconColor)} />
        </div>
        <div className="mt-3 max-w-full truncate text-sm leading-tight font-semibold">{entry.userName}</div>
        <div className="text-xs text-muted-foreground">{entry.group}</div>
        <div className="mt-2 font-mono text-2xl font-semibold text-primary tabular-nums">{entry.score}</div>
        <div className="text-xs text-muted-foreground">баллов</div>
        <div className="mt-1.5 flex items-center gap-1 text-xs text-warning">
          <Flame size={12} /> {entry.streak} дн
        </div>
      </CardBody>
    </Card>
  );
}

function RowContent({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-sm font-semibold",
          entry.isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {entry.rank}
      </div>
      <Avatar name={entry.userName} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{entry.userName}</span>
          {entry.isCurrentUser && <Badge tone="primary">вы</Badge>}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen size={11} /> {entry.materialsCompleted}/{entry.materialsTotal}
          </span>
          <span className="flex items-center gap-1">
            <Target size={11} /> {entry.avgCoverage}%
          </span>
          {entry.quizAvg != null && <span>тест {entry.quizAvg}%</span>}
          <span className="flex items-center gap-1 text-warning">
            <Flame size={11} /> {entry.streak}
          </span>
        </div>
      </div>
      <div className="hidden w-28 sm:block">
        <Progress value={entry.avgCoverage} tone={entry.avgCoverage >= 80 ? "success" : "primary"} />
      </div>
      <div className="w-14 shrink-0 text-right">
        <div className="font-mono font-semibold tabular-nums">{entry.score}</div>
        <div className="text-xs text-muted-foreground">баллов</div>
      </div>
    </div>
  );
}
