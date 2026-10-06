import type { ProductStatus } from "@/types/api";
import type { VendorProduct, VendorStatusTarget } from "@/types/products";

/** The list filter, in the order a seller works through them. */
export const PRODUCT_STATUSES: readonly ProductStatus[] = [
  "draft",
  "pending_review",
  "active",
  "inactive",
  "rejected",
  "banned",
  "archived",
];

export const STATUS_HINTS: Record<ProductStatus, string> = {
  draft: "Only you can see this product. Submit it for review when it is ready.",
  pending_review: "KACHI is reviewing this product. You can still edit it; it goes live once approved.",
  rejected: "KACHI did not approve this product. Fix what the reviewer asked and submit it again.",
  active: "Live in the shop.",
  inactive: "Hidden from the shop. Publish it again whenever you like.",
  archived: "Removed from your catalogue. Restore it as a draft to work on it again.",
  banned: "KACHI took this product down. It cannot be published again.",
};

export interface StatusAction {
  to: VendorStatusTarget;
  label: string;
  /** Shown in the confirmation dialog. */
  description: string;
  primary?: boolean;
}

/**
 * The vendor's transitions (ProductStatus::allowedTargets, vendor side). A product that was
 * never approved is submitted for review; once approved, the seller publishes it directly.
 * Archiving (DELETE) is offered separately.
 */
export function statusActions(product: Pick<VendorProduct, "status" | "approved_at">): StatusAction[] {
  const approved = Boolean(product.approved_at);
  const publish: StatusAction = approved
    ? { to: "active", label: "Publish", primary: true, description: "The product goes live in the shop straight away." }
    : {
        to: "pending_review",
        label: "Submit for review",
        primary: true,
        description: "KACHI reviews the product before it goes live. It needs an active variant and a ready image.",
      };

  switch (product.status) {
    case "draft":
    case "inactive":
      return [publish];
    case "rejected":
      return [{ ...publish, to: "pending_review", label: "Resubmit for review" }];
    case "pending_review":
      return [{ to: "draft", label: "Withdraw from review", description: "The product goes back to draft; submit it again later." }];
    case "active":
      return [{ to: "inactive", label: "Deactivate", description: "The product is hidden from the shop until you publish it again." }];
    case "archived":
      return [{ to: "draft", label: "Restore as draft", description: "The product comes back as a draft you can edit and publish." }];
    default:
      return [];
  }
}

/** Whether DELETE (archive) is allowed from this status. */
export function canArchive(status: ProductStatus | undefined): boolean {
  return status !== undefined && status !== "archived" && status !== "banned";
}
