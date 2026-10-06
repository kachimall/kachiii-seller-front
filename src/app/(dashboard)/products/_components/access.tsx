"use client";

import { LockIcon } from "lucide-react";
import { useAuth, useCan } from "@/store/auth";

/**
 * What the signed-in seller may change. A suspended vendor keeps read access but the API refuses
 * every write outside orders (EnsureUserIsVendor), so write actions are hidden or disabled.
 */
export function useProductAccess() {
  const can = useCan();
  const suspended = useAuth((s) => s.user?.vendor?.status === "suspended");
  return {
    canView: can("products.view"),
    canManage: can("products.manage") && !suspended,
    /** May see stock and low-stock (reads stay open while suspended). */
    viewStock: can("inventory.manage"),
    canStock: can("inventory.manage") && !suspended,
    suspended,
  };
}

/** Explains why the page is read-only. */
export function SuspendedNotice() {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl bg-destructive/5 p-4 text-sm ring-1 ring-destructive/20">
      <LockIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
      <p>
        <span className="font-medium text-destructive">Your store is suspended.</span> You can still view your products and
        stock, but you cannot change them until KACHI lifts the suspension.
      </p>
    </div>
  );
}
