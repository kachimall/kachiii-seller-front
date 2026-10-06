"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { Controller, useFieldArray, useForm, useWatch, type Path, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { DEVICE_NAME } from "@/lib/api/auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import { register as registerVendor } from "@/lib/api/onboarding";
import { formatBytes } from "@/lib/format";
import { nullable } from "@/lib/forms";
import {
  BUSINESS_TYPE_OPTIONS,
  DOCUMENT_ACCEPT,
  DOCUMENT_TYPE_LABELS,
  MAX_DOCUMENT_KB,
  MAX_DOCUMENTS,
  normaliseTrn,
  registerSchema,
  suggestSlug,
  type RegisterValues,
} from "@/lib/schemas/onboarding";
import { useAuth } from "@/store/auth";

type Form = UseFormReturn<RegisterValues>;

const FIELDS = [
  "name",
  "email",
  "phone",
  "password",
  "password_confirmation",
  "store_name",
  "store_slug",
  "store_description",
  "business_name",
  "business_type",
  "is_vat_registered",
  "tax_id",
  "contact_phone",
  "contact_email",
] as const;

const DEFAULTS: RegisterValues = {
  name: "",
  email: "",
  phone: "",
  password: "",
  password_confirmation: "",
  store_name: "",
  store_slug: "",
  store_description: "",
  business_name: "",
  business_type: "llc",
  is_vat_registered: false,
  tax_id: "",
  contact_phone: "",
  contact_email: "",
  documents: [{ type: "trade_license", file: null }],
};

/**
 * Vendor sign-up (POST /vendor/register): the account, the store, the business and its documents
 * in one multipart request. The API signs the new account in, so it goes straight to /application.
 */
export function RegisterForm() {
  const router = useRouter();
  const hydrated = useAuth((s) => s.hydrated);
  const token = useAuth((s) => s.token);
  const [formError, setFormError] = useState<string | null>(null);
  // Set once our own sign-up succeeds, so the "already signed in" redirect below stays out of the way.
  const [registered, setRegistered] = useState(false);

  const form = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: DEFAULTS });
  const { errors, isSubmitting } = form.formState;

  // Already signed in: the guard decides between the dashboard and the application.
  useEffect(() => {
    if (hydrated && token && !registered) router.replace("/");
  }, [hydrated, token, registered, router]);

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await registerVendor(
        {
          name: values.name.trim(),
          email: values.email,
          phone: nullable(values.phone),
          password: values.password,
          password_confirmation: values.password_confirmation,
          store_name: values.store_name.trim(),
          store_slug: values.store_slug,
          store_description: nullable(values.store_description),
          business_name: values.business_name.trim(),
          business_type: values.business_type,
          is_vat_registered: values.is_vat_registered,
          tax_id: values.is_vat_registered ? normaliseTrn(values.tax_id) : null,
          contact_phone: values.contact_phone,
          contact_email: nullable(values.contact_email),
          // The schema refuses an empty file, so every row has one here.
          documents: values.documents.map((doc) => ({ type: doc.type, file: doc.file as File })),
        },
        DEVICE_NAME,
      );
      setRegistered(true);
      // The register response does not load user.vendor; the guard needs it to let the applicant in.
      useAuth.getState().setSession({
        token: result.token,
        expires_at: result.expires_at,
        user: { ...result.user, vendor: { id: result.vendor.id, status: result.vendor.status } },
      });
      toast.success(`Application received. We sent a verification link to ${result.user.email}.`);
      router.replace("/application");
    } catch (error) {
      showServerErrors(error, form, setFormError);
    }
  });

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      <div>
        <h1 className="font-heading text-headline-md">Register your store</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      {formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <FormGroup title="Your account" description="You sign in to the Seller Centre with these.">
        <Field label="Full name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" aria-invalid={Boolean(errors.name)} {...form.register("name")} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message} hint="We send a verification link here.">
          <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...form.register("email")} />
        </Field>
        <Field label="Mobile (optional)" htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" type="tel" autoComplete="tel" placeholder="050 123 4567" aria-invalid={Boolean(errors.phone)} {...form.register("phone")} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters.">
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...form.register("password")} />
        </Field>
        <Field label="Confirm password" htmlFor="password_confirmation" error={errors.password_confirmation?.message}>
          <Input
            id="password_confirmation"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password_confirmation)}
            {...form.register("password_confirmation")}
          />
        </Field>
      </FormGroup>

      <StoreFields form={form} />
      <BusinessFields form={form} />
      <DocumentRows form={form} />

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting && <Loader2Icon className="animate-spin" />}
        Submit application
      </Button>
      <p className="-mt-3 text-center text-xs text-muted-foreground">
        KACHI reviews your application once your email is verified. If it is approved, you accept the vendor agreement
        and your store opens.
      </p>
    </form>
  );
}

