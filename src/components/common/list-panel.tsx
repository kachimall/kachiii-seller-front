"use client";

import type { ReactNode } from "react";
import { Pagination } from "@/components/common/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { NativeSelect } from "@/components/ui/native-select";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PageMeta } from "@/types/api";

interface ListPanelProps<T> {
  filters?: ReactNode;
  rows: T[] | undefined;
  meta?: PageMeta;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onPage?: (page: number) => void;
  empty: { title: string; description?: string };
  children: (rows: T[]) => ReactNode;
}

/** A card with a filter bar, the list (or its loading/empty/error state) and pagination. */
export function ListPanel<T>({ filters, rows, meta, loading, error, onRetry, onPage, empty, children }: ListPanelProps<T>) {
  let body: ReactNode;
  if (error && !rows) body = <ErrorState error={error} onRetry={onRetry} />;
  else if (!rows) body = <LoadingState />;
  else if (rows.length === 0) body = <EmptyState {...empty} />;
  else body = <div className={cn("transition-opacity", loading && "opacity-60")}>{children(rows)}</div>;

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      {filters && <div className="flex flex-wrap items-center gap-2 border-b p-3">{filters}</div>}
      {body}
      {onPage && rows && rows.length > 0 && <Pagination meta={meta} onPage={onPage} />}
    </div>
  );
}

/** A filter <select> with an "All" option; values are shown humanized unless labels are given. */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (string | { value: string; label: string })[];
  className?: string;
}) {
  return (
    <NativeSelect
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn("w-full sm:w-44", className)}
    >
      <option value="">{`All ${label.toLowerCase()}`}</option>
      {options.map((option) => {
        const item = typeof option === "string" ? { value: option, label: humanize(option) } : option;
        return (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        );
      })}
    </NativeSelect>
  );
}
