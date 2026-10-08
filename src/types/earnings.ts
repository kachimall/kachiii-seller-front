// The store's earnings (Phase 4c, DECISIONS FN6): GET /vendor/earnings/summary and the ledger,
// GET /vendor/earnings (LedgerEntryResource). Amounts are decimal strings; a deduction is negative.
import type { IsoDate, Money, Ulid } from "@/types/api";

/** LedgerEntryType: a sale (a delivered package), returned items, or a refund charged to the store. */
export type LedgerEntryType = "sale" | "return" | "refund";

/**
 * A sale is "pending" during the return period after delivery, then "available"; a deduction is
 * available at once. Both become "released" once a weekly payout takes them.
 */
export type LedgerEntryStatus = "pending" | "available" | "released";

export interface EarningsSummary {
  /** What the store has earned after KACHI's commission, net of returns and refunds. */
  earned: Money;
  /** KACHI's commission, net of returned items. */
  commission: Money;
  /** Already taken into weekly payouts. */
  released: Money;
  /** Not yet in a payout: pending plus available. */
  outstanding: Money;
  /** Still in the return period: not yet counted towards a payout. */
  pending: Money;
  /** Past the return period (and every deduction): counts towards the next payout. */
  available: Money;
  /**
   * The store's share of its cash-on-delivery orders, which KACHI pays it outside the payment
   * split: earned (net of returns and refunds), paid (in payouts whose KACHI part KACHI recorded
   * paid) and due.
   */
  cash_on_delivery: { earned: Money; paid: Money; due: Money };
}

export interface LedgerEntry {
  id: Ulid;
  type: LedgerEntryType;
  /** The store's order number (KO-…); the entry has no order id. */
  order_number: string;
  /** RT-…, for a return. */
  return_number: string | null;
  /** What the store earns after commission; negative when it gives money back. */
  amount: Money;
  /** Who pays it out: noqodi (from the payment split) or KACHI (cash on delivery, KACHI's vouchers). */
  paid_by: { noqodi: Money; kachi: Money };
  /** KACHI's commission on it; negative on a return. */
  commission: Money;
  /** When it counts towards a payout. */
  available_at: IsoDate;
  status: LedgerEntryStatus;
  /** The payout that took it, once released. */
  payout_number: string | null;
  created_at: IsoDate;
}

/** noqodi's part of a payout: "none", "pending" or "settled". */
export type NoqodiPayoutStatus = "none" | "pending" | "settled";
/** KACHI's part (cash on delivery, KACHI's vouchers): "none", "pending" or "paid". */
export type KachiPayoutStatus = "none" | "pending" | "paid";

/** A weekly payout (DECISIONS FN7): GET /vendor/payouts and /vendor/payouts/{id}. */
export interface Payout {
  id: Ulid;
  number: string;
  /** The weekly cut-off: the earnings available, and recorded, by then. */
  period_end: IsoDate;
  amount: Money;
  /** Each part is paid out apart; a negative part is money the store gives back. */
  paid_by: {
    noqodi: { amount: Money; status: NoqodiPayoutStatus; reference: string | null; settled_at: IsoDate | null };
    kachi: { amount: Money; status: KachiPayoutStatus; reference: string | null; paid_at: IsoDate | null };
  };
  commission: Money;
  /** "released" while a part waits for its money, then "completed". */
  status: "released" | "completed";
  /** On GET /vendor/payouts/{id} only. */
  entries?: LedgerEntry[];
  created_at: IsoDate;
}

export const LEDGER_ENTRY_TYPES: Record<LedgerEntryType, string> = {
  sale: "Sale",
  return: "Returned items",
  refund: "Refund charged to you",
};

export const LEDGER_STATUSES: { value: LedgerEntryStatus; label: string }[] = [
  { value: "pending", label: "In the return period" },
  { value: "available", label: "Available" },
  { value: "released", label: "In a payout" },
];

export const PAYMENT_METHOD_OPTIONS = [
  { value: "online", label: "Paid online" },
  { value: "cash_on_delivery", label: "Cash on delivery" },
];

export const KACHI_STATUS_OPTIONS = [
  { value: "pending", label: "KACHI part due" },
  { value: "paid", label: "KACHI part paid" },
  { value: "none", label: "No KACHI part" },
];
