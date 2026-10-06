import { api } from "@/lib/api/client";
import type { OwnStore, StoreImageKind, StoreOpenStatus, StoreProfileInput } from "@/types/store";

export const getStore = () => api<OwnStore>("/vendor/store");

/** The public profile: name, description, contact details and policies (not the slug). */
export const updateStore = (body: StoreProfileInput) => api<OwnStore>("/vendor/store", { method: "PATCH", body });

/** Opens or closes the store (vacation mode); 409 while KACHI has it suspended. */
export const setStoreStatus = (status: StoreOpenStatus) =>
  api<OwnStore>("/vendor/store/status", { method: "PUT", body: { status } });

/**
 * Replaces the logo or banner: a file (multipart field "image") or an https:// address
 * (image_url, DECISIONS S10) that KACHI downloads; a bad address is a 422 on image_url.
 */
export function uploadStoreImage(kind: StoreImageKind, image: File | string) {
  if (typeof image === "string") {
    return api<OwnStore>(`/vendor/store/${kind}`, { method: "POST", body: { image_url: image } });
  }
  const body = new FormData();
  body.append("image", image);
  return api<OwnStore>(`/vendor/store/${kind}`, { method: "POST", body });
}

/** Removes the logo or banner; the API answers with no data. */
export const removeStoreImage = (kind: StoreImageKind) => api<null>(`/vendor/store/${kind}`, { method: "DELETE" });
