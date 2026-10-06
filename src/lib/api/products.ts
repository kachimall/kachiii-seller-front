import { api, apiList, type Query } from "@/lib/api/client";
import type { Inventory, InventoryMovement, ProductImage, ProductOption, ProductVariant } from "@/types/api";
import type {
  BulkSetInventoryBody,
  CatalogAttribute,
  CreateProductBody,
  MovementBody,
  MovementResult,
  NewVariantBody,
  SetInventoryBody,
  UpdateProductBody,
  UpdateVariantBody,
  VendorProduct,
  VendorStatusTarget,
} from "@/types/products";

const base = (productId: string) => `/vendor/products/${productId}`;

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export interface ProductFilters extends Query {
  status?: string;
  q?: string;
  category_id?: string;
  /** updated (default), created or name. */
  sort?: string;
  page?: number;
  per_page?: number;
}

export const listProducts = (filters: ProductFilters) => apiList<VendorProduct>("/vendor/products", filters);
export const getProduct = (id: string) => api<VendorProduct>(base(id));
export const createProduct = (body: CreateProductBody) => api<VendorProduct>("/vendor/products", { method: "POST", body });
export const updateProduct = (id: string, body: UpdateProductBody) =>
  api<VendorProduct>(base(id), { method: "PATCH", body });
export const changeProductStatus = (id: string, status: VendorStatusTarget) =>
  api<VendorProduct>(`${base(id)}/status`, { method: "PUT", body: { status } });
/** Archives the product: order history keeps pointing at it, so it is never removed. */
export const archiveProduct = (id: string) => api<null>(base(id), { method: "DELETE" });

/** The catalogue attributes options are named after (Color, Size, ...). */
export const listAttributes = () => api<CatalogAttribute[]>("/vendor/attributes");

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/** 202: the image is processing; it turns ready (or failed) once the media queue runs. */
export function uploadProductImage(productId: string, file: File, altText?: string | null) {
  const body = new FormData();
  body.append("image", file);
  if (altText) body.append("alt_text", altText);
  return api<ProductImage>(`${base(productId)}/images`, { method: "POST", body });
}

/** Every image id exactly once; the first becomes the primary image. */
export const reorderProductImages = (productId: string, imageIds: string[]) =>
  api<ProductImage[]>(`${base(productId)}/images/order`, { method: "PUT", body: { images: imageIds } });

export const updateProductImage = (productId: string, imageId: string, altText: string | null) =>
  api<ProductImage>(`${base(productId)}/images/${imageId}`, { method: "PATCH", body: { alt_text: altText } });

export const deleteProductImage = (productId: string, imageId: string) =>
  api<null>(`${base(productId)}/images/${imageId}`, { method: "DELETE" });

// ---------------------------------------------------------------------------
// Options and values (the set of options is fixed at creation)
// ---------------------------------------------------------------------------

export const updateOption = (productId: string, optionId: string, body: { name?: string; position?: number }) =>
  api<ProductOption>(`${base(productId)}/options/${optionId}`, { method: "PATCH", body });

/** Returns the whole option. */
export const updateOptionValue = (
  productId: string,
  optionId: string,
  valueId: string,
  body: { value?: string; position?: number },
) => api<ProductOption>(`${base(productId)}/options/${optionId}/values/${valueId}`, { method: "PATCH", body });

/** 409 while any variant (archived ones too) uses the value. */
export const deleteOptionValue = (productId: string, optionId: string, valueId: string) =>
  api<null>(`${base(productId)}/options/${optionId}/values/${valueId}`, { method: "DELETE" });

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export const addVariant = (productId: string, body: NewVariantBody) =>
  api<ProductVariant>(`${base(productId)}/variants`, { method: "POST", body });

export const updateVariant = (productId: string, variantId: string, body: UpdateVariantBody) =>
  api<ProductVariant>(`${base(productId)}/variants/${variantId}`, { method: "PATCH", body });

/** Archives the variant (terminal) and withdraws its unheld stock. */
export const archiveVariant = (productId: string, variantId: string) =>
  api<null>(`${base(productId)}/variants/${variantId}`, { method: "DELETE" });

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export const getInventory = (productId: string, variantId: string) =>
  api<Inventory>(`${base(productId)}/variants/${variantId}/inventory`);

/** 409 if on_hand changed since expected_on_hand was read. */
export const setInventory = (productId: string, variantId: string, body: SetInventoryBody) =>
  api<Inventory>(`${base(productId)}/variants/${variantId}/inventory`, { method: "PUT", body });

/** Stock-take for several variants of one product, all or nothing. */
export const bulkSetInventory = (productId: string, body: BulkSetInventoryBody) =>
  api<Inventory[]>(`${base(productId)}/inventory`, { method: "PUT", body });

/** The ledger, newest first; paged without a total. */
export const listMovements = (productId: string, variantId: string, query: Query & { type?: string; page?: number } = {}) =>
  apiList<InventoryMovement>(`${base(productId)}/variants/${variantId}/inventory/movements`, query);

export const recordMovement = (productId: string, variantId: string, body: MovementBody) =>
  api<MovementResult>(`${base(productId)}/variants/${variantId}/inventory/movements`, { method: "POST", body });

/** Live variants at or below their threshold, emptiest first. */
export const listLowStock = (query: Query & { page?: number; per_page?: number }) =>
  apiList<Inventory>("/vendor/inventory/low-stock", query);
