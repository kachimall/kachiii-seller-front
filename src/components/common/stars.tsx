import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A 1–5 rating as five stars. */
export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${rating} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon
          key={n}
          className={cn("size-3.5", n <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
        />
      ))}
    </span>
  );
}
