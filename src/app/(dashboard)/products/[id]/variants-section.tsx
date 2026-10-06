"use client";

import { ArchiveIcon, BoxesIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { Thumb } from "@/components/common/thumb";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/api/client";
import { archiveVariant } from "@/lib/api/products";
import { formatMoney, formatOptions } from "@/lib/format";
import { MAX_VARIANTS } from "@/lib/schemas/products";
import { cn } from "@/lib/utils";
import type { ProductVariant } from "@/types/api";
import type { ProductSectionProps } from "./product-detail";
import { StockDialog } from "./stock-dialog";
import { AddVariantDialog, EditVariantDialog } from "./variant-dialogs";

export function VariantsSection({
  product,
  onReload,
  canManage,
  canStock,
  viewStock,
}: ProductSectionProps & { canStock: boolean; viewStock: boolean }) {
  const variants = product.variants ?? [];
  const live = variants.filter((v) => v.status !== "archived");
  const archived = variants.length - live.length;
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stockId, setStockId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<ProductVariant | null>(null);

  const hasOptions = (product.options ?? []).length > 0;
  // Without options there is exactly one combination, so a second live variant is impossible.
  const canAdd = canManage && product.status !== "banned" && (hasOptions || live.length === 0) && live.length < MAX_VARIANTS;
  const rows = showArchived ? variants : live;
  const editing = variants.find((v) => v.id === editingId) ?? null;
  const stockVariant = variants.find((v) => v.id === stockId) ?? null;
  const imageOf = (v: ProductVariant) => (product.images ?? []).find((i) => i.id === v.image_id)?.thumbnail_url ?? null;

  async function runArchive() {
    if (!archiving) return false;
    try {
      await archiveVariant(product.id, archiving.id);
      toast.success("Variant archived.");
      onReload();
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  }

  return (
    <Section
      title={`Variants and stock (${live.length})`}
      flush
      actions={
        <>
          {archived > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setShowArchived((s) => !s)}>
              {showArchived ? "Hide archived" : `Show archived (${archived})`}
            </Button>
          )}
          {canAdd && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <PlusIcon /> Add variant
            </Button>
          )}
        </>
      }
    >
      {rows.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">No variants yet. Add one so the product has something to sell.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Variant</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>On hand</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((v) => {
                const isArchived = v.status === "archived";
                return (
                  <TableRow key={v.id} className={cn(isArchived && "opacity-60")}>
                    <TableCell className="pl-5">
                      <span className="flex items-center gap-3">
                        <Thumb src={imageOf(v) ?? product.thumbnail_url} alt="" className="size-9" />
                        <span className="min-w-0">
                          <span className="block font-medium">{formatOptions(v.options)}</span>
                          <span className="block text-xs text-muted-foreground">
                            {v.sku}
                            {v.seller_sku ? ` · ${v.seller_sku}` : ""}
                          </span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {v.sale_price ? (
                        <>
                          {formatMoney(v.sale_price, v.currency_code)}{" "}
                          <span className="text-xs text-muted-foreground line-through">{v.price}</span>
                        </>
                      ) : (
                        formatMoney(v.price, v.currency_code)
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span className={cn((v.inventory?.available ?? v.stock) <= 0 && "font-medium text-destructive")}>
                          {v.inventory?.available ?? v.stock}
                        </span>
                        {!isArchived && v.inventory?.is_low_stock && <StatusBadge status="low" label="Low" tone="warning" />}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.inventory ? (
                        <>
                          {v.inventory.on_hand}
                          {v.inventory.reserved > 0 && <span className="text-xs"> ({v.inventory.reserved} held)</span>}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={v.status} />
                    </TableCell>
                    <TableCell className="pr-5">
                      <span className="flex justify-end gap-1">
                        {viewStock && (
                          <Button size="sm" variant="ghost" onClick={() => setStockId(v.id)}>
                            <BoxesIcon /> Stock
                          </Button>
                        )}
                        {canManage && !isArchived && (
                          <>
                            <Button size="icon-sm" variant="ghost" aria-label="Edit variant" title="Edit" onClick={() => setEditingId(v.id)}>
                              <PencilIcon />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              className="text-destructive"
                              aria-label="Archive variant"
                              title="Archive"
                              onClick={() => setArchiving(v)}
                            >
                              <ArchiveIcon />
                            </Button>
                          </>
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {adding && <AddVariantDialog product={product} onClose={() => setAdding(false)} onSaved={onReload} />}
      {editing && <EditVariantDialog product={product} variant={editing} onClose={() => setEditingId(null)} onSaved={onReload} />}
      {stockVariant && (
        <StockDialog
          productId={product.id}
          variant={stockVariant}
          canAdjust={canStock && stockVariant.status !== "archived"}
          onClose={() => setStockId(null)}
          onChanged={onReload}
        />
      )}

      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={archiving ? `Archive ${formatOptions(archiving.options)}?` : ""}
        description="The variant can no longer be sold and its unreserved stock is written off. Orders already placed are not affected. This cannot be undone; add the variant again if you need it back."
        confirmLabel="Archive"
        destructive
        onConfirm={runArchive}
      />
    </Section>
  );
}
