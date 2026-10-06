"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileTextIcon, Loader2Icon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { DetailList } from "@/components/common/detail-list";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { AsyncContent } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi } from "@/hooks/use-api";
import { me } from "@/lib/api/auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import { acceptAgreement, getAgreement, openAgreementCopy } from "@/lib/api/onboarding";
import { formatDate, formatDateTime } from "@/lib/format";
import { handleFormError } from "@/lib/forms";
import { agreementSchema, type AgreementValues } from "@/lib/schemas/onboarding";
import { useAuth } from "@/store/auth";
import type { VendorConsent } from "@/types/api";
import type { AgreementView } from "@/types/onboarding";
import { rememberAgreementToken, rememberedAgreementToken } from "../onboarding-frame";
import { Markdown } from "./markdown";

/**
 * The digital consent page: the current vendor agreement, the acceptance form while the vendor is
 * awaiting consent (it needs the token from the approval email), and the consent record after.
 */
export function AgreementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get("token");
  // Rendered only on the client (the guard waits for the saved session), so storage is readable here.
  const [linkToken] = useState(() => urlToken ?? rememberedAgreementToken());
  const { data, error, loading, reload } = useApi("vendor-agreement", getAgreement);

  // Keep the token for this tab, and take it out of the address bar.
  useEffect(() => {
    if (urlToken) {
      rememberAgreementToken(urlToken);
      router.replace("/agreement");
    }
  }, [urlToken, router]);

  return (
    <AsyncContent data={data} error={error} loading={loading} onRetry={reload}>
      {(view) => <AgreementDetails view={view} linkToken={linkToken} onReload={reload} />}
    </AsyncContent>
  );
}

function AgreementDetails({ view, linkToken, onReload }: { view: AgreementView; linkToken: string | null; onReload: () => void }) {
  const { agreement, consent, status } = view;
  // The latest consent may be for an older version than the one shown.
  const olderConsent = consent?.agreement && consent.agreement.id !== agreement.id;

  return (
    <>
      <PageHeader
        back={{ href: "/application", label: "Application" }}
        title={agreement.title}
        description={`Version ${agreement.version} · published ${formatDate(agreement.published_at)}`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title="Agreement">
            {olderConsent && (
              <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                You accepted version {consent.agreement!.version}. This is the current version, shown for reference.
              </p>
            )}
            <Markdown source={agreement.body} />
          </Section>
        </div>

        <div className="grid h-fit gap-6 lg:sticky lg:top-20">
          {status === "awaiting_consent" ? (
            <AcceptForm view={view} linkToken={linkToken} onReload={onReload} />
          ) : consent ? (
            <ConsentRecord consent={consent} />
          ) : (
            <Section title="Your acceptance">
              <div className="grid gap-2 text-sm">
                <StatusBadge status={status} />
                <p className="text-muted-foreground">
                  {status === "pending" || status === "rejected"
                    ? "You can accept the agreement once KACHI approves your application. We email you a link when it does."
                    : "There is no agreement waiting for you to accept."}
                </p>
              </div>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}

/** A pasted approval link or a bare token. */
function tokenFrom(value: string): string {
  const trimmed = value.trim();
  try {
    return new URL(trimmed).searchParams.get("token") ?? trimmed;
  } catch {
    return trimmed;
  }
}

function AcceptForm({ view, linkToken, onReload }: { view: AgreementView; linkToken: string | null; onReload: () => void }) {
  const router = useRouter();
  // Without a token from the link (or once it is refused), the vendor can paste the link instead.
  const [askToken, setAskToken] = useState(!linkToken);
  const form = useForm<AgreementValues>({
    resolver: zodResolver(agreementSchema),
    defaultValues: { accepted: false, token: linkToken ?? "" },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await acceptAgreement({ agreement_id: view.agreement.id, token: tokenFrom(values.token) });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // A newer version was published (or the status moved): show what is current now.
        toast.error(errorMessage(error));
        form.setValue("accepted", false);
        onReload();
      } else if (error instanceof ApiError && error.status === 422 && error.firstError("token")) {
        setAskToken(true);
        form.setValue("token", "");
        form.setError("token", { message: error.firstError("token") });
      } else {
        handleFormError(error, form.setError, ["token", "accepted"]);
      }
      return;
    }

    rememberAgreementToken(null);
    toast.success("Agreement accepted. Your store is open.");
    try {
      useAuth.getState().setUser(await me());
    } catch {
      // The dashboard's guard reads the account again anyway.
    }
    router.replace("/");
  });

  return (
    <Section title="Accept the agreement">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <p className="text-sm text-muted-foreground">
          Your application is approved. Accepting opens your store on KACHI. We record the time, your IP address and your
          browser, and email you a signed copy.
        </p>
        {view.link_expires_at && (
          <p className="text-xs text-muted-foreground">Your link works until {formatDateTime(view.link_expires_at)}.</p>
        )}

        {askToken && (
          <Field
            label="Agreement link"
            htmlFor="agreement-token"
            error={errors.token?.message}
            hint="Paste the link from your approval email. If it has expired, ask KACHI to send a new one."
          >
            <Input id="agreement-token" autoComplete="off" aria-invalid={Boolean(errors.token)} {...form.register("token")} />
          </Field>
        )}
        {!askToken && errors.token?.message && <p className="text-xs text-destructive">{errors.token.message}</p>}

        <div className="grid gap-1.5">
          <Controller
            control={form.control}
            name="accepted"
            render={({ field }) => (
              <Label className="items-start font-normal leading-snug">
                <Checkbox
                  className="mt-0.5"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  aria-invalid={Boolean(errors.accepted)}
                />
                I have read the {view.agreement.title} (version {view.agreement.version}) and accept it on behalf of my
                business.
              </Label>
            )}
          />
          {errors.accepted?.message && (
            <p role="alert" className="text-xs text-destructive">
              {errors.accepted.message}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2Icon className="animate-spin" />}
          Accept and open my store
        </Button>
      </form>
    </Section>
  );
}

function ConsentRecord({ consent }: { consent: VendorConsent }) {
  async function openCopy() {
    try {
      await openAgreementCopy();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <Section title="Your acceptance">
      <DetailList
        className="sm:grid-cols-1"
        items={[
          {
            label: "Agreement",
            value: consent.agreement ? `${consent.agreement.title} (v${consent.agreement.version})` : "—",
          },
          { label: "Accepted", value: formatDateTime(consent.accepted_at) },
          { label: "IP address", value: consent.ip_address ?? "—" },
          { label: "Browser", value: consent.user_agent ?? "—" },
        ]}
      />
      <div className="mt-4">
        {consent.copy_ready ? (
          <Button variant="outline" onClick={openCopy}>
            <FileTextIcon /> Download signed copy
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Your signed copy is being prepared. We also email it to you.</p>
        )}
      </div>
    </Section>
  );
}
