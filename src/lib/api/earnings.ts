import { api, apiList, type Query } from "@/lib/api/client";
import type { EarningsSummary, LedgerEntry, LedgerEntryStatus } from "@/types/earnings";

/**
 * The earnings routes need only a vendor account (no ->can() on them); the nav and page gate on
 * these, which the vendor role always holds (RolePermissionSeeder).
 */
export const EARNINGS_PERMISSIONS = ["payouts.view", "commissions.view"];

export interface EarningsFilters extends Query {
  status?: LedgerEntryStatus | "";
  page?: number;
  /** Up to 100 (30 by default). */
  per_page?: number;
}

/** Earned and commission (net of deductions), and how much is pending or available. */
export const getEarningsSummary = () => api<EarningsSummary>("/vendor/earnings/summary");

/** The store's sales and deductions, newest first (no search, type filter or sort). */
export const listEarnings = (filters: EarningsFilters = {}) => apiList<LedgerEntry>("/vendor/earnings", filters);
