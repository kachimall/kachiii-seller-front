// The store's dashboard (GET /vendor/dashboard, DECISIONS RP4): its own figures over UAE days.
import type { Money, VendorOrderStatus, CourierStatus } from "@/types/api";
import type { EarningsSummary } from "@/types/earnings";

export interface DashboardPeriod {
  /** YYYY-MM-DD, UAE time. Left out: the last 30 days up to today. A year at most. */
  from?: string;
  to?: string;
}

export interface VendorDashboard {
  from: string;
  to: string;
  /** As the sales report counts them: the store's orders placed in the period. */
  sales: { orders: number; units: number; sales: Money; discounts: Money; net_sales: Money };
  orders: {
    /** Waiting for the store now, whatever the period. */
    to_accept: number;
    to_pack: number;
    /** Placed in the period, by where each one is now. */
    store_orders: Partial<Record<Exclude<VendorOrderStatus, "pending">, number>>;
  };
  /** The packages with the store's items, by what the courier last reported. */
  deliveries: { packages: number; awaiting_pickup: number } & Partial<Record<CourierStatus, number>>;
  /** Payouts released at the weekly cut-offs in the period: noqodi's part and KACHI's, paid and due. */
  payouts: {
    payouts: number;
    released: Money;
    noqodi_settled: Money;
    noqodi_due: Money;
    kachi_paid: Money;
    kachi_due: Money;
  };
  /** Now, as at /vendor/earnings/summary. */
  earnings: EarningsSummary;
  /** No average until the first review. */
  rating: { average: string | null; count: number };
}
