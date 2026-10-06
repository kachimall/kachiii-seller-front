import { api } from "@/lib/api/client";
import type { OwnStore, StoreImageKind, StoreOpenStatus, StoreProfileInput } from "@/types/store";

export const getStore = () => api<OwnStore>("/vendor/store");

/** The public profile: name, description, contact details and policies (not the slug). */
export const updateStore = (body: StoreProfileInput) => api<OwnStore>("/vendor/store", { method: "PATCH", body });

/** Opens or closes the store (vacation mode); 409 while KACHI has it suspended. */
export const setStoreStatus = (status: StoreOpenStatus) =>
  api<OwnStore>("/vendor/store/status", { method: "PUT", body: { status } });

/** Replaces the logo or banner (multipart field "image"). */
export function uploadStoreImage(kind: StoreImageKind, file: File) {
  const body = new FormData();
  body.append("image", file);
  return api<OwnStore>(`/vendor/store/${kind}`, { method: "POST", body });
}

/** Removes the logo or banner; the API answers with no data. */
export const removeStoreImage = (kind: StoreImageKind) => api<null>(`/vendor/store/${kind}`, { method: "DELETE" });
