"use client";

import Link from "next/link";
import { PackageXIcon, PlusIcon } from "lucide-react";
import { FilterSelect, ListPanel } from "@/components/common/list-panel";
import { PageHeader } from "@/components/common/page-header";
import { SearchInput } from "@/components/common/search-input";
import { ForbiddenState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { Thumb } from "@/components/common/thumb";
import { ButtonLink } from "@/components/ui/button-link";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { useCategoryOptions } from "@/hooks/use-options";
import { useQueryState } from "@/hooks/use-query-state";
import { listProducts } from "@/lib/api/products";
import { formatDate, formatPriceRange } from "@/lib/format";
import { SuspendedNotice, useProductAccess } from "./_components/access";
import { PRODUCT_STATUSES } from "./_components/status";

const SORTS = [
  { value: "created", label: "Newest first" },
  { value: "name", label: "Name A–Z" },
];

export function ProductsList() {
  const access = useProductAccess();
  const query = useQueryState();
  const filters = {
    status: query.get("status"),
    q: query.get("q"),
    category_id: query.get("category_id"),
    sort: query.get("sort"),
    page: query.page,
  };
  const { data, error, loading, reload } = useApi(access.canView ? `products?${query.key}` : null, () => listProducts(filters));
  const categories = useCategoryOptions(access.canView);

  if (!access.canView) return <ForbiddenState />;

  const filtered = Boolean(filters.status || filters.q || filters.category_id);

  return (
    <>
      <PageHeader
        title="Products"
        description="Your catalogue: create listings, keep stock up to date and submit products for review."
        actions={
          <>
            {access.viewStock && (
              <ButtonLink href="/inventory/low-stock">
                <PackageXIcon /> Low stock
              </ButtonLink>
            )}
            {access.canManage && (
              <ButtonLink href="/products/new" variant="default">
                <PlusIcon /> New product
              </ButtonLink>
            )}
          </>
        }
      />
      {access.suspended && <SuspendedNotice />}
      <ListPanel
        rows={data?.data}
        meta={data?.meta}
        loading={loading}
        error={error}
        onRetry={reload}
        onPage={(page) => query.set({ page })}
        empty={
          filtered
            ? { title: "No products match", description: "Try other filters or clear the search." }
            : { title: "No products yet", description: "Create your first product to start selling on KACHI." }
        }
        filters={
          <>
            <SearchInput value={filters.q} onChange={(q) => query.set({ q })} placeholder="Search name or SKU" />
            <FilterSelect label="Statuses" value={filters.status} onChange={(status) => query.set({ status })} options={PRODUCT_STATUSES} />
            <FilterSelect
              label="Categories"
              value={filters.category_id}
              onChange={(category_id) => query.set({ category_id })}
              options={categories.map((c) => ({ value: c.value, label: `${String.fromCharCode(160).repeat(2 * c.depth)}${c.category.name}` }))}
            />
            <NativeSelect aria-label="Sort" value={filters.sort} onChange={(e) => query.set({ sort: e.target.value })} className="w-full sm:w-44">
              <option value="">Recently updated</option>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          </>
        }
      >
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Link href={`/products/${product.id}`} className="flex items-center gap-3 hover:underline">
                      <Thumb src={product.thumbnail_url} alt="" />
                      <span className="min-w-0">
                        <span className="block max-w-xs truncate font-medium">{product.name}</span>
                        <span className="block text-xs text-muted-foreground">{product.sku}</span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {product.price_range ? formatPriceRange(product.price_range, product.currency_code) : "—"}
                  </TableCell>
                  <TableCell>
                    {product.in_stock ? (
                      <span>{product.stock_on_hand ?? "In stock"}</span>
                    ) : (
                      <span className="text-destructive">Out of stock</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-col gap-1">
                      <StatusBadge status={product.status} />
                      {product.moderation_reason && (
                        <span className="max-w-48 truncate text-xs text-destructive" title={product.moderation_reason}>
                          {product.moderation_reason}
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(product.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListPanel>
    </>
  );
}
