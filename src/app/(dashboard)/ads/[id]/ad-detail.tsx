"use client";

import Link from "next/link";
import {
  AlertTriangleIcon,
  CheckIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  FlaskConicalIcon,
  InfoIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DetailList } from "@/components/common/detail-list";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { AsyncContent } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { cancelAd, getAd, MOCK_PAYMENTS, mockAdPayment, payForAd } from "@/lib/api/ads";
import { errorMessage } from "@/lib/api/client";
import { formatDateTime, formatMoney, humanize } from "@/lib/format";
import { useAuth } from "@/store/auth";
import type { Ad } from "@/types/ads";
import { Notice } from "../../orders/_components/notice";
import { AD_STATUS_LABELS, adSubject, clickRate } from "../_components/ad-labels";

export function AdDetail({ id }: { id: string }) {
  const { data, error, loading, reload, mutate } = useApi(`ad:${id}`, () => getAd(id));
  return (
    <AsyncContent data={data} error={error} loading={loading} onRetry={reload}>
      {(ad) => <AdView ad={ad} onChange={mutate} onReload={reload} />}
    </AsyncContent>
  );
}

function AdView({ ad, onChange, onReload }: { ad: Ad; onChange: (ad: Ad) => void; onReload: () => void }) {
  const suspended = useAuth((s) => s.user?.vendor?.status === "suspended");
  const [withdrawing, setWithdrawing] = useState(false);
  const [busy, setBusy] = useState<"pay" | "paid" | "failed" | null>(null);

  const waitingPayment = ad.payment?.status === "pending" ? ad.payment : null;
  const payUrl = waitingPayment?.redirect_url ?? null;

  async function pay() {
    setBusy("pay");
    try {
      const updated = await payForAd(ad.id);
      onChange(updated);
      const url = updated.payment?.redirect_url;
      if (!MOCK_PAYMENTS && url) window.location.assign(url);
      else if (MOCK_PAYMENTS) toast.success("Payment opened. Use the test buttons to settle it.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function mock(outcome: "paid" | "failed") {
    setBusy(outcome);
    try {
      const updated = await mockAdPayment(ad.id, outcome);
      onChange(updated);
      toast.success(outcome === "paid" ? "Test payment recorded: the ad is live." : "Test payment marked as failed.");
    } catch (error) {
      toast.error(errorMessage(error));
      onReload();
    } finally {
      setBusy(null);
    }
  }

  const items = [
    {
      label: "Promotes",
      value: ad.product ? (
        <Link href={`/products/${ad.product.id}`} className="text-secondary hover:underline">
          {ad.product.name}
        </Link>
      ) : (
        "Whole store"
      ),
    },
    { label: "Placement", value: ad.placement.name },
    { label: "Duration", value: `${ad.weeks} week${ad.weeks === 1 ? "" : "s"}` },
    { label: "Price", value: formatMoney(ad.amount, ad.currency_code) },
    { label: "Booked", value: formatDateTime(ad.created_at) },
    { label: "Approved", value: ad.approved_at ? formatDateTime(ad.approved_at) : "—" },
    { label: "Paid", value: ad.paid_at ? formatDateTime(ad.paid_at) : "—" },
    { label: "Runs", value: ad.starts_at ? `${formatDateTime(ad.starts_at)} – ${formatDateTime(ad.ends_at)}` : "Starts once paid" },
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/ads", label: "Ads" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Ad {ad.number} <StatusBadge status={ad.status} label={AD_STATUS_LABELS[ad.status]} />
          </span>
        }
        description={`${adSubject(ad)} · ${ad.placement.name}`}
        actions={
          !suspended && (
            <>
              {ad.status === "pending_approval" && (
                <Button variant="outline" onClick={() => setWithdrawing(true)}>
                  <XIcon /> Withdraw
                </Button>
              )}
              {ad.status === "approved" && !waitingPayment && (
                <Button onClick={pay} disabled={busy !== null}>
                  {busy === "pay" ? <Loader2Icon className="animate-spin" /> : <CreditCardIcon />}
                  Pay {formatMoney(ad.amount, ad.currency_code)}
                </Button>
              )}
              {ad.status === "approved" && waitingPayment && !MOCK_PAYMENTS && payUrl && (
                <a href={payUrl} className={buttonVariants()}>
                  <ExternalLinkIcon /> Continue to payment
                </a>
              )}
            </>
          )
        }
      />

      <div className="mb-6 grid gap-3 empty:hidden">
        {ad.status === "pending_approval" && (
          <Notice icon={<InfoIcon />}>
            KACHI is reviewing this ad. You can withdraw it until they decide. Once approved, you have until the pay-by time
            to pay for it.
          </Notice>
        )}
        {ad.status === "approved" && (
          <Notice icon={<AlertTriangleIcon />} tone="warning">
            <span className="font-medium">Approved. Pay by {formatDateTime(ad.pay_by)}</span>
            <span className="block text-muted-foreground">
              The ad goes live as soon as the payment goes through. If it is not paid in time, it expires.
            </span>
          </Notice>
        )}
        {ad.payment?.status === "failed" && ad.status === "approved" && (
          <Notice icon={<AlertTriangleIcon />} tone="danger">
            The last payment did not go through{ad.payment.failure_reason ? `: ${ad.payment.failure_reason}` : "."} You can try
            again.
          </Notice>
        )}
        {ad.status === "approved" && waitingPayment && MOCK_PAYMENTS && !suspended && (
          <Notice icon={<FlaskConicalIcon />}>
            <span className="font-medium">Test payment</span>
            <span className="block text-muted-foreground">
              The backend runs the mock payment gateway. Settle this payment as the gateway would.
            </span>
            <span className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => mock("paid")} disabled={busy !== null}>
                {busy === "paid" ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
                Mark paid
              </Button>
              <Button size="sm" variant="outline" onClick={() => mock("failed")} disabled={busy !== null}>
                {busy === "failed" ? <Loader2Icon className="animate-spin" /> : <XIcon />}
                Mark failed
              </Button>
            </span>
          </Notice>
        )}
        {ad.status === "rejected" && (
          <Notice icon={<XIcon />} tone="danger">
            <span className="font-medium">Rejected by KACHI {ad.rejected_at ? `on ${formatDateTime(ad.rejected_at)}` : ""}</span>
            {ad.rejection_reason && <span className="block text-muted-foreground">{ad.rejection_reason}</span>}
          </Notice>
        )}
        {ad.status === "stopped" && (
          <Notice icon={<AlertTriangleIcon />} tone="danger">
            <span className="font-medium">Stopped early by KACHI {ad.stopped_at ? `on ${formatDateTime(ad.stopped_at)}` : ""}</span>
            {ad.stop_reason && <span className="block text-muted-foreground">{ad.stop_reason}</span>}
          </Notice>
        )}
        {ad.status === "expired" && (
          <Notice icon={<InfoIcon />}>The time to pay ran out, so this ad will not run. Book a new one to try again.</Notice>
        )}
        {ad.status === "cancelled" && (
          <Notice icon={<InfoIcon />}>You withdrew this ad {ad.cancelled_at ? `on ${formatDateTime(ad.cancelled_at)}` : ""}.</Notice>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Details" className="h-fit lg:col-span-2">
          <DetailList items={items} />
        </Section>
        <div className="grid h-fit gap-6">
          <Section title="Performance">
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: "Views", value: ad.views.toLocaleString("en-AE") },
                { label: "Clicks", value: ad.clicks.toLocaleString("en-AE") },
                { label: "Click rate", value: clickRate(ad) },
              ]}
            />
          </Section>
          {ad.payment && (
            <Section title="Payment">
              <DetailList
                className="sm:grid-cols-1"
                items={[
                  { label: "Latest attempt", value: <StatusBadge status={ad.payment.status} label={humanize(ad.payment.status)} /> },
                  ...(ad.payment.failure_reason ? [{ label: "Why it failed", value: ad.payment.failure_reason }] : []),
                ]}
              />
            </Section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={withdrawing}
        onOpenChange={setWithdrawing}
        title="Withdraw this ad?"
        description="KACHI stops reviewing it and it will not run. You can book a new one at any time."
        confirmLabel="Withdraw"
        destructive
        onConfirm={async () => {
          try {
            onChange(await cancelAd(ad.id));
            toast.success("Ad withdrawn.");
            return true;
          } catch (error) {
            toast.error(errorMessage(error));
            return false;
          }
        }}
      />
    </>
  );
}
