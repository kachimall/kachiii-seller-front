"use client";

import { AlertTriangleIcon, InboxIcon, Loader2Icon, LockIcon, RotateCwIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, errorMessage } from "@/lib/api/client";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status">
      <Loader2Icon className="size-4 animate-spin" />
      {label}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <InboxIcon className="size-8 text-muted-foreground/60" />
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export function ForbiddenState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <LockIcon className="size-8 text-muted-foreground/60" />
      <p className="font-medium">You do not have access to this</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {message ?? "Your account does not include this section."}
      </p>
    </div>
  );
}

/** A failed load: 403 and 404 get their own wording, everything else offers a retry. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (error instanceof ApiError && error.status === 403 && !error.needsTwoFactorSetup) {
    return <ForbiddenState message={error.message} />;
  }
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <AlertTriangleIcon className="size-8 text-destructive/70" />
      <p className="font-medium">{notFound ? "Not found" : "Could not load this"}</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {notFound ? "It may have been deleted, or the link is wrong." : errorMessage(error)}
      </p>
      {onRetry && !notFound && (
        <Button variant="outline" onClick={onRetry}>
          <RotateCwIcon /> Try again
        </Button>
      )}
    </div>
  );
}

/** Shows loading / error / content for a useApi() result. */
export function AsyncContent<T>({
  data,
  error,
  loading,
  onRetry,
  children,
}: {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
}) {
  if (error && data === undefined) return <ErrorState error={error} onRetry={onRetry} />;
  if (data === undefined) return loading ? <LoadingState /> : null;
  return <>{children(data)}</>;
}
