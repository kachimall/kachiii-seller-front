"use client";

import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  Loader2Icon,
  PencilIcon,
  StarIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Section } from "@/components/common/section";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/client";
import { deleteProductImage, reorderProductImages, updateProductImage, uploadProductImage } from "@/lib/api/products";
import { MAX_IMAGES } from "@/lib/schemas/products";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/types/api";
import type { ProductSectionProps } from "./product-detail";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const POLL_MS = 3000;
const MAX_POLLS = 40;

/** StoreProductImageRequest: JPG, PNG or WebP, up to 5 MB, 500–5000 px on each side. */
async function checkFile(file: File): Promise<string | null> {
  if (!TYPES.includes(file.type)) return `${file.name}: choose a JPG, PNG or WebP image.`;
  if (file.size > MAX_BYTES) return `${file.name}: the image must be 5 MB or smaller.`;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();
    if (width < 500 || height < 500) return `${file.name}: the image must be at least 500 × 500 px (it is ${width} × ${height}).`;
    if (width > 5000 || height > 5000) return `${file.name}: the image must be at most 5000 × 5000 px.`;
  } catch {
    // Let the server decide if the browser cannot read it.
  }
  return null;
}

export function ImagesSection({ product, onChange, onReload, canManage }: ProductSectionProps) {
  const images = product.images ?? [];
  const input = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ProductImage | null>(null);
  const [deleting, setDeleting] = useState<ProductImage | null>(null);
  const [polls, setPolls] = useState(0);
  const processing = images.some((i) => i.status === "processing");
  const room = MAX_IMAGES - images.length;

  // While an upload is processing, reload the product every few seconds until it is ready.
  useEffect(() => {
    if (!processing || polls >= MAX_POLLS) return;
    const timer = setTimeout(() => {
      setPolls((n) => n + 1);
      onReload();
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [processing, polls, onReload]);

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    if (files.length > room) toast.error(`Only ${room} more image${room === 1 ? "" : "s"} fit (${MAX_IMAGES} at most).`);
    const batch = files.slice(0, Math.max(room, 0));

    const checked: File[] = [];
    for (const file of batch) {
      const problem = await checkFile(file);
      if (problem) toast.error(problem);
      else checked.push(file);
    }
    if (checked.length === 0) return;

    setUpload({ done: 0, total: checked.length });
    let uploaded = 0;
    for (const file of checked) {
      try {
        await uploadProductImage(product.id, file);
        uploaded += 1;
      } catch (error) {
        toast.error(`${file.name}: ${errorMessage(error)}`);
      }
      setUpload({ done: uploaded, total: checked.length });
    }
    setUpload(null);
    if (uploaded > 0) {
      toast.success(uploaded === 1 ? "Image uploaded. It is being processed." : `${uploaded} images uploaded. They are being processed.`);
      setPolls(0);
      onReload();
    }
  }

  async function reorder(ids: string[]) {
    setBusy(true);
    try {
      const updated = await reorderProductImages(product.id, ids);
      onChange({ ...product, images: updated, thumbnail_url: updated.find((i) => i.status === "ready")?.thumbnail_url ?? null });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, to: number) {
    const ids = images.map((i) => i.id);
    const [id] = ids.splice(index, 1);
    ids.splice(to, 0, id);
    void reorder(ids);
  }

  async function remove() {
    if (!deleting) return false;
    try {
      await deleteProductImage(product.id, deleting.id);
      toast.success("Image deleted.");
      onReload();
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  }

  // The primary image is the first ready one (the shop's card and the list thumbnail).
  const primaryId = images.find((i) => i.status === "ready")?.id;

  return (
    <Section
      title={`Images (${images.length}/${MAX_IMAGES})`}
      actions={
        canManage && (
          <>
            <input ref={input} type="file" accept={TYPES.join(",")} multiple className="hidden" onChange={pick} />
            <Button size="sm" variant="outline" disabled={room <= 0 || upload !== null} onClick={() => input.current?.click()}>
              {upload ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
              {upload ? `Uploading ${Math.min(upload.done + 1, upload.total)} of ${upload.total}` : "Upload images"}
            </Button>
          </>
        )
      }
    >
      {images.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No images yet. A product needs at least one before it can be submitted.
          {canManage && <p className="mt-1 text-xs">JPG, PNG or WebP, up to 5 MB, 500–5000 px. The first image is the main one.</p>}
        </div>
      ) : (
        <>
          <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4", busy && "opacity-60")}>
            {images.map((image, index) => (
              <li key={image.id} className="overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
                <div className="relative">
                  {image.status === "ready" && (image.thumbnail_url || image.url) ? (
                    <a href={image.url ?? image.thumbnail_url ?? undefined} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- absolute storage URLs from the API host */}
                      <img src={image.thumbnail_url ?? image.url ?? ""} alt={image.alt_text ?? ""} className="aspect-square w-full object-cover" />
                    </a>
                  ) : (
                    <div className="flex aspect-square flex-col items-center justify-center gap-2 p-2 text-center text-xs text-muted-foreground">
                      {image.status === "failed" ? (
                        <>
                          <AlertTriangleIcon className="size-5 text-destructive" />
                          <span className="text-destructive">Could not process this image. Delete it and upload another.</span>
                        </>
                      ) : (
                        <>
                          <Loader2Icon className="size-5 animate-spin" />
                          Processing…
                        </>
                      )}
                    </div>
                  )}
                  {image.id === primaryId && (
                    <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-xs font-medium shadow">
                      <StarIcon className="size-3" /> Main
                    </span>
                  )}
                </div>
                <div className="grid gap-1 bg-card p-2">
                  <p className="truncate text-xs text-muted-foreground" title={image.alt_text ?? undefined}>
                    {image.alt_text || "No alt text"}
                  </p>
                  {canManage && (
                    <div className="flex flex-wrap items-center gap-0.5">
                      <Button size="icon-xs" variant="ghost" aria-label="Move earlier" disabled={busy || index === 0} onClick={() => move(index, index - 1)}>
                        <ArrowLeftIcon />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label="Move later"
                        disabled={busy || index === images.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        <ArrowRightIcon />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label="Make main image"
                        title="Make main image"
                        disabled={busy || index === 0 || image.status !== "ready"}
                        onClick={() => move(index, 0)}
                      >
                        <StarIcon />
                      </Button>
                      <Button size="icon-xs" variant="ghost" aria-label="Edit alt text" title="Edit alt text" onClick={() => setEditing(image)}>
                        <PencilIcon />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="ml-auto text-destructive"
                        aria-label="Delete image"
                        onClick={() => setDeleting(image)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {processing && polls >= MAX_POLLS && (
            <p className="mt-3 text-xs text-muted-foreground">
              Still processing. <button type="button" className="underline" onClick={() => { setPolls(0); onReload(); }}>Check again</button>
            </p>
          )}
          {canManage && <p className="mt-3 text-xs text-muted-foreground">The first processed image is the main image in the shop.</p>}
        </>
      )}

      {editing && (
        <AltTextDialog
          image={editing}
          onClose={() => setEditing(null)}
          onSave={async (alt) => {
            const updated = await updateProductImage(product.id, editing.id, alt);
            onChange({ ...product, images: images.map((i) => (i.id === updated.id ? updated : i)) });
            toast.success("Alt text saved.");
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this image?"
        description="The image is removed from the product for good. Variants that showed it fall back to the main image."
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
      />
    </Section>
  );
}

function AltTextDialog({ image, onClose, onSave }: { image: ProductImage; onClose: () => void; onSave: (alt: string | null) => Promise<void> }) {
  const [value, setValue] = useState(image.alt_text ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await onSave(value.trim() === "" ? null : value.trim());
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Alt text</DialogTitle>
            <DialogDescription>Describe the image for shoppers who use a screen reader, e.g. “Blue yoga mat, rolled”.</DialogDescription>
          </DialogHeader>
          <Field label="Alt text" htmlFor="alt-text" error={error} hint={`${value.length}/150`}>
            <Input id="alt-text" value={value} maxLength={150} onChange={(e) => setValue(e.target.value)} autoFocus />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
