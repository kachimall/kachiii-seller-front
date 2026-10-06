"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NOT_VENDOR_MESSAGE } from "@/components/layout/auth-guard";
import { login, logout, twoFactorChallenge } from "@/lib/api/auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import {
  loginSchema,
  otpSchema,
  recoveryCodeSchema,
  type LoginValues,
  type OtpValues,
  type RecoveryCodeValues,
} from "@/lib/schemas/auth";
import { hasStore, isVendor, needsTwoFactorSetup, useAuth } from "@/store/auth";
import type { TokenResult } from "@/types/api";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useAuth((s) => s.hydrated);
  const token = useAuth((s) => s.token);
  const signedOutReason = useAuth((s) => s.signedOutReason);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const next = safeNext(searchParams.get("next"));

  // Already signed in: go straight in.
  useEffect(() => {
    if (hydrated && token) router.replace(next);
  }, [hydrated, token, next, router]);

  async function finish(result: TokenResult) {
    if (!isVendor(result.user)) {
      // Revoke the token again: it is no use here.
      await logout(result.token).catch(() => {});
      setChallenge(null);
      setFormError(NOT_VENDOR_MESSAGE);
      return;
    }
    useAuth.getState().setSession(result);
    router.replace(needsTwoFactorSetup(result.user) ? "/two-factor" : hasStore(result.user) ? next : "/application");
  }

  return (
    <div className="grid gap-6">
      {(formError || signedOutReason) && (
        <p
          role="alert"
          className={
            formError
              ? "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              : "rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"
          }
        >
          {formError ?? signedOutReason}
        </p>
      )}
      {challenge ? (
        <ChallengeStep
          challengeToken={challenge}
          onDone={finish}
          onRestart={(message) => {
            setChallenge(null);
            setFormError(message);
          }}
        />
      ) : (
        <CredentialsStep
          onError={setFormError}
          onChallenge={(ticket) => {
            setFormError(null);
            setChallenge(ticket);
          }}
          onDone={finish}
        />
      )}
    </div>
  );
}

function CredentialsStep({
  onChallenge,
  onDone,
  onError,
}: {
  onChallenge: (ticket: string) => void;
  onDone: (result: TokenResult) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    onError(null);
    try {
      const result = await login(values.email, values.password);
      if ("two_factor" in result) onChallenge(result.challenge_token);
      else await onDone(result);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        const email = error.firstError("email");
        const password = error.firstError("password");
        if (email) form.setError("email", { message: email });
        if (password) form.setError("password", { message: password });
        if (!email && !password) onError(error.message);
      } else {
        // 403: inactive or suspended account; 429: too many attempts.
        onError(errorMessage(error));
      }
    }
  });

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div>
        <h1 className="font-heading text-headline-md">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          New to KACHI?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Register your store
          </Link>
        </p>
      </div>
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          autoFocus
          aria-invalid={Boolean(errors.email)}
          {...form.register("email")}
        />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          {...form.register("password")}
        />
      </Field>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting && <Loader2Icon className="animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}

function ChallengeStep({
  challengeToken,
  onDone,
  onRestart,
}: {
  challengeToken: string;
  onDone: (result: TokenResult) => Promise<void>;
  onRestart: (message: string | null) => void;
}) {
  const [useRecovery, setUseRecovery] = useState(false);
  return useRecovery ? (
    <RecoveryForm challengeToken={challengeToken} onDone={onDone} onRestart={onRestart} onSwitch={() => setUseRecovery(false)} />
  ) : (
    <CodeForm challengeToken={challengeToken} onDone={onDone} onRestart={onRestart} onSwitch={() => setUseRecovery(true)} />
  );
}

interface StepProps {
  challengeToken: string;
  onDone: (result: TokenResult) => Promise<void>;
  onRestart: (message: string | null) => void;
  onSwitch: () => void;
}

/** An expired or closed challenge (five wrong codes) means signing in again. */
function challengeExpired(error: unknown): string | null {
  return error instanceof ApiError && error.status === 422 ? (error.firstError("challenge_token") ?? null) : null;
}

function CodeForm({ challengeToken, onDone, onRestart, onSwitch }: StepProps) {
  const form = useForm<OtpValues>({ resolver: zodResolver(otpSchema), defaultValues: { code: "" } });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async ({ code }) => {
    try {
      await onDone(await twoFactorChallenge(challengeToken, { code }));
    } catch (error) {
      const expired = challengeExpired(error);
      if (expired) return onRestart(expired);
      form.setError("code", { message: error instanceof ApiError ? (error.firstError("code") ?? error.message) : errorMessage(error) });
    }
  });

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div>
        <h1 className="font-heading text-headline-md">Two-factor authentication</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
      </div>
      <Field label="Authentication code" htmlFor="code" error={errors.code?.message}>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          className="text-center font-mono text-lg tracking-[0.4em]"
          aria-invalid={Boolean(errors.code)}
          {...form.register("code")}
        />
      </Field>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting && <Loader2Icon className="animate-spin" />}
        Verify
      </Button>
      <div className="flex justify-between text-sm">
        <button type="button" className="text-secondary hover:underline" onClick={onSwitch}>
          Use a recovery code
        </button>
        <button type="button" className="text-muted-foreground hover:underline" onClick={() => onRestart(null)}>
          Back to sign in
        </button>
      </div>
    </form>
  );
}

function RecoveryForm({ challengeToken, onDone, onRestart, onSwitch }: StepProps) {
  const form = useForm<RecoveryCodeValues>({
    resolver: zodResolver(recoveryCodeSchema),
    defaultValues: { recovery_code: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async ({ recovery_code }) => {
    try {
      await onDone(await twoFactorChallenge(challengeToken, { recovery_code }));
    } catch (error) {
      const expired = challengeExpired(error);
      if (expired) return onRestart(expired);
      form.setError("recovery_code", {
        message: error instanceof ApiError ? (error.firstError("recovery_code") ?? error.message) : errorMessage(error),
      });
    }
  });

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div>
        <h1 className="font-heading text-headline-md">Use a recovery code</h1>
        <p className="mt-1 text-sm text-muted-foreground">Each recovery code works once.</p>
      </div>
      <Field label="Recovery code" htmlFor="recovery_code" error={errors.recovery_code?.message}>
        <Input
          id="recovery_code"
          autoComplete="off"
          autoFocus
          className="font-mono"
          aria-invalid={Boolean(errors.recovery_code)}
          {...form.register("recovery_code")}
        />
      </Field>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting && <Loader2Icon className="animate-spin" />}
        Verify
      </Button>
      <div className="flex justify-between text-sm">
        <button type="button" className="text-secondary hover:underline" onClick={onSwitch}>
          Use an authenticator code
        </button>
        <button type="button" className="text-muted-foreground hover:underline" onClick={() => onRestart(null)}>
          Back to sign in
        </button>
      </div>
    </form>
  );
}

/** Only same-site paths, so ?next= cannot send people elsewhere. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) return "/";
  return value;
}
