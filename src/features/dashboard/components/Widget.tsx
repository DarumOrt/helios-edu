import { Card, CardHeader, CardBody } from "@/shared/ui";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function Widget({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title={title}
        subtitle={subtitle}
        icon={Icon ? <Icon size={18} /> : undefined}
        action={action}
      />
      <CardBody className="flex-1">{children}</CardBody>
    </Card>
  );
}
