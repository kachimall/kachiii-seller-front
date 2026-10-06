// Seller Centre product and inventory shapes (BackOffice ProductController & co. under /vendor).
// The resource types themselves live in @/types/api; these are the vendor-specific additions.

import type {
  CatalogAttribute,
  Inventory,
  InventoryMovement,
  Money,
  Product,
  ProductStatus,
  ProductVariantStatus,
  TaxClass,
  Ulid,
} from "@/types/api";

export type { CatalogAttribute };

/** ProductResource on /vendor routes. price_range is null while the product has no active variant. */
export type VendorProduct = Omit<Product, "price_range"> & {
  price_range: { min: Money | null; max: Money | null } | null;
};

/** What PUT /vendor/products/{id}/status accepts (ChangeProductStatusRequest). Archiving is DELETE. */
export type VendorStatusTarget = Extract<ProductStatus, "draft" | "pending_review" | "active" | "inactive">;

/** One variant in StoreProductRequest and StoreProductVariantRequest. KACHI assigns `sku`. */
export interface NewVariantBody {
  /** {option name: value}; {} for a product without options. New values are created on the fly. */
  options: Record<string, string>;
  seller_sku?: string | null;
  price: Money;
  sale_price?: Money | null;
  weight_grams: number;
  length_mm?: number | null;
  width_mm?: number | null;
  height_mm?: number | null;
  stock: number;
  low_stock_threshold?: number | null;
}

export interface MetadataEntry {
  name: string;
  value: string;
}

/** StoreProductRequest: the product, its options and every variant in one call. */
export interface CreateProductBody {
  name: string;
  description: string;
  category_id: Ulid;
  brand_id?: Ulid | null;
  tax_class?: TaxClass;
  ships_from_provider?: boolean;
  metadata?: MetadataEntry[] | null;
  /** Named after a catalogue attribute (GET /vendor/attributes); at most 2, 20 values each. */
  options?: { name: string; values: string[] }[] | null;
  variants: NewVariantBody[];
}

/** UpdateProductRequest. Options and variants have their own endpoints. */
export interface UpdateProductBody {
  name?: string;
  description?: string;
  category_id?: Ulid;
  brand_id?: Ulid | null;
  tax_class?: TaxClass;
  ships_from_provider?: boolean;
  metadata?: MetadataEntry[];
}

/** UpdateProductVariantRequest. The three dimensions are sent together or not at all. */
export interface UpdateVariantBody {
  seller_sku?: string | null;
  price?: Money;
  sale_price?: Money | null;
  weight_grams?: number;
  length_mm?: number | null;
  width_mm?: number | null;
  height_mm?: number | null;
  status?: Extract<ProductVariantStatus, "active" | "inactive">;
  image_id?: Ulid | null;
  position?: number;
}

/** SetInventoryRequest: a stock-take, written only if on_hand still equals expected_on_hand. */
export interface SetInventoryBody {
  on_hand: number;
  expected_on_hand: number;
  low_stock_threshold?: number;
  note?: string | null;
}

/** BulkSetInventoryRequest. */
export interface BulkSetInventoryBody {
  items: { variant_id: Ulid; on_hand: number; expected_on_hand: number }[];
  note?: string | null;
}

/** StoreInventoryMovementRequest: stock received (+) or a signed adjustment with a note. */
export interface MovementBody {
  type: "purchase" | "adjustment";
  quantity: number;
  expected_on_hand: number;
  note?: string | null;
}

export interface MovementResult {
  movement: InventoryMovement;
  inventory: Inventory;
}
