"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { RecoveryCodes } from "@/components/common/recovery-codes";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { confirmTwoFactor, startTwoFactor } from "@/lib/api/auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import { otpSchema, type OtpValues } from "@/lib/schemas/auth";
import type { TwoFactorSetup as Setup } from "@/types/api";

/**
 * Turns on 2FA: POST /auth/two-factor gives a secret and an otpauth:// URL, then a code from
 * the app confirms it and returns the recovery codes. Other devices are signed out.
 */
export function TwoFactorSetup({ onComplete }: { onComplete: () => void }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [starting, setStarting] = useState(false);
  const form = useForm<OtpValues>({ resolver: zodResolver(otpSchema), defaultValues: { code: "" } });
  const { errors, isSubmitting } = form.formState;

  async function begin() {
    setStarting(true);
    try {
      setSetup(await startTwoFactor());
      form.reset();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setStarting(false);
    }
  }

  const confirm = form.handleSubmit(async ({ code }) => {
    try {
      const result = await confirmTwoFactor(code);
      setCodes(result.recovery_codes);
      toast.success("Two-factor authentication is on.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        form.setError("code", { message: error.firstError("code") ?? error.message });
      } else {
        toast.error(errorMessage(error));
      }
    }
  });

  if (codes) {
    return (
      <div className="grid gap-4">
        <div>
          <h2 className="font-heading text-headline-sm">Save your recovery codes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Two-factor authentication is now on for your account.</p>
        </div>
        <RecoveryCodes codes={codes} />
        <Button onClick={onComplete}>I saved them, continue</Button>
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="grid gap-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Install an authenticator app (Google Authenticator, 1Password, Authy…).</li>
          <li>Add KACHI to it with the key we show you.</li>
          <li>Enter the 6-digit code the app shows to confirm.</li>
        </ol>
        <Button onClick={begin} disabled={starting}>
          {starting && <Loader2Icon className="animate-spin" />}
          Begin setup
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={confirm} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <p className="text-sm">
          In your authenticator app, add an account with this setup key (time-based), or open the link on the phone that
          has the app.
        </p>
        <code className="rounded-lg bg-muted px-3 py-2 text-center font-mono text-base tracking-wider break-all select-all">
          {groupKey(setup.secret)}
        </code>
        <a href={setup.otpauth_url} className="text-sm text-secondary hover:underline">
          Open in authenticator app
        </a>
      </div>
      <Field label="6-digit code" htmlFor="setup-code" error={errors.code?.message}>
        <Input
          id="setup-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          className="text-center font-mono text-lg tracking-[0.4em]"
          aria-invalid={Boolean(errors.code)}
          {...form.register("code")}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting && <Loader2Icon className="animate-spin" />}
          Confirm and turn on
        </Button>
        <Button type="button" variant="outline" onClick={begin} disabled={starting || isSubmitting}>
          New key
        </Button>
      </div>
    </form>
  );
}

function groupKey(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}
