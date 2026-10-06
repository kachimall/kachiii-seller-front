import { api, apiList, fetchBlob, type Query } from "@/lib/api/client";
import type { ReturnRequest, ReturnStatus } from "@/types/sales";

export interface ReturnFilters extends Query {
  status?: ReturnStatus | "";
  page?: number;
  /** Up to 100. */
  per_page?: number;
}

/** The store's returns, newest first (the API has no search or sort). */
export const listReturns = (filters: ReturnFilters = {}) => apiList<ReturnRequest>("/vendor/returns", filters);
export const getReturn = (id: string) => api<ReturnRequest>(`/vendor/returns/${id}`);

/** The courier collects the items. Before reply_by only (409 after: KACHI decides). Remarks up to 500. */
export const approveReturn = (id: string, remarks: string | null) =>
  api<ReturnRequest>(`/vendor/returns/${id}/approve`, { method: "POST", body: { remarks } });

/** The buyer keeps the items and may ask KACHI to review. Remarks required, up to 500. */
export const rejectReturn = (id: string, remarks: string) =>
  api<ReturnRequest>(`/vendor/returns/${id}/reject`, { method: "POST", body: { remarks } });

/**
 * The approved items are back with the store: they go back on sale unless restock is false, and
 * the buyer is refunded. 409 for items that go back to Zajel (KACHI confirms those).
 */
export const receiveReturn = (id: string, restock: boolean) =>
  api<ReturnRequest>(`/vendor/returns/${id}/receive`, { method: "POST", body: { restock } });

/** One of the buyer's photos (WebP), numbered from 1, downloaded with the token. */
export const getReturnPhoto = (id: string, number: number, signal?: AbortSignal) =>
  fetchBlob(`/vendor/returns/${id}/photos/${number}`, signal);
