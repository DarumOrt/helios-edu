import { GraduationCap, ArrowRight, BookOpen } from "lucide-react";
import { Card, CardBody, Badge } from "@/shared/ui";
import { gradientFor } from "@/shared/lib/utils";
import type { Program } from "@/shared/types/domain";

const ruleLabel: Record<Program["rule"], string> = {
  sequential: "Последовательно",
  "any-order": "Любой порядок",
  "by-deadline": "По срокам",
};

export function ProgramCard({ program }: { program: Program }) {
  return (
    <Card className="group overflow-hidden transition hover:shadow-elevate">
      <div className={`h-1 bg-linear-to-r ${gradientFor(program.id)}`} />
      <CardBody>
        <div className="mb-3 flex items-start gap-3">
          <div
            className={`h-10 w-10 rounded-lg bg-linear-to-br ${gradientFor(program.id)} flex shrink-0 items-center justify-center text-white`}
          >
            <GraduationCap size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="leading-snug font-semibold">{program.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{program.description}</p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BookOpen size={13} /> {program.courseIds.length} курсов
          </div>
          <Badge tone="info">{ruleLabel[program.rule]}</Badge>
        </div>
        <button className="mt-4 inline-flex w-full items-center justify-center gap-2 text-sm font-medium text-primary transition-all group-hover:gap-3">
          Перейти <ArrowRight size={14} />
        </button>
      </CardBody>
    </Card>
  );
}
