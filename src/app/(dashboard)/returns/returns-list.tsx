"use client";

import Link from "next/link";
import { ChevronRightIcon, HourglassIcon } from "lucide-react";
import { FilterSelect, ListPanel } from "@/components/common/list-panel";
import { PageHeader } from "@/components/common/page-header";
import { ForbiddenState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { Thumb } from "@/components/common/thumb";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { useQueryState } from "@/hooks/use-query-state";
import { errorMessage } from "@/lib/api/client";
import { listReturns } from "@/lib/api/returns";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useCan } from "@/store/auth";
import { RETURN_REASONS, RETURN_STATUSES, type ReturnRequest, type ReturnStatus } from "@/types/sales";
import { Deadline } from "../orders/_components/deadline";

const STATUS_LABELS = Object.fromEntries(RETURN_STATUSES.map((s) => [s.value, s.label]));

export function ReturnsList() {
  const can = useCan();
  const allowed = can("orders.view");
  const query = useQueryState();
  const status = query.get("status") as ReturnStatus | "";
  const { data, error, loading, reload } = useApi(allowed ? `returns?${query.key}` : null, () =>
    listReturns({ status, page: query.page }),
  );

  if (!allowed) return <ForbiddenState />;

  return (
    <>
      <PageHeader
        title="Returns"
        description="Buyers' return requests for your store. Answer each one before its reply-by time, or KACHI decides it."
      />

      {!status && <AwaitingAnswer />}

      <ListPanel
        rows={data?.data}
        meta={data?.meta}
        loading={loading}
        error={error}
        onRetry={reload}
        onPage={(page) => query.set({ page })}
        empty={{
          title: status ? "No returns found" : "No returns yet",
          description: status ? "Try another status." : "Return requests from buyers appear here.",
        }}
        filters={
          <FilterSelect label="Statuses" value={status} onChange={(next) => query.set({ status: next })} options={RETURN_STATUSES} />
        }
      >
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Refund</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((ret) => (
                <TableRow key={ret.id}>
                  <TableCell>
                    <Link href={`/returns/${ret.id}`} className="font-medium hover:underline">
                      {ret.number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/orders/${ret.store_order.id}`} className="hover:underline">
                      {ret.store_order.number}
                    </Link>
                  </TableCell>
                  <TableCell>{RETURN_REASONS[ret.reason] ?? ret.reason}</TableCell>
                  <TableCell>
                    <span className="grid gap-1">
                      <StatusBadge status={ret.status} label={STATUS_LABELS[ret.status]} />
                      {ret.status === "requested" && <Deadline at={ret.reply_by} className="text-xs" />}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(ret.created_at)}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(ret.refund_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListPanel>
    </>
  );
}

/**
 * The requests waiting for the store's answer, soonest deadline first. The API lists newest
 * first with no sort, so this reads up to 100 and sorts them by reply_by here.
 */
function AwaitingAnswer() {
  const { data, error } = useApi("returns:awaiting", () => listReturns({ status: "requested", per_page: 100 }));
  if (error) return <p className="mb-6 text-sm text-destructive">{errorMessage(error)}</p>;
  if (!data || data.data.length === 0) return null;

  const rows = [...data.data].sort(byReplyBy);
  const more = (data.meta.total ?? rows.length) - rows.length;

  return (
    <section className="mb-6 overflow-hidden rounded-xl bg-tertiary-fixed/30 ring-1 ring-tertiary/20">
      <div className="flex flex-wrap items-center gap-2 border-b border-tertiary/20 px-5 py-3">
        <HourglassIcon className="size-4 text-on-tertiary-fixed" />
        <h2 className="font-heading text-headline-sm">
          Awaiting your answer <span className="text-muted-foreground">({data.meta.total ?? rows.length})</span>
        </h2>
        <p className="w-full text-xs text-muted-foreground">
          Approve or reject before the time runs out. After that, KACHI decides for you.
        </p>
      </div>
      <ul className="divide-y divide-tertiary/10">
        {rows.map((ret) => (
          <AwaitingRow key={ret.id} ret={ret} />
        ))}
      </ul>
      {more > 0 && <p className="px-5 py-2 text-xs text-muted-foreground">And {more} more, filter by “Awaiting your answer”.</p>}
    </section>
  );
}

function AwaitingRow({ ret }: { ret: ReturnRequest }) {
  const first = ret.items[0];
  return (
    <li>
      <Link href={`/returns/${ret.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-background/60">
        <Thumb src={first?.thumbnail_url} alt="" className="size-9" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">
            {ret.number} <span className="font-normal text-muted-foreground">· {RETURN_REASONS[ret.reason]}</span>
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {first?.product_name}
            {ret.items.length > 1 ? ` and ${ret.items.length - 1} more` : ""} · refund {formatMoney(ret.refund_amount)}
          </span>
        </span>
        <span className="hidden text-right text-xs sm:block">
          <span className="block text-muted-foreground">Answer by</span>
          <Deadline at={ret.reply_by} />
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
      </Link>
      <span className="block px-5 pb-3 pl-17 text-xs sm:hidden">
        Answer by <Deadline at={ret.reply_by} />
      </span>
    </li>
  );
}

function byReplyBy(a: ReturnRequest, b: ReturnRequest): number {
  const at = (r: ReturnRequest) => (r.reply_by ? new Date(r.reply_by).getTime() : Number.POSITIVE_INFINITY);
  return at(a) - at(b);
}
