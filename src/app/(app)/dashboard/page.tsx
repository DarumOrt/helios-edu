import { PageHeader } from "@/shared/ui";
import { HeroCard } from "@/features/dashboard/components/HeroCard";
import { StatsRow } from "@/features/dashboard/components/StatsRow";
import { MyCoursesWidget } from "@/features/dashboard/components/MyCoursesWidget";
import { UpcomingDeadlines } from "@/features/dashboard/components/UpcomingDeadlines";
import { NotificationsWidget } from "@/features/dashboard/components/NotificationsWidget";

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Дашборд" subtitle="Сводка по обучению и активности" />
      <HeroCard />
      <StatsRow />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MyCoursesWidget />
        <UpcomingDeadlines />
        <NotificationsWidget />
      </div>
    </div>
  );
}
