// Types for the KACHI admin API (GET /docs/admin.json). IDs are ULIDs, money is a decimal
// string ("158.00") alongside a currency_code, and timestamps are ISO 8601 strings.

export type Ulid = string;
export type Money = string;
export type IsoDate = string;

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

export type FieldErrors = Record<string, string[]>;

export interface Envelope<T, M = Record<string, unknown>> {
  success: boolean;
  message: string;
  data: T;
  meta: M;
}

export interface PageMeta {
  current_page: number;
  per_page: number;
  has_more: boolean;
  total?: number;
  last_page?: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type UserStatus = "active" | "inactive" | "suspended";
export type VendorStatus =
  | "pending"
  | "awaiting_consent"
  | "approved"
  | "rejected"
  | "suspended"
  | "terminated";
export type BusinessType =
  | "individual"
  | "sole_establishment"
  | "civil_company"
  | "llc"
  | "free_zone_company"
  | "branch";
export type StoreStatus = "active" | "inactive" | "suspended";
export type ProductStatus =
  | "draft"
  | "pending_review"
  | "rejected"
  | "active"
  | "inactive"
  | "archived"
  | "banned";
export type ModerationStatus = "active" | "rejected" | "banned" | "inactive";
export type ProductVariantStatus = "active" | "inactive" | "archived";
export type ProductImageStatus = "processing" | "ready" | "failed";
export type TaxClass = "standard" | "zero_rated" | "exempt";
export type InventoryMovementType =
  | "purchase"
  | "sale"
  | "reservation"
  | "release"
  | "return"
  | "adjustment"
  | "cancellation";
export type PurchaseStatus = "pending" | "placed" | "cancelled";
export type PaymentMethod = "online" | "cash_on_delivery";
export type PaymentStatus = "unpaid" | "paid" | "due_on_delivery";
export type PaymentAttemptStatus = "pending" | "succeeded" | "failed";
export type VendorOrderStatus =
  | "pending"
  | "placed"
  | "accepted"
  | "ready_to_ship"
  | "shipped"
  | "delivered"
  | "returned"
  | "cancelled";
export type CancelledBy = "buyer" | "vendor" | "staff" | "system";
export type ShipmentStatus = "pending" | "processing" | "ready" | "shipped" | "delivered" | "returned" | "cancelled";
/** What the courier (Zajel) reports. Not one-way: a failed attempt goes back out; delivered and returned are final. */
export type CourierStatus = "picked_up" | "in_transit" | "out_for_delivery" | "delivery_failed" | "delivered" | "returned";
export type CodStatus = "pending" | "collected" | "not_collected";
export type Fulfiller = "vendor" | "provider";
/** "pending" and "processing" until paid back; "failed" waits for staff to try again. */
export type RefundStatus = "pending" | "processing" | "succeeded" | "failed";
/** Who bears a refund in the payouts. */
export type RefundCharge = "vendor" | "kachi";
/** "escalated": KACHI decides (the store did not answer in time, or the buyer disputed its rejection). */
export type ReturnStatus = "requested" | "escalated" | "approved" | "rejected" | "received" | "withdrawn";
export type ReturnDecision = "approved" | "rejected";
export type ReturnReason = "damaged" | "defective" | "wrong_item" | "not_as_described" | "missing_parts" | "other";
export type VendorDocumentType = "trade_license" | "vat_certificate" | "other";
export type VoucherFunder = "kachi" | "vendor";
export type VoucherType = "fixed" | "percentage";
export type VoucherState = "off" | "scheduled" | "ended" | "running";
export type AccessLevel = "view" | "change";

/**
 * A variant's option values. The spec says string; the API sends an object such as
 * {"Colour": "Red", "Size": "M"} ({} for a single-variant product).
 */
export type VariantOptions = Record<string, string> | string;

/** The spec says string[]; the API sends {id, name, slug} objects, root first. */
export interface Crumb {
  id: Ulid;
  name: string;
  slug: string;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface User {
  id: Ulid;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  email_verified: boolean;
  roles?: string[];
  permissions?: string[];
  two_factor?: { enabled: boolean; required: boolean };
  vendor?: { id: Ulid; status: VendorStatus };
  created_at: IsoDate | null;
}

export interface TokenResult {
  user: User;
  token: string;
  expires_at: IsoDate;
}

export interface TwoFactorPending {
  two_factor: true;
  challenge_token: string;
}

export type LoginResult = TokenResult | TwoFactorPending;

export interface TwoFactorStatus {
  enabled: boolean;
  required: boolean;
  recovery_codes_left: number | null;
}

export interface TwoFactorSetup {
  secret: string;
  otpauth_url: string;
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export interface Category {
  id: Ulid;
  name: string;
  slug: string;
  image_url: string | null;
  depth: number;
  position: number;
  breadcrumbs?: (Crumb | string)[];
  children?: Category[];
  is_active?: boolean;
  parent_id?: Ulid | null;
}

export interface Brand {
  id: Ulid;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active?: boolean;
}

export interface CatalogAttribute {
  id: Ulid;
  name: string;
  is_active: boolean;
  position: number;
}

export interface Inventory {
  on_hand: number;
  reserved: number;
  available: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
  variant?: { id: Ulid; sku: string; seller_sku: string | null; options: VariantOptions };
  product?: { id: Ulid; name: string; status: ProductStatus };
}

export interface InventoryMovement {
  type: InventoryMovementType;
  quantity: number;
  on_hand_before: number;
  on_hand_after: number;
  reserved_before: number;
  reserved_after: number;
  note: string | null;
  reference_type: string | null;
  created_by: { id?: Ulid; name: string } | null;
  created_at: IsoDate;
}

export interface ProductImage {
  id: Ulid;
  status: ProductImageStatus;
  url: string | null;
  thumbnail_url: string | null;
  position: number;
  alt_text: string | null;
  width: number | null;
  height: number | null;
}

export interface ProductOption {
  id: Ulid;
  name: string;
  position: number;
  values: { id: Ulid; value: string; position: number }[];
}

export interface ProductVariant {
  id: Ulid;
  sku: string;
  options: VariantOptions;
  price: Money;
  sale_price: Money | null;
  effective_price: Money;
  currency_code: string;
  weight_grams: number;
  /** null when no dimensions were given (the spec says always an object). */
  dimensions_mm: { length: number | null; width: number | null; height: number | null } | null;
  image_id: Ulid | null;
  stock: number;
  seller_sku?: string | null;
  status?: ProductVariantStatus;
  position?: number;
  inventory?: Inventory;
}

export interface Product {
  id: Ulid;
  name: string;
  slug: string;
  sku: string;
  currency_code: string;
  price_range: { min: Money | null; max: Money | null };
  in_stock: boolean;
  /** Its visible reviews; average null until the first one. */
  rating?: { average: string | null; count: number };
  /** Units sold in orders that went ahead, recounted every few minutes. */
  sold_count?: number;
  thumbnail_url: string | null;
  store: { id: Ulid; name: string; slug: string };
  description?: string;
  metadata?: { name: string; value: string }[];
  tax_class?: TaxClass;
  published_at?: IsoDate | null;
  category?: { id: Ulid; name: string; slug: string; breadcrumbs: (Crumb | string)[] };
  brand?: { id: Ulid; name: string; slug: string } | null;
  options?: ProductOption[];
  variants?: ProductVariant[];
  images?: ProductImage[];
  status?: ProductStatus;
  ships_from_provider?: boolean;
  moderation_reason?: string | null;
  approved_at?: IsoDate | null;
  submitted_at?: IsoDate | null;
  archived_at?: IsoDate | null;
  created_at?: IsoDate | null;
  updated_at?: IsoDate | null;
  stock_on_hand?: number;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface OrderItem {
  id: Ulid;
  package_id: Ulid;
  product: { id: Ulid; name: string };
  variant: { id: Ulid; sku: string; options: VariantOptions };
  thumbnail_url: string | null;
  unit_price: Money;
  compare_at_price: Money | null;
  quantity: number;
  line_total: Money;
  discount_amount: Money;
  tax_rate: string;
  tax_amount: Money;
  commission_rate?: string;
  commission_amount?: Money;
}

export interface Shipment {
  id: Ulid;
  fulfiller: Fulfiller;
  status: ShipmentStatus;
  order_id: Ulid | null;
  service: { code: string; name: string };
  fee: Money;
  min_days: number;
  max_days: number;
  weight_grams: number;
  ready_at: IsoDate | null;
  shipped_at: IsoDate | null;
  delivered_at: IsoDate | null;
  /** Until when its items can be returned; null until delivered. */
  return_by: IsoDate | null;
  /** Brought back undelivered by the courier, and when its sender confirmed it is back. */
  returned_at: IsoDate | null;
  received_back_at: IsoDate | null;
  cancelled_at: IsoDate | null;
  /** The courier's tracking number, once booked. */
  waybill_number: string | null;
  courier_status: CourierStatus | null;
  /** What the courier collects; null when paid online. */
  cash_on_delivery: { amount: Money; status: CodStatus; collected_at: IsoDate | null } | null;
  /** Courier updates, oldest first. */
  tracking?: { status: CourierStatus; description: string | null; reason: string | null; occurred_at: IsoDate }[];
  booked_at?: IsoDate | null;
  /** The label can be downloaded (GET …/packages/{id}/waybill). */
  waybill_ready?: boolean;
  quoted_fee?: Money;
}

export type Address = Record<string, unknown>;

export interface VendorOrder {
  id: Ulid;
  number: string;
  status: VendorOrderStatus;
  store: { id: Ulid; name: string; slug: string };
  items_total: Money;
  discount_total: Money;
  items: OrderItem[];
  placed_at: IsoDate | null;
  ship_by: IsoDate | null;
  accepted_at: IsoDate | null;
  ready_at: IsoDate | null;
  shipped_at: IsoDate | null;
  delivered_at: IsoDate | null;
  returned_at: IsoDate | null;
  cancelled_at: IsoDate | null;
  cancelled_by: CancelledBy | null;
  cancel_reason: string | null;
  refund_amount: Money;
  purchase?: { number: string; payment_method: PaymentMethod; payment_status: PaymentStatus };
  delivery_address?: Address;
  package?: Shipment | null;
  commission_total?: Money;
  earnings?: Money;
}

export interface PaymentRecord {
  id: Ulid;
  status: PaymentAttemptStatus;
  amount: Money;
  reference: string | null;
  failure_reason: string | null;
  split: Record<string, unknown>[];
  paid_at: IsoDate | null;
  failed_at: IsoDate | null;
  created_at: IsoDate | null;
}

export interface Purchase {
  id: Ulid;
  number: string;
  status: PurchaseStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  currency_code: string;
  items_total: Money;
  voucher_code: string | null;
  discount_total: Money;
  shipping_total: Money;
  grand_total: Money;
  shipping_address: Address;
  contact_email: string;
  pay_by: IsoDate | null;
  payment: {
    id: Ulid;
    status: PaymentAttemptStatus;
    redirect_url: string | null;
    failure_reason: string | null;
  } | null;
  orders: VendorOrder[];
  packages: Shipment[];
  /** Money owed back to the buyer; loaded on the order detail. */
  refunds?: Refund[];
  placed_at: IsoDate | null;
  paid_at: IsoDate | null;
  cancelled_at: IsoDate | null;
  cancel_reason: string | null;
  created_at: IsoDate | null;
  buyer?: { id: Ulid; name: string; email: string };
  payment_failures?: number;
  flagged_at?: IsoDate | null;
  payments?: PaymentRecord[];
}

export interface Refund {
  id: Ulid;
  amount: Money;
  reason: string;
  status: RefundStatus;
  refunded_at: IsoDate | null;
  created_at: IsoDate | null;
  order?: { id: Ulid; number: string };
  /** The store's order number, when one store's order is refunded. */
  store_order?: string | null;
  /** null when nothing was earned yet. */
  charged_to?: RefundCharge | null;
  reference?: string | null;
  attempts?: number;
  failure_reason?: string | null;
  failed_at?: IsoDate | null;
}

export interface ReturnAnswer {
  decision: ReturnDecision;
  remarks: string | null;
  decided_at: IsoDate | null;
}

export interface ReturnRequest {
  id: Ulid;
  number: string;
  status: ReturnStatus;
  order: { id: Ulid; number: string };
  store_order: { id: Ulid; number: string; store_name: string };
  /** The package the items came in. */
  package_id: Ulid;
  reason: ReturnReason;
  details: string | null;
  /** Portal paths of the buyer's photos (WebP); they need the bearer token. */
  photos: string[];
  items: {
    item_id: Ulid;
    product_name: string;
    sku: string;
    options: Record<string, string>;
    thumbnail_url: string | null;
    quantity: number;
    refund_amount: Money;
  }[];
  /** What the buyer gets back once the items are back; final once received. */
  refund_amount: Money;
  /** The store answers by then, or KACHI decides. */
  reply_by: IsoDate | null;
  store_answer: ReturnAnswer | null;
  escalated_at: IsoDate | null;
  /** The buyer's reason for asking KACHI to review the store's rejection. */
  dispute_reason: string | null;
  dispute_by: IsoDate | null;
  kachi_decision: ReturnAnswer | null;
  /** The courier's pickup, once booked. */
  pickup: {
    waybill_number: string;
    booked_at: IsoDate | null;
    cancelled_at: IsoDate | null;
    courier_status: CourierStatus | null;
    courier_status_at: IsoDate | null;
  } | null;
  received_at: IsoDate | null;
  /** Whether the items went back on sale; null until received. */
  restocked: boolean | null;
  withdrawn_at: IsoDate | null;
  created_at: IsoDate | null;
  buyer?: { id: Ulid; name: string; email: string };
  decided_by?: string | null;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export interface Buyer {
  id: Ulid;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  email_verified: boolean;
  /** Switched off after the admin-set number of refused parcels, or by staff. */
  cash_on_delivery?: { allowed: boolean; blocked_at: IsoDate | null; refused_parcels: number };
  created_at: IsoDate | null;
}

export interface Store {
  id: Ulid;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  policies: string | null;
  joined_at: IsoDate | null;
  /** The average of its rated products' ratings, and their number of reviews. */
  rating?: { average: string | null; count: number };
  products_count?: number;
  status?: StoreStatus;
  status_reason?: string | null;
  vendor?: { id: Ulid; status: VendorStatus; business_name: string };
}

export interface VendorDocument {
  id: Ulid;
  type: VendorDocumentType;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: IsoDate | null;
}

export interface VendorConsent {
  id: Ulid;
  agreement?: { id: Ulid; version: number; title: string };
  accepted_at: IsoDate;
  accepted_by?: { id: Ulid; name: string; email: string };
  ip_address: string | null;
  user_agent: string | null;
  copy_ready: boolean;
}

export interface Vendor {
  id: Ulid;
  code: string | null;
  status: VendorStatus;
  status_reason: string | null;
  business_name: string;
  business_type: BusinessType;
  /** Masked everywhere except GET /vendors/{id}/tax-id. */
  tax_id: string | null;
  is_vat_registered: boolean;
  contact_phone: string;
  contact_email: string | null;
  revision: number;
  submitted_at: IsoDate;
  approved_at: IsoDate | null;
  agreement_link_expires_at?: IsoDate | null;
  documents?: VendorDocument[];
  consent?: VendorConsent | null;
  store: Store | null;
  user?: User;
}

export interface VendorAgreement {
  id: Ulid;
  version: number;
  title: string;
  body: string;
  published_at: IsoDate | null;
}

export interface Staff {
  id: Ulid;
  name: string;
  email: string;
  status: UserStatus;
  role?: { id: Ulid; name: string } | null;
  two_factor?: { enabled: boolean; required: boolean };
  created_at: IsoDate | null;
}

export const ADMIN_SECTIONS = [
  "vendors",
  "products",
  "orders",
  "finance",
  "reports",
  "content",
  "promotions",
  "ads",
  "messages",
  "buyers",
  "settings",
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];
export type SectionGrants = Record<AdminSection, AccessLevel | null>;

export interface StaffRole {
  id: Ulid;
  name: string;
  sections: SectionGrants;
  requires_two_factor: boolean;
  staff_count?: number;
  created_at: IsoDate | null;
  updated_at: IsoDate | null;
}

/** meta.sections of GET /admin/roles: what each section offers. */
export interface SectionInfo {
  key: AdminSection;
  name: string;
  levels: AccessLevel[];
}

// ---------------------------------------------------------------------------
// Promotions & settings
// ---------------------------------------------------------------------------

export interface Voucher {
  id: Ulid;
  code: string;
  name: string;
  funded_by: VoucherFunder;
  store: { id: Ulid; name: string } | null;
  type: VoucherType;
  value: Money;
  max_discount: Money | null;
  min_spend: Money;
  starts_at: IsoDate;
  ends_at: IsoDate;
  usage_limit: number | null;
  usage_limit_per_buyer: number;
  is_active: boolean;
  status: VoucherState;
  uses?: number;
  created_at: IsoDate | null;
}

/** GET /admin/settings. The spec types `data` as an array; it is a keyed object. */
export interface Settings {
  unpaid_order_minutes: number;
  ship_deadline_days: number;
  cash_on_delivery_enabled: boolean;
  cash_on_delivery_max_total: Money;
  delivery_fee_mode: "courier" | "flat";
  delivery_flat_fee: Money;
  free_delivery_min_total: Money | null;
  /** Refused cash-on-delivery parcels before cash on delivery switches off for a buyer (1–10). */
  cod_refusal_limit: number;
  /** Days after delivery a buyer may ask to return items (1–90). */
  return_days: number;
  /** Days the store has to answer a return request before KACHI decides it (1–14). */
  return_reply_days: number;
  /** Days the buyer has to ask KACHI to review the store's rejection (1–30). */
  return_dispute_days: number;
}

/** GET /admin/commission-rates: the default, and the categories and vendors with their own rate. */
export interface CommissionRates {
  default: string;
  categories: { id: Ulid; name: string; rate: string }[];
  vendors: { id: Ulid; business_name: string; store: string | null; rate: string }[];
}
