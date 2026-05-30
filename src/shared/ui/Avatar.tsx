import { cn, gradientFor, initials } from "@/shared/lib/utils";

export function Avatar({
  name,
  size = 32,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br text-white font-semibold flex items-center justify-center shrink-0",
        gradientFor(name),
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}
