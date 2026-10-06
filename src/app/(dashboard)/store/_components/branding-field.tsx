"use client";

// Adapted from components/common/image-field.tsx: the banner has its own pixel bounds and a wide preview.
import { ImageIcon, Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { STORE_IMAGE_RULES, type StoreImageKind } from "@/types/store";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

/** The store's logo or banner with upload / remove buttons (StoreBrandingImageRequest rules). */
export function BrandingField({
  kind,
  url,
  disabled,
  onUpload,
  onRemove,
}: {
  kind: StoreImageKind;
  url: string | null;
  disabled?: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<"upload" | "remove" | null>(null);
  const rules = STORE_IMAGE_RULES[kind];
  const label = kind === "logo" ? "Logo" : "Banner";

  async function run(which: "upload" | "remove", action: () => Promise<void>, success: string) {
    setPending(which);
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(null);
    }
  }

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!TYPES.includes(file.type)) return void toast.error("Choose a JPG, PNG or WebP image.");
    if (file.size > MAX_BYTES) return void toast.error("The image must be 2 MB or smaller.");
    const size = await imageSize(file);
    if (
      size &&
      (size.width < rules.minWidth ||
        size.height < rules.minHeight ||
        size.width > rules.maxWidth ||
        size.height > rules.maxHeight)
    ) {
      return void toast.error(`This image is ${size.width}×${size.height} px. ${hint(kind)}`);
    }
    void run("upload", () => onUpload(file), `${label} uploaded.`);
  }

  return (
    <div className="grid gap-3">
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10",
          kind === "logo" ? "size-24" : "aspect-[4/1] w-full",
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- storage URLs come from the API host
          <img src={url} alt={`Store ${kind}`} className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground" />
        )}
      </div>
      <input ref={input} type="file" accept={TYPES.join(",")} className="hidden" onChange={pick} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || pending !== null}
          onClick={() => input.current?.click()}
        >
          {pending === "upload" ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
          {url ? "Replace" : "Upload"}
        </Button>
        {url && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || pending !== null}
            onClick={() => run("remove", onRemove, `${label} removed.`)}
          >
            {pending === "remove" ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
            Remove
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{hint(kind)}</p>
    </div>
  );
}

function hint(kind: StoreImageKind): string {
  const r = STORE_IMAGE_RULES[kind];
  return `JPG, PNG or WebP, up to 2 MB, ${r.minWidth}×${r.minHeight} to ${r.maxWidth}×${r.maxHeight} px.`;
}

/** The image's pixel size, or null when the browser cannot read it (the server still checks). */
async function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}
