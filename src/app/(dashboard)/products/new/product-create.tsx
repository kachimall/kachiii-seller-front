"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { ForbiddenState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { ApiError, errorMessage } from "@/lib/api/client";
import { createProduct, listAttributes } from "@/lib/api/products";
import {
  intOrNull,
  MAX_OPTION_VALUES,
  MAX_OPTIONS,
  MAX_VARIANTS,
  moneyOrNull,
  productCreateSchema,
  rowOf,
  sellerSku,
  variantCombos,
  type Combo,
  type ProductCreateValues,
  type ProductDetailsValues,
} from "@/lib/schemas/products";
import type { CreateProductBody } from "@/types/products";
import { SuspendedNotice, useProductAccess } from "../_components/access";
import { DETAIL_FIELDS, DetailsFields } from "../_components/details-fields";
import { TagInput } from "../_components/tag-input";

type CreateForm = UseFormReturn<ProductCreateValues>;

const DEFAULTS: ProductCreateValues = {
  name: "",
  description: "",
  category_id: "",
  brand_id: "",
  tax_class: "standard",
  ships_from_provider: false,
  metadata: [],
  options: [],
  variants: {},
  length_mm: "",
  width_mm: "",
  height_mm: "",
  low_stock_threshold: "",
};

export function ProductCreate() {
  const access = useProductAccess();
  const router = useRouter();
  const form = useForm<ProductCreateValues>({ resolver: zodResolver(productCreateSchema), defaultValues: DEFAULTS });
  const { isSubmitting } = form.formState;

  if (!access.canView) return <ForbiddenState />;
  if (!access.canManage) {
    return (
      <>
        <PageHeader back={{ href: "/products", label: "Products" }} title="New product" />
        {access.suspended ? <SuspendedNotice /> : <ForbiddenState message="Your account cannot create products." />}
      </>
    );
  }

  const submit = form.handleSubmit(async (values) => {
    const combos = variantCombos(values.options).filter((c) => rowOf(values.variants, c.key).include);
    const body: CreateProductBody = {
      name: values.name.trim(),
      description: values.description.trim(),
      category_id: values.category_id,
      brand_id: values.brand_id || null,
      tax_class: values.tax_class,
      ships_from_provider: values.ships_from_provider,
      metadata: values.metadata.map((m) => ({ name: m.name.trim(), value: m.value.trim() })),
      options: values.options.map((o) => ({ name: o.name, values: o.values.map((v) => v.trim()) })),
      variants: combos.map((combo) => {
        const row = rowOf(values.variants, combo.key);
        return {
          options: combo.options,
          seller_sku: sellerSku(row.seller_sku),
          price: moneyOrNull(row.price) ?? "",
          sale_price: moneyOrNull(row.sale_price),
          stock: Number(row.stock),
          weight_grams: Number(row.weight_grams),
          length_mm: intOrNull(values.length_mm),
          width_mm: intOrNull(values.width_mm),
          height_mm: intOrNull(values.height_mm),
          low_stock_threshold: intOrNull(values.low_stock_threshold),
        };
      }),
    };

    try {
      const product = await createProduct(body);
      toast.success("Product created as a draft. Add images, then submit it for review.");
      router.push(`/products/${product.id}`);
    } catch (error) {
      showServerErrors(error, form, combos);
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        back={{ href: "/products", label: "Products" }}
        title="New product"
        description="The product is saved as a draft. Add images on the next page, then submit it for review."
      />

      <div className="grid gap-6">
        <Section title="Basics">
          {/* The create form holds every details field under the same names. */}
          <DetailsFields form={form as unknown as UseFormReturn<ProductDetailsValues>} idPrefix="new" />
        </Section>

        <OptionsSection form={form} />
        <VariantsSection form={form} />

        <Section title="Shipping and stock alerts">
          <ShippingFields form={form} />
        </Section>

        <div className="flex flex-wrap justify-end gap-2">
          <ButtonLink href="/products">Cancel</ButtonLink>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2Icon className="animate-spin" />}
            Create product
          </Button>
        </div>
      </div>
    </form>
  );
}

/** 422 errors next to their fields; variants.N.* is mapped back to the row it came from. */
function showServerErrors(error: unknown, form: CreateForm, combos: Combo[]) {
  if (!(error instanceof ApiError) || error.status !== 422) {
    toast.error(errorMessage(error));
    return;
  }
  const loose: string[] = [];
  for (const [field, messages] of Object.entries(error.errors)) {
    const message = messages[0];
    const variant = /^variants\.(\d+)\.(\w+)/.exec(field);
    const option = /^options\.(\d+)\.(name|values)/.exec(field);
    const top = field.split(".")[0];
    if (variant && combos[Number(variant[1])] && ["price", "sale_price", "stock", "weight_grams", "seller_sku"].includes(variant[2])) {
      const key = combos[Number(variant[1])].key;
      form.setError(`variants.${key}.${variant[2] as "price"}`, { type: "server", message });
    } else if (option) {
      form.setError(`options.${Number(option[1])}.${option[2] as "name" | "values"}`, { type: "server", message });
    } else if ((DETAIL_FIELDS as readonly string[]).includes(top)) {
      form.setError(top as (typeof DETAIL_FIELDS)[number], { type: "server", message });
    } else if (["length_mm", "width_mm", "height_mm", "low_stock_threshold"].includes(field.split(".").pop() ?? "")) {
      form.setError(field.split(".").pop() as "length_mm", { type: "server", message });
    } else {
      loose.push(message);
    }
  }
  if (loose.length > 0) toast.error(loose[0]);
  else toast.error("Check the highlighted fields.");
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

function OptionsSection({ form }: { form: CreateForm }) {
  const { control, register, formState } = form;
  const { errors } = formState;
  const options = useFieldArray({ control, name: "options" });
  const attributes = useApi("vendor:attributes", listAttributes);
  const chosen = useWatch({ control, name: "options" });

  return (
    <Section
      title="Options"
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={options.fields.length >= MAX_OPTIONS}
          onClick={() => options.append({ name: "", values: [] })}
        >
          <PlusIcon /> Add option
        </Button>
      }
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Options are how the variants differ, e.g. Size with S, M and L. Use up to {MAX_OPTIONS}. Leave this empty for a product
        that comes in one version. The options themselves cannot be changed later, but you can rename values and add new ones
        by adding variants.
      </p>
      {options.fields.length === 0 ? (
        <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">No options: the product has a single variant.</p>
      ) : (
        <div className="grid gap-4">
          {options.fields.map((f, index) => {
            const err = errors.options?.[index];
            const taken = (chosen ?? []).filter((_, i) => i !== index).map((o) => o.name.toLowerCase());
            return (
              <div key={f.id} className="grid gap-3 rounded-lg p-4 ring-1 ring-foreground/10 sm:grid-cols-[12rem_1fr_auto] sm:items-start">
                <Field label="Attribute" htmlFor={`opt-${index}`} error={err?.name?.message}>
                  <NativeSelect id={`opt-${index}`} aria-invalid={Boolean(err?.name)} {...register(`options.${index}.name`)}>
                    <option value="">Choose…</option>
                    {(attributes.data ?? []).map((a) => (
                      <option key={a.id} value={a.name} disabled={taken.includes(a.name.toLowerCase())}>
                        {a.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field
                  label="Values"
                  htmlFor={`opt-${index}-values`}
                  error={err?.values?.message ?? err?.values?.root?.message ?? err?.values?.[0]?.message}
                  hint={`Type a value and press Enter. Up to ${MAX_OPTION_VALUES}.`}
                >
                  <Controller
                    control={control}
                    name={`options.${index}.values`}
                    render={({ field }) => (
                      <TagInput
                        id={`opt-${index}-values`}
                        value={field.value}
                        onChange={field.onChange}
                        max={MAX_OPTION_VALUES}
                        placeholder="e.g. S, M, L"
                        invalid={Boolean(err?.values)}
                      />
                    )}
                  />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="sm:mt-6"
                  aria-label="Remove option"
                  onClick={() => options.remove(index)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            );
          })}
        </div>
      )}
      {attributes.error !== undefined && (
        <p className="mt-2 text-xs text-destructive">Could not load the attribute list: {errorMessage(attributes.error)}</p>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Variants: one row per combination of option values
// ---------------------------------------------------------------------------

const FILL_FIELDS = [
  { name: "price", label: "Price (AED)", placeholder: "49.90", mode: "decimal" },
  { name: "sale_price", label: "Sale price", placeholder: "Optional", mode: "decimal" },
  { name: "stock", label: "Stock", placeholder: "10", mode: "numeric" },
  { name: "weight_grams", label: "Weight (g)", placeholder: "500", mode: "numeric" },
] as const;

type FillField = (typeof FILL_FIELDS)[number]["name"];

function VariantsSection({ form }: { form: CreateForm }) {
  const { control, register, formState, setValue, getValues } = form;
  const { errors } = formState;
  const options = useWatch({ control, name: "options" });
  const rows = useWatch({ control, name: "variants" });
  const combos = variantCombos(options ?? []);
  const [fill, setFill] = useState<Record<FillField, string>>({ price: "", sale_price: "", stock: "", weight_grams: "" });
  const includedCount = combos.filter((c) => rowOf(rows ?? {}, c.key).include).length;
  // An issue on the whole list ("include at least one") sits on variants itself; in a record
  // type, `message` would read as a row key, hence the cast.
  const listError = (errors.variants as { message?: string } | undefined)?.message;

  function applyToAll() {
    const all = getValues("variants");
    for (const combo of combos) {
      if (!rowOf(all, combo.key).include) continue;
      for (const { name } of FILL_FIELDS) {
        if (fill[name].trim() !== "") setValue(`variants.${combo.key}.${name}`, fill[name].trim(), { shouldDirty: true });
      }
    }
    if (formState.isSubmitted) void form.trigger("variants");
  }

  return (
    <Section title={combos.length > 1 ? `Variants (${includedCount} of ${combos.length})` : "Price and stock"} flush>
      <div className="grid gap-3 border-b p-5">
        <p className="text-sm text-muted-foreground">
          {combos.length > 1
            ? `Every combination of the option values is a variant. Untick the ones you do not sell. Up to ${MAX_VARIANTS} variants.`
            : "Set the price and opening stock. KACHI assigns the SKU; add your own code as the seller SKU if you like."}
        </p>
        {combos.length > 1 && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/50 p-3">
            {FILL_FIELDS.map((f) => (
              <Field key={f.name} label={f.label} htmlFor={`fill-${f.name}`} className="w-28">
                <Input
                  id={`fill-${f.name}`}
                  inputMode={f.mode}
                  placeholder={f.placeholder}
                  value={fill[f.name]}
                  onChange={(e) => setFill((prev) => ({ ...prev, [f.name]: e.target.value }))}
                />
              </Field>
            ))}
            <Button type="button" variant="secondary" onClick={applyToAll}>
              Apply to all
            </Button>
          </div>
        )}
        {listError && <p className="text-sm text-destructive">{listError}</p>}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {combos.length > 1 && <TableHead className="w-10 pl-5" />}
              <TableHead className={combos.length > 1 ? undefined : "pl-5"}>Variant</TableHead>
              <TableHead>Price (AED)</TableHead>
              <TableHead>Sale price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Weight (g)</TableHead>
              <TableHead className="pr-5">Seller SKU</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {combos.map((combo) => {
              const row = rowOf(rows ?? {}, combo.key);
              const err = errors.variants?.[combo.key];
              const cell = (name: FillField | "seller_sku", props: React.ComponentProps<typeof Input>) => (
                <div className="grid gap-1">
                  <Input
                    aria-label={`${combo.label} ${name.replace("_", " ")}`}
                    aria-invalid={Boolean(err?.[name])}
                    disabled={!row.include}
                    className="min-w-20"
                    {...props}
                    {...register(`variants.${combo.key}.${name}`)}
                  />
                  {err?.[name] && <p className="text-xs text-destructive">{err[name]?.message}</p>}
                </div>
              );
              return (
                <TableRow key={combo.key} className={row.include ? undefined : "opacity-50"}>
                  {combos.length > 1 && (
                    <TableCell className="pl-5 align-top">
                      <Controller
                        control={control}
                        name={`variants.${combo.key}.include`}
                        defaultValue={true}
                        render={({ field }) => (
                          <Checkbox
                            className="mt-2"
                            aria-label={`Sell ${combo.label}`}
                            checked={field.value ?? true}
                            onCheckedChange={(checked) => field.onChange(checked === true)}
                          />
                        )}
                      />
                    </TableCell>
                  )}
                  <TableCell className={combos.length > 1 ? "align-top font-medium" : "pl-5 align-top font-medium"}>
                    <span className="mt-1.5 block whitespace-nowrap">{combo.label}</span>
                  </TableCell>
                  <TableCell className="align-top">{cell("price", { inputMode: "decimal", placeholder: "49.90" })}</TableCell>
                  <TableCell className="align-top">{cell("sale_price", { inputMode: "decimal", placeholder: "—" })}</TableCell>
                  <TableCell className="align-top">{cell("stock", { inputMode: "numeric", placeholder: "0" })}</TableCell>
                  <TableCell className="align-top">{cell("weight_grams", { inputMode: "numeric", placeholder: "500" })}</TableCell>
                  <TableCell className="pr-5 align-top">
                    {cell("seller_sku", { placeholder: "Optional", maxLength: 64, className: "min-w-28 uppercase" })}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}

function ShippingFields({ form }: { form: CreateForm }) {
  const { register, formState } = form;
  const { errors } = formState;
  const dims = ["length_mm", "width_mm", "height_mm"] as const;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Package size in mm (optional)</span>
        <div className="grid grid-cols-3 gap-2">
          {dims.map((d) => (
            <div key={d} className="grid gap-1">
              <Input
                inputMode="numeric"
                placeholder={d === "length_mm" ? "Length" : d === "width_mm" ? "Width" : "Height"}
                aria-label={d.replace("_mm", "")}
                aria-invalid={Boolean(errors[d])}
                {...register(d)}
              />
              {errors[d] && <p className="text-xs text-destructive">{errors[d]?.message}</p>}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Applies to every variant; you can change it per variant later. All three or none.</p>
      </div>
      <Field
        label="Low-stock alert at (optional)"
        htmlFor="new-threshold"
        error={errors.low_stock_threshold?.message}
        hint="A variant shows under Low stock when its stock falls to this number."
      >
        <Input id="new-threshold" inputMode="numeric" placeholder="5" {...register("low_stock_threshold")} />
      </Field>
    </div>
  );
}
