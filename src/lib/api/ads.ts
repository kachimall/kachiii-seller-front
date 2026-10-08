import { api, apiList, type Query } from "@/lib/api/client";
import type { Ad, AdPlacement, AdStatus, BookAdInput } from "@/types/ads";

/** Every ad route needs the promotions permission vendors hold. */
export const ADS_PERMISSION = "promotions.manage";

/**
 * The mock gateway's stand-in payment (POST /vendor/ads/{id}/payments/mock) is only served while
 * the backend runs the mock driver outside production. The Seller Centre offers it when this is on.
 */
export const MOCK_PAYMENTS = process.env.NEXT_PUBLIC_MOCK_PAYMENTS === "true";

export interface AdFilters extends Query {
  status?: AdStatus | "";
  page?: number;
  per_page?: number;
}

/** The placements on sale, with their weekly prices. */
export const listAdPlacements = () => api<AdPlacement[]>("/vendor/ad-placements");

/** The store's ads, newest first. */
export const listAds = (filters: AdFilters = {}) => apiList<Ad>("/vendor/ads", filters);
export const getAd = (id: string) => api<Ad>(`/vendor/ads/${id}`);

/** Price: the placement's weekly price times the weeks. KACHI approves it, then the store pays. */
export const bookAd = (body: BookAdInput) => api<Ad>("/vendor/ads", { method: "POST", body });

/** Withdraw it, until KACHI decides (409 after). */
export const cancelAd = (id: string) => api<Ad>(`/vendor/ads/${id}/cancel`, { method: "POST" });

/** Open a payment for an approved ad; its payment.redirect_url is where to pay. */
export const payForAd = (id: string) => api<Ad>(`/vendor/ads/${id}/payments`, { method: "POST" });

/** Test only (mock gateway): settle the waiting payment as noqodi would. */
export const mockAdPayment = (id: string, outcome: "paid" | "failed") =>
  api<Ad>(`/vendor/ads/${id}/payments/mock`, { method: "POST", body: { outcome } });
