"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useForm, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { addVariant, updateVariant } from "@/lib/api/products";
import { formatOptions } from "@/lib/format";
import { handleFormError } from "@/lib/forms";
import {
  editVariantSchema,
  intOrNull,
  moneyOrNull,
  newVariantSchema,
  sellerSku,
  type EditVariantValues,
  type NewVariantValues,
} from "@/lib/schemas/products";
import type { ProductVariant } from "@/types/api";
import type { VendorProduct } from "@/types/products";

const NEW_FIELDS = [
  "options",
  "seller_sku",
  "price",
  "sale_price",
  "weight_grams",
  "length_mm",
  "width_mm",
  "height_mm",
  "stock",
  "low_stock_threshold",
] as const;

const EDIT_FIELDS = [
  "seller_sku",
  "price",
  "sale_price",
  "weight_grams",
  "length_mm",
  "width_mm",
  "height_mm",
  "status",
  "image_id",
] as const;

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

/** The fields both dialogs share: SKU, prices, weight and package size. */
type SharedValues = Pick<NewVariantValues, "seller_sku" | "price" | "sale_price" | "weight_grams" | "length_mm" | "width_mm" | "height_mm">;

function SharedFields({
  register,
  errors,
  currency,
}: {
  register: UseFormRegister<SharedValues>;
  errors: FieldErrors<SharedValues>;
  currency: string;
}) {
  const dims = ["length_mm", "width_mm", "height_mm"] as const;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Price (${currency})`} htmlFor="v-price" error={errors.price?.message}>
          <Input id="v-price" inputMode="decimal" placeholder="49.90" aria-invalid={Boolean(errors.price)} {...register("price")} />
        </Field>
        <Field label="Sale price (optional)" htmlFor="v-sale" error={errors.sale_price?.message} hint="Lower than the price.">
          <Input id="v-sale" inputMode="decimal" aria-invalid={Boolean(errors.sale_price)} {...register("sale_price")} />
        </Field>
        <Field label="Weight (g)" htmlFor="v-weight" error={errors.weight_grams?.message} hint="Packed weight, for shipping.">
          <Input id="v-weight" inputMode="numeric" aria-invalid={Boolean(errors.weight_grams)} {...register("weight_grams")} />
        </Field>
        <Field label="Seller SKU (optional)" htmlFor="v-sku" error={errors.seller_sku?.message} hint="Your own code. KACHI assigns the SKU.">
          <Input id="v-sku" maxLength={64} className="uppercase" aria-invalid={Boolean(errors.seller_sku)} {...register("seller_sku")} />
        </Field>
      </div>
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
      </div>
    </>
  );
}

function sharedBody(values: SharedValues) {
  return {
    seller_sku: sellerSku(values.seller_sku),
    price: moneyOrNull(values.price) ?? "",
    sale_price: moneyOrNull(values.sale_price),
    weight_grams: Number(values.weight_grams),
    // Sent together (null for none): the API keeps all three or none.
    length_mm: intOrNull(values.length_mm),
    width_mm: intOrNull(values.width_mm),
    height_mm: intOrNull(values.height_mm),
  };
}

// ---------------------------------------------------------------------------
// Add
// ---------------------------------------------------------------------------

export function AddVariantDialog({ product, onClose, onSaved }: { product: VendorProduct; onClose: () => void; onSaved: () => void }) {
  const options = product.options ?? [];
  // Start from the first live variant's shipping data: usually the same across variants.
  const template = (product.variants ?? []).find((v) => v.status !== "archived");
  const form = useForm<NewVariantValues>({
    resolver: zodResolver(newVariantSchema),
    defaultValues: {
      options: options.map(() => ""),
      seller_sku: "",
      price: template?.price ?? "",
      sale_price: "",
      weight_grams: str(template?.weight_grams),
      length_mm: str(template?.dimensions_mm?.length),
      width_mm: str(template?.dimensions_mm?.width),
      height_mm: str(template?.dimensions_mm?.height),
      stock: "",
      low_stock_threshold: str(template?.inventory?.low_stock_threshold),
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await addVariant(product.id, {
        ...sharedBody(values),
        options: Object.fromEntries(options.map((o, i) => [o.name, values.options[i].trim()])),
        stock: Number(values.stock),
        low_stock_threshold: intOrNull(values.low_stock_threshold),
      });
      toast.success("Variant added.");
      onSaved();
      onClose();
    } catch (error) {
      handleFormError(error, form.setError, NEW_FIELDS);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Add variant</DialogTitle>
            <DialogDescription>
              {options.length > 0
                ? "Pick a value for each option, or type a new one to add it to the option."
                : "Set the price and opening stock."}
            </DialogDescription>
          </DialogHeader>

          {options.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {options.map((option, i) => (
                <Field key={option.id} label={option.name} htmlFor={`v-opt-${i}`} error={errors.options?.[i]?.message}>
                  <Input
                    id={`v-opt-${i}`}
                    list={`v-opt-${i}-values`}
                    maxLength={30}
                    autoComplete="off"
                    aria-invalid={Boolean(errors.options?.[i])}
                    {...form.register(`options.${i}`)}
                  />
                  <datalist id={`v-opt-${i}-values`}>
                    {option.values.map((v) => (
                      <option key={v.id} value={v.value} />
                    ))}
                  </datalist>
                </Field>
              ))}
              {errors.options?.message && <p className="text-xs text-destructive sm:col-span-2">{errors.options.message}</p>}
            </div>
          )}

          <SharedFields
            register={form.register as unknown as UseFormRegister<SharedValues>}
            errors={errors}
            currency={product.currency_code}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Opening stock" htmlFor="v-stock" error={errors.stock?.message}>
              <Input id="v-stock" inputMode="numeric" placeholder="0" aria-invalid={Boolean(errors.stock)} {...form.register("stock")} />
            </Field>
            <Field label="Low-stock alert at (optional)" htmlFor="v-threshold" error={errors.low_stock_threshold?.message}>
              <Input id="v-threshold" inputMode="numeric" aria-invalid={Boolean(errors.low_stock_threshold)} {...form.register("low_stock_threshold")} />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2Icon className="animate-spin" />}
              Add variant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------

export function EditVariantDialog({
  product,
  variant,
  onClose,
  onSaved,
}: {
  product: VendorProduct;
  variant: ProductVariant;
  onClose: () => void;
  onSaved: () => void;
}) {
  const images = (product.images ?? []).filter((i) => i.status === "ready" || i.id === variant.image_id);
  const form = useForm<EditVariantValues>({
    resolver: zodResolver(editVariantSchema),
    defaultValues: {
      seller_sku: variant.seller_sku ?? "",
      price: variant.price,
      sale_price: variant.sale_price ?? "",
      weight_grams: str(variant.weight_grams),
      length_mm: str(variant.dimensions_mm?.length),
      width_mm: str(variant.dimensions_mm?.width),
      height_mm: str(variant.dimensions_mm?.height),
      status: variant.status === "inactive" ? "inactive" : "active",
      image_id: variant.image_id ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await updateVariant(product.id, variant.id, {
        ...sharedBody(values),
        status: values.status,
        image_id: values.image_id || null,
      });
      toast.success("Variant saved.");
      onSaved();
      onClose();
    } catch (error) {
      handleFormError(error, form.setError, EDIT_FIELDS);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Edit {formatOptions(variant.options)}</DialogTitle>
            <DialogDescription>{variant.sku}. Change the stock from the Stock button.</DialogDescription>
          </DialogHeader>

          <SharedFields
            register={form.register as unknown as UseFormRegister<SharedValues>}
            errors={errors}
            currency={variant.currency_code}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Status"
              htmlFor="v-status"
              error={errors.status?.message}
              hint="Inactive variants stay on the product but cannot be bought."
            >
              <NativeSelect id="v-status" {...form.register("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </NativeSelect>
            </Field>
            <Field label="Image" htmlFor="v-image" error={errors.image_id?.message} hint="Shown when a shopper picks this variant.">
              <NativeSelect id="v-image" {...form.register("image_id")}>
                <option value="">Main image</option>
                {images.map((image) => (
                  <option key={image.id} value={image.id}>
                    {`Image ${(product.images ?? []).indexOf(image) + 1}${image.alt_text ? ` – ${image.alt_text}` : ""}`}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2Icon className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