function StoreFields({ form }: { form: Form }) {
  const { errors } = form.formState;
  // The slug follows the name until the applicant types one of their own (clearing it resumes that).
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <FormGroup title="Your store" description="What shoppers see on KACHI.">
      <Field label="Store name" htmlFor="store_name" error={errors.store_name?.message}>
        <Input
          id="store_name"
          aria-invalid={Boolean(errors.store_name)}
          {...form.register("store_name", {
            onChange: (e: ChangeEvent<HTMLInputElement>) => {
              if (!slugEdited) {
                form.setValue("store_slug", suggestSlug(e.target.value), { shouldValidate: form.formState.isSubmitted });
              }
            },
          })}
        />
      </Field>
      <Field
        label="Store address"
        htmlFor="store_slug"
        error={errors.store_slug?.message}
        hint="Lowercase letters, numbers and dashes. It cannot be changed later."
      >
        <Input
          id="store_slug"
          autoCapitalize="none"
          spellCheck={false}
          className="font-mono"
          aria-invalid={Boolean(errors.store_slug)}
          {...form.register("store_slug", {
            onChange: (e: ChangeEvent<HTMLInputElement>) => {
              const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
              if (value !== e.target.value) form.setValue("store_slug", value);
              setSlugEdited(value !== "");
            },
          })}
        />
      </Field>
      <Field label="Description (optional)" htmlFor="store_description" error={errors.store_description?.message}>
        <Textarea id="store_description" rows={3} aria-invalid={Boolean(errors.store_description)} {...form.register("store_description")} />
      </Field>
    </FormGroup>
  );
}

