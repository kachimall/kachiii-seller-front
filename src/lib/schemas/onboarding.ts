import { z } from "zod";
import type { BusinessType, VendorDocumentType } from "@/types/api";

// Mirrors config/kachi.php vendor_onboarding; the API does not expose it.
export const MAX_DOCUMENTS = 10;
export const MAX_DOCUMENT_KB = 5120;
export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

const BUSINESS_TYPES = ["individual", "sole_establishment", "civil_company", "llc", "free_zone_company", "branch"] as const;
const DOCUMENT_TYPES = ["trade_license", "vat_certificate", "other"] as const;

export const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "sole_establishment", label: "Sole establishment" },
  { value: "civil_company", label: "Civil company" },
  { value: "llc", label: "Limited liability company (LLC)" },
  { value: "free_zone_company", label: "Free zone company" },
  { value: "branch", label: "Branch" },
];

export const DOCUMENT_TYPE_LABELS: Record<VendorDocumentType, string> = {
  trade_license: "Trade licence",
  vat_certificate: "VAT certificate",
  other: "Other",
};

export function businessTypeLabel(value: BusinessType): string {
  return BUSINESS_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

// ---------------------------------------------------------------------------
// Shared rules (the API's UaePhone and TRN rules)
// ---------------------------------------------------------------------------

const UAE_PHONE = /^\+971(5\d{8}|[234679]\d{7})$/;
export const UAE_PHONE_MESSAGE = "Enter a UAE mobile or landline number, e.g. 050 123 4567.";

/** 050…, 97150…, 0097150… and +971 050… are one number, as UaePhone::normalise reads them. */
export function normaliseUaePhone(value: string): string {
  return value.replace(/[\s().-]/g, "").replace(/^(?:(?:\+|00)?971)?0?(5\d{8}|[234679]\d{7})$/, "+971$1");
}

export const isUaePhone = (value: string) => UAE_PHONE.test(normaliseUaePhone(value));

/** A TRN is often written in groups; only the digits count. */
export const normaliseTrn = (value: string) => value.replace(/[\s-]/g, "");
export const TRN_MESSAGE = "The TRN must have 15 digits, e.g. 100123456789003.";
const isTrn = (value: string) => /^\d{15}$/.test(normaliseTrn(value));

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A store slug suggestion from its name: lowercase with single dashes, at most 60 characters. */
export function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/** Why a document file would be refused, or null when it is fine. */
export function documentFileError(file: File | null | undefined): string | null {
  if (!file) return "Choose a file.";
  if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) return "Use a PDF, JPG or PNG file.";
  if (file.size > MAX_DOCUMENT_KB * 1024) return `The file must be ${MAX_DOCUMENT_KB / 1024} MB or smaller.`;
  return null;
}

const documentFile = z
  .custom<File | null>((value) => value === null || (typeof File !== "undefined" && value instanceof File))
  .superRefine((file, ctx) => {
    const message = documentFileError(file);
    if (message) ctx.addIssue({ code: "custom", message });
  });

const optionalEmail = z.union([z.literal(""), z.email("Enter a valid email address.").max(255)]);

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name.").max(255),
    email: z.email("Enter a valid email address.").max(255),
    phone: z.string().refine((v) => v.trim() === "" || isUaePhone(v), UAE_PHONE_MESSAGE),
    password: z.string().min(8, "Use at least 8 characters."),
    password_confirmation: z.string(),

    store_name: z.string().trim().min(3, "Use at least 3 characters.").max(120),
    store_slug: z
      .string()
      .min(3, "Use at least 3 characters.")
      .max(60, "Use at most 60 characters.")
      .regex(SLUG, "Only lowercase letters, numbers and single hyphens."),
    store_description: z.string().max(2000),

    business_name: z.string().trim().min(1, "Enter the business name.").max(255),
    business_type: z.enum(BUSINESS_TYPES, "Choose the business type."),
    is_vat_registered: z.boolean(),
    tax_id: z.string(),
    contact_phone: z.string().refine(isUaePhone, UAE_PHONE_MESSAGE),
    contact_email: optionalEmail,

    documents: z
      .array(z.object({ type: z.enum(DOCUMENT_TYPES), file: documentFile }))
      .max(MAX_DOCUMENTS, `Upload at most ${MAX_DOCUMENTS} documents.`),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.password_confirmation) {
      ctx.addIssue({ code: "custom", path: ["password_confirmation"], message: "The passwords do not match." });
    }
    if (v.is_vat_registered && !isTrn(v.tax_id)) {
      ctx.addIssue({
        code: "custom",
        path: ["tax_id"],
        message: v.tax_id.trim() ? TRN_MESSAGE : "A VAT-registered business must give its TRN.",
      });
    }
    // The API's after() checks, so the applicant hears about them before uploading.
    const types = v.documents.map((d) => d.type);
    if (!types.includes("trade_license")) {
      ctx.addIssue({ code: "custom", path: ["documents"], message: "Upload your trade licence." });
    } else if (v.is_vat_registered && !types.includes("vat_certificate")) {
      ctx.addIssue({ code: "custom", path: ["documents"], message: "A VAT-registered business must upload its VAT certificate." });
    }
  });

export type RegisterValues = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Editing the application
// ---------------------------------------------------------------------------

/** tax_id may stay empty to keep the stored (masked) TRN; the API decides whether one is needed. */
export const applicationSchema = z.object({
  store_name: z.string().trim().min(3, "Use at least 3 characters.").max(120),
  store_description: z.string().max(2000),
  business_name: z.string().trim().min(1, "Enter the business name.").max(255),
  business_type: z.enum(BUSINESS_TYPES, "Choose the business type."),
  is_vat_registered: z.boolean(),
  tax_id: z.string().refine((v) => v.trim() === "" || isTrn(v), TRN_MESSAGE),
  contact_phone: z.string().refine(isUaePhone, UAE_PHONE_MESSAGE),
  contact_email: optionalEmail,
});

export type ApplicationValues = z.infer<typeof applicationSchema>;

export const documentUploadSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  file: documentFile,
});

export type DocumentUploadValues = z.infer<typeof documentUploadSchema>;

// ---------------------------------------------------------------------------
// Agreement
// ---------------------------------------------------------------------------

export const agreementSchema = z.object({
  accepted: z.boolean().refine(Boolean, "Tick the box to confirm you accept the agreement."),
  token: z.string().trim().min(1, "Open the agreement from the link in your approval email, or paste that link here."),
});

export type AgreementValues = z.infer<typeof agreementSchema>;
