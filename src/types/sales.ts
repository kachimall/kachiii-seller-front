// The Seller Centre's orders and returns (GET /vendor/orders, /vendor/returns). The shapes are the
// ones in types/api.ts: the vendor routes get the back-office fields of VendorOrderResource
// (purchase, delivery_address, package, commission_total, earnings) and ShipmentResource
// (booked_at, waybill_ready), but never a return's buyer or decided_by (staff only).
import type { Inventory, ReturnReason, ReturnStatus, VendorOrder, VendorOrderStatus } from "@/types/api";

export type {
  CourierStatus,
  OrderItem,
  ReturnAnswer,
  ReturnReason,
  ReturnRequest,
  ReturnStatus,
  Shipment,
  VendorOrder,
  VendorOrderStatus,
} from "@/types/api";

/** The store's order as the Seller Centre gets it: the back-office fields are always there. */
export type SellerOrder = VendorOrder & Required<Pick<VendorOrder, "purchase" | "delivery_address" | "package">>;

/** Every status a vendor can filter by: "pending" (waiting for an online payment) is never shown. */
export const ORDER_STATUSES: { value: Exclude<VendorOrderStatus, "pending">; label: string }[] = [
  { value: "placed", label: "Waiting for acceptance" },
  { value: "accepted", label: "To pack" },
  { value: "ready_to_ship", label: "Ready for pickup" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "returned", label: "Returned by courier" },
  { value: "cancelled", label: "Cancelled" },
];

export const RETURN_STATUSES: { value: ReturnStatus; label: string }[] = [
  { value: "requested", label: "Awaiting your answer" },
  { value: "escalated", label: "KACHI decides" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "received", label: "Received" },
  { value: "withdrawn", label: "Withdrawn" },
];

/** ReturnReason::label() */
export const RETURN_REASONS: Record<ReturnReason, string> = {
  damaged: "Arrived damaged",
  defective: "Does not work",
  wrong_item: "Wrong item, size or colour",
  not_as_described: "Not as described",
  missing_parts: "Parts or accessories missing",
  other: "Another reason",
};

/** GET /vendor/inventory/low-stock: live variants at or below their threshold, emptiest first. */
export type LowStockItem = Inventory;
