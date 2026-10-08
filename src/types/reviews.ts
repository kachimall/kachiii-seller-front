// Reviews of the store's products (DECISIONS RV1): GET /vendor/reviews, POST /vendor/reviews/{id}/reply.
import type { IsoDate, Ulid } from "@/types/api";

export interface Review {
  id: Ulid;
  /** 1 to 5. */
  rating: number;
  comment: string | null;
  photo_urls: string[];
  /** The buyer's first name and last initial, e.g. "Sarah L.". */
  author: string;
  /** What they bought, e.g. "Red / M". */
  variant: string | null;
  /** The store's one reply; null until it answers. */
  reply: { text: string; replied_at: IsoDate } | null;
  created_at: IsoDate;
  product: { id: Ulid; name: string };
  /** Hidden by KACHI's staff, with the reason the buyer and the store see. */
  hidden: boolean;
  hidden_reason: string | null;
}

/** Up to 1,000 characters. */
export const REVIEW_REPLY_MAX = 1000;
