"use client";

import Link from "next/link";
import { AlertTriangleIcon, CheckIcon, ImageOffIcon, InfoIcon, Loader2Icon, PackageCheckIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { getOrder } from "@/lib/api/orders";
import { approveReturn, getReturn, getReturnPhoto, receiveReturn, rejectReturn } from "@/lib/api/returns";
import { formatDateTime, formatMoney, formatOptions, humanize } from "@/lib/format";
import { useAuth, useCan } from "@/store/auth";
import { RETURN_REASONS, RETURN_STATUSES, type ReturnAnswer, type ReturnRequest } from "@/types/sales";
import { Deadline, useNow } from "../../orders/_components/deadline";
import { Notice } from "../../orders/_components/notice";
import { RestockDialog } from "../../orders/_components/restock-dialog";

const STATUS_LABELS = Object.fromEntries(RETURN_STATUSES.map((s) => [s.value, s.label]));

export function ReturnDetail({ id }: { id: string }) {
  const { data, error, loading, reload, mutate } = useApi(`return:${id}`, () => getReturn(id));
  return (
    <AsyncContent data={data} error={error} loading={loading} onRetry={reload}>
      {(ret) => <ReturnView ret={ret} onChange={mutate} />}
    </AsyncContent>
  );
}

function ReturnView({ ret, onChange }: { ret: ReturnRequest; onChange: (ret: ReturnRequest) => void }) {
  const can = useCan();
  const nowMs = useNow();
  // A suspended vendor is read-only outside vendor/orders: the API refuses return answers (403).
  const suspended = useAuth((s) => s.user?.vendor?.status === "suspended");
  const canManage = can("orders.manage");
  const [dialog, setDialog] = useState<"approve" | "reject" | "receive" | null>(null);
  const close = (open: boolean) => !open && setDialog(null);

  const replyPassed = ret.reply_by !== null && nowMs !== 0 && new Date(ret.reply_by).getTime() <= nowMs;
  const answerable = ret.status === "requested" && !replyPassed;

  // The store confirms items of its own package only; Zajel's go back to Zajel (KACHI confirms).
  const { data: order } = useApi(ret.status === "approved" ? `order:${ret.store_order.id}` : null, () =>
    getOrder(ret.store_order.id),
  );
  const ownPackage = order ? order.package?.id === ret.package_id : undefined;
  const pickupBack = ret.pickup?.courier_status === "delivered";

  const blocked = suspended ? "Your account is suspended, so you cannot answer returns or confirm them received." : null;

  return (
    <>
      <PageHeader
        back={{ href: "/returns", label: "Returns" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Return {ret.number} <StatusBadge status={ret.status} label={STATUS_LABELS[ret.status]} />
          </span>
        }
        description={
          <>
            Requested {formatDateTime(ret.created_at)} for order{" "}
            <Link href={`/orders/${ret.store_order.id}`} className="text-secondary hover:underline">
              {ret.store_order.number}
            </Link>
          </>
        }
        actions={
          canManage && (
            <>
              {answerable && (
                <>
                  <Button variant="outline" disabled={Boolean(blocked)} onClick={() => setDialog("reject")}>
                    <XIcon /> Reject
                  </Button>
                  <Button disabled={Boolean(blocked)} onClick={() => setDialog("approve")}>
                    <CheckIcon /> Approve
                  </Button>
                </>
              )}
              {ret.status === "approved" && ownPackage && (
                <Button disabled={Boolean(blocked)} onClick={() => setDialog("receive")}>
                  <PackageCheckIcon /> Confirm received
                </Button>
              )}
            </>
          )
        }
      />

      <div className="mb-6 grid gap-3 empty:hidden">
        {blocked && canManage && (answerable || ret.status === "approved") && (
          <Notice icon={<AlertTriangleIcon />} tone="danger">
            {blocked}
          </Notice>
        )}
        {answerable && (
          <Notice icon={<AlertTriangleIcon />} tone="warning">
            <span className="font-medium">
              Answer by <Deadline at={ret.reply_by} />
            </span>
            <span className="block text-muted-foreground">
              Approve and the courier collects the items from the buyer; reject and the buyer keeps them (they may ask
              KACHI to review). If you do not answer in time, KACHI decides.
            </span>
          </Notice>
        )}
        {ret.status === "requested" && replyPassed && (
          <Notice icon={<InfoIcon />}>The time to answer ran out, so KACHI decides this request now.</Notice>
        )}
        {ret.status === "escalated" && (
          <Notice icon={<InfoIcon />}>
            <span className="font-medium">KACHI decides this request</span>
            {ret.escalated_at ? ` (since ${formatDateTime(ret.escalated_at)})` : ""}:{" "}
            {ret.dispute_reason ? "the buyer asked KACHI to review your rejection." : "your store did not answer in time."}
          </Notice>
        )}
        {ret.status === "approved" && ownPackage === false && (
          <Notice icon={<InfoIcon />}>
            These items go back to Zajel, which sent them from its own stock, so KACHI confirms they are back.
          </Notice>
        )}
        {ret.status === "approved" && ownPackage && (
          <Notice icon={<InfoIcon />} tone={pickupBack ? "warning" : undefined}>
            {pickupBack
              ? "The courier delivered the items back to you. Check them and confirm they are received: the buyer is then refunded."
              : "The courier is bringing the items back. Confirm they are received once they are in your hands: the buyer is then refunded."}
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
                  <TableHead>Qty</TableHead>
                  <TableHead className="pr-5 text-right">Refund</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ret.items.map((item) => (
                  <TableRow key={item.item_id}>
                    <TableCell className="pl-5">
                      <span className="flex items-center gap-3">
                        <Thumb src={item.thumbnail_url} alt="" className="size-9" />
                        <span className="min-w-0">
                          <span className="block max-w-xs truncate font-medium">{item.product_name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {formatOptions(item.options)} · {item.sku}
                          </span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell className="pr-5 text-right">{formatMoney(item.refund_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-between border-t px-5 py-3 text-sm font-semibold">
              <span>{ret.status === "received" ? "Refunded to the buyer" : "Refund once the items are back"}</span>
              <span>{formatMoney(ret.refund_amount)}</span>
            </div>
          </Section>

          <Section title="The buyer's request">
            <DetailList
              items={[
                { label: "Reason", value: RETURN_REASONS[ret.reason] ?? humanize(ret.reason) },
                { label: "Answer by", value: formatDateTime(ret.reply_by) },
                { label: "Details", value: ret.details ? <span className="whitespace-pre-line">{ret.details}</span> : "—", wide: true },
              ]}
            />
            {ret.photos.length > 0 && (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ret.photos.map((_, index) => (
                  <ReturnPhoto key={index} returnId={ret.id} number={index + 1} />
                ))}
              </div>
            )}
          </Section>

          <Section title="Answers">
            <div className="grid gap-5 sm:grid-cols-2">
              <Answer
                title="Your answer"
                answer={ret.store_answer}
                empty={ret.status === "requested" ? "Waiting for your answer." : "You did not answer."}
              />
              <Answer
                title="KACHI's decision"
                answer={ret.kachi_decision}
                empty={ret.status === "escalated" ? "Waiting for KACHI's decision." : "Not needed."}
              />
            </div>
            {(ret.dispute_reason || ret.dispute_by) && (
              <div className="mt-5 border-t pt-4 text-sm">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">The buyer&rsquo;s dispute</p>
                {ret.dispute_reason ? (
                  <p className="mt-1.5 whitespace-pre-line">{ret.dispute_reason}</p>
                ) : (
                  <p className="mt-1.5 text-muted-foreground">
                    The buyer may ask KACHI to review your rejection until {formatDateTime(ret.dispute_by)}.
                  </p>
                )}
              </div>
            )}
          </Section>
        </div>

        <div className="grid h-fit gap-6">
          <Section title="Pickup">
            {ret.pickup ? (
              <DetailList
                className="sm:grid-cols-1"
                items={[
                  { label: "Waybill", value: <span className="font-mono">{ret.pickup.waybill_number}</span> },
                  { label: "Booked", value: formatDateTime(ret.pickup.booked_at) },
                  {
                    label: "Courier status",
                    value: ret.pickup.courier_status ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={ret.pickup.courier_status} />
                        <span className="text-xs text-muted-foreground">{formatDateTime(ret.pickup.courier_status_at)}</span>
                      </span>
                    ) : (
                      "Waiting for the courier"
                    ),
                  },
                  ...(ret.pickup.cancelled_at ? [{ label: "Pickup cancelled", value: formatDateTime(ret.pickup.cancelled_at) }] : []),
                ]}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {ret.status === "approved"
                  ? "The courier's pickup from the buyer is being booked."
                  : "Zajel collects the items from the buyer once the return is approved."}
              </p>
            )}
          </Section>

          <Section title="Timeline">
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: "Requested", value: formatDateTime(ret.created_at) },
                ...(ret.store_answer
                  ? [{ label: `You ${ret.store_answer.decision}`, value: formatDateTime(ret.store_answer.decided_at) }]
                  : []),
                ...(ret.escalated_at ? [{ label: "Escalated to KACHI", value: formatDateTime(ret.escalated_at) }] : []),
                ...(ret.kachi_decision
                  ? [{ label: `KACHI ${ret.kachi_decision.decision}`, value: formatDateTime(ret.kachi_decision.decided_at) }]
                  : []),
                ...(ret.received_at
                  ? [
                      { label: "Received", value: formatDateTime(ret.received_at) },
                      { label: "Back on sale", value: ret.restocked ? "Yes" : "No" },
                    ]
                  : []),
                ...(ret.withdrawn_at ? [{ label: "Withdrawn by the buyer", value: formatDateTime(ret.withdrawn_at) }] : []),
              ]}
            />
          </Section>
        </div>
      </div>

      <ReasonDialog
        open={dialog === "approve"}
        onOpenChange={close}
        title={`Approve return ${ret.number}?`}
        description="Zajel collects the items from the buyer and brings them back to you. The buyer is refunded once you confirm they are back."
        confirmLabel="Approve"
        required={false}
        min={1}
        max={500}
        label="Note for the buyer"
        onSubmit={async (remarks) => {
          onChange(await approveReturn(ret.id, remarks));
          toast.success("Return approved.");
        }}
      />

      <ReasonDialog
        open={dialog === "reject"}
        onOpenChange={close}
        title={`Reject return ${ret.number}?`}
        description="The buyer keeps the items and is not refunded. They see your remarks and may ask KACHI to review your decision."
        confirmLabel="Reject"
        destructive
        required
        min={1}
        max={500}
        label="Why you reject it (shown to the buyer)"
        onSubmit={async (remarks) => {
          if (!remarks) return;
          onChange(await rejectReturn(ret.id, remarks));
          toast.success("Return rejected.");
        }}
      />

      <RestockDialog
        open={dialog === "receive"}
        onOpenChange={close}
        title="Items received back?"
        description={`Confirm the items are back with you. The buyer is refunded ${formatMoney(ret.refund_amount)}.`}
        confirmLabel="Confirm received"
        onSubmit={async (restock) => {
          onChange(await receiveReturn(ret.id, restock));
          toast.success("Return received.");
        }}
      />
    </>
  );
}

function Answer({ title, answer, empty }: { title: string; answer: ReturnAnswer | null; empty: string }) {
  return (
    <div className="grid gap-1.5 text-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      {answer ? (
        <>
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={answer.decision} />
            <span className="text-xs text-muted-foreground">{formatDateTime(answer.decided_at)}</span>
          </span>
          {answer.remarks && <p className="whitespace-pre-line">{answer.remarks}</p>}
        </>
      ) : (
        <p className="text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

/** A buyer's photo: private, so it is downloaded with the token and shown through an object URL. */
function ReturnPhoto({ returnId, number }: { returnId: string; number: number }) {
  const { data: url, error } = useApi(`return-photo:${returnId}:${number}`, async () =>
    URL.createObjectURL(await getReturnPhoto(returnId, number)),
  );
  // Revoke each object URL when it is replaced or the photo unmounts.
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  const frame = "flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/5";
  if (error) {
    return (
      <span className={frame} title="Could not load this photo">
        <ImageOffIcon className="size-5 text-muted-foreground" />
      </span>
    );
  }
  if (!url) {
    return (
      <span className={frame}>
        <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
      </span>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element -- an object URL of a private photo */}
      <img src={url} alt={`Buyer's photo ${number}`} className="size-full object-cover" />
    </a>
  );
}
