"use client";

import Link from "next/link";
import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/api/auth";
import { hasStore, useAuth } from "@/store/auth";

const TOKEN_KEY = "kachi-agreement-token";

/** The dashboard for an open store; a slim header for an applicant. */
export function OnboardingFrame({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user);
  if (hasStore(user)) return <AppShell>{children}</AppShell>;

  return (
    <div className="flex min-h-dvh flex-col bg-surface-container-low">
      <SlimHeader name={user?.name} />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8">
        {children}
      </main>
    </div>
  );
}

function SlimHeader({ name }: { name: string | undefined }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // The token may already be gone; sign out locally either way.
    }
    useAuth.getState().clear("You signed out.");
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 md:px-8">
        <Link href="/application" className="flex items-center gap-2">
          <span className="font-heading text-xl font-extrabold tracking-tight text-primary">KACHI</span>
          <span className="rounded bg-secondary px-1.5 py-0.5 text-label-xs text-secondary-foreground uppercase">Seller Centre</span>
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          {name && <span className="hidden truncate text-sm font-medium sm:block">{name}</span>}
          <Button variant="ghost" size="sm" onClick={signOut} disabled={signingOut}>
            <LogOutIcon /> Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}

/**
 * The approval email links to /agreement?token=…. A signed-out vendor is sent to /login first and
 * the guard's ?next= keeps only the path, so the token is kept for this tab until it is used.
 */
export function AgreementTokenKeeper() {
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token && window.location.pathname === "/agreement") rememberAgreementToken(token);
  }, []);
  return null;
}

export function rememberAgreementToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage may be off (private mode); the link still works when opened while signed in.
  }
}

export function rememberedAgreementToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
