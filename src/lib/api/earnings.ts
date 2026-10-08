import { api, apiList, type Query } from "@/lib/api/client";
import type { EarningsSummary, KachiPayoutStatus, LedgerEntry, LedgerEntryStatus, Payout } from "@/types/earnings";
import type { PaymentMethod } from "@/types/api";

/**
 * The earnings routes need only a vendor account (no ->can() on them); the nav and page gate on
 * these, which the vendor role always holds (RolePermissionSeeder).
 */
export const EARNINGS_PERMISSIONS = ["payouts.view", "commissions.view"];

export interface EarningsFilters extends Query {
  status?: LedgerEntryStatus | "";
  /** cash_on_delivery keeps the entries of orders paid in cash on delivery. */
  payment_method?: PaymentMethod | "";
  page?: number;
  /** Up to 100 (30 by default). */
  per_page?: number;
}

/** Earned and commission (net of deductions), released and outstanding, and the cash-on-delivery share. */
export const getEarningsSummary = () => api<EarningsSummary>("/vendor/earnings/summary");

/** The store's sales and deductions, newest first (no search, type filter or sort). */
export const listEarnings = (filters: EarningsFilters = {}) => apiList<LedgerEntry>("/vendor/earnings", filters);

export interface PayoutFilters extends Query {
  /** "paid" lists the payouts whose KACHI part (cash on delivery, KACHI's vouchers) KACHI recorded paid. */
  kachi_status?: KachiPayoutStatus | "";
  page?: number;
  per_page?: number;
}

/** The store's weekly payouts, newest first. */
export const listPayouts = (filters: PayoutFilters = {}) => apiList<Payout>("/vendor/payouts", filters);

/** One payout with its entries. */
export const getPayout = (id: string) => api<Payout>(`/vendor/payouts/${id}`);
