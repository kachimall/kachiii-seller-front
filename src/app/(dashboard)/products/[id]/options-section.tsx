"use client";

import { Loader2Icon, PencilIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Section } from "@/components/common/section";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useApi } from "@/hooks/use-api";
import { ApiError, errorMessage } from "@/lib/api/client";
import { deleteOptionValue, listAttributes, updateOption, updateOptionValue } from "@/lib/api/products";
import type { ProductOption } from "@/types/api";
import type { ProductSectionProps } from "./product-detail";

type OptionValue = ProductOption["values"][number];

type Editing =
  | { kind: "option"; option: ProductOption }
  | { kind: "value"; option: ProductOption; value: OptionValue };

/**
 * The set of options is fixed when the product is created; here they can be renamed, and values
 * renamed or deleted. New values come from adding a variant.
 */
export function OptionsSection({ product, onReload, canManage }: ProductSectionProps) {
  const options = product.options ?? [];
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<{ option: ProductOption; value: OptionValue } | null>(null);

  // A value stays in use while any variant points at it, archived ones included.
  function inUse(option: ProductOption, value: OptionValue): boolean {
    const target = value.value.toLowerCase();
    return (product.variants ?? []).some((v) => {
      if (typeof v.options !== "object" || v.options === null) return false;
      const chosen = Object.entries(v.options).find(([name]) => name.toLowerCase() === option.name.toLowerCase())?.[1];
      return chosen?.toLowerCase() === target;
    });
  }

  async function remove() {
    if (!deleting) return false;
    try {
      await deleteOptionValue(product.id, deleting.option.id, deleting.value.id);
      toast.success("Value deleted.");
      onReload();
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  }

  if (options.length === 0) {
    return (
      <Section title="Options">
        <p className="text-sm text-muted-foreground">This product has no options, so it is sold as a single variant.</p>
      </Section>
    );
  }

  return (
    <Section title="Options">
      <div className="grid gap-4">
        {options.map((option) => (
          <div key={option.id} className="grid gap-2">
            <div className="flex items-center gap-1">
              <p className="text-sm font-medium">{option.name}</p>
              {canManage && (
                <Button size="icon-xs" variant="ghost" aria-label={`Rename ${option.name}`} onClick={() => setEditing({ kind: "option", option })}>
                  <PencilIcon />
                </Button>
              )}
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {option.values.map((value) => {
                const used = inUse(option, value);
                return (
                  <li key={value.id} className="inline-flex items-center gap-0.5 rounded-md bg-muted py-0.5 pr-0.5 pl-2 text-sm">
                    {value.value}
                    {canManage && (
                      <>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={`Rename ${value.value}`}
                          onClick={() => setEditing({ kind: "value", option, value })}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={`Delete ${value.value}`}
                          title={used ? "A variant uses this value, so it cannot be deleted." : undefined}
                          disabled={used}
                          onClick={() => setDeleting({ option, value })}
                        >
                          <XIcon />
                        </Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {canManage && (
          <p className="text-xs text-muted-foreground">
            Add a new value by adding a variant that uses it. A value can be deleted once no variant uses it, archived ones
            included.
          </p>
        )}
      </div>

      {editing && (
        <RenameDialog
          editing={editing}
          onClose={() => setEditing(null)}
          onSave={async (text) => {
            if (editing.kind === "option") await updateOption(product.id, editing.option.id, { name: text });
            else await updateOptionValue(product.id, editing.option.id, editing.value.id, { value: text });
            toast.success("Renamed.");
            onReload();
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete “${deleting.value.value}”?` : ""}
        description="The value is removed from this option."
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
      />
    </Section>
  );
}

function RenameDialog({ editing, onClose, onSave }: { editing: Editing; onClose: () => void; onSave: (text: string) => Promise<void> }) {
  const isOption = editing.kind === "option";
  const initial = isOption ? editing.option.name : editing.value.value;
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const attributes = useApi(isOption ? "vendor:attributes" : null, listAttributes);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (value === "") return setError(isOption ? "Choose an attribute." : "Enter a value.");
    if (value.length > 30) return setError("Keep it under 30 characters.");
    if (value === initial) return onClose();
    setPending(true);
    setError(undefined);
    try {
      await onSave(value);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? (err.firstError(isOption ? "name" : "value") ?? errorMessage(err)) : errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{isOption ? "Rename option" : `Rename ${editing.option.name} value`}</DialogTitle>
            <DialogDescription>
              {isOption
                ? "Options are named after KACHI's product attributes."
                : "Every variant with this value shows the new name."}
            </DialogDescription>
          </DialogHeader>
          <Field label={isOption ? "Attribute" : "Value"} htmlFor="rename" error={error}>
            {isOption ? (
              <NativeSelect id="rename" value={text} onChange={(e) => setText(e.target.value)} aria-invalid={Boolean(error)}>
                {!(attributes.data ?? []).some((a) => a.name === initial) && <option value={initial}>{initial}</option>}
                {(attributes.data ?? []).map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <Input id="rename" value={text} maxLength={30} onChange={(e) => setText(e.target.value)} aria-invalid={Boolean(error)} autoFocus />
            )}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
