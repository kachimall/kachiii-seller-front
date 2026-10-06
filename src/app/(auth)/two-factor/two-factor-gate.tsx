"use client";

import { ShieldAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingState } from "@/components/common/states";
import { TwoFactorSetup } from "@/components/common/two-factor-setup";
import { logout, me, twoFactorStatus } from "@/lib/api/auth";
import { useAuth } from "@/store/auth";

/** Shown when the API refuses the Seller Centre with errors.two_factor: 2FA must be on before going further. */
export function TwoFactorGate() {
  const router = useRouter();
  const hydrated = useAuth((s) => s.hydrated);
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) return void router.replace("/login");
    // Already on (e.g. turned on in another tab): carry on.
    twoFactorStatus().then(
      (status) => {
        if (status.enabled) void continueIn();
      },
      () => {},
    );
    // continueIn only reads the store and the router.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, token]);

  async function continueIn() {
    try {
      useAuth.getState().setUser(await me());
    } catch {
      useAuth.getState().setTwoFactorSetupRequired(false);
    }
    router.replace("/");
  }

  async function signOut() {
    await logout().catch(() => {});
    useAuth.getState().clear("You signed out.");
    router.replace("/login");
  }

  if (!hydrated || !token) return <LoadingState />;

  return (
    <div className="grid gap-5">
      <div className="flex gap-3">
        <ShieldAlertIcon className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <h1 className="font-heading text-headline-md">Set up two-factor authentication</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user?.name ? `${user.name}, your` : "Your"} account must use two-factor authentication before it can open the
            Seller Centre.
          </p>
        </div>
      </div>
      <TwoFactorSetup onComplete={continueIn} />
      <button type="button" onClick={signOut} className="text-sm text-muted-foreground hover:underline">
        Sign out
      </button>
    </div>
  );
}
