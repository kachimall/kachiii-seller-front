import { api, apiList, openFile, type Query } from "@/lib/api/client";
import type { SellerOrder, VendorOrderStatus } from "@/types/sales";

export interface OrderFilters extends Query {
  status?: Exclude<VendorOrderStatus, "pending"> | "";
  /** Part of the order number, e.g. "0000002" or "KO-0000002-1" (max 30). */
  q?: string;
  page?: number;
  /** Up to 100. */
  per_page?: number;
}

/** The store's own orders once placed, newest first. */
export const listOrders = (filters: OrderFilters = {}) => apiList<SellerOrder>("/vendor/orders", filters);
export const getOrder = (id: string) => api<SellerOrder>(`/vendor/orders/${id}`);

/** placed → accepted. 409 when Zajel sends the items from its own stock. */
export const acceptOrder = (id: string) => api<SellerOrder>(`/vendor/orders/${id}/accept`, { method: "POST" });

/** accepted → ready_to_ship: packed; the courier's pickup is booked moments later. */
export const markOrderReady = (id: string) => api<SellerOrder>(`/vendor/orders/${id}/ready`, { method: "POST" });

/**
 * The store cannot send it (placed or accepted only): the stock goes back on sale and a paid
 * buyer is refunded. The buyer sees "Cancelled by the store: {reason}". Required, up to 200 characters.
 */
export const cancelOrder = (id: string, reason: string) =>
  api<SellerOrder>(`/vendor/orders/${id}/cancel`, { method: "POST", body: { reason } });

/** The courier's waybill PDF to stick on the package; 409 until the pickup is booked. */
export const openWaybill = (id: string) => openFile(`/vendor/orders/${id}/waybill`);

/**
 * The package the courier brought back undelivered is back with the store: its items go back on
 * sale unless restock is false, and a buyer who paid online is refunded. 409 unless returned.
 */
export const receiveOrderBack = (id: string, restock: boolean) =>
  api<SellerOrder>(`/vendor/orders/${id}/received-back`, { method: "POST", body: { restock } });
