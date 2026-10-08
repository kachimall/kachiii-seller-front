"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Section } from "@/components/common/section";
import { ErrorState, LoadingState } from "@/components/common/states";
import { Stars } from "@/components/common/stars";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { getDashboard } from "@/lib/api/dashboard";
import { formatDate, formatMoney, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCan } from "@/store/auth";
import { EARNINGS_PERMISSIONS } from "@/lib/api/earnings";
import type { VendorDashboard } from "@/types/dashboard";

const PERIODS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

/** Today's date in the UAE (the dashboard counts UAE days), minus `back` days, as YYYY-MM-DD. */
function uaeDay(back = 0): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - back);
  return date.toISOString().slice(0, 10);
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  placed: "To accept",
  accepted: "To pack",
  ready_to_ship: "Ready for pickup",
  shipped: "Shipped",
  delivered: "Delivered",
  returned: "Returned",
  cancelled: "Cancelled",
};

const DELIVERY_ROWS: { key: keyof VendorDashboard["deliveries"]; label: string }[] = [
  { key: "awaiting_pickup", label: "Waiting for the courier" },
  { key: "picked_up", label: "Picked up" },
  { key: "in_transit", label: "In transit" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivery_failed", label: "Delivery failed" },
  { key: "delivered", label: "Delivered" },
  { key: "returned", label: "Returned to you" },
];

/** The store's figures over a period (GET /vendor/dashboard): sales, orders, deliveries, payouts, rating. */
export function Performance() {
  const [days, setDays] = useState<number>(30);
  const { data, error, loading, reload } = useApi(`dashboard:${days}`, () =>
    getDashboard(days === 30 ? {} : { from: uaeDay(days - 1), to: uaeDay() }),
  );

  return (
    <section className="mt-8 grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-headline-sm">Performance</h2>
          <p className="text-sm text-muted-foreground">
            {data ? `${formatDate(data.from)} – ${formatDate(data.to)}, UAE time.` : "Your store's figures over a period."}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <Button
              key={p.days}
              size="sm"
              variant={days === p.days ? "secondary" : "ghost"}
              aria-pressed={days === p.days}
              onClick={() => setDays(p.days)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {error && !data ? (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : !data ? (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <LoadingState />
        </div>
      ) : (
        <div className={cn("grid gap-4 transition-opacity", loading && "opacity-60")}>
          <Figures data={data} />
          <div className="grid gap-4 lg:grid-cols-3">
            <OrdersBreakdown data={data} />
            <Deliveries data={data} />
            <Payouts data={data} />
          </div>
        </div>
      )}
    </section>
  );
}

function Figures({ data }: { data: VendorDashboard }) {
  const { sales, rating } = data;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Figure title="Net sales" value={formatMoney(sales.net_sales)}>
        {sales.discounts === "0.00" ? "No vouchers used." : `${formatMoney(sales.sales)} less ${formatMoney(sales.discounts)} in vouchers.`}
      </Figure>
      <Figure title="Orders" value={sales.orders.toLocaleString("en-AE")}>
        {sales.orders === 0 ? "No orders in this period." : `${sales.units.toLocaleString("en-AE")} units sold.`}
      </Figure>
      <Figure title="Average order" value={sales.orders > 0 ? formatMoney(divide(sales.net_sales, sales.orders)) : "—"}>
        Net sales per order.
      </Figure>
      <Link
        href="/reviews"
        className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition-colors hover:ring-foreground/25"
      >
        <span className="text-sm text-muted-foreground">Store rating</span>
        <span className="flex items-center gap-2">
          <span className="font-heading text-headline-lg leading-none">{rating.average ?? "—"}</span>
          {rating.average && <Stars rating={Number(rating.average)} />}
        </span>
        <span className="text-sm text-muted-foreground">
          {rating.count === 0 ? "No reviews yet." : `From ${rating.count} review${rating.count === 1 ? "" : "s"}, all time.`}
        </span>
      </Link>
    </div>
  );
}

/** "1234.50" / 3 → "411.50", rounded to the fils. */
function divide(amount: string, by: number): string {
  const negative = amount.startsWith("-");
  const [whole, fraction = ""] = (negative ? amount.slice(1) : amount).split(".");
  const fils = (Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2))) * (negative ? -1 : 1);
  const each = Math.round(fils / by);
  const sign = each < 0 ? "-" : "";
  const abs = Math.abs(each);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

function Figure({ title, value, children }: { title: string; value: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <span className="text-sm text-muted-foreground">{title}</span>
      <span className="font-heading text-headline-lg leading-none">{value}</span>
      <span className="text-sm text-muted-foreground">{children}</span>
    </div>
  );
}

function OrdersBreakdown({ data }: { data: VendorDashboard }) {
  const can = useCan();
  const rows = Object.entries(data.orders.store_orders).filter(([, count]) => (count ?? 0) > 0);
  const total = rows.reduce((sum, [, count]) => sum + (count ?? 0), 0);
  return (
    <Section title="Orders placed">
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No orders were placed in this period.</p>
      ) : (
        <ul className="grid gap-2 text-sm">
          {rows.map(([status, count]) => (
            <li key={status} className="flex items-center justify-between gap-3">
              {can("orders.view") ? (
                <Link href={`/orders?status=${status}`} className="hover:underline">
                  <StatusBadge status={status} label={ORDER_STATUS_LABELS[status] ?? humanize(status)} />
                </Link>
              ) : (
                <StatusBadge status={status} label={ORDER_STATUS_LABELS[status] ?? humanize(status)} />
              )}
              <span className="font-medium tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted-foreground">Where each order placed in the period is now.</p>
    </Section>
  );
}

function Deliveries({ data }: { data: VendorDashboard }) {
  const { deliveries } = data;
  const rows = DELIVERY_ROWS.filter((row) => (deliveries[row.key] ?? 0) > 0);
  return (
    <Section title="Deliveries">
      {deliveries.packages === 0 ? (
        <p className="text-sm text-muted-foreground">No packages with your items in this period.</p>
      ) : (
        <ul className="grid gap-2 text-sm">
          <li className="flex justify-between gap-3 border-b pb-2 font-medium">
            <span>Packages</span>
            <span className="tabular-nums">{deliveries.packages}</span>
          </li>
          {rows.map((row) => (
            <li key={row.key} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="tabular-nums">{deliveries[row.key]}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted-foreground">By what the courier last reported.</p>
    </Section>
  );
}

function Payouts({ data }: { data: VendorDashboard }) {
  const can = useCan();
  const { payouts } = data;
  const linked = can(EARNINGS_PERMISSIONS);
  return (
    <Section
      title="Payouts"
      actions={
        linked && (
          <Link href="/payouts" className="text-sm text-secondary hover:underline">
            See all
          </Link>
        )
      }
    >
      {payouts.payouts === 0 ? (
        <p className="text-sm text-muted-foreground">No weekly payout in this period.</p>
      ) : (
        <ul className="grid gap-2 text-sm">
          <li className="flex justify-between gap-3 border-b pb-2 font-medium">
            <span>
              Released ({payouts.payouts} payout{payouts.payouts === 1 ? "" : "s"})
            </span>
            <span className="tabular-nums">{formatMoney(payouts.released)}</span>
          </li>
          <Line label="Settled by noqodi" value={payouts.noqodi_settled} />
          <Line label="Due from noqodi" value={payouts.noqodi_due} />
          <Line label="Paid by KACHI" value={payouts.kachi_paid} />
          <Line label="Due from KACHI" value={payouts.kachi_due} />
        </ul>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Now: {formatMoney(data.earnings.available)} available, {formatMoney(data.earnings.pending)} in the return period.
      </p>
    </Section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{formatMoney(value)}</span>
    </li>
  );
}
