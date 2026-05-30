import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="breadcrumb">
      <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={12} className="opacity-40" />}
            {c.href ? (
              <Link href={c.href} className="hover:text-foreground transition">
                {c.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
