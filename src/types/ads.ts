// The store's ads (contract §5.4.2; DECISIONS AD1): booked, approved by KACHI, paid, live, ended.
import type { IsoDate, Money, PaymentAttemptStatus, Ulid } from "@/types/api";

export type AdPlacementKey = "home" | "category" | "search";

export type AdStatus =
  | "pending_approval"
  | "approved"
  | "live"
  | "ended"
  | "rejected"
  | "cancelled"
  | "expired"
  | "stopped";

/** GET /vendor/ad-placements: the placements on sale, priced by the week. */
export interface AdPlacement {
  key: AdPlacementKey;
  name: string;
  weekly_price: Money;
}

export interface Ad {
  id: Ulid;
  number: string;
  status: AdStatus;
  placement: { key: AdPlacementKey; name: string };
  /** null for an ad for the whole store. */
  product: { id: Ulid; name: string } | null;
  weeks: number;
  amount: Money;
  currency_code: string;
  approved_at: IsoDate | null;
  /** Pay by then once approved, or the ad expires. */
  pay_by: IsoDate | null;
  rejected_at: IsoDate | null;
  rejection_reason: string | null;
  cancelled_at: IsoDate | null;
  /** The latest attempt to pay; null before the first. */
  payment: {
    id: Ulid;
    status: PaymentAttemptStatus;
    /** Where to pay, while both the ad and this attempt wait for the payment. */
    redirect_url: string | null;
    failure_reason: string | null;
  } | null;
  paid_at: IsoDate | null;
  starts_at: IsoDate | null;
  ends_at: IsoDate | null;
  stopped_at: IsoDate | null;
  stop_reason: string | null;
  ended_at: IsoDate | null;
  views: number;
  clicks: number;
  created_at: IsoDate;
}

/** POST /vendor/ads. product_id null advertises the whole store. */
export interface BookAdInput {
  placement: AdPlacementKey;
  product_id: Ulid | null;
  weeks: number;
}

export const AD_MAX_WEEKS = 12;

export const AD_STATUSES: { value: AdStatus; label: string }[] = [
  { value: "pending_approval", label: "Waiting for approval" },
  { value: "approved", label: "Approved: to pay" },
  { value: "live", label: "Live" },
  { value: "ended", label: "Ended" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Withdrawn" },
  { value: "expired", label: "Expired (not paid)" },
  { value: "stopped", label: "Stopped by KACHI" },
];
