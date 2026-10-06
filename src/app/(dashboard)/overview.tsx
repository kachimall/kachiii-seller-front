"use client";

import Link from "next/link";
import {
  AlertTriangleIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  type LucideIcon,
  MoonIcon,
  PackageIcon,
  PackageXIcon,
  StoreIcon,
  TruckIcon,
  Undo2Icon,
  WalletIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { useApi } from "@/hooks/use-api";
import { apiList, errorMessage } from "@/lib/api/client";
import { EARNINGS_PERMISSIONS, getEarningsSummary } from "@/lib/api/earnings";
import { listOrders } from "@/lib/api/orders";
import { listReturns } from "@/lib/api/returns";
import { getStore } from "@/lib/api/store";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth, useCan } from "@/store/auth";
import type { LowStockItem, ReturnRequest, SellerOrder } from "@/types/sales";
import { Deadline } from "./orders/_components/deadline";
import { Notice } from "./orders/_components/notice";

// There is no stats endpoint: each count is meta.total of a filtered list. The deadlines read up
// to 100 rows (the lists come newest first) and keep the soonest.
const SAMPLE = 100;

export function Overview() {
  const name = useAuth((s) => s.user?.name);
  const suspended = useAuth((s) => s.user?.vendor?.status === "suspended");
  const can = useCan();
  const orders = can("orders.view");

  return (
    <>
      <PageHeader title="Overview" description={name ? `Welcome back, ${name}.` : undefined} />

      {suspended && (
        <Notice icon={<AlertTriangleIcon />} tone="danger" className="mb-6">
          <span className="font-medium">Your vendor account is suspended.</span>
          <span className="block text-muted-foreground">
            Your products are hidden from the shop and the Seller Centre is read-only, except that you can still pack and
            send the orders placed before the suspension. Contact KACHI support for details.
          </span>
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {can("stores.manage") && <StoreCard />}
        {orders && (
          <>
            <OrdersCard
              status="placed"
              title="Waiting for acceptance"
              icon={ClipboardCheckIcon}
              emptyText="No new orders to accept."
              deadlineLabel="Soonest ship-by"
            />
            <OrdersCard
              status="accepted"
              title="To pack"
              icon={PackageIcon}
              emptyText="Nothing waiting to be packed."
              deadlineLabel="Soonest ship-by"
            />
            <OrdersCard
              status="ready_to_ship"
              title="Ready for pickup"
              icon={TruckIcon}
              emptyText="No packages waiting for the courier."
            />
            <ReturnsCard />
          </>
        )}
        {can("inventory.manage") && <LowStockCard />}
        {can(EARNINGS_PERMISSIONS) && <EarningsCard />}
      </div>
    </>
  );
}

function StatCard({
  href,
  icon: Icon,
  title,
  value,
  tone,
  error,
  children,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  value: ReactNode;
  tone?: "attention" | "danger";
  error?: unknown;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition-colors hover:ring-foreground/25",
        tone === "attention" && "ring-tertiary/30",
        tone === "danger" && "ring-destructive/30",
      )}
    >
      <span className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <Icon
            className={cn(
              "size-4",
              tone === "attention" && "text-on-tertiary-fixed",
              tone === "danger" && "text-destructive",
            )}
          />
          {title}
        </span>
        <ChevronRightIcon className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
      {error ? (
        <span className="text-sm text-destructive">{errorMessage(error)}</span>
      ) : (
        <span className="font-heading text-headline-lg leading-none">{value}</span>
      )}
      {!error && children && <span className="text-sm text-muted-foreground">{children}</span>}
    </Link>
  );
}

function soonest<T>(rows: T[], at: (row: T) => string | null): string | null {
  let best: string | null = null;
  for (const row of rows) {
    const value = at(row);
    if (value && (best === null || new Date(value) < new Date(best))) best = value;
  }
  return best;
}

