import { api, apiList, type Query } from "@/lib/api/client";
import type { Review } from "@/types/reviews";

/** Listing needs only a vendor account; replying needs products.manage (ReviewPolicy). */
export const REVIEW_REPLY_PERMISSION = "products.manage";

export interface ReviewFilters extends Query {
  /** Only the reviews the store has not answered. */
  unreplied?: boolean;
  /** 1 to 5. */
  rating?: number | "";
  page?: number;
  /** Up to 100 (20 by default). */
  per_page?: number;
}

/** The reviews of the store's products, newest first, including those KACHI hid. */
export const listReviews = (filters: ReviewFilters = {}) => apiList<Review>("/vendor/reviews", filters);

/** One reply per review: 409 once answered, or for a review KACHI hid. Up to 1,000 characters. */
export const replyToReview = (id: string, reply: string) =>
  api<Review>(`/vendor/reviews/${id}/reply`, { method: "POST", body: { reply } });