function BusinessFields({ form }: { form: Form }) {
  const { errors } = form.formState;
  const vat = useWatch({ control: form.control, name: "is_vat_registered" });

  return (
    <FormGroup title="Your business" description="As on your trade licence. Only KACHI sees these.">
      <Field label="Business name" htmlFor="business_name" error={errors.business_name?.message}>
        <Input id="business_name" autoComplete="organization" aria-invalid={Boolean(errors.business_name)} {...form.register("business_name")} />
      </Field>
      <Field label="Business type" htmlFor="business_type" error={errors.business_type?.message}>
        <NativeSelect id="business_type" aria-invalid={Boolean(errors.business_type)} {...form.register("business_type")}>
          {BUSINESS_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid gap-1.5">
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
        {errors.is_vat_registered?.message && <p className="text-xs text-destructive">{errors.is_vat_registered.message}</p>}
      </div>
      {vat && (
        <Field label="Tax registration number (TRN)" htmlFor="tax_id" error={errors.tax_id?.message} hint="15 digits, e.g. 100123456789003.">
          <Input id="tax_id" inputMode="numeric" className="font-mono" aria-invalid={Boolean(errors.tax_id)} {...form.register("tax_id")} />
        </Field>
      )}
      <Field label="Contact phone" htmlFor="contact_phone" error={errors.contact_phone?.message} hint="A UAE mobile or landline, e.g. 050 123 4567.">
        <Input id="contact_phone" type="tel" placeholder="050 123 4567" aria-invalid={Boolean(errors.contact_phone)} {...form.register("contact_phone")} />
      </Field>
      <Field label="Contact email (optional)" htmlFor="contact_email" error={errors.contact_email?.message}>
        <Input id="contact_email" type="email" aria-invalid={Boolean(errors.contact_email)} {...form.register("contact_email")} />
      </Field>
    </FormGroup>
  );
}

function DocumentRows({ form }: { form: Form }) {
  const { errors } = form.formState;
  const documents = useFieldArray({ control: form.control, name: "documents" });
  const vat = useWatch({ control: form.control, name: "is_vat_registered" });
  const listError = errors.documents?.message ?? errors.documents?.root?.message;

  return (
    <FormGroup
      title="Documents"
      description={`Your trade licence${vat ? " and VAT certificate" : ""}. PDF, JPG or PNG, up to ${MAX_DOCUMENT_KB / 1024} MB each, at most ${MAX_DOCUMENTS} files.`}
    >
      <ul className="grid gap-3">
        {documents.fields.map((row, i) => {
          const rowErrors = errors.documents?.[i];
          return (
            <li key={row.id} className="grid gap-2 rounded-lg border p-3">
              <div className="flex items-end gap-2">
                <Field label="Document" htmlFor={`documents.${i}.type`} error={rowErrors?.type?.message} className="flex-1">
                  <NativeSelect id={`documents.${i}.type`} aria-invalid={Boolean(rowErrors?.type)} {...form.register(`documents.${i}.type`)}>
                    {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove document ${i + 1}`}
                  onClick={() => documents.remove(i)}
                >
                  <Trash2Icon />
                </Button>
              </div>
              <Controller
                control={form.control}
                name={`documents.${i}.file`}
                render={({ field }) => (
                  <Field
                    label="File"
                    htmlFor={`documents.${i}.file`}
                    error={rowErrors?.file?.message}
                    hint={field.value ? `${field.value.name} · ${formatBytes(field.value.size)}` : undefined}
                  >
                    <Input
                      id={`documents.${i}.file`}
                      type="file"
                      accept={DOCUMENT_ACCEPT}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      aria-invalid={Boolean(rowErrors?.file)}
                      onChange={(e) => field.onChange(e.target.files?.[0] ?? null)}
                    />
                  </Field>
                )}
              />
            </li>
          );
        })}
      </ul>
      {listError && (
        <p role="alert" className="text-xs text-destructive">
          {listError}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        disabled={documents.fields.length >= MAX_DOCUMENTS}
        onClick={() => documents.append({ type: vat && !hasType(form, "vat_certificate") ? "vat_certificate" : "other", file: null })}
      >
        <PlusIcon /> Add a document
      </Button>
    </FormGroup>
  );
}

function FormGroup({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-t pt-5">
      <legend className="contents">
        <span className="block font-heading text-headline-sm">{title}</span>
      </legend>
      {description && <p className="-mt-2 text-sm text-muted-foreground">{description}</p>}
      {children}
    </fieldset>
  );
}

function hasType(form: Form, type: RegisterValues["documents"][number]["type"]): boolean {
  return form.getValues("documents").some((d) => d.type === type);
}

/**
 * 422 field errors go onto their inputs, including documents.N.type and documents.N.file;
 * anything else (and other failures) shows above the form.
 */
function showServerErrors(error: unknown, form: Form, setFormError: (message: string | null) => void) {
  if (!(error instanceof ApiError) || error.status !== 422) {
    setFormError(errorMessage(error));
    return;
  }
  let first: Path<RegisterValues> | null = null;
  const unknown: string[] = [];
  for (const [key, messages] of Object.entries(error.errors)) {
    const name = fieldFor(key);
    if (!name) {
      unknown.push(messages[0]);
      continue;
    }
    form.setError(name, { type: "server", message: messages[0] });
    if (!first && name !== "documents") first = name;
  }
  if (unknown.length > 0 || Object.keys(error.errors).length === 0) setFormError(unknown[0] ?? error.message);
  if (first) form.setFocus(first);
}

function fieldFor(key: string): Path<RegisterValues> | null {
  if ((FIELDS as readonly string[]).includes(key)) return key as Path<RegisterValues>;
  const row = /^documents\.(\d+)\.(type|file)$/.exec(key);
  if (row) return `documents.${Number(row[1])}.${row[2] as "type" | "file"}`;
  // "documents" (missing licence, too many files) or "documents.N" (a row that is not an object).
  if (key === "documents" || key.startsWith("documents.")) return "documents";
  return null;
}
