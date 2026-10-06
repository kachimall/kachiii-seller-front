// The vendor's own store (GET /vendor/store, StoreResource with the vendor-only status fields).
import type { Store, StoreStatus } from "@/types/api";

export type { StoreStatus } from "@/types/api";

/** The vendor route always includes status and status_reason; the public one does not. */
export type OwnStore = Store & { status: StoreStatus; status_reason: string | null };

/** PATCH /vendor/store (UpdateStoreRequest). The slug is prohibited: only staff change it. */
export interface StoreProfileInput {
  /** 3–120 characters. */
  name?: string;
  /** Up to 2000 characters. */
  description?: string | null;
  contact_email?: string | null;
  /** A UAE number; the API normalises 050…, 97150… and +971 050… to +971…. */
  contact_phone?: string | null;
  /** Up to 5000 characters. */
  policies?: string | null;
}

/** PUT /vendor/store/status: vacation mode. "suspended" is set by staff only. */
export type StoreOpenStatus = Extract<StoreStatus, "active" | "inactive">;

/** POST/DELETE /vendor/store/{kind}. */
export type StoreImageKind = "logo" | "banner";

/** StoreBrandingImageRequest: JPG, PNG or WebP up to 2 MB, within these pixel bounds. */
export const STORE_IMAGE_RULES: Record<
  StoreImageKind,
  { minWidth: number; minHeight: number; maxWidth: number; maxHeight: number }
> = {
  logo: { minWidth: 200, minHeight: 200, maxWidth: 2000, maxHeight: 2000 },
  banner: { minWidth: 1200, minHeight: 300, maxWidth: 3000, maxHeight: 1000 },
};
