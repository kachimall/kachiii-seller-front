import { AD_STATUSES, type Ad } from "@/types/ads";

export const AD_STATUS_LABELS: Record<string, string> = Object.fromEntries(AD_STATUSES.map((s) => [s.value, s.label]));

/** What the ad promotes: a product, or the whole store. */
export function adSubject(ad: Pick<Ad, "product">): string {
  return ad.product ? ad.product.name : "Whole store";
}

/** "12.50" × 3 → "37.50", in fils so decimals never drift. */
export function multiplyMoney(amount: string, times: number): string {
  const [whole, fraction = ""] = amount.split(".");
  const fils = (Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2))) * times;
  return `${Math.floor(fils / 100)}.${String(fils % 100).padStart(2, "0")}`;
}

/** Click-through rate as a percentage, or a dash before the first view. */
export function clickRate(ad: Pick<Ad, "views" | "clicks">): string {
  return ad.views > 0 ? `${((ad.clicks / ad.views) * 100).toFixed(1)}%` : "—";
}
