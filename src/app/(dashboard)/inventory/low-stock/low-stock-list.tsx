"use client";

import Link from "next/link";
import { ListPanel } from "@/components/common/list-panel";
import { PageHeader } from "@/components/common/page-header";
import { ForbiddenState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { useQueryState } from "@/hooks/use-query-state";
import { listLowStock } from "@/lib/api/products";
import { formatOptions } from "@/lib/format";
import { useCan } from "@/store/auth";

export function LowStockList() {
  const can = useCan();
  const query = useQueryState();
  // GET /vendor/inventory/low-stock needs inventory.manage; a suspended store can still read it.
  const allowed = can("inventory.manage");
  const { data, error, loading, reload } = useApi(allowed ? `low-stock?${query.key}` : null, () => listLowStock({ page: query.page }));

  if (!allowed) return <ForbiddenState />;

  return (
    <>
      <PageHeader
        back={{ href: "/products", label: "Products" }}
        title="Low stock"
        description="Live variants whose stock on hand is at or under their low-stock alert, emptiest first. Open a product to restock it."
      />
      <ListPanel
        rows={data?.data}
        meta={data?.meta}
        loading={loading}
        error={error}
        onRetry={reload}
        onPage={(page) => query.set({ page })}
        empty={{ title: "Nothing is running low", description: "Every variant is above its low-stock alert." }}
      >
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>On hand</TableHead>
                <TableHead>Held</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Alert at</TableHead>
                <TableHead>Listing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.variant?.id ?? index}>
                  <TableCell>
                    {row.product ? (
                      <Link href={`/products/${row.product.id}`} className="font-medium hover:underline">
                        {row.product.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="block">{formatOptions(row.variant?.options)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {row.variant?.sku}
                      {row.variant?.seller_sku ? ` · ${row.variant.seller_sku}` : ""}
                    </span>
                  </TableCell>
                  <TableCell className={row.on_hand <= 0 ? "font-medium text-destructive" : "font-medium"}>{row.on_hand}</TableCell>
                  <TableCell>{row.reserved}</TableCell>
                  <TableCell className={row.available <= 0 ? "text-destructive" : undefined}>{row.available}</TableCell>
                  <TableCell>{row.low_stock_threshold}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.product?.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListPanel>
    </>
  );
}
