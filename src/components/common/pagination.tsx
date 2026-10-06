"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PageMeta } from "@/types/api";

export function Pagination({ meta, onPage }: { meta: PageMeta | undefined; onPage: (page: number) => void }) {
  if (!meta) return null;
  const { current_page: page, last_page: last, total, per_page: perPage, has_more: hasMore } = meta;
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = total !== undefined ? Math.min(page * perPage, total) : undefined;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
      <span>
        {total !== undefined ? `${from}–${to} of ${total}` : `Page ${page}`}
      </span>
      <div className="flex items-center gap-2">
        {last !== undefined && <span>Page {page} of {Math.max(last, 1)}</span>}
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeftIcon />
        </Button>
        <Button variant="outline" size="icon-sm" disabled={!hasMore} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}
