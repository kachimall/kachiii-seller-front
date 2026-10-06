"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangleIcon, Loader2Icon, MoonIcon, StoreIcon } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DetailList } from "@/components/common/detail-list";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { AsyncContent, ForbiddenState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { getStore, removeStoreImage, setStoreStatus, updateStore, uploadStoreImage } from "@/lib/api/store";
import { formatDate } from "@/lib/format";
import { handleFormError, nullable, runAction } from "@/lib/forms";
import { useAuth, useCan } from "@/store/auth";
import type { OwnStore, StoreImageKind } from "@/types/store";
import { Notice } from "../orders/_components/notice";
import { BrandingField } from "./_components/branding-field";

// UpdateStoreRequest. The phone is normalised and checked by the API (UaePhone: a UAE number, or
// a Philippine mobile on a test server); its 422 shows on the field.
const profileSchema = z.object({
  name: z.string().trim().min(3, "Use at least 3 characters.").max(120, "Keep it under 120 characters."),
  description: z.string().max(2000, "Keep it under 2000 characters."),
  contact_email: z
    .string()
    .trim()
    .max(255)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address."),
  contact_phone: z.string().trim().max(30),
  policies: z.string().max(5000, "Keep it under 5000 characters."),
});
type ProfileValues = z.infer<typeof profileSchema>;
const FIELDS = ["name", "description", "contact_email", "contact_phone", "policies"] as const;

const STATUS_LABELS: Record<OwnStore["status"], string> = {
  active: "Open",
  inactive: "Closed",
  suspended: "Suspended by KACHI",
};

export function StorePage() {
  const can = useCan();
  const allowed = can("stores.manage");
  const { data, error, loading, reload, mutate } = useApi(allowed ? "store" : null, getStore);

  if (!allowed) return <ForbiddenState />;

  return (
    <>
      <PageHeader title="Store profile" description="What buyers see on your store page: name, branding, contact details and policies." />
      <AsyncContent data={data} error={error} loading={loading} onRetry={reload}>
        {(store) => <StoreView store={store} onChange={mutate} />}
      </AsyncContent>
    </>
  );
}

