"use client";

import Link from "next/link";
import { FilterSelect, ListPanel } from "@/components/common/list-panel";
import { PageHeader } from "@/components/common/page-header";
import { ForbiddenState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { useQueryState } from "@/hooks/use-query-state";
import { EARNINGS_PERMISSIONS, listPayouts } from "@/lib/api/earnings";
import { formatDate, formatMoney, formatSignedMoney } from "@/lib/format";
import { useCan } from "@/store/auth";
import { KACHI_STATUS_OPTIONS, type KachiPayoutStatus } from "@/types/earnings";
import { PAYOUT_STATUS_LABELS, PayoutPart } from "./payout-parts";

export function PayoutsList() {
  const can = useCan();
  const allowed = can(EARNINGS_PERMISSIONS);
  const query = useQueryState();
  const kachiStatus = query.get("kachi_status") as KachiPayoutStatus | "";
  const { data, error, loading, reload } = useApi(allowed ? `payouts?${query.key}` : null, () =>
    listPayouts({ kachi_status: kachiStatus, page: query.page }),
  );

  if (!allowed) return <ForbiddenState />;

  return (
    <>
      <PageHeader
        title="Payouts"
        description="One statement a week: the earnings available at the cut-off. noqodi pays the part from online orders; KACHI pays the part from cash-on-delivery orders and KACHI's own vouchers."
      />

      <ListPanel
        rows={data?.data}
        meta={data?.meta}
        loading={loading}
        error={error}
        onRetry={reload}
        onPage={(page) => query.set({ page })}
        empty={{
          title: kachiStatus ? "No payouts found" : "No payouts yet",
          description: kachiStatus ? "Try another filter." : "Your first payout comes at the weekly cut-off after a sale becomes available.",
        }}
        filters={
          <FilterSelect
            label="KACHI parts"
            value={kachiStatus}
            onChange={(next) => query.set({ kachi_status: next })}
            options={KACHI_STATUS_OPTIONS}
          />
        }
      >
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payout</TableHead>
                <TableHead>Cut-off</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((payout) => (
                <TableRow key={payout.id}>
                  <TableCell>
                    <Link href={`/payouts/${payout.id}`} className="font-medium hover:underline">
                      {payout.number}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(payout.period_end)}</TableCell>
                  <TableCell>
                    <StatusBadge status={payout.status} label={PAYOUT_STATUS_LABELS[payout.status]} />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap text-muted-foreground">{formatMoney(payout.commission)}</TableCell>
                  <TableCell className="text-right">
                    <span className="grid gap-1">
                      <span className="font-medium whitespace-nowrap">{formatSignedMoney(payout.amount)}</span>
                      <PayoutPart label="noqodi" amount={payout.paid_by.noqodi.amount} status={payout.paid_by.noqodi.status} />
                      <PayoutPart label="KACHI" amount={payout.paid_by.kachi.amount} status={payout.paid_by.kachi.status} />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListPanel>
    </>
  );
}
