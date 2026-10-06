// Types for vendor onboarding at the Seller Centre (routes named onboarding.* in the API):
// sign-up, the application with its documents, and the vendor agreement.

import type {
  BusinessType,
  IsoDate,
  TokenResult,
  Vendor,
  VendorAgreement,
  VendorConsent,
  VendorDocumentType,
  VendorStatus,
} from "@/types/api";

/**
 * GET /vendor/application: the applicant's own Vendor with its store, documents and consent.
 * The TRN is masked ("************003"); it is never sent back as it came.
 */
export type VendorApplication = Vendor;

/** POST /vendor/register (201): signed in at once. `user.vendor` is not loaded, so it comes from `vendor`. */
export interface RegisterResult extends TokenResult {
  vendor: Vendor;
}

/** One application document; the API takes pdf, jpg, jpeg and png. */
export interface RegisterDocument {
  type: VendorDocumentType;
  file: File;
}

/** POST /vendor/register, sent as multipart/form-data. Optional fields are left out when empty. */
export interface RegisterInput {
  name: string;
  email: string;
  phone: string | null;
  password: string;
  password_confirmation: string;
  store_name: string;
  /** Lowercase letters, numbers and single hyphens; the API derives one from store_name if empty. */
  store_slug: string;
  store_description: string | null;
  business_name: string;
  business_type: BusinessType;
  is_vat_registered: boolean;
  /** 15 digits; required when VAT registered. */
  tax_id: string | null;
  contact_phone: string;
  contact_email: string | null;
  documents: RegisterDocument[];
}

/**
 * PATCH /vendor/application: every field optional, only while pending or rejected (409 otherwise).
 * No revision is needed. The store slug cannot change. Any change bumps the revision, and
 * changing a rejected application sends it back for review.
 */
export interface ApplicationUpdate {
  store_name?: string;
  store_description?: string | null;
  business_name?: string;
  business_type?: BusinessType;
  is_vat_registered?: boolean;
  /** Left out keeps the stored TRN; null clears it. */
  tax_id?: string | null;
  contact_phone?: string;
  contact_email?: string | null;
}

/** GET /vendor/agreement: the current agreement (Markdown body), with the vendor's own state. */
export interface AgreementView {
  agreement: VendorAgreement;
  status: VendorStatus;
  /** Until when the link in the approval email works; set while awaiting consent. */
  link_expires_at: IsoDate | null;
  /** The latest acceptance, possibly of an older version. */
  consent: VendorConsent | null;
}

/** POST /vendor/agreement. */
export interface AcceptAgreementInput {
  /** The version the vendor read; 409 if a newer one was published since. */
  agreement_id: string;
  /** From the link in the approval email (?token=). */
  token: string;
}
