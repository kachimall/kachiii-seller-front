"use client";

import Link from "next/link";
import { FilterSelect, ListPanel } from "@/components/common/list-panel";
import { PageHeader } from "@/components/common/page-header";
import { SearchInput } from "@/components/common/search-input";
import { ForbiddenState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { useQueryState } from "@/hooks/use-query-state";
import { listOrders, type OrderFilters } from "@/lib/api/orders";
import { formatDateTime, formatMoney, humanize } from "@/lib/format";
import { useCan } from "@/store/auth";
import { ORDER_STATUSES, type SellerOrder } from "@/types/sales";
import { Deadline } from "./_components/deadline";

const STATUS_LABELS = Object.fromEntries(ORDER_STATUSES.map((s) => [s.value, s.label]));

export function OrdersList() {
  const can = useCan();
  const allowed = can("orders.view");
  const query = useQueryState();
  const filters = { q: query.get("q"), status: query.get("status") as OrderFilters["status"] };
  const { data, error, loading, reload } = useApi(allowed ? `orders?${query.key}` : null, () =>
    listOrders({ ...filters, page: query.page }),
  );

  if (!allowed) return <ForbiddenState />;

  return (
    <>
      <PageHeader
        title="Orders"
        description="Your store's orders, newest first. Accept new ones and pack them before their ship-by date, or they are cancelled."
      />
      <ListPanel
        rows={data?.data}
        meta={data?.meta}
        loading={loading}
        error={error}
        onRetry={reload}
        onPage={(page) => query.set({ page })}
        empty={{
          title: filters.q || filters.status ? "No orders found" : "No orders yet",
          description: filters.q || filters.status ? "Try other filters." : "Orders appear here once buyers place them.",
        }}
        filters={
          <>
            <SearchInput
              key={filters.q}
              value={filters.q}
              onChange={(q) => query.set({ q })}
              placeholder="Order number"
            />
            <FilterSelect
              label="Statuses"
              value={filters.status ?? ""}
              onChange={(status) => query.set({ status })}
              options={ORDER_STATUSES}
            />
          </>
        }
      >
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Next step</TableHead>
                <TableHead className="text-right">Items total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link href={`/orders/${order.id}`} className="font-medium hover:underline">
                      {order.number}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(order.placed_at)}</TableCell>
                  <TableCell>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} label={STATUS_LABELS[order.status]} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {humanize(order.purchase?.payment_method)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <NextStep order={order} />
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(order.items_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListPanel>
    </>
  );
}

function NextStep({ order }: { order: SellerOrder }) {
  const pkg = order.package;
  if (order.status === "placed" || order.status === "accepted") {
    if (!pkg) return <span className="text-muted-foreground">Sent by Zajel</span>;
    return (
      <span className="grid gap-0.5">
        <span>{order.status === "placed" ? "Accept, then pack by" : "Pack by"}</span>
        <Deadline at={order.ship_by} className="text-xs" />
      </span>
    );
  }
  if (order.status === "ready_to_ship") {
    return <span>{pkg?.waybill_ready ? "Print the label for the courier" : "Booking the courier…"}</span>;
  }
  if (order.status === "returned" && pkg?.status === "returned" && !pkg.received_back_at) {
    return <span className="text-destructive">Confirm the package is back</span>;
  }
  return <span className="text-muted-foreground">—</span>;
}
