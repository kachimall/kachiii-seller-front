import { api, openFile, shopApi } from "@/lib/api/client";
import type { VendorAgreement, VendorConsent, VendorDocument, VendorDocumentType } from "@/types/api";
import type {
  AcceptAgreementInput,
  AgreementView,
  ApplicationUpdate,
  RegisterInput,
  RegisterResult,
  VendorApplication,
} from "@/types/onboarding";

/** Sign-up with documents, as multipart/form-data (booleans as 1/0). Signs the new account in. */
export function register(input: RegisterInput, deviceName: string) {
  const form = new FormData();
  const text: Record<string, string | null> = {
    name: input.name,
    email: input.email,
    phone: input.phone,
    password: input.password,
    password_confirmation: input.password_confirmation,
    device_name: deviceName,
    store_name: input.store_name,
    store_slug: input.store_slug,
    store_description: input.store_description,
    business_name: input.business_name,
    business_type: input.business_type,
    is_vat_registered: input.is_vat_registered ? "1" : "0",
    tax_id: input.is_vat_registered ? input.tax_id : null,
    contact_phone: input.contact_phone,
    contact_email: input.contact_email,
    turnstile_token: input.turnstile_token ?? null,
  };
  for (const [key, value] of Object.entries(text)) {
    if (value !== null && value !== "") form.append(key, value);
  }
  input.documents.forEach((doc, i) => {
    form.append(`documents[${i}][type]`, doc.type);
    form.append(`documents[${i}][file]`, doc.file);
  });

  return api<RegisterResult>("/vendor/register", { method: "POST", body: form, skipAuthHandling: true });
}

/** Sends the email verification link again (no-op once verified). */
export const resendVerification = () => api<null>("/auth/email/verification-notification", { method: "POST" });

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

export const getApplication = () => api<VendorApplication>("/vendor/application");

/** The response has the store and documents but not the consent. */
export const updateApplication = (body: ApplicationUpdate) =>
  api<VendorApplication>("/vendor/application", { method: "PATCH", body });

export function uploadDocument(type: VendorDocumentType, file: File) {
  const form = new FormData();
  form.append("type", type);
  form.append("file", file);
  return api<VendorDocument>("/vendor/application/documents", { method: "POST", body: form });
}

export const deleteDocument = (id: string) =>
  api<null>(`/vendor/application/documents/${id}`, { method: "DELETE" });

/** Private file: downloaded with the token and opened in a new tab. */
export const openDocument = (id: string) => openFile(`/vendor/application/documents/${id}`);

// ---------------------------------------------------------------------------
// Agreement
// ---------------------------------------------------------------------------

export const getAgreement = () => api<AgreementView>("/vendor/agreement");

/** Records the consent and opens the store (the account becomes an approved vendor). */
export const acceptAgreement = (body: AcceptAgreementInput) =>
  api<VendorConsent>("/vendor/agreement", { method: "POST", body });

/** The signed PDF; 404 until a queued job has written it (consent.copy_ready). */
export const openAgreementCopy = () => openFile("/vendor/agreement/copy");

/**
 * The vendor agreement in force, from the shop portal's public catalogue (no sign-in): for anyone
 * thinking of selling, before they register. 404 while none is published.
 */
export const getPublicAgreement = () => shopApi<VendorAgreement>("/vendor-agreement");
