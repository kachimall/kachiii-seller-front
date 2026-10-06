"use client";

import { CheckCircle2Icon, CircleIcon, ExternalLinkIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DetailList } from "@/components/common/detail-list";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { AsyncContent, ForbiddenState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { errorMessage, SHOP_URL } from "@/lib/api/client";
import { archiveProduct, changeProductStatus, getProduct } from "@/lib/api/products";
import { formatDateTime, formatPriceRange } from "@/lib/format";
import type { VendorProduct } from "@/types/products";
import { SuspendedNotice, useProductAccess } from "../_components/access";
import { canArchive, STATUS_HINTS, statusActions, type StatusAction } from "../_components/status";
import { DetailsSection } from "./details-section";
import { ImagesSection } from "./images-section";
import { OptionsSection } from "./options-section";
import { VariantsSection } from "./variants-section";

export function ProductDetail({ id }: { id: string }) {
  const access = useProductAccess();
  const { data, error, loading, reload, mutate } = useApi(access.canView ? `vendor-product:${id}` : null, () => getProduct(id));

  if (!access.canView) return <ForbiddenState />;

  return (
    <AsyncContent data={data} error={error} loading={loading} onRetry={reload}>
      {(product) => <ProductView product={product} onChange={mutate} onReload={reload} />}
    </AsyncContent>
  );
}

export interface ProductSectionProps {
  product: VendorProduct;
  onChange: (product: VendorProduct) => void;
  onReload: () => void;
  canManage: boolean;
}

function ProductView({ product, onChange, onReload }: { product: VendorProduct; onChange: (p: VendorProduct) => void; onReload: () => void }) {
  const router = useRouter();
  const access = useProductAccess();
  const [action, setAction] = useState<StatusAction | null>(null);
  const [archiving, setArchiving] = useState(false);
  const canManage = access.canManage;
  const actions = canManage ? statusActions(product) : [];
  const status = product.status ?? "draft";

  async function runStatus() {
    if (!action) return false;
    try {
      const updated = await changeProductStatus(product.id, action.to);
      onChange(updated);
      toast.success(
        updated.status === "pending_review"
          ? "Submitted. KACHI will review the product."
          : updated.status === "active"
            ? "The product is live."
            : `Product is now ${(updated.status ?? "").replace("_", " ")}.`,
      );
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  }

  async function runArchive() {
    try {
      await archiveProduct(product.id);
      toast.success("Product archived.");
      router.push("/products");
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  }

  const sectionProps: ProductSectionProps = { product, onChange, onReload, canManage };
  const readyImages = (product.images ?? []).filter((i) => i.status === "ready").length;
  const activeVariants = (product.variants ?? []).filter((v) => v.status === "active").length;
  const showChecklist = ["draft", "inactive", "rejected"].includes(status);

  return (
    <>
      <PageHeader
        back={{ href: "/products", label: "Products" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {product.name} <StatusBadge status={status} />
          </span>
        }
        description={`${product.sku} · ${product.store.name}`}
        actions={
          <>
            {status === "active" && (
              <a
                href={`${SHOP_URL}/products/${product.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
              >
                <ExternalLinkIcon className="size-4" /> View in shop
              </a>
            )}
            {actions.map((a) => (
              <Button key={a.to} variant={a.primary ? "default" : "outline"} onClick={() => setAction(a)}>
                {a.label}
              </Button>
            ))}
            {canManage && canArchive(status) && (
              <Button variant="destructive" onClick={() => setArchiving(true)}>
                <Trash2Icon /> Delete
              </Button>
            )}
          </>
        }
      />

      {access.suspended && <SuspendedNotice />}

      {product.moderation_reason && (status === "rejected" || status === "banned") && (
        <div className="mb-6 rounded-xl bg-destructive/5 p-4 text-sm ring-1 ring-destructive/20">
          <p className="font-medium text-destructive">{status === "banned" ? "Taken down by KACHI" : "Not approved by KACHI"}</p>
          <p className="mt-1 whitespace-pre-line">{product.moderation_reason}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid min-w-0 gap-6 lg:col-span-2">
          <ImagesSection {...sectionProps} canManage={canManage && status !== "banned"} />
          <VariantsSection {...sectionProps} canStock={access.canStock} viewStock={access.viewStock} />
          <OptionsSection {...sectionProps} />
          <DetailsSection {...sectionProps} />
        </div>

        <div className="grid h-fit gap-6">
          <Section title="Status">
            <div className="grid gap-4 text-sm">
              <div className="flex items-center gap-2">
                <StatusBadge status={status} />
              </div>
              <p className="text-muted-foreground">{STATUS_HINTS[status]}</p>
              {showChecklist && (
                <ul className="grid gap-1.5">
                  <Check done={activeVariants > 0}>At least one active variant</Check>
                  <Check done={readyImages > 0}>At least one processed image</Check>
                </ul>
              )}
              <DetailList
                className="sm:grid-cols-1"
                items={[
                  { label: "Submitted for review", value: formatDateTime(product.submitted_at) },
                  { label: "Approved", value: formatDateTime(product.approved_at) },
                  { label: "First published", value: formatDateTime(product.published_at) },
                  ...(product.archived_at ? [{ label: "Archived", value: formatDateTime(product.archived_at) }] : []),
                ]}
              />
            </div>
          </Section>

          <Section title="Summary">
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: "KACHI SKU", value: product.sku },
                {
                  label: "Price",
                  value: product.price_range ? formatPriceRange(product.price_range, product.currency_code) : "No active variant",
                },
                { label: "Stock on hand", value: product.stock_on_hand ?? "—" },
                { label: "In stock", value: product.in_stock ? "Yes" : "No" },
                { label: "Created", value: formatDateTime(product.created_at) },
                { label: "Last updated", value: formatDateTime(product.updated_at) },
              ]}
            />
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
        title={action ? `${action.label}?` : ""}
        description={action?.description}
        confirmLabel={action?.label}
        onConfirm={runStatus}
      />

      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={`Delete “${product.name}”?`}
        description="The product leaves the shop and your catalogue and is kept as archived, because past orders still point at it. You can restore it as a draft later from the Archived filter."
        confirmLabel="Delete"
        destructive
        onConfirm={runArchive}
      />
    </>
  );
}

function Check({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      {done ? <CheckCircle2Icon className="size-4 text-success" /> : <CircleIcon className="size-4 text-muted-foreground" />}
      <span className={done ? undefined : "text-muted-foreground"}>{children}</span>
    </li>
  );
}
