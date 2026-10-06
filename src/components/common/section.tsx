import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A titled card on detail pages. Pass flush for tables that run edge to edge. */
export function Section({
  title,
  actions,
  children,
  flush,
  className,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <h2 className="font-heading text-headline-sm">{title}</h2>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className={flush ? undefined : "p-5"}>{children}</div>
    </section>
  );
}
