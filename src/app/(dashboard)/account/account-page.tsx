"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, ShieldCheckIcon, ShieldOffIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { DetailList } from "@/components/common/detail-list";
import { PageHeader } from "@/components/common/page-header";
import { RecoveryCodes } from "@/components/common/recovery-codes";
import { Section } from "@/components/common/section";
import { AsyncContent } from "@/components/common/states";
import { TwoFactorSetup } from "@/components/common/two-factor-setup";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useApi } from "@/hooks/use-api";
import { changePassword, disableTwoFactor, me, newRecoveryCodes, twoFactorStatus } from "@/lib/api/auth";
import { handleFormError } from "@/lib/forms";
import { otpSchema, type OtpValues } from "@/lib/schemas/auth";
import { useAuth } from "@/store/auth";

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password."),
    password: z.string().min(8, "Use at least 8 characters."),
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: "The passwords do not match." });
type PasswordValues = z.infer<typeof passwordSchema>;

export function AccountPage() {
  const user = useAuth((s) => s.user);

  return (
    <>
      <PageHeader title="Account & security" description="Your sign-in details and two-factor authentication." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Profile" className="h-fit">
          <DetailList
            className="sm:grid-cols-1"
            items={[
              { label: "Name", value: user?.name },
              { label: "Email", value: user?.email },
              { label: "Roles", value: user?.roles?.join(", ") || "—" },
            ]}
          />
        </Section>
        <TwoFactorSection />
        <PasswordSection />
      </div>
    </>
  );
}

function TwoFactorSection() {
  const { data, error, loading, reload } = useApi("two-factor-status", twoFactorStatus);
  const [codes, setCodes] = useState<string[] | null>(null);

  async function refreshUser() {
    reload();
    try {
      useAuth.getState().setUser(await me());
    } catch {
      // The status above is enough.
    }
  }

  return (
    <Section title="Two-factor authentication" className="h-fit">
      <AsyncContent data={data} error={error} loading={loading} onRetry={reload}>
        {(status) =>
          codes ? (
            <div className="grid gap-3">
              <p className="text-sm font-medium">Your new recovery codes</p>
              <RecoveryCodes codes={codes} />
              <Button variant="outline" onClick={() => setCodes(null)}>
                Done
              </Button>
            </div>
          ) : status.enabled ? (
            <div className="grid gap-5">
              <p className="flex items-center gap-2 text-sm">
                <ShieldCheckIcon className="size-4 text-success" /> On · {status.recovery_codes_left ?? 0} recovery codes left
              </p>
              <CodeAction
                label="New recovery codes"
                description="The old codes stop working."
                onSubmit={async (code) => setCodes((await newRecoveryCodes(code)).recovery_codes)}
              />
              {status.required ? (
                <p className="text-xs text-muted-foreground">Your role requires two-factor authentication, so it cannot be turned off.</p>
              ) : (
                <CodeAction
                  label="Turn off"
                  destructive
                  description="Sign-in will only need your password."
                  onSubmit={async (code) => {
                    await disableTwoFactor(code);
                    toast.success("Two-factor authentication is off.");
                    await refreshUser();
                  }}
                />
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              <p className="flex items-center gap-2 text-sm">
                <ShieldOffIcon className="size-4 text-muted-foreground" /> Off{status.required ? " · required for your role" : ""}
              </p>
              <TwoFactorSetup onComplete={refreshUser} />
            </div>
          )
        }
      </AsyncContent>
    </Section>
  );
}

/** A 6-digit code from the authenticator app confirms a sensitive change. */
function CodeAction({
  label,
  description,
  destructive,
  onSubmit,
}: {
  label: string;
  description: string;
  destructive?: boolean;
  onSubmit: (code: string) => Promise<void>;
}) {
  const form = useForm<OtpValues>({ resolver: zodResolver(otpSchema), defaultValues: { code: "" } });
  const { errors, isSubmitting } = form.formState;
  const id = `code-${label.replace(/\s+/g, "-").toLowerCase()}`;

  const submit = form.handleSubmit(async ({ code }) => {
    try {
      await onSubmit(code);
      form.reset();
    } catch (error) {
      handleFormError(error, form.setError, ["code"]);
    }
  });

  return (
    <form onSubmit={submit} className="grid gap-2 border-t pt-4" noValidate>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex items-start gap-2">
        <Field label="Code" htmlFor={id} error={errors.code?.message} className="flex-1 [&>label]:sr-only">
          <Input id={id} inputMode="numeric" maxLength={6} placeholder="6-digit code" autoComplete="one-time-code" aria-invalid={Boolean(errors.code)} {...form.register("code")} />
        </Field>
        <Button type="submit" variant={destructive ? "destructive" : "outline"} disabled={isSubmitting}>
          {isSubmitting && <Loader2Icon className="animate-spin" />}
          {label}
        </Button>
      </div>
    </form>
  );
}

function PasswordSection() {
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", password: "", password_confirmation: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await changePassword(values);
      form.reset();
      toast.success("Password changed. Your other devices were signed out.");
    } catch (error) {
      handleFormError(error, form.setError, ["current_password", "password", "password_confirmation"]);
    }
  });

  return (
    <Section title="Change password" className="h-fit">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Current password" htmlFor="pw-current" error={errors.current_password?.message}>
          <Input id="pw-current" type="password" autoComplete="current-password" {...form.register("current_password")} />
        </Field>
        <Field label="New password" htmlFor="pw-new" error={errors.password?.message}>
          <Input id="pw-new" type="password" autoComplete="new-password" {...form.register("password")} />
        </Field>
        <Field label="Confirm new password" htmlFor="pw-confirm" error={errors.password_confirmation?.message}>
          <Input id="pw-confirm" type="password" autoComplete="new-password" {...form.register("password_confirmation")} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2Icon className="animate-spin" />}
            Change password
          </Button>
        </div>
      </form>
    </Section>
  );
}
