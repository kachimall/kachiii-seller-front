"use client";

import {
  ArrowRightIcon,
  BanIcon,
  CircleCheckIcon,
  CirclePauseIcon,
  CircleXIcon,
  ClockIcon,
  FilePenLineIcon,
  FileTextIcon,
  Loader2Icon,
  MailIcon,
  PencilIcon,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { DetailList } from "@/components/common/detail-list";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { AsyncContent } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { useApi } from "@/hooks/use-api";
import { me } from "@/lib/api/auth";
import { errorMessage } from "@/lib/api/client";
import { getApplication, openAgreementCopy, resendVerification } from "@/lib/api/onboarding";
import { formatDateTime } from "@/lib/format";
import { businessTypeLabel } from "@/lib/schemas/onboarding";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import type { VendorStatus } from "@/types/api";
import type { VendorApplication } from "@/types/onboarding";
import { ApplicationForm } from "./application-form";
import { DocumentsSection } from "./documents-section";

/** The applicant's own application: where it stands, its details, store and documents. */
export function ApplicationPage() {
  const { data, error, loading, reload, mutate } = useApi("vendor-application", getApplication);
  return (
    <AsyncContent data={data} error={error} loading={loading} onRetry={reload}>
      {(vendor) => <ApplicationView vendor={vendor} onChange={mutate} onReload={reload} />}
    </AsyncContent>
  );
}

/** Pending and rejected applications may still change (VendorStatus::isEditableApplication). */
export const isEditable = (status: VendorStatus) => status === "pending" || status === "rejected";

/** The status may have moved (a rejected application goes back to pending), so re-read the account. */
export async function refreshAccount() {
  try {
    useAuth.getState().setUser(await me());
  } catch {
    // The page already shows the new state; the guard re-reads the account on the next visit.
  }
}

function ApplicationView({
  vendor,
  onChange,
  onReload,
}: {
  vendor: VendorApplication;
  onChange: (vendor: VendorApplication) => void;
  onReload: () => void;
}) {
  const editable = isEditable(vendor.status);
  const [editing, setEditing] = useState(false);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            Your application <StatusBadge status={vendor.status} />
          </span>
        }
        description={[vendor.code, `Submitted ${formatDateTime(vendor.submitted_at)}`, `revision ${vendor.revision}`]
          .filter(Boolean)
          .join(" · ")}
      />

      <div className="grid gap-6">
        <StatusPanel vendor={vendor} />
        <VerifyEmailNotice />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="grid h-fit gap-6 lg:col-span-2">
            <Section
              title="Business"
              actions={
                editable &&
                !editing && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <PencilIcon /> Edit
                  </Button>
                )
              }
            >
              {editing ? (
                <ApplicationForm
                  vendor={vendor}
                  onCancel={() => setEditing(false)}
                  onSaved={(updated) => {
                    // The update answer has no consent; keep the one we have.
                    onChange({ ...updated, consent: vendor.consent });
                    setEditing(false);
                    if (updated.status !== vendor.status) void refreshAccount();
                  }}
                  onConflict={() => {
                    setEditing(false);
                    onReload();
                  }}
                />
              ) : (
                <DetailList
                  items={[
                    { label: "Business name", value: vendor.business_name },
                    { label: "Business type", value: businessTypeLabel(vendor.business_type) },
                    { label: "VAT registered", value: vendor.is_vat_registered ? "Yes" : "No" },
                    { label: "Tax ID (TRN)", value: <span className="font-mono">{vendor.tax_id ?? "—"}</span> },
                    { label: "Contact phone", value: vendor.contact_phone },
                    { label: "Contact email", value: vendor.contact_email ?? "—" },
                    { label: "Store name", value: vendor.store?.name ?? "—" },
                    { label: "Store address", value: <span className="font-mono">{vendor.store?.slug ?? "—"}</span> },
                    { label: "Store description", value: vendor.store?.description || "—", wide: true },
                  ]}
                />
              )}
            </Section>

            <DocumentsSection
              vendor={vendor}
              editable={editable}
              onChanged={async (statusBefore) => {
                onReload();
                if (statusBefore === "rejected") await refreshAccount();
              }}
            />
          </div>

          <div className="grid h-fit gap-6">
            <AgreementSummary vendor={vendor} />
            <Section title="Timeline">
              <DetailList
                className="sm:grid-cols-1"
                items={[
                  { label: "Submitted", value: formatDateTime(vendor.submitted_at) },
                  { label: "Approved", value: formatDateTime(vendor.approved_at) },
                  ...(vendor.agreement_link_expires_at
                    ? [{ label: "Agreement link expires", value: formatDateTime(vendor.agreement_link_expires_at) }]
                    : []),
                  { label: "Agreement accepted", value: formatDateTime(vendor.consent?.accepted_at) },
                ]}
              />
            </Section>
          </div>
        </div>
      </div>
    </>
  );
}

interface StatusCopy {
  icon: LucideIcon;
  tone: "info" | "action" | "success" | "danger";
  title: string;
  body: ReactNode;
  action?: ReactNode;
}

