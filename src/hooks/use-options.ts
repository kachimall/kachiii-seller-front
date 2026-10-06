"use client";

import { useApi } from "@/hooks/use-api";
import { shopApi } from "@/lib/api/client";
import type { Brand, Category } from "@/types/api";

export interface Option {
  value: string;
  label: string;
}

/** The category tree flattened for a <select>, children indented under their parent. */
export function flattenCategories(tree: Category[], depth = 0): (Option & { category: Category; depth: number })[] {
  return tree.flatMap((category) => [
    { value: category.id, label: `${"  ".repeat(depth)}${category.name}`, category, depth },
    ...flattenCategories(category.children ?? [], depth + 1),
  ]);
}

/** The public category tree, from the shop portal (the Seller Centre does not serve it). */
export function useCategoryOptions(enabled = true) {
  const { data } = useApi(enabled ? "options:categories" : null, () => shopApi<Category[]>("/categories"));
  return data ? flattenCategories(data) : [];
}

/** Up to 100 active brands, from the shop portal, for pickers. */
export function useBrandOptions(enabled = true): Option[] {
  const { data } = useApi(enabled ? "options:brands" : null, () => shopApi<Brand[]>("/brands", { per_page: 100 }));
  return data?.map((b) => ({ value: b.id, label: b.name })) ?? [];
}
