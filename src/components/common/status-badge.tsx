import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<Tone, string> = {
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-tertiary-fixed text-on-tertiary-fixed ring-tertiary/20",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
  info: "bg-secondary-fixed text-secondary ring-secondary/20",
  neutral: "bg-muted text-muted-foreground ring-foreground/10",
};

const STATUS_TONES: Record<string, Tone> = {
  active: "success",
  approved: "success",
  running: "success",
  paid: "success",
  succeeded: "success",
  delivered: "success",
  ready: "success",
  collected: "success",
  received: "success",
  picked_up: "info",
  in_transit: "info",
  out_for_delivery: "info",
  delivery_failed: "warning",
  returned: "danger",
  not_collected: "danger",
  pending: "warning",
  requested: "warning",
  escalated: "warning",
  pending_review: "warning",
  awaiting_consent: "warning",
  scheduled: "info",
  placed: "info",
  accepted: "info",
  ready_to_ship: "info",
  shipped: "info",
  processing: "info",
  due_on_delivery: "info",
  unpaid: "warning",
  rejected: "danger",
  banned: "danger",
  suspended: "danger",
  terminated: "danger",
  cancelled: "danger",
  failed: "danger",
  draft: "neutral",
  inactive: "neutral",
  archived: "neutral",
  ended: "neutral",
  withdrawn: "neutral",
  off: "neutral",
};

export function StatusBadge({ status, label, tone, className }: { status: string | null | undefined; label?: string; tone?: Tone; className?: string }) {
  const resolved = tone ?? STATUS_TONES[status ?? ""] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        TONES[resolved],
        className,
      )}
    >
      {label ?? humanize(status)}
    </span>
  );
}
