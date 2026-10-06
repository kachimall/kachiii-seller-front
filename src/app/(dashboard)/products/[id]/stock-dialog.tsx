"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Pagination } from "@/components/common/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApi } from "@/hooks/use-api";
import { ApiError } from "@/lib/api/client";
import { getInventory, listMovements, recordMovement, setInventory } from "@/lib/api/products";
import { formatDateTime, formatOptions, humanize } from "@/lib/format";
import { handleFormError, nullable } from "@/lib/forms";
import { movementSchema, stockSchema, type MovementValues, type StockValues } from "@/lib/schemas/products";
import type { Inventory, InventoryMovement, ProductVariant } from "@/types/api";

const MOVEMENT_LABELS: Record<string, string> = {
  purchase: "Stock received",
  sale: "Sale",
  reservation: "Held at checkout",
  release: "Hold released",
  return: "Return",
  adjustment: "Adjustment",
  cancellation: "Cancellation",
};

/** Stock for one variant: the figures, a stock count, a received/adjustment movement and the ledger. */
export function StockDialog({
  productId,
  variant,
  canAdjust,
  onClose,
  onChanged,
}: {
  productId: string;
  variant: ProductVariant;
  canAdjust: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [page, setPage] = useState(1);
  const inventory = useApi(`inventory:${variant.id}`, () => getInventory(productId, variant.id));
  const movements = useApi(`movements:${variant.id}:${page}`, () => listMovements(productId, variant.id, { page }));
  const current = inventory.data ?? variant.inventory;

  function refresh() {
    inventory.reload();
    setPage(1);
    movements.reload();
    onChanged();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Stock · {formatOptions(variant.options)}</DialogTitle>
          <DialogDescription>
            {variant.sku}
            {variant.seller_sku ? ` · ${variant.seller_sku}` : ""}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label="On hand" value={current?.on_hand} />
          <Figure label="Held at checkout" value={current?.reserved} />
          <Figure label="Available" value={current?.available} tone={current && current.available <= 0 ? "danger" : undefined} />
          <Figure label="Low-stock alert at" value={current?.low_stock_threshold} tone={current?.is_low_stock ? "warning" : undefined} />
        </dl>

        {canAdjust && current && (
          <Tabs defaultValue="count">
            <TabsList>
              <TabsTrigger value="count">Set stock count</TabsTrigger>
              <TabsTrigger value="movement">Receive or adjust</TabsTrigger>
            </TabsList>
            <TabsContent value="count">
              <CountForm productId={productId} variantId={variant.id} inventory={current} onDone={refresh} />
            </TabsContent>
            <TabsContent value="movement">
              <MovementForm productId={productId} variantId={variant.id} onHand={current.on_hand} onDone={refresh} />
            </TabsContent>
          </Tabs>
        )}

        <div>
          <p className="mb-2 text-sm font-medium">History</p>
          <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
            {movements.error && !movements.data ? (
              <ErrorState error={movements.error} onRetry={movements.reload} />
            ) : !movements.data ? (
              <LoadingState />
            ) : movements.data.data.length === 0 ? (
              <EmptyState title="No stock movements yet" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>On hand</TableHead>
                        <TableHead>Held</TableHead>
                        <TableHead>By</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements.data.data.map((m, index) => (
                        <TableRow key={`${m.created_at}-${index}`}>
                          <TableCell className="whitespace-nowrap">{formatDateTime(m.created_at)}</TableCell>
                          <TableCell>{MOVEMENT_LABELS[m.type] ?? humanize(m.type)}</TableCell>
                          <TableCell className={change(m) < 0 ? "text-destructive" : "text-success"}>
                            {change(m) > 0 ? `+${change(m)}` : change(m)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {m.on_hand_before} → {m.on_hand_after}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {m.reserved_before} → {m.reserved_after}
                          </TableCell>
                          <TableCell>{m.created_by?.name ?? "System"}</TableCell>
                          <TableCell className="max-w-48 truncate" title={m.note ?? undefined}>
                            {m.note ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Pagination meta={movements.data.meta} onPage={setPage} />
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The signed change. The API's `quantity` is unsigned (an adjustment of -2 reads 2), so the sign
 * comes from the figures: on hand for most types, held stock for reservations and releases.
 */
function change(m: InventoryMovement): number {
  const onHand = m.on_hand_after - m.on_hand_before;
  return onHand !== 0 ? onHand : m.reserved_after - m.reserved_before;
}

function Figure({ label, value, tone }: { label: string; value: number | undefined; tone?: "danger" | "warning" }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          tone === "danger"
            ? "text-lg font-semibold text-destructive"
            : tone === "warning"
              ? "text-lg font-semibold text-on-tertiary-fixed"
              : "text-lg font-semibold"
        }
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

/** A 409 means the stock moved since it was read (an order, another tab): reload and retry. */
function conflict(error: unknown, onDone: () => void): boolean {
  if (error instanceof ApiError && error.status === 409) {
    toast.error("The stock changed in the meantime. The figures have been reloaded; check them and try again.");
    onDone();
    return true;
  }
  return false;
}

const COUNT_FIELDS = ["on_hand", "low_stock_threshold", "note"] as const;

function CountForm({
  productId,
  variantId,
  inventory,
  onDone,
}: {
  productId: string;
  variantId: string;
  inventory: Inventory;
  onDone: () => void;
}) {
  const form = useForm<StockValues>({
    resolver: zodResolver(stockSchema),
    values: { on_hand: String(inventory.on_hand), low_stock_threshold: String(inventory.low_stock_threshold), note: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await setInventory(productId, variantId, {
        on_hand: Number(values.on_hand),
        // Written only if nobody changed the stock since we read it.
        expected_on_hand: inventory.on_hand,
        low_stock_threshold: Number(values.low_stock_threshold),
        note: nullable(values.note),
      });
      toast.success("Stock saved.");
      onDone();
    } catch (error) {
      if (!conflict(error, onDone)) handleFormError(error, form.setError, COUNT_FIELDS);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-[8rem_8rem_1fr_auto] sm:items-start">
      <Field label="Units on hand" htmlFor="s-on-hand" error={errors.on_hand?.message}>
        <Input id="s-on-hand" inputMode="numeric" aria-invalid={Boolean(errors.on_hand)} {...form.register("on_hand")} />
      </Field>
      <Field label="Alert at" htmlFor="s-threshold" error={errors.low_stock_threshold?.message}>
        <Input id="s-threshold" inputMode="numeric" aria-invalid={Boolean(errors.low_stock_threshold)} {...form.register("low_stock_threshold")} />
      </Field>
      <Field label="Note (optional)" htmlFor="s-note" error={errors.note?.message}>
        <Input id="s-note" maxLength={500} placeholder="Stock count" {...form.register("note")} />
      </Field>
      <Button type="submit" className="sm:mt-5.5" disabled={isSubmitting}>
        {isSubmitting && <Loader2Icon className="animate-spin" />}
        Save
      </Button>
      <p className="text-xs text-muted-foreground sm:col-span-4">
        Count what is physically on your shelf, including units held for checkouts. The difference is recorded as an adjustment.
      </p>
    </form>
  );
}

const MOVEMENT_FIELDS = ["type", "quantity", "note"] as const;

function MovementForm({
  productId,
  variantId,
  onHand,
  onDone,
}: {
  productId: string;
  variantId: string;
  onHand: number;
  onDone: () => void;
}) {
  const form = useForm<MovementValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: { type: "purchase", quantity: "", note: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const type = useWatch({ control: form.control, name: "type" });

  const submit = form.handleSubmit(async (values) => {
    try {
      await recordMovement(productId, variantId, {
        type: values.type,
        quantity: Number(values.quantity),
        expected_on_hand: onHand,
        note: nullable(values.note),
      });
      toast.success(values.type === "purchase" ? "Stock received." : "Stock adjusted.");
      form.reset({ type: values.type, quantity: "", note: "" });
      onDone();
    } catch (error) {
      if (!conflict(error, onDone)) handleFormError(error, form.setError, MOVEMENT_FIELDS);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-[10rem_8rem_1fr_auto] sm:items-start">
      <Field label="Movement" htmlFor="m-type" error={errors.type?.message}>
        <NativeSelect id="m-type" {...form.register("type")}>
          <option value="purchase">Stock received</option>
          <option value="adjustment">Adjustment (±)</option>
        </NativeSelect>
      </Field>
      <Field label="Quantity" htmlFor="m-qty" error={errors.quantity?.message}>
        <Input
          id="m-qty"
          inputMode="numeric"
          placeholder={type === "purchase" ? "10" : "-2"}
          aria-invalid={Boolean(errors.quantity)}
          {...form.register("quantity")}
        />
      </Field>
      <Field label={type === "adjustment" ? "Reason" : "Note (optional)"} htmlFor="m-note" error={errors.note?.message}>
        <Input
          id="m-note"
          maxLength={500}
          placeholder={type === "adjustment" ? "e.g. 2 damaged in storage" : "e.g. Supplier delivery"}
          aria-invalid={Boolean(errors.note)}
          {...form.register("note")}
        />
      </Field>
      <Button type="submit" className="sm:mt-5.5" disabled={isSubmitting}>
        {isSubmitting && <Loader2Icon className="animate-spin" />}
        Record
      </Button>
      <p className="text-xs text-muted-foreground sm:col-span-4">
        {type === "purchase"
          ? "Adds the units to the stock on hand."
          : "Use a negative number to take units away (damaged, lost) and a positive one to add found units."}
      </p>
    </form>
  );
}
