"use client";

import Link from "next/link";
import { EyeOffIcon, MessageSquareReplyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FilterSelect, ListPanel } from "@/components/common/list-panel";
import { PageHeader } from "@/components/common/page-header";
import { ReasonDialog } from "@/components/common/reason-dialog";
import { Stars } from "@/components/common/stars";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { useQueryState } from "@/hooks/use-query-state";
import { getDashboard } from "@/lib/api/dashboard";
import { listReviews, REVIEW_REPLY_PERMISSION, replyToReview } from "@/lib/api/reviews";
import { formatDate, formatDateTime } from "@/lib/format";
import { useAuth, useCan } from "@/store/auth";
import { REVIEW_REPLY_MAX, type Review } from "@/types/reviews";

const RATINGS = [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} star${n === 1 ? "" : "s"}` }));
const REPLY_FILTER = [{ value: "1", label: "Not answered" }];

export function ReviewsList() {
  const query = useQueryState();
  const rating = query.get("rating");
  const unreplied = query.get("unreplied") === "1";
  const { data, error, loading, reload, mutate } = useApi(`reviews?${query.key}`, () =>
    listReviews({ rating: rating ? Number(rating) : "", unreplied: unreplied || undefined, page: query.page }),
  );
  const can = useCan();
  // A suspended vendor is read-only outside its orders.
  const suspended = useAuth((s) => s.user?.vendor?.status === "suspended");
  const canReply = can(REVIEW_REPLY_PERMISSION) && !suspended;
  const [replying, setReplying] = useState<Review | null>(null);

  const filtered = Boolean(rating || unreplied);

  return (
    <>
      <PageHeader
        title="Reviews"
        description="What buyers say about your products. You can answer each review once; your reply shows under it in the shop."
      />

      <RatingSummary />

      <ListPanel
        rows={data?.data}
        meta={data?.meta}
        loading={loading}
        error={error}
        onRetry={reload}
        onPage={(page) => query.set({ page })}
        empty={{
          title: filtered ? "No reviews found" : "No reviews yet",
          description: filtered ? "Try other filters." : "Buyers can review the products they received.",
        }}
        filters={
          <>
            <FilterSelect label="Ratings" value={rating} onChange={(next) => query.set({ rating: next })} options={RATINGS} />
            <FilterSelect
              label="Reviews"
              value={unreplied ? "1" : ""}
              onChange={(next) => query.set({ unreplied: next })}
              options={REPLY_FILTER}
            />
          </>
        }
      >
        {(rows) => (
          <ul className="divide-y">
            {rows.map((review) => (
              <ReviewItem key={review.id} review={review} canReply={canReply} onReply={() => setReplying(review)} />
            ))}
          </ul>
        )}
      </ListPanel>

      <ReasonDialog
        open={replying !== null}
        onOpenChange={(open) => !open && setReplying(null)}
        title="Reply to the review"
        description={
          replying
            ? `${replying.author} on ${replying.product.name}. You can reply once, and buyers see it in the shop.`
            : undefined
        }
        confirmLabel="Post reply"
        label="Your reply"
        required
        min={1}
        max={REVIEW_REPLY_MAX}
        onSubmit={async (text) => {
          if (!replying || !text) return;
          const updated = await replyToReview(replying.id, text);
          if (data) mutate({ ...data, data: data.data.map((r) => (r.id === updated.id ? updated : r)) });
          toast.success("Reply posted.");
        }}
      />
    </>
  );
}

function ReviewItem({ review, canReply, onReply }: { review: Review; canReply: boolean; onReply: () => void }) {
  return (
    <li className="grid gap-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <Stars rating={review.rating} />
          <p className="text-sm">
            <span className="font-medium">{review.author}</span>
            <span className="text-muted-foreground"> on </span>
            <Link href={`/products/${review.product.id}`} className="font-medium hover:underline">
              {review.product.name}
            </Link>
            {review.variant && <span className="text-muted-foreground"> · {review.variant}</span>}
          </p>
          <p className="text-xs text-muted-foreground">{formatDateTime(review.created_at)}</p>
        </div>
        {canReply && !review.reply && !review.hidden && (
          <Button variant="outline" size="sm" onClick={onReply}>
            <MessageSquareReplyIcon /> Reply
          </Button>
        )}
      </div>

      {review.hidden && (
        <p className="flex items-start gap-2 rounded-lg bg-destructive/5 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/20">
          <EyeOffIcon className="mt-0.5 size-4 shrink-0" />
          <span>Hidden from the shop by KACHI{review.hidden_reason ? `: ${review.hidden_reason}` : "."}</span>
        </p>
      )}

      {review.comment ? (
        <p className="text-sm whitespace-pre-line">{review.comment}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">No comment, just a rating.</p>
      )}

      {review.photo_urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {review.photo_urls.map((url, i) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="size-20 overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a buyer's photo on the API's storage */}
              <img src={url} alt={`Buyer photo ${i + 1}`} className="size-full object-cover" />
            </a>
          ))}
        </div>
      )}

      {review.reply && (
        <div className="ml-4 border-l-2 border-primary/40 pl-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Your reply · {formatDate(review.reply.replied_at)}
          </p>
          <p className="mt-1 text-sm whitespace-pre-line">{review.reply.text}</p>
        </div>
      )}
    </li>
  );
}

/** The store's rating as the shop shows it (no average before the first review). */
function RatingSummary() {
  const { data } = useApi("reviews:rating", () => getDashboard());
  if (!data) return null;
  const { average, count } = data.rating;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <span className="font-heading text-headline-lg leading-none">{average ?? "—"}</span>
      <span className="grid gap-1">
        {average && <Stars rating={Number(average)} />}
        <span className="text-sm text-muted-foreground">
          {count === 0
            ? "No reviews yet: your store's rating shows once buyers review it."
            : `Store rating from ${count} review${count === 1 ? "" : "s"}.`}
        </span>
      </span>
    </div>
  );
}
