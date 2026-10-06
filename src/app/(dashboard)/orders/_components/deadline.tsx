"use client";

import { ClockIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// One shared clock, ticking every 30 s while anything shows a deadline.
let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** The current time in ms, refreshed every 30 s; 0 on the server. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => 0,
  );
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "in 2 days", "in 5 hours", "3 hours ago". */
export function timeFrom(iso: string, nowMs: number): string {
  const diff = new Date(iso).getTime() - nowMs;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs >= 2 * day) return relative.format(Math.round(diff / day), "day");
  if (abs >= hour) return relative.format(Math.round(diff / hour), "hour");
  return relative.format(Math.round(diff / minute), "minute");
}

/**
 * A deadline with how long is left: amber within `urgentHours`, red once past. Shows the plain
 * date until the clock is known (server render).
 */
export function Deadline({
  at,
  urgentHours = 24,
  pastLabel = "passed",
  className,
}: {
  at: string | null | undefined;
  urgentHours?: number;
  pastLabel?: string;
  className?: string;
}) {
  const nowMs = useNow();
  if (!at) return <span className={className}>—</span>;
  const left = new Date(at).getTime() - nowMs;
  const tone =
    nowMs === 0
      ? "text-muted-foreground"
      : left <= 0
        ? "text-destructive"
        : left <= urgentHours * 3_600_000
          ? "text-on-tertiary-fixed"
          : "text-muted-foreground";

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1.5", className)} title={formatDateTime(at)}>
      <ClockIcon className={cn("size-3.5 shrink-0", tone)} />
      <span>{formatDateTime(at)}</span>
      {nowMs !== 0 && (
        <span className={cn("text-xs font-medium", tone)}>
          ({left <= 0 ? `${pastLabel} ${timeFrom(at, nowMs)}` : timeFrom(at, nowMs)})
        </span>
      )}
    </span>
  );
}
