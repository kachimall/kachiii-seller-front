"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { me, refresh, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { hasStore, isVendor, useAuth } from "@/store/auth";

const REFRESH_WITHIN_MS = 24 * 60 * 60 * 1000; // rotate the 7-day token in its last day
const CHECK_EVERY_MS = 5 * 60 * 1000;
export const NOT_VENDOR_MESSAGE = "This account has no seller account. Register your store to sell on KACHI.";

/**
 * Client-side guard for the Seller Centre (the token lives in localStorage, so the server cannot
 * check it). Sends visitors without a session to /login, accounts that must set up 2FA to
 * /two-factor, and signs out shop accounts with no vendor application. With `requireStore`,
 * applicants whose store is not open yet go to /application.
 */
export function AuthGuard({ children, requireStore = false }: { children: ReactNode; requireStore?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuth((s) => s.hydrated);
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const twoFactorSetupRequired = useAuth((s) => s.twoFactorSetupRequired);
  const [checkFailed, setCheckFailed] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  // Where to go when the session is missing or incomplete.
  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      // Keep the query too: the agreement link carries its ?token.
      const here = pathname + window.location.search;
      router.replace(here === "/" ? "/login" : `/login?next=${encodeURIComponent(here)}`);
    } else if (twoFactorSetupRequired) {
      router.replace("/two-factor");
    } else if (requireStore && user && isVendor(user) && !hasStore(user)) {
      router.replace("/application");
    }
  }, [hydrated, token, user, requireStore, twoFactorSetupRequired, pathname, router]);

  // Re-read the account once per token: roles and permissions may have changed.
  useEffect(() => {
    if (!hydrated || !token) return;
    let cancelled = false;
    me().then(
      (fresh) => {
        if (cancelled) return;
        if (!isVendor(fresh)) return void signOutNotVendor();
        setCheckFailed(undefined);
        useAuth.getState().setUser(fresh);
      },
      (error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 403 && !error.needsTwoFactorSetup) {
          signOutNotVendor();
        } else if (!(error instanceof ApiError) || error.status !== 401) {
          // Network or server trouble: without the account we can't render the app, so say so.
          setCheckFailed(error instanceof Error ? error.message : "Couldn’t reach the KACHI API.");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [hydrated, token, attempt]);

  // Rotate the token before it expires.
  useEffect(() => {
    if (!token) return;
    const check = () => {
      const expiresAt = useAuth.getState().expiresAt;
      if (!expiresAt) return;
      const left = new Date(expiresAt).getTime() - Date.now();
      if (left <= 0) useAuth.getState().clear("Your session expired. Sign in again.");
      else if (left < REFRESH_WITHIN_MS) {
        refresh().then((result) => useAuth.getState().setSession(result), () => {});
      }
    };
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, [token]);

  if (checkFailed && !user) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-start gap-3 px-6 py-16">
        <p className="font-heading text-xl font-bold">Couldn’t check your session</p>
        <p className="text-sm text-on-surface-variant">{checkFailed} Make sure the KACHI backend is running.</p>
        <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
      </div>
    );
  }

  if (!hydrated || !token || twoFactorSetupRequired || !user || !isVendor(user) || (requireStore && !hasStore(user))) {
    return <LoadingState label="Checking your session…" />;
  }

  return <>{children}</>;
}

function signOutNotVendor() {
  logout().catch(() => {});
  useAuth.getState().clear(NOT_VENDOR_MESSAGE);
}
