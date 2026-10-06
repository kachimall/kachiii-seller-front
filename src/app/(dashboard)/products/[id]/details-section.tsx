"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PencilIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { DetailList } from "@/components/common/detail-list";
import { Section } from "@/components/common/section";
import { Button } from "@/components/ui/button";
import { updateProduct } from "@/lib/api/products";
import { crumbName, humanize } from "@/lib/format";
import { handleFormError } from "@/lib/forms";
import { productDetailsSchema, type ProductDetailsValues } from "@/lib/schemas/products";
import type { VendorProduct } from "@/types/products";
import { DETAIL_FIELDS, DetailsFields } from "../_components/details-fields";
import type { ProductSectionProps } from "./product-detail";

function toValues(product: VendorProduct): ProductDetailsValues {
  return {
    name: product.name,
    description: product.description ?? "",
    category_id: product.category?.id ?? "",
    brand_id: product.brand?.id ?? "",
    tax_class: product.tax_class ?? "standard",
    ships_from_provider: product.ships_from_provider ?? false,
    metadata: product.metadata ?? [],
  };
}

export function DetailsSection({ product, onChange, canManage }: ProductSectionProps) {
  const [editing, setEditing] = useState(false);

  return (
    <Section
      title="Details"
      actions={
        canManage &&
        !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <PencilIcon /> Edit
          </Button>
        )
      }
    >
      {editing ? (
        <EditForm
          product={product}
          onCancel={() => setEditing(false)}
          onSaved={(updated) => {
            onChange(updated);
            setEditing(false);
          }}
        />
      ) : (
        <div className="grid gap-5">
          <DetailList
            items={[
              {
                label: "Category",
                value: product.category?.breadcrumbs.map(crumbName).join(" › ") || product.category?.name,
                wide: true,
              },
              { label: "Brand", value: product.brand?.name ?? "No brand" },
              { label: "Tax class", value: humanize(product.tax_class) },
              { label: "Fulfilment", value: product.ships_from_provider ? "Delivery provider ships it" : "You ship it" },
            ]}
          />
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Description</p>
            <p className="mt-1 text-sm whitespace-pre-line">{product.description || "—"}</p>
          </div>
          {product.metadata && product.metadata.length > 0 && (
            <DetailList items={product.metadata.map((m) => ({ label: m.name, value: m.value }))} />
          )}
        </div>
      )}
    </Section>
  );
}

function EditForm({
  product,
  onCancel,
  onSaved,
}: {
  product: VendorProduct;
  onCancel: () => void;
  onSaved: (product: VendorProduct) => void;
}) {
  const form = useForm<ProductDetailsValues>({ resolver: zodResolver(productDetailsSchema), defaultValues: toValues(product) });
  const { isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      const updated = await updateProduct(product.id, {
        name: values.name.trim(),
        description: values.description.trim(),
        category_id: values.category_id,
        brand_id: values.brand_id || null,
        tax_class: values.tax_class,
        ships_from_provider: values.ships_from_provider,
        metadata: values.metadata.map((m) => ({ name: m.name.trim(), value: m.value.trim() })),
      });
      toast.success("Product saved.");
      onSaved(updated);
    } catch (error) {
      handleFormError(error, form.setError, DETAIL_FIELDS);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <DetailsFields form={form} current={{ category: product.category, brand: product.brand }} idPrefix="edit" />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2Icon className="animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  );
}
