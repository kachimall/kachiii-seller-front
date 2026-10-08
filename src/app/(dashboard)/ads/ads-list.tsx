"use client";

import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { FilterSelect, ListPanel } from "@/components/common/list-panel";
import { PageHeader } from "@/components/common/page-header";
import { ForbiddenState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { useQueryState } from "@/hooks/use-query-state";
import { ADS_PERMISSION, listAds } from "@/lib/api/ads";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { useAuth, useCan } from "@/store/auth";
import { AD_STATUSES, type AdStatus } from "@/types/ads";
import { AD_STATUS_LABELS, adSubject, clickRate } from "./_components/ad-labels";

export function AdsList() {
  const can = useCan();
  const allowed = can(ADS_PERMISSION);
  const suspended = useAuth((s) => s.user?.vendor?.status === "suspended");
  const query = useQueryState();
  const status = query.get("status") as AdStatus | "";
  const { data, error, loading, reload } = useApi(allowed ? `ads?${query.key}` : null, () =>
    listAds({ status, page: query.page }),
  );

  if (!allowed) return <ForbiddenState />;

  return (
    <>
      <PageHeader
        title="Ads"
        description="Promote a product or your whole store on the home page or at the top of category and search results. KACHI approves each ad; once approved, pay to start it."
        actions={
          !suspended && (
            <ButtonLink href="/ads/new" variant="default">
              <PlusIcon /> Book an ad
            </ButtonLink>
          )
        }
      />

      <ListPanel
        rows={data?.data}
        meta={data?.meta}
        loading={loading}
        error={error}
        onRetry={reload}
        onPage={(page) => query.set({ page })}
        empty={{
          title: status ? "No ads found" : "No ads yet",
          description: status ? "Try another status." : "Book an ad to bring more buyers to your products.",
        }}
        filters={
          <FilterSelect label="Statuses" value={status} onChange={(next) => query.set({ status: next })} options={AD_STATUSES} />
        }
      >
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad</TableHead>
                <TableHead>Placement</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Runs</TableHead>
                <TableHead className="text-right">Views · clicks</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((ad) => (
                <TableRow key={ad.id}>
                  <TableCell>
                    <Link href={`/ads/${ad.id}`} className="grid gap-0.5 hover:underline">
                      <span className="font-medium">{ad.number}</span>
                      <span className="max-w-56 truncate text-xs text-muted-foreground">{adSubject(ad)}</span>
                    </Link>
                  </TableCell>
                  <TableCell>{ad.placement.name}</TableCell>
                  <TableCell>
                    <span className="grid gap-1">
                      <StatusBadge status={ad.status} label={AD_STATUS_LABELS[ad.status]} />
                      {ad.status === "approved" && ad.pay_by && (
                        <span className="text-xs whitespace-nowrap text-muted-foreground">Pay by {formatDateTime(ad.pay_by)}</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {ad.starts_at ? `${formatDate(ad.starts_at)} – ${formatDate(ad.ends_at)}` : `${ad.weeks} week${ad.weeks === 1 ? "" : "s"}`}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {ad.views} · {ad.clicks}
                    <span className="block text-xs text-muted-foreground">{clickRate(ad)} click rate</span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatMoney(ad.amount, ad.currency_code)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListPanel>
    </>
  );
}
