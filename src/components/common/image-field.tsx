"use client";

import { ImageIcon, Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api/client";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * An image with upload / remove buttons. The API takes JPG, PNG or WebP up to 2 MB and
 * 200–2000 px on each side; the size rules are checked by the server.
 */
export function ImageField({
  url,
  alt,
  disabled,
  onUpload,
  onRemove,
}: {
  url: string | null;
  alt: string;
  disabled?: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<"upload" | "remove" | null>(null);

  async function run(kind: "upload" | "remove", action: () => Promise<void>, success: string) {
    setPending(kind);
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(null);
    }
  }

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!TYPES.includes(file.type)) return void toast.error("Choose a JPG, PNG or WebP image.");
    if (file.size > MAX_BYTES) return void toast.error("The image must be 2 MB or smaller.");
    void run("upload", () => onUpload(file), "Image uploaded.");
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- storage URLs come from the API host
          <img src={url} alt={alt} className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input ref={input} type="file" accept={TYPES.join(",")} className="hidden" onChange={pick} />
        <div className="flex gap-2">
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
              onClick={() => run("remove", onRemove, "Image removed.")}
            >
              {pending === "remove" ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 2 MB, 200–2000 px.</p>
      </div>
    </div>
  );
}
