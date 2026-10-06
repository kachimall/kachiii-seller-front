"use client";

import Link from "next/link";
import {
  AlertTriangleIcon,
  CheckIcon,
  FileTextIcon,
  InfoIcon,
  PackageCheckIcon,
  PackageIcon,
  RotateCwIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DetailList } from "@/components/common/detail-list";
import { PageHeader } from "@/components/common/page-header";
import { ReasonDialog } from "@/components/common/reason-dialog";
import { Section } from "@/components/common/section";
import { AsyncContent } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { Thumb } from "@/components/common/thumb";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { errorMessage } from "@/lib/api/client";
import { acceptOrder, cancelOrder, getOrder, markOrderReady, openWaybill, receiveOrderBack } from "@/lib/api/orders";
import { listReturns } from "@/lib/api/returns";
import { formatDateTime, formatMoney, formatOptions, humanize } from "@/lib/format";
import { runAction } from "@/lib/forms";
import { useAuth, useCan } from "@/store/auth";
import type { CancelledBy } from "@/types/api";
import { ORDER_STATUSES, RETURN_REASONS, type SellerOrder, type Shipment } from "@/types/sales";
import { Deadline } from "../_components/deadline";
import { Notice } from "../_components/notice";
import { RestockDialog } from "../_components/restock-dialog";

const STATUS_LABELS = Object.fromEntries(ORDER_STATUSES.map((s) => [s.value, s.label]));

const CANCELLED_BY: Record<CancelledBy, string> = {
  buyer: "the buyer",
  vendor: "your store",
  staff: "KACHI",
  system: "KACHI (not packed in time)",
};

export function OrderDetail({ id }: { id: string }) {
  const { data, error, loading, reload, mutate } = useApi(`order:${id}`, () => getOrder(id));
  return (
    <AsyncContent data={data} error={error} loading={loading} onRetry={reload}>
      {(order) => <OrderView order={order} onChange={mutate} onReload={reload} reloading={loading} />}
    </AsyncContent>
  );
}

