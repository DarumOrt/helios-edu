import { cn } from "@/shared/lib/utils";

// Знак «Гелиос»: солнце над линией горизонта (она же линейка чертежа).
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M8 22a8 8 0 0 1 16 0" />
      <path d="M16 6v3M6.1 12.1l2.1 2.1M25.9 12.1l-2.1 2.1M3 22h26" />
      <path d="M7 26h2M12 26h2M18 26h2M23 26h2" strokeWidth={1.5} />
    </svg>
  );
}
