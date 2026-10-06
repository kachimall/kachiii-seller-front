import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A small image from the API's storage host, or a placeholder when there is none. */
export function Thumb({ src, alt, className }: { src: string | null | undefined; alt: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-foreground/5",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- absolute storage URLs from the API host
        <img src={src} alt={alt} className="size-full object-cover" loading="lazy" />
      ) : (
        <ImageIcon className="size-4 text-muted-foreground" />
      )}
    </span>
  );
}