function OrderView({
  order,
  onChange,
  onReload,
  reloading,
}: {
  order: SellerOrder;
  onChange: (order: SellerOrder) => void;
  onReload: () => void;
  reloading: boolean;
}) {
  const can = useCan();
  // A suspended vendor still fulfils the orders it has (the API exempts vendor/orders, P10).
  const suspended = useAuth((s) => s.user?.vendor?.status === "suspended");
  const canManage = can("orders.manage");
  const [dialog, setDialog] = useState<"accept" | "ready" | "cancel" | "received-back" | null>(null);
  const pkg = order.package;
  const money = (amount: string | null | undefined) => formatMoney(amount);
  const close = (open: boolean) => !open && setDialog(null);

  // VendorOrderStatus::canBeCancelledBy(Vendor): before it is packed.
  const cancellable = order.status === "placed" || order.status === "accepted";
  const awaitingReceipt = pkg?.status === "returned" && !pkg.received_back_at;

  return (
    <>
      <PageHeader
        back={{ href: "/orders", label: "Orders" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Order {order.number} <StatusBadge status={order.status} label={STATUS_LABELS[order.status]} />
          </span>
        }
        description={`Placed ${formatDateTime(order.placed_at)} · ${humanize(order.purchase.payment_method)}`}
        actions={
          <>
            {pkg?.waybill_ready && (
              <Button variant="outline" onClick={() => openWaybill(order.id).catch((e) => toast.error(errorMessage(e)))}>
                <FileTextIcon /> Download label
              </Button>
            )}
            {canManage && (
              <>
                {cancellable && (
                  <Button variant="outline" onClick={() => setDialog("cancel")}>
                    <XIcon /> Cancel order
                  </Button>
                )}
                {order.status === "placed" && pkg && (
                  <Button onClick={() => setDialog("accept")}>
                    <CheckIcon /> Accept
                  </Button>
                )}
                {order.status === "accepted" && pkg && (
                  <Button onClick={() => setDialog("ready")}>
                    <PackageIcon /> Mark packed
                  </Button>
                )}
                {awaitingReceipt && (
                  <Button onClick={() => setDialog("received-back")}>
                    <PackageCheckIcon /> Confirm received back
                  </Button>
                )}
              </>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-3 empty:hidden">
        {suspended && canManage && cancellable && (
          <Notice icon={<InfoIcon />}>
            Your account is suspended. You can still fulfil the orders placed before the suspension.
          </Notice>
        )}
        {cancellable && !pkg && (
          <Notice icon={<InfoIcon />}>
            Zajel sends these items from its own stock, so there is nothing for you to pack.
          </Notice>
        )}
        {cancellable && pkg && (
          <Notice icon={<AlertTriangleIcon />} tone="warning">
            <span className="font-medium">
              {order.status === "placed" ? "Accept and pack this order by" : "Pack this order by"}{" "}
              <Deadline at={order.ship_by} />
            </span>
            <span className="block text-muted-foreground">Orders not packed by then are cancelled automatically.</span>
          </Notice>
        )}
        {order.status === "ready_to_ship" && pkg && !pkg.waybill_ready && (
          <Notice icon={<InfoIcon />}>
            <span className="flex flex-wrap items-center justify-between gap-2">
              The courier pickup is being booked. The label to print appears here in a moment.
              <Button variant="outline" size="sm" onClick={onReload} disabled={reloading}>
                <RotateCwIcon className={reloading ? "animate-spin" : undefined} /> Refresh
              </Button>
            </span>
          </Notice>
        )}
        {order.status === "ready_to_ship" && pkg?.waybill_ready && (
          <Notice icon={<InfoIcon />}>
            Print the label, stick it on the package and hand it to the Zajel courier
            {pkg.waybill_number ? ` (waybill ${pkg.waybill_number})` : ""}.
          </Notice>
        )}
        {awaitingReceipt && (
          <Notice icon={<AlertTriangleIcon />} tone="danger">
            The courier brought this package back undelivered {pkg?.returned_at ? `on ${formatDateTime(pkg.returned_at)}` : ""}.
            Confirm once it is back with you: the items can go back on sale, and a buyer who paid online is refunded.
          </Notice>
        )}
        {order.cancelled_at && (
          <Notice icon={<XIcon />}>
            <span className="font-medium">
              Cancelled {order.cancelled_by ? `by ${CANCELLED_BY[order.cancelled_by]} ` : ""}
              {formatDateTime(order.cancelled_at)}
            </span>
            {order.cancel_reason && <span className="block text-muted-foreground">{order.cancel_reason}</span>}
          </Notice>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid h-fit gap-6 lg:col-span-2">
          <Section title="Items" flush>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Item</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead className="pr-5 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-5">
                      <span className="flex items-center gap-3">
                        <Thumb src={item.thumbnail_url} alt="" className="size-9" />
                        <span className="min-w-0">
                          <span className="block max-w-xs truncate font-medium">{item.product.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {formatOptions(item.variant.options)} · {item.variant.sku}
                          </span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {money(item.unit_price)}
                      {item.compare_at_price && (
                        <span className="block text-xs text-muted-foreground line-through">{money(item.compare_at_price)}</span>
                      )}
                    </TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {item.commission_amount ? `${money(item.commission_amount)} (${item.commission_rate}%)` : "—"}
                    </TableCell>
                    <TableCell className="pr-5 text-right whitespace-nowrap">
                      {money(item.line_total)}
                      {item.discount_amount !== "0.00" && (
                        <span className="block text-xs text-muted-foreground">− {money(item.discount_amount)} voucher</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>

          <Section title="Package" flush>
            {pkg ? (
              <PackageView pkg={pkg} />
            ) : (
              <p className="p-5 text-sm text-muted-foreground">
                Zajel sends these items from its own stock; there is no package for you to send.
              </p>
            )}
          </Section>

          <OrderReturns order={order} />
        </div>

        <div className="grid h-fit gap-6">
          <Section title="Totals">
            <dl className="grid gap-2 text-sm">
              <SummaryRow label="Items" value={money(order.items_total)} />
              <SummaryRow
                label="Voucher discount"
                value={order.discount_total === "0.00" ? "—" : `− ${money(order.discount_total)}`}
              />
              <SummaryRow label="KACHI commission" value={order.commission_total ? `− ${money(order.commission_total)}` : "—"} />
              <div className="my-1 border-t" />
              <SummaryRow label="Your earnings" value={money(order.earnings)} strong />
              {order.refund_amount !== "0.00" && <SummaryRow label="Refunded to the buyer" value={money(order.refund_amount)} />}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              A store voucher comes out of your earnings; a KACHI voucher never does.
              {pkg ? ` The buyer paid ${money(pkg.fee)} for delivery.` : ""}{" "}
              <Link href="/earnings" className="underline">
                Earnings
              </Link>{" "}
              records them once the package is delivered, and takes back returned items and refunds charged to you.
            </p>
          </Section>

          <Section title="Delivery">
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: "Ship to", value: <AddressBlock address={order.delivery_address} /> },
                { label: "Purchase", value: order.purchase.number },
                { label: "Payment", value: humanize(order.purchase.payment_method) },
                { label: "Payment status", value: <StatusBadge status={order.purchase.payment_status} /> },
              ]}
            />
          </Section>

          <Section title="Timeline">
            <Timeline order={order} />
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === "accept"}
        onOpenChange={close}
        title={`Accept order ${order.number}?`}
        description={`You commit to send it. Pack it by ${formatDateTime(order.ship_by)}, or it is cancelled.`}
        confirmLabel="Accept order"
        onConfirm={() => run(() => acceptOrder(order.id), "Order accepted.")}
      />

      <ConfirmDialog
        open={dialog === "ready"}
        onOpenChange={close}
        title="Packed and ready for the courier?"
        description="The Zajel pickup is booked and the order can no longer be cancelled by you. The label to print appears on this page once booked."
        confirmLabel="Mark packed"
        onConfirm={() => run(() => markOrderReady(order.id), "Order ready to ship.")}
      />

      <ReasonDialog
        open={dialog === "cancel"}
        onOpenChange={close}
        title={`Cancel order ${order.number}?`}
        description="The stock goes back on sale, and a buyer who paid online is refunded. The buyer sees “Cancelled by the store:” followed by your reason."
        confirmLabel="Cancel order"
        destructive
        required
        min={1}
        max={200}
        label="Reason for the buyer"
        onSubmit={async (reason) => {
          if (!reason) return;
          onChange(await cancelOrder(order.id, reason));
          toast.success("Order cancelled.");
        }}
      />

      <RestockDialog
        open={dialog === "received-back"}
        onOpenChange={close}
        title="Package received back?"
        description="Confirm the courier's returned package is back with you. A buyer who paid online is refunded for its items (not the delivery)."
        confirmLabel="Confirm received"
        onSubmit={async (restock) => {
          onChange(await receiveOrderBack(order.id, restock));
          toast.success("Package received back.");
        }}
      />
    </>
  );

  async function run(action: () => Promise<SellerOrder>, success: string): Promise<boolean> {
    let next: SellerOrder | undefined;
    const done = await runAction(async () => {
      next = await action();
    }, success);
    if (next) onChange(next);
    return done;
  }
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between font-semibold" : "flex justify-between"}>
      <dt className={strong ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** The buyer's delivery address as the API exposes it (recipient, phone and the address lines). */
function AddressBlock({ address }: { address: Record<string, unknown> | null }) {
  if (!address) return <>—</>;
  const text = (key: string) => {
    const value = address[key];
    return typeof value === "string" && value.trim() !== "" ? value : null;
  };
  const lines = [
    [text("unit"), text("building")].filter(Boolean).join(", "),
    text("street"),
    text("area"),
    text("landmark") && `Near ${text("landmark")}`,
    text("emirate") && humanize(text("emirate")!.replace(/_/g, " ")),
  ].filter((line): line is string => Boolean(line));

  return (
    <span className="grid gap-0.5">
      {text("recipient_name") && <span className="font-medium">{text("recipient_name")}</span>}
      {text("phone") && (
        <a href={`tel:${text("phone")}`} className="text-secondary hover:underline">
          {text("phone")}
        </a>
      )}
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </span>
  );
}

function PackageView({ pkg }: { pkg: Shipment }) {
  const steps = [...(pkg.tracking ?? [])].reverse();
  return (
    <div className="grid gap-4 p-5 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{pkg.service.name}</p>
          <p className="text-xs text-muted-foreground">
            {(pkg.weight_grams / 1000).toFixed(2)} kg · {pkg.min_days}–{pkg.max_days} days
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={pkg.status} />
          {pkg.courier_status && <StatusBadge status={pkg.courier_status} />}
        </div>
      </div>

      <DetailList
        className="sm:grid-cols-3"
        items={[
          {
            label: "Waybill",
            value: pkg.waybill_number ? <span className="font-mono">{pkg.waybill_number}</span> : "Not booked yet",
          },
          { label: "Pickup booked", value: formatDateTime(pkg.booked_at) },
          {
            label: "Cash on delivery",
            value: pkg.cash_on_delivery ? (
              <span className="flex flex-wrap items-center gap-2">
                {formatMoney(pkg.cash_on_delivery.amount)} <StatusBadge status={pkg.cash_on_delivery.status} />
              </span>
            ) : (
              "Paid online"
            ),
          },
          ...(pkg.return_by ? [{ label: "Returnable until", value: <Deadline at={pkg.return_by} pastLabel="ended" /> }] : []),
          ...(pkg.returned_at ? [{ label: "Returned by courier", value: formatDateTime(pkg.returned_at) }] : []),
          ...(pkg.received_back_at ? [{ label: "Received back", value: formatDateTime(pkg.received_back_at) }] : []),
        ]}
      />

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Courier tracking</p>
        {steps.length > 0 ? (
          <ol className="grid gap-2 border-l pl-4">
            {steps.map((step) => (
              <li key={`${step.status}-${step.occurred_at}`}>
                <span className="font-medium">{step.description ?? humanize(step.status)}</span>
                {step.reason && <span className="text-muted-foreground"> ({humanize(step.reason)})</span>}
                <span className="block text-xs text-muted-foreground">{formatDateTime(step.occurred_at)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground">No courier updates yet.</p>
        )}
      </div>
    </div>
  );
}

function Timeline({ order }: { order: SellerOrder }) {
  const pkg = order.package;
  const events: { label: string; at: string | null | undefined }[] = [
    { label: "Placed", at: order.placed_at },
    { label: "Accepted", at: order.accepted_at },
    { label: "Packed", at: order.ready_at },
    { label: "Pickup booked", at: pkg?.booked_at },
    { label: "Shipped", at: order.shipped_at },
    { label: "Delivered", at: order.delivered_at },
    { label: "Returned by courier", at: order.returned_at },
    { label: "Received back", at: pkg?.received_back_at },
    { label: "Cancelled", at: order.cancelled_at },
  ];
  const done = events.filter((e) => e.at).sort((a, b) => new Date(a.at!).getTime() - new Date(b.at!).getTime());

  return (
    <ol className="grid gap-3 border-l pl-4 text-sm">
      {done.map((event) => (
        <li key={event.label}>
          <span className="font-medium">{event.label}</span>
          <span className="block text-xs text-muted-foreground">{formatDateTime(event.at)}</span>
        </li>
      ))}
      {(order.status === "placed" || order.status === "accepted") && order.ship_by && (
        <li className="text-muted-foreground">
          <span className="font-medium">Pack by</span>
          <span className="block text-xs">{formatDateTime(order.ship_by)}</span>
        </li>
      )}
    </ol>
  );
}

/**
 * The returns for this order. The API cannot filter returns by order, so this reads the latest
 * 100 and keeps this order's (returns only exist once something was delivered).
 */
function OrderReturns({ order }: { order: SellerOrder }) {
  const can = useCan();
  const show = Boolean(order.delivered_at) && can("orders.view");
  const { data, error } = useApi(show ? `order-returns:${order.id}` : null, () => listReturns({ per_page: 100 }));
  if (!show) return null;
  const returns = data?.data.filter((r) => r.store_order.id === order.id);

  return (
    <Section title="Returns" flush>
      {error ? (
        <p className="p-5 text-sm text-destructive">{errorMessage(error)}</p>
      ) : !returns ? (
        <p className="p-5 text-sm text-muted-foreground">Loading…</p>
      ) : returns.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          No return requests for this order.
          {order.package?.return_by ? ` The buyer can ask until ${formatDateTime(order.package.return_by)}.` : ""}
        </p>
      ) : (
        <ul className="divide-y">
          {returns.map((ret) => (
            <li key={ret.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <span className="min-w-0">
                <Link href={`/returns/${ret.id}`} className="font-medium hover:underline">
                  {ret.number}
                </Link>
                <span className="block text-xs text-muted-foreground">
                  {RETURN_REASONS[ret.reason]} · {ret.items.reduce((sum, item) => sum + item.quantity, 0)} item(s) ·{" "}
                  {formatMoney(ret.refund_amount)}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {ret.status === "requested" && (
                  <span className="text-xs">
                    Answer by <Deadline at={ret.reply_by} />
                  </span>
                )}
                <StatusBadge status={ret.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