function StoreView({ store, onChange }: { store: OwnStore; onChange: (store: OwnStore) => void }) {
  // A suspended vendor is read-only: the API refuses every change outside vendor/orders.
  const suspended = useAuth((s) => s.user?.vendor?.status === "suspended");

  async function upload(kind: StoreImageKind, image: File | string) {
    onChange(await uploadStoreImage(kind, image));
  }

  async function remove(kind: StoreImageKind) {
    await removeStoreImage(kind);
    onChange({ ...store, [kind === "logo" ? "logo_url" : "banner_url"]: null });
  }

  return (
    <div className="grid gap-6">
      {suspended && (
        <Notice icon={<AlertTriangleIcon />} tone="danger">
          <span className="font-medium">Your vendor account is suspended.</span>
          <span className="block text-muted-foreground">
            Your store is read-only until KACHI lifts the suspension. Contact KACHI support for details.
          </span>
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid h-fit gap-6 lg:col-span-2">
          <ProfileSection store={store} disabled={suspended} onChange={onChange} />
        </div>

        <div className="grid h-fit gap-6">
          <StatusSection store={store} disabled={suspended} onChange={onChange} />

          <Section title="Branding">
            <div className="grid gap-6">
              <div className="grid gap-2">
                <p className="text-sm font-medium">Logo</p>
                <BrandingField
                  kind="logo"
                  url={store.logo_url}
                  disabled={suspended}
                  onUpload={(image) => upload("logo", image)}
                  onRemove={() => remove("logo")}
                />
              </div>
              <div className="grid gap-2">
                <p className="text-sm font-medium">Banner</p>
                <BrandingField
                  kind="banner"
                  url={store.banner_url}
                  disabled={suspended}
                  onUpload={(image) => upload("banner", image)}
                  onRemove={() => remove("banner")}
                />
              </div>
            </div>
          </Section>

          <Section title="Store details">
            <DetailList
              className="sm:grid-cols-1"
              items={[
                {
                  label: "Store address",
                  value: (
                    <>
                      <span className="font-mono">{store.slug}</span>
                      <span className="block text-xs text-muted-foreground">Only KACHI can change it. Contact support if it must change.</span>
                    </>
                  ),
                },
                { label: "Joined", value: formatDate(store.joined_at) },
              ]}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

function ProfileSection({ store, disabled, onChange }: { store: OwnStore; disabled: boolean; onChange: (store: OwnStore) => void }) {
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: toValues(store),
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const description = useWatch({ control: form.control, name: "description" });
  const policies = useWatch({ control: form.control, name: "policies" });

  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = await updateStore({
        name: values.name.trim(),
        description: nullable(values.description),
        contact_email: nullable(values.contact_email),
        contact_phone: nullable(values.contact_phone),
        policies: nullable(values.policies),
      });
      onChange(saved);
      form.reset(toValues(saved));
      toast.success("Store profile saved.");
    } catch (error) {
      handleFormError(error, form.setError, FIELDS);
    }
  });

  return (
    <Section title="Profile">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <fieldset disabled={disabled} className="grid gap-4">
          <Field label="Store name" htmlFor="name" error={errors.name?.message}>
            <Input id="name" maxLength={120} aria-invalid={Boolean(errors.name)} {...form.register("name")} />
          </Field>
          <Field
            label="Description"
            htmlFor="description"
            error={errors.description?.message}
            hint={`${description.length}/2000 · shown at the top of your store page.`}
          >
            <Textarea
              id="description"
              rows={4}
              maxLength={2000}
              aria-invalid={Boolean(errors.description)}
              {...form.register("description")}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact email" htmlFor="contact_email" error={errors.contact_email?.message} hint="Public, for buyers' questions.">
              <Input
                id="contact_email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.contact_email)}
                {...form.register("contact_email")}
              />
            </Field>
            <Field label="Contact phone" htmlFor="contact_phone" error={errors.contact_phone?.message} hint="A UAE number, e.g. 050 123 4567.">
              <Input
                id="contact_phone"
                type="tel"
                autoComplete="tel"
                aria-invalid={Boolean(errors.contact_phone)}
                {...form.register("contact_phone")}
              />
            </Field>
          </div>
          <Field
            label="Store policies"
            htmlFor="policies"
            error={errors.policies?.message}
            hint={`${policies.length}/5000 · e.g. delivery times, exchanges and warranty. Returns follow KACHI's return rules.`}
          >
            <Textarea id="policies" rows={6} maxLength={5000} aria-invalid={Boolean(errors.policies)} {...form.register("policies")} />
          </Field>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={disabled || !isDirty || isSubmitting} onClick={() => form.reset(toValues(store))}>
            Discard
          </Button>
          <Button type="submit" disabled={disabled || !isDirty || isSubmitting}>
            {isSubmitting && <Loader2Icon className="animate-spin" />}
            Save profile
          </Button>
        </div>
      </form>
    </Section>
  );
}

function toValues(store: OwnStore): ProfileValues {
  return {
    name: store.name,
    description: store.description ?? "",
    contact_email: store.contact_email ?? "",
    contact_phone: store.contact_phone ?? "",
    policies: store.policies ?? "",
  };
}

/** Vacation mode (PUT store/status): open ↔ closed. Only KACHI suspends a store or lifts it. */
function StatusSection({ store, disabled, onChange }: { store: OwnStore; disabled: boolean; onChange: (store: OwnStore) => void }) {
  const [confirming, setConfirming] = useState(false);
  const open = store.status === "active";
  const target = open ? "inactive" : "active";

  return (
    <Section title="Store status">
      <div className="grid gap-4 text-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-muted">
            {open ? <StoreIcon className="size-4" /> : <MoonIcon className="size-4" />}
          </span>
          <StatusBadge status={store.status} label={STATUS_LABELS[store.status]} />
        </div>

        {store.status === "suspended" ? (
          <div className="grid gap-1 rounded-lg bg-destructive/5 p-3 ring-1 ring-destructive/20">
            <p className="font-medium">KACHI suspended this store.</p>
            {store.status_reason && <p className="whitespace-pre-line">{store.status_reason}</p>}
            <p className="text-muted-foreground">
              Its products are hidden from the shop until KACHI lifts the suspension. You cannot reopen it yourself.
            </p>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground">
              {open
                ? "Your store and its products are visible in the shop."
                : "Your store is closed: it and its products are hidden from the shop, so buyers cannot find or buy them."}
            </p>
            {store.status_reason && <p className="whitespace-pre-line">{store.status_reason}</p>}
            <Button variant={open ? "outline" : "default"} disabled={disabled} onClick={() => setConfirming(true)}>
              {open ? <MoonIcon /> : <StoreIcon />}
              {open ? "Close store" : "Reopen store"}
            </Button>
            {disabled && <p className="text-xs text-muted-foreground">Your account is suspended, so the status cannot change.</p>}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={open ? "Close your store?" : "Reopen your store?"}
        description={
          open
            ? "Your store page and all your products are hidden from the shop and cannot be bought until you reopen it. Orders already placed still need to be packed and sent, and returns still need your answer. Your listings and stock are kept."
            : "Your store page and its active products show in the shop again."
        }
        confirmLabel={open ? "Close store" : "Reopen store"}
        destructive={open}
        onConfirm={async () => {
          let next: OwnStore | undefined;
          const done = await runAction(async () => {
            next = await setStoreStatus(target);
          }, open ? "Store closed." : "Store reopened.");
          if (next) onChange(next);
          return done;
        }}
      />
    </Section>
  );
}