function statusCopy(vendor: VendorApplication): StatusCopy {
  const reason = vendor.status_reason ? (
    <p className="mt-2 rounded-lg bg-background/60 px-3 py-2">
      <span className="font-medium">Reason given:</span> {vendor.status_reason}
    </p>
  ) : null;

  switch (vendor.status) {
    case "pending":
      return {
        icon: ClockIcon,
        tone: "info",
        title: "We are reviewing your application",
        body: "KACHI checks your business details and documents. You can still change them below while we review. We will email you when there is a decision.",
      };
    case "awaiting_consent":
      return {
        icon: FilePenLineIcon,
        tone: "action",
        title: "Approved: accept the vendor agreement to open your store",
        body: (
          <>
            Your application is approved. Read and accept the KACHI vendor agreement with the link from your approval
            email
            {vendor.agreement_link_expires_at ? `, before ${formatDateTime(vendor.agreement_link_expires_at)}` : ""}. If
            the link has expired, ask KACHI to send you a new one.
          </>
        ),
        action: (
          <ButtonLink href="/agreement" variant="default" size="lg">
            Read and accept the agreement <ArrowRightIcon />
          </ButtonLink>
        ),
      };
    case "rejected":
      return {
        icon: CircleXIcon,
        tone: "danger",
        title: "Your application was not approved",
        body: (
          <>
            Update your details or documents below. Any change sends the application back to KACHI for review.
            {reason}
          </>
        ),
      };
    case "approved":
      return {
        icon: CircleCheckIcon,
        tone: "success",
        title: "Your store is open",
        body: "You accepted the vendor agreement, and your store is live on KACHI.",
        action: (
          <ButtonLink href="/" variant="outline">
            Go to the dashboard <ArrowRightIcon />
          </ButtonLink>
        ),
      };
    case "suspended":
      return {
        icon: CirclePauseIcon,
        tone: "danger",
        title: "Your store is suspended",
        body: (
          <>
            Your store is offline. You can still see your catalogue and orders, but not change them. Contact KACHI
            support to resolve this.
            {reason}
          </>
        ),
      };
    case "terminated":
      return {
        icon: BanIcon,
        tone: "danger",
        title: "Your seller account is closed",
        body: (
          <>
            Your store is offline and the Seller Centre is locked. Contact KACHI if you think this is a mistake.
            {reason}
          </>
        ),
      };
  }
}

const TONE_CLASSES: Record<StatusCopy["tone"], { box: string; icon: string }> = {
  info: { box: "bg-secondary-fixed/60 ring-secondary/20", icon: "text-secondary" },
  action: { box: "bg-primary-fixed ring-primary/30", icon: "text-primary" },
  success: { box: "bg-success/10 ring-success/20", icon: "text-success" },
  danger: { box: "bg-destructive/10 ring-destructive/20", icon: "text-destructive" },
};

/** What the status means and what happens next, with the one thing to do (if any). */
function StatusPanel({ vendor }: { vendor: VendorApplication }) {
  const copy = statusCopy(vendor);
  const Icon = copy.icon;
  return (
    <div role="status" className={cn("flex flex-col gap-4 rounded-xl p-5 ring-1 sm:flex-row sm:items-start", TONE_CLASSES[copy.tone].box)}>
      <Icon className={cn("size-8 shrink-0", TONE_CLASSES[copy.tone].icon)} />
      <div className="min-w-0 flex-1">
        <p className="font-heading text-headline-sm">{copy.title}</p>
        <div className="mt-1 text-sm text-foreground/80">{copy.body}</div>
        {copy.action && <div className="mt-4">{copy.action}</div>}
      </div>
    </div>
  );
}

/** KACHI reviews an application once the email is verified. */
function VerifyEmailNotice() {
  const user = useAuth((s) => s.user);
  const [sending, setSending] = useState(false);
  if (!user || user.email_verified) return null;

  async function resend() {
    setSending(true);
    try {
      await resendVerification();
      toast.success(`We sent a new verification link to ${user?.email}.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center">
      <MailIcon className="size-5 shrink-0 text-muted-foreground" />
      <p className="flex-1 text-sm">
        <span className="font-medium">Verify your email address.</span> We sent a link to {user.email}; KACHI reviews
        your application once it is verified.
      </p>
      <Button variant="outline" size="sm" onClick={resend} disabled={sending}>
        {sending && <Loader2Icon className="animate-spin" />}
        Send the link again
      </Button>
    </div>
  );
}

function AgreementSummary({ vendor }: { vendor: VendorApplication }) {
  const consent = vendor.consent;

  async function openCopy() {
    try {
      await openAgreementCopy();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <Section
      title="Vendor agreement"
      actions={
        <ButtonLink href="/agreement" variant="outline" size="sm">
          {vendor.status === "awaiting_consent" ? "Accept" : "View"}
        </ButtonLink>
      }
    >
      {consent ? (
        <div className="grid gap-3 text-sm">
          <p>
            You accepted{" "}
            <span className="font-medium">
              {consent.agreement ? `${consent.agreement.title} (v${consent.agreement.version})` : "the agreement"}
            </span>{" "}
            on {formatDateTime(consent.accepted_at)}.
          </p>
          {consent.copy_ready ? (
            <Button variant="outline" size="sm" className="w-fit" onClick={openCopy}>
              <FileTextIcon /> Signed copy
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Your signed copy is being prepared. We also email it to you.</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {vendor.status === "awaiting_consent"
            ? "Waiting for you to accept the agreement."
            : "You accept the agreement once KACHI approves your application."}
        </p>
      )}
    </Section>
  );
}
