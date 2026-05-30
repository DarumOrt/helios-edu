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
    <Card className="overflow-hidden hover:shadow-elevate transition group">
      <div className={`h-1 bg-gradient-to-r ${gradientFor(program.id)}`} />
      <CardBody>
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradientFor(program.id)} text-white flex items-center justify-center shrink-0`}>
            <GraduationCap size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold leading-snug">{program.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{program.description}</p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BookOpen size={13} /> {program.courseIds.length} курсов
          </div>
          <Badge tone="info">{ruleLabel[program.rule]}</Badge>
        </div>
        <button className="mt-4 w-full inline-flex items-center justify-center gap-2 text-sm font-medium text-primary group-hover:gap-3 transition-all">
          Перейти <ArrowRight size={14} />
        </button>
      </CardBody>
    </Card>
  );
}
