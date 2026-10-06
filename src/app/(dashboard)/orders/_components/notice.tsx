import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A callout above a detail page: a deadline, a blocked action, or what happens next. */
export function Notice({
  icon,
  tone,
  className,
  children,
}: {
  icon: ReactNode;
  tone?: "warning" | "danger";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl p-4 text-sm ring-1 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
        tone === "warning" && "bg-tertiary-fixed/40 ring-tertiary/20",
        tone === "danger" && "bg-destructive/5 ring-destructive/20 [&>svg]:text-destructive",
        !tone && "bg-muted ring-foreground/5",
        className,
      )}
    >
      {icon}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
