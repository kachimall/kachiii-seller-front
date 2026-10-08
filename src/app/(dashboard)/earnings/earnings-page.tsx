"use client";

import Link from "next/link";
import { BanknoteIcon, CircleCheckIcon, HandCoinsIcon, HourglassIcon, type LucideIcon, WalletIcon } from "lucide-react";
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
import { Section } from "@/components/common/section";
import {
  LEDGER_ENTRY_TYPES,
  LEDGER_STATUSES,
  PAYMENT_METHOD_OPTIONS,
  type LedgerEntry,
  type LedgerEntryStatus,
} from "@/types/earnings";
import type { PaymentMethod } from "@/types/api";

const STATUS_LABELS = Object.fromEntries(LEDGER_STATUSES.map((s) => [s.value, s.label]));

export function EarningsPage() {
  const can = useCan();
  const allowed = can(EARNINGS_PERMISSIONS);
  const query = useQueryState();
  const status = query.get("status") as LedgerEntryStatus | "";
  const paymentMethod = query.get("payment_method") as PaymentMethod | "";
  const { data, error, loading, reload } = useApi(allowed ? `earnings?${query.key}` : null, () =>
    listEarnings({ status, payment_method: paymentMethod, page: query.page }),
  );
  const filtered = Boolean(status || paymentMethod);

  if (!allowed) return <ForbiddenState />;

  return (
    <>
      <PageHeader
        title="Earnings"
        description="What your store is owed after KACHI's commission. A sale is recorded when its package is delivered, and returns and refunds charged to you are taken back from it. Each week, what is available goes into a payout."
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
          title: filtered ? "No entries found" : "No earnings yet",
          description: filtered ? "Try other filters." : "Each delivered package records a sale here.",
        }}
        filters={
          <>
            <FilterSelect label="Statuses" value={status} onChange={(next) => query.set({ status: next })} options={LEDGER_STATUSES} />
            <FilterSelect
              label="Payment methods"
              value={paymentMethod}
              onChange={(next) => query.set({ payment_method: next })}
              options={PAYMENT_METHOD_OPTIONS}
              className="sm:w-52"
            />
          </>
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
            tone={entry.status === "available" ? "success" : entry.status === "released" ? "info" : "warning"}
          />
          {entry.status === "pending" && (
            <span className="text-xs whitespace-nowrap text-muted-foreground">From {formatDate(entry.available_at)}</span>
          )}
          {entry.status === "released" && entry.payout_number && (
            <span className="text-xs whitespace-nowrap text-muted-foreground">In {entry.payout_number}</span>
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

  const cod = data?.cash_on_delivery;

  return (
    <div className="mb-6 grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Figure icon={CircleCheckIcon} title="Available" value={data?.available} tone="success">
          Past the return period: counts towards your next weekly payout.
        </Figure>
        <Figure icon={HourglassIcon} title="In the return period" value={data?.pending} tone="attention">
          Sales from the last few days. They become available once the buyer can no longer return them.
        </Figure>
        <Figure icon={BanknoteIcon} title="Released in payouts" value={data?.released}>
          Already in your weekly payouts. <Link href="/payouts" className="text-secondary hover:underline">See payouts</Link>
        </Figure>
        <Figure icon={WalletIcon} title="Earned in total" value={data?.earned}>
          After KACHI&apos;s commission ({data ? formatMoney(data.commission) : "…"}), less returns and refunds charged to
          you.
        </Figure>
      </div>

      <Section
        title={
          <span className="flex items-center gap-2">
            <HandCoinsIcon className="size-4 text-muted-foreground" /> Cash on delivery
          </span>
        }
        actions={
          <Link href="/earnings?payment_method=cash_on_delivery" className="text-sm text-secondary hover:underline">
            Show these orders
          </Link>
        }
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Your share of the orders buyers paid in cash. The courier collects the cash and KACHI pays your share with your
          weekly payouts, apart from what noqodi pays for online orders. Included in the figures above.
        </p>
        <dl className="grid gap-4 sm:grid-cols-3">
          <CodFigure label="Earned" value={cod?.earned} />
          <CodFigure label="Paid by KACHI" value={cod?.paid} />
          <CodFigure label="Still due from KACHI" value={cod?.due} />
        </dl>
      </Section>
    </div>
  );
}

function CodFigure({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 font-heading text-headline-sm">{value === undefined ? "…" : formatMoney(value)}</dd>
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
