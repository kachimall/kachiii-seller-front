import { api } from "@/lib/api/client";
import type { DashboardPeriod, VendorDashboard } from "@/types/dashboard";

/** The store's own figures over UAE days (the last 30 by default, a year at most). No permission needed. */
export const getDashboard = (period: DashboardPeriod = {}) =>
  api<VendorDashboard>("/vendor/dashboard", { query: { from: period.from, to: period.to } });
