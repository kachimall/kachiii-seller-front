"use client";

import Link from "next/link";
import { CircleCheckIcon, HourglassIcon, type LucideIcon, PercentIcon, WalletIcon } from "lucide-react";
import type { ReactNode } from "react";
import { FilterSelect, ListPanel } from "@/components/common/list-panel";
import { PageHeader } from "@/components/common/page-header";
import { ForbiddenState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { useQueryState } from "@/hooks/use-query-state";
import { errorMessage } from "@/lib/api/client";
import { EARNINGS_PERMISSIONS, getEarningsSummary, listEarnings } from "@/lib/api/earnings";
import { formatDate, formatDateTime, formatMoney, formatSignedMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCan } from "@/store/auth";
import { LEDGER_ENTRY_TYPES, LEDGER_STATUSES, type LedgerEntry, type LedgerEntryStatus } from "@/types/earnings";

const STATUS_LABELS = Object.fromEntries(LEDGER_STATUSES.map((s) => [s.value, s.label]));

export function EarningsPage() {
  const can = useCan();
  const allowed = can(EARNINGS_PERMISSIONS);
  const query = useQueryState();
  const status = query.get("status") as LedgerEntryStatus | "";
  const { data, error, loading, reload } = useApi(allowed ? `earnings?${query.key}` : null, () =>
    listEarnings({ status, page: query.page }),
  );

  if (!allowed) return <ForbiddenState />;

  return (
    <>
      <PageHeader
        title="Earnings"
        description="What your store is owed after KACHI's commission. A sale is recorded when its package is delivered, and returns and refunds charged to you are taken back from it."
      />

      <Summary />

      <ListPanel
        rows={data?.data}
        meta={data?.meta}
        loading={loading}
        error={error}
        onRetry={reload}
        onPage={(page) => query.set({ page })}
        empty={{
          title: status ? "No entries found" : "No earnings yet",
          description: status ? "Try another status." : "Each delivered package records a sale here.",
        }}
        filters={
          <FilterSelect label="Statuses" value={status} onChange={(next) => query.set({ status: next })} options={LEDGER_STATUSES} />
        }
      >
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Recorded</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </TableBody>
          </Table>
        )}
      </ListPanel>
    </>
  );
}

function EntryRow({ entry }: { entry: LedgerEntry }) {
  const negative = entry.amount.startsWith("-");
  return (
    <TableRow>
      <TableCell>
        <span className="grid gap-0.5">
          <span className="font-medium">{LEDGER_ENTRY_TYPES[entry.type] ?? entry.type}</span>
          {entry.return_number && <span className="text-xs text-muted-foreground">{entry.return_number}</span>}
        </span>
      </TableCell>
      <TableCell>
        {/* The entry carries the order number, not its id: the orders list finds it by number. */}
        <Link href={`/orders?q=${encodeURIComponent(entry.order_number)}`} className="hover:underline">
          {entry.order_number}
        </Link>
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(entry.created_at)}</TableCell>
      <TableCell>
        <span className="grid gap-1">
          <StatusBadge
            status={entry.status}
            label={STATUS_LABELS[entry.status]}
            tone={entry.status === "available" ? "success" : "warning"}
          />
          {entry.status === "pending" && (
            <span className="text-xs whitespace-nowrap text-muted-foreground">From {formatDate(entry.available_at)}</span>
          )}
        </span>
      </TableCell>
      <TableCell className="text-right whitespace-nowrap text-muted-foreground">{formatMoney(entry.commission)}</TableCell>
      <TableCell className="text-right">
        <span className="grid gap-0.5">
          <span className={cn("font-medium whitespace-nowrap", negative && "text-destructive")}>{formatSignedMoney(entry.amount)}</span>
          <PaidBy entry={entry} />
        </span>
      </TableCell>
    </TableRow>
  );
}

/** Who pays the entry out: noqodi from an online payment's split, KACHI for cash on delivery and its own vouchers. */
function PaidBy({ entry }: { entry: LedgerEntry }) {
  const parts = [
    isZero(entry.paid_by.noqodi) ? null : `noqodi ${entry.paid_by.noqodi}`,
    isZero(entry.paid_by.kachi) ? null : `KACHI ${entry.paid_by.kachi}`,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <span className="text-xs whitespace-nowrap text-muted-foreground">Paid by {parts.join(" + ")}</span>;
}

const isZero = (amount: string) => /^-?0*(\.0*)?$/.test(amount);

function Summary() {
  const { data, error } = useApi("earnings:summary", getEarningsSummary);

  if (error) return <p className="mb-6 text-sm text-destructive">{errorMessage(error)}</p>;

  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Figure icon={CircleCheckIcon} title="Available" value={data?.available} tone="success">
        Past the return period: counts towards your next payout.
      </Figure>
      <Figure icon={HourglassIcon} title="In the return period" value={data?.pending} tone="attention">
        Sales from the last few days. They become available once the buyer can no longer return them.
      </Figure>
      <Figure icon={WalletIcon} title="Earned in total" value={data?.earned}>
        Everything your store has earned after commission, less returns and refunds charged to you.
      </Figure>
      <Figure icon={PercentIcon} title="KACHI commission" value={data?.commission}>
        KACHI&apos;s commission on your sales, less the commission on returned items.
      </Figure>
    </div>
  );
}

function Figure({
  icon: Icon,
  title,
  value,
  tone,
  children,
}: {
  icon: LucideIcon;
  title: string;
  value: string | undefined;
  tone?: "success" | "attention";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10",
        tone === "success" && "ring-success/30",
        tone === "attention" && "ring-tertiary/30",
      )}
    >
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={cn("size-4", tone === "success" && "text-success", tone === "attention" && "text-on-tertiary-fixed")} />
        {title}
      </span>
      <span className="font-heading text-headline-lg leading-none">{value === undefined ? "…" : formatMoney(value)}</span>
      <span className="text-sm text-muted-foreground">{children}</span>
    </div>
  );
}
