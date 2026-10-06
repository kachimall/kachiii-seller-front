"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, errorMessage } from "@/lib/api/client";
import { updateApplication } from "@/lib/api/onboarding";
import { handleFormError, nullable } from "@/lib/forms";
import {
  applicationSchema,
  BUSINESS_TYPE_OPTIONS,
  normaliseTrn,
  type ApplicationValues,
} from "@/lib/schemas/onboarding";
import type { ApplicationUpdate, VendorApplication } from "@/types/onboarding";

const FIELDS = [
  "store_name",
  "store_description",
  "business_name",
  "business_type",
  "is_vat_registered",
  "tax_id",
  "contact_phone",
  "contact_email",
] as const;

/**
 * Edits a pending or rejected application (PATCH /vendor/application). The store address is fixed.
 * The TRN comes back masked, so the field starts empty and an empty field keeps the stored one.
 */
export function ApplicationForm({
  vendor,
  onSaved,
  onCancel,
  onConflict,
}: {
  vendor: VendorApplication;
  onSaved: (vendor: VendorApplication) => void;
  onCancel: () => void;
  /** 409: the application can no longer change (KACHI decided it meanwhile). */
  onConflict: () => void;
}) {
  const form = useForm<ApplicationValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      store_name: vendor.store?.name ?? "",
      store_description: vendor.store?.description ?? "",
      business_name: vendor.business_name,
      business_type: vendor.business_type,
      is_vat_registered: vendor.is_vat_registered,
      tax_id: "",
      contact_phone: vendor.contact_phone,
      contact_email: vendor.contact_email ?? "",
    },
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const vat = useWatch({ control: form.control, name: "is_vat_registered" });

  const submit = form.handleSubmit(async (values) => {
    if (!isDirty) return onCancel();

    const taxId = normaliseTrn(values.tax_id);
    if (values.is_vat_registered && !taxId && !vendor.tax_id) {
      form.setError("tax_id", { message: "A VAT-registered business must give its TRN." });
      return;
    }

    const body: ApplicationUpdate = {
      store_name: values.store_name.trim(),
      store_description: nullable(values.store_description),
      business_name: values.business_name.trim(),
      business_type: values.business_type,
      is_vat_registered: values.is_vat_registered,
      contact_phone: values.contact_phone,
      contact_email: nullable(values.contact_email),
    };
    // Not VAT registered: drop any TRN. Registered with the field left empty: keep the stored one.
    if (!values.is_vat_registered) body.tax_id = null;
    else if (taxId) body.tax_id = taxId;

    try {
      const updated = await updateApplication(body);
      toast.success(
        vendor.status === "rejected" ? "Application updated and sent back for review." : "Application updated.",
      );
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error(errorMessage(error));
        onConflict();
      } else {
        handleFormError(error, form.setError, FIELDS);
      }
    }
  });

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      {vendor.status === "rejected" && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Saving sends your application back to KACHI for review.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" htmlFor="app-business_name" error={errors.business_name?.message}>
          <Input id="app-business_name" aria-invalid={Boolean(errors.business_name)} {...form.register("business_name")} />
        </Field>
        <Field label="Business type" htmlFor="app-business_type" error={errors.business_type?.message}>
          <NativeSelect id="app-business_type" aria-invalid={Boolean(errors.business_type)} {...form.register("business_type")}>
            {BUSINESS_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Controller
        control={form.control}
        name="is_vat_registered"
        render={({ field }) => (
          <Label className="font-normal">
            <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
            The business is registered for VAT
          </Label>
        )}
      />
      {vat && (
        <Field
          label="Tax registration number (TRN)"
          htmlFor="app-tax_id"
          error={errors.tax_id?.message}
          hint={vendor.tax_id ? `On file: ${vendor.tax_id}. Leave empty to keep it.` : "15 digits, e.g. 100123456789003."}
        >
          <Input id="app-tax_id" inputMode="numeric" className="font-mono" aria-invalid={Boolean(errors.tax_id)} {...form.register("tax_id")} />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact phone" htmlFor="app-contact_phone" error={errors.contact_phone?.message} hint="A UAE mobile or landline.">
          <Input id="app-contact_phone" type="tel" aria-invalid={Boolean(errors.contact_phone)} {...form.register("contact_phone")} />
        </Field>
        <Field label="Contact email (optional)" htmlFor="app-contact_email" error={errors.contact_email?.message}>
          <Input id="app-contact_email" type="email" aria-invalid={Boolean(errors.contact_email)} {...form.register("contact_email")} />
        </Field>
      </div>

      <Field label="Store name" htmlFor="app-store_name" error={errors.store_name?.message}>
        <Input id="app-store_name" aria-invalid={Boolean(errors.store_name)} {...form.register("store_name")} />
      </Field>
      <Field
        label="Store address"
        htmlFor="app-store_slug"
        hint="The store address cannot be changed. Contact KACHI support if it must change."
      >
        <Input id="app-store_slug" value={vendor.store?.slug ?? ""} readOnly disabled className="font-mono" />
      </Field>
      <Field label="Store description (optional)" htmlFor="app-store_description" error={errors.store_description?.message}>
        <Textarea id="app-store_description" rows={3} aria-invalid={Boolean(errors.store_description)} {...form.register("store_description")} />
      </Field>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2Icon className="animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
