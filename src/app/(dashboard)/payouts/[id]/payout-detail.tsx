"use client";

import Link from "next/link";
import { DetailList } from "@/components/common/detail-list";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { AsyncContent } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { getPayout } from "@/lib/api/earnings";
import { formatDate, formatDateTime, formatMoney, formatSignedMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LEDGER_ENTRY_TYPES, type Payout } from "@/types/earnings";
import { PAYOUT_STATUS_LABELS } from "../payout-parts";

const PART_LABELS: Record<string, string> = { none: "Nothing to pay", pending: "Due", settled: "Settled", paid: "Paid" };

export function PayoutDetail({ id }: { id: string }) {
  const { data, error, loading, reload } = useApi(`payout:${id}`, () => getPayout(id));
  return (
    <AsyncContent data={data} error={error} loading={loading} onRetry={reload}>
      {(payout) => <PayoutView payout={payout} />}
    </AsyncContent>
  );
}

function PayoutView({ payout }: { payout: Payout }) {
  const { noqodi, kachi } = payout.paid_by;
  return (
    <>
      <PageHeader
        back={{ href: "/payouts", label: "Payouts" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Payout {payout.number} <StatusBadge status={payout.status} label={PAYOUT_STATUS_LABELS[payout.status]} />
          </span>
        }
        description={`Weekly cut-off ${formatDate(payout.period_end)}`}
      />

      <div className="mb-6 grid gap-6 md:grid-cols-3">
        <Section title="Total">
          <DetailList
            className="sm:grid-cols-1"
            items={[
              { label: "Amount", value: <span className="font-heading text-headline-sm">{formatSignedMoney(payout.amount)}</span> },
              { label: "KACHI commission", value: formatMoney(payout.commission) },
            ]}
          />
        </Section>
        <Section title="Paid by noqodi">
          <DetailList
            className="sm:grid-cols-1"
            items={[
              { label: "Amount", value: formatSignedMoney(noqodi.amount) },
              { label: "Status", value: <StatusBadge status={noqodi.status} label={PART_LABELS[noqodi.status]} /> },
              { label: "Reference", value: noqodi.reference ?? "—" },
              { label: "Settled", value: noqodi.settled_at ? formatDateTime(noqodi.settled_at) : "—" },
            ]}
          />
        </Section>
        <Section title="Paid by KACHI">
          <DetailList
            className="sm:grid-cols-1"
            items={[
              { label: "Amount", value: formatSignedMoney(kachi.amount) },
              { label: "Status", value: <StatusBadge status={kachi.status} label={PART_LABELS[kachi.status]} /> },
              { label: "Reference", value: kachi.reference ?? "—" },
              { label: "Paid", value: kachi.paid_at ? formatDateTime(kachi.paid_at) : "—" },
            ]}
          />
          <p className="mt-4 text-xs text-muted-foreground">Cash-on-delivery orders, and what KACHI owes for its own vouchers.</p>
        </Section>
      </div>

      <Section title="Entries" flush>
        {!payout.entries || payout.entries.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No entries.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Entry</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Recorded</TableHead>
                <TableHead className="text-right">noqodi · KACHI</TableHead>
                <TableHead className="pr-5 text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payout.entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="pl-5">
                    <span className="grid gap-0.5">
                      <span className="font-medium">{LEDGER_ENTRY_TYPES[entry.type] ?? entry.type}</span>
                      {entry.return_number && <span className="text-xs text-muted-foreground">{entry.return_number}</span>}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link href={`/orders?q=${encodeURIComponent(entry.order_number)}`} className="hover:underline">
                      {entry.order_number}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(entry.created_at)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                    {entry.paid_by.noqodi} · {entry.paid_by.kachi}
                  </TableCell>
                  <TableCell className={cn("pr-5 text-right font-medium whitespace-nowrap", entry.amount.startsWith("-") && "text-destructive")}>
                    {formatSignedMoney(entry.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </>
  );
}