function OrdersCard({
  status,
  title,
  icon,
  emptyText,
  deadlineLabel,
}: {
  status: "placed" | "accepted" | "ready_to_ship";
  title: string;
  icon: LucideIcon;
  emptyText: string;
  deadlineLabel?: string;
}) {
  const { data, error } = useApi(`overview:orders:${status}`, () =>
    listOrders({ status, per_page: deadlineLabel ? SAMPLE : 1 }),
  );
  const total = data ? (data.meta.total ?? data.data.length) : undefined;
  // Zajel sends some orders from its own stock: those have nothing for the store to pack.
  const next = data && deadlineLabel ? soonest<SellerOrder>(data.data, (o) => (o.package ? o.ship_by : null)) : null;

  return (
    <StatCard
      href={`/orders?status=${status}`}
      icon={icon}
      title={title}
      value={total ?? "…"}
      tone={total ? "attention" : undefined}
      error={error}
    >
      {total === 0 ? (
        emptyText
      ) : next ? (
        <>
          {deadlineLabel}: <Deadline at={next} />
        </>
      ) : null}
    </StatCard>
  );
}

function ReturnsCard() {
  const { data, error } = useApi("overview:returns", () => listReturns({ status: "requested", per_page: SAMPLE }));
  const total = data ? (data.meta.total ?? data.data.length) : undefined;
  const next = data ? soonest<ReturnRequest>(data.data, (r) => r.reply_by) : null;

  return (
    <StatCard
      href="/returns?status=requested"
      icon={Undo2Icon}
      title="Returns awaiting your answer"
      value={total ?? "…"}
      tone={total ? "attention" : undefined}
      error={error}
    >
      {total === 0 ? (
        "No return requests to answer."
      ) : next ? (
        <>
          Answer the first by <Deadline at={next} />
        </>
      ) : null}
    </StatCard>
  );
}

function LowStockCard() {
  const { data, error } = useApi("overview:low-stock", () =>
    apiList<LowStockItem>("/vendor/inventory/low-stock", { per_page: 1 }),
  );
  const total = data ? (data.meta.total ?? data.data.length) : undefined;
  const emptiest = data?.data[0];

  return (
    <StatCard
      href="/inventory/low-stock"
      icon={PackageXIcon}
      title="Low stock"
      value={total ?? "…"}
      tone={total ? "attention" : undefined}
      error={error}
    >
      {total === 0
        ? "Every live variant is above its threshold."
        : emptiest
          ? `Lowest: ${emptiest.product?.name ?? emptiest.variant?.sku ?? "a variant"} (${emptiest.available} left)`
          : null}
    </StatCard>
  );
}

function EarningsCard() {
  const { data, error } = useApi("overview:earnings", getEarningsSummary);

  return (
    <StatCard href="/earnings" icon={WalletIcon} title="Available earnings" value={data ? formatMoney(data.available) : "…"} error={error}>
      {data && (data.pending === "0.00" ? "Counts towards your next payout." : `${formatMoney(data.pending)} more once the return period ends.`)}
    </StatCard>
  );
}

function StoreCard() {
  const { data: store, error } = useApi("overview:store", getStore);
  const open = store?.status === "active";

  return (
    <StatCard
      href="/store"
      icon={store && !open ? MoonIcon : StoreIcon}
      title="Your store"
      value={store ? store.name : "…"}
      tone={store?.status === "suspended" ? "danger" : store?.status === "inactive" ? "attention" : undefined}
      error={error}
    >
      {store && (
        <span className="grid gap-1.5">
          <StatusBadge
            status={store.status}
            label={store.status === "active" ? "Open" : store.status === "inactive" ? "Closed" : "Suspended by KACHI"}
          />
          <span>
            {store.status === "active"
              ? "Visible in the shop."
              : store.status === "inactive"
                ? "Closed: hidden from the shop until you reopen it."
                : (store.status_reason ?? "Hidden from the shop until KACHI lifts the suspension.")}
          </span>
        </span>
      )}
    </StatCard>
  );
}
