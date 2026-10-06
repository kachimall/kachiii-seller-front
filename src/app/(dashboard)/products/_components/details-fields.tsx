"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { Controller, useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useBrandOptions, useCategoryOptions } from "@/hooks/use-options";
import { humanize } from "@/lib/format";
import { TAX_CLASSES, type ProductDetailsValues } from "@/lib/schemas/products";

export const DETAIL_FIELDS = [
  "name",
  "description",
  "category_id",
  "brand_id",
  "tax_class",
  "ships_from_provider",
  "metadata",
] as const;

/** Non-breaking spaces: <option> text collapses ordinary ones. */
const INDENT = String.fromCharCode(160).repeat(3);

const TAX_HINTS: Record<(typeof TAX_CLASSES)[number], string> = {
  standard: "Standard VAT applies.",
  zero_rated: "VAT applies at 0%.",
  exempt: "Outside VAT.",
};

/**
 * Name, description, category, brand, tax class, fulfilment and extra details: shared by the
 * create form and the edit form. `current` keeps a category or brand that has since been
 * deactivated selectable (the API lets a product keep it).
 */
export function DetailsFields({
  form,
  current,
  idPrefix = "p",
}: {
  form: UseFormReturn<ProductDetailsValues>;
  current?: { category?: { id: string; name: string } | null; brand?: { id: string; name: string } | null };
  idPrefix?: string;
}) {
  const { register, control, formState } = form;
  const { errors } = formState;
  const categories = useCategoryOptions();
  const brands = useBrandOptions();
  const metadata = useFieldArray({ control, name: "metadata" });
  const taxClass = useWatch({ control, name: "tax_class" });
  const id = (name: string) => `${idPrefix}-${name}`;

  const categoryMissing = current?.category && !categories.some((c) => c.value === current.category?.id);
  const brandMissing = current?.brand && !brands.some((b) => b.value === current.brand?.id);

  return (
    <div className="grid gap-5">
      <Field label="Product name" htmlFor={id("name")} error={errors.name?.message}>
        <Input id={id("name")} maxLength={200} aria-invalid={Boolean(errors.name)} {...register("name")} />
      </Field>

      <Field
        label="Description"
        htmlFor={id("description")}
        error={errors.description?.message}
        hint="What it is, what it is made of, sizes and care. At least 20 characters."
      >
        <Textarea id={id("description")} rows={6} maxLength={10000} aria-invalid={Boolean(errors.description)} {...register("description")} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Category"
          htmlFor={id("category")}
          error={errors.category_id?.message}
          hint="Pick the most specific category; groups that have subcategories cannot be chosen."
        >
          {/* Controlled, so the saved value shows once the options arrive from the shop API. */}
          <Controller
            control={control}
            name="category_id"
            render={({ field }) => (
              <NativeSelect id={id("category")} aria-invalid={Boolean(errors.category_id)} {...field}>
                <option value="">Choose a category…</option>
                {categoryMissing && current?.category && <option value={current.category.id}>{current.category.name}</option>}
                {categories.map((c) => (
                  <option key={c.value} value={c.value} disabled={(c.category.children?.length ?? 0) > 0}>
                    {INDENT.repeat(c.depth)}
                    {c.category.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          />
        </Field>

        <Field label="Brand (optional)" htmlFor={id("brand")} error={errors.brand_id?.message}>
          <Controller
            control={control}
            name="brand_id"
            render={({ field }) => (
              <NativeSelect id={id("brand")} aria-invalid={Boolean(errors.brand_id)} {...field}>
                <option value="">No brand</option>
                {brandMissing && current?.brand && <option value={current.brand.id}>{current.brand.name}</option>}
                {brands.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          />
        </Field>

        <Field label="Tax class" htmlFor={id("tax")} error={errors.tax_class?.message} hint={TAX_HINTS[taxClass]}>
          <NativeSelect id={id("tax")} {...register("tax_class")}>
            {TAX_CLASSES.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Fulfilment</span>
          <Controller
            control={control}
            name="ships_from_provider"
            render={({ field }) => (
              <Label className="font-normal">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                Stock is kept with the delivery provider, who packs and ships it
              </Label>
            )}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Product details (optional)</p>
            <p className="text-xs text-muted-foreground">Specifications shown on the product page, e.g. Material: Cotton.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={metadata.fields.length >= 30}
            onClick={() => metadata.append({ name: "", value: "" })}
          >
            <PlusIcon /> Add detail
          </Button>
        </div>
        {metadata.fields.map((f, index) => {
          const err = errors.metadata?.[index];
          return (
            <div key={f.id} className="grid grid-cols-[1fr_1.5fr_auto] items-start gap-2">
              <div className="grid gap-1">
                <Input placeholder="Name" maxLength={50} aria-label="Detail name" aria-invalid={Boolean(err?.name)} {...register(`metadata.${index}.name`)} />
                {err?.name && <p className="text-xs text-destructive">{err.name.message}</p>}
              </div>
              <div className="grid gap-1">
                <Input placeholder="Value" maxLength={255} aria-label="Detail value" aria-invalid={Boolean(err?.value)} {...register(`metadata.${index}.value`)} />
                {err?.value && <p className="text-xs text-destructive">{err.value.message}</p>}
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Remove detail" onClick={() => metadata.remove(index)}>
                <Trash2Icon />
              </Button>
            </div>
          );
        })}
        {errors.metadata?.message && <p className="text-xs text-destructive">{errors.metadata.message}</p>}
      </div>
    </div>
  );
}
