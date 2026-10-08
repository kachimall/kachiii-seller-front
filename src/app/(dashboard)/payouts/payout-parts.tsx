import { StatusBadge } from "@/components/common/status-badge";
import { formatMoney, formatSignedMoney } from "@/lib/format";
import type { Payout } from "@/types/earnings";

export const PAYOUT_STATUS_LABELS: Record<Payout["status"], string> = {
  released: "Waiting for payment",
  completed: "Paid",
};

const PART_LABELS: Record<string, string> = {
  none: "Nothing to pay",
  pending: "Due",
  settled: "Settled",
  paid: "Paid",
};

/** One part of a payout: noqodi's (online orders) or KACHI's (cash on delivery, KACHI's vouchers). */
export function PayoutPart({
  label,
  amount,
  status,
}: {
  label: string;
  amount: string;
  status: string;
}) {
  if (status === "none") return null;
  return (
    <span className="flex items-center justify-end gap-2 text-xs whitespace-nowrap text-muted-foreground">
      {label} {amount.startsWith("-") ? formatSignedMoney(amount) : formatMoney(amount)}
      <StatusBadge status={status} label={PART_LABELS[status] ?? status} />
    </span>
  );
}
