// The store's earnings (Phase 4c, DECISIONS FN6): GET /vendor/earnings/summary and the ledger,
// GET /vendor/earnings (LedgerEntryResource). Amounts are decimal strings; a deduction is negative.
import type { IsoDate, Money, Ulid } from "@/types/api";

/** LedgerEntryType: a sale (a delivered package), returned items, or a refund charged to the store. */
export type LedgerEntryType = "sale" | "return" | "refund";

/** A sale is "pending" during the return period after delivery, then "available"; a deduction is available at once. */
export type LedgerEntryStatus = "pending" | "available";

export interface EarningsSummary {
  /** What the store has earned after KACHI's commission, net of returns and refunds. */
  earned: Money;
  /** KACHI's commission, net of returned items. */
  commission: Money;
  /** Still in the return period: not yet counted towards a payout. */
  pending: Money;
  /** Past the return period (and every deduction): counts towards the next payout. */
  available: Money;
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
];
