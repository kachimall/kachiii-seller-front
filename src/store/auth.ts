"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { registerAuthHooks } from "@/lib/api/client";
import type { TokenResult, User } from "@/types/api";

interface AuthState {
  token: string | null;
  expiresAt: string | null;
  user: User | null;
  /** True once the persisted session has been read from localStorage. */
  hydrated: boolean;
  /** Set when the API answers 403 with errors.two_factor: the account must set up 2FA first. */
  twoFactorSetupRequired: boolean;
  /** Why the session ended, shown once on the login page. */
  signedOutReason: string | null;

  setSession: (result: Pick<TokenResult, "token" | "expires_at"> & { user?: User }) => void;
  setUser: (user: User) => void;
  setTwoFactorSetupRequired: (value: boolean) => void;
  clear: (reason?: string | null) => void;
  consumeSignedOutReason: () => string | null;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      expiresAt: null,
      user: null,
      hydrated: false,
      twoFactorSetupRequired: false,
      signedOutReason: null,

      setSession: ({ token, expires_at, user }) =>
        set((state) => ({
          token,
          expiresAt: expires_at,
          user: user ?? state.user,
          twoFactorSetupRequired: user ? needsTwoFactorSetup(user) : state.twoFactorSetupRequired,
          signedOutReason: null,
        })),
      setUser: (user) => set({ user, twoFactorSetupRequired: needsTwoFactorSetup(user) }),
      setTwoFactorSetupRequired: (value) => set({ twoFactorSetupRequired: value }),
      clear: (reason = null) =>
        set({ token: null, expiresAt: null, user: null, twoFactorSetupRequired: false, signedOutReason: reason }),
      consumeSignedOutReason: () => {
        const reason = get().signedOutReason;
        if (reason) set({ signedOutReason: null });
        return reason;
      },
    }),
    {
      name: "kachi-seller-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ token, expiresAt, user }) => ({ token, expiresAt, user }),
      // Rehydrated by <Providers> after mount, so the first client render matches the server's.
      skipHydration: true,
    },
  ),
);

// Runs once the saved session has been read. (Not onRehydrateStorage: that fires while
// create() is still running, before `useAuth` exists.) `persist` is missing on the server.
useAuth.persist?.onFinishHydration((state) => {
  if (state.expiresAt && new Date(state.expiresAt).getTime() <= Date.now()) {
    state.clear("Your session expired. Sign in again.");
  }
  useAuth.setState({ hydrated: true });
});

export function needsTwoFactorSetup(user: User): boolean {
  return Boolean(user.two_factor?.required && !user.two_factor.enabled);
}

/** The account has a vendor application or store (shop-only accounts have none). */
export function isVendor(user: User | null): boolean {
  return Boolean(user?.vendor);
}

/**
 * The store is open to manage: approved, or suspended (read-only, the API refuses changes).
 * Anything else stays on the application pages until KACHI approves and the agreement is accepted.
 */
export function hasStore(user: User | null): boolean {
  return user?.vendor?.status === "approved" || user?.vendor?.status === "suspended";
}

/** Whether the signed-in user holds a permission, e.g. "products.view". */
export function useCan() {
  const permissions = useAuth((s) => s.user?.permissions);
  return (permission: string | string[]) => {
    const list = Array.isArray(permission) ? permission : [permission];
    return list.some((p) => permissions?.includes(p) ?? false);
  };
}

registerAuthHooks({
  getToken: () => useAuth.getState().token,
  onUnauthorized: () => useAuth.getState().clear("Your session ended. Sign in again."),
  onTwoFactorRequired: () => useAuth.getState().setTwoFactorSetupRequired(true),
});
