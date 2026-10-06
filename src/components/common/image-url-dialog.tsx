"use client";

import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, errorMessage } from "@/lib/api/client";

/** Why the address would be refused before KACHI tries it (AcceptsImageUrl: https, up to 2048 characters). */
function urlError(value: string): string | null {
  if (value === "") return "Paste the picture's web address.";
  if (value.length > 2048) return "The address must be 2048 characters or fewer.";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "That is not a valid web address.";
  }
  if (url.protocol !== "https:") return "Use an https:// address.";
  return null;
}

/**
 * Adds an image by its https:// web address (image_url, DECISIONS S10). KACHI downloads it in the
 * request (up to 5 MB, within 15 seconds, one at a time per account) and checks it like an upload,
 * so its 422s (too large, private network, "Another picture is still downloading…") show on the field.
 */
export function ImageUrlDialog({
  open,
  onOpenChange,
  title,
  description,
  hint,
  withAltText,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  hint: string;
  /** Also ask for alt text (product images). */
  withAltText?: boolean;
  onSubmit: (url: string, altText: string | null) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Remounted on each open, so a closed dialog forgets its address and errors. */}
        {open && (
          <UrlForm
            title={title}
            description={description}
            hint={hint}
            withAltText={withAltText}
            onSubmit={onSubmit}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function UrlForm({
  title,
  description,
  hint,
  withAltText,
  onSubmit,
  onClose,
}: {
  title: string;
  description: string;
  hint: string;
  withAltText?: boolean;
  onSubmit: (url: string, altText: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<{ url?: string; alt?: string }>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = url.trim();
    const problem = urlError(value);
    if (problem) return setErrors({ url: problem });

    setPending(true);
    setErrors({});
    try {
      await onSubmit(value, alt.trim() === "" ? null : alt.trim());
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 422 && (error.firstError("image_url") || error.firstError("alt_text"))) {
        setErrors({ url: error.firstError("image_url"), alt: error.firstError("alt_text") });
      } else {
        setErrors({ url: errorMessage(error) });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <Field label="Web address" htmlFor="image-url" error={errors.url} hint={hint}>
        <Input
          id="image-url"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={url}
          maxLength={2048}
          aria-invalid={Boolean(errors.url)}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus
        />
      </Field>
      {withAltText && (
        <Field label="Alt text (optional)" htmlFor="image-url-alt" error={errors.alt} hint={`${alt.length}/150`}>
          <Input id="image-url-alt" value={alt} maxLength={150} aria-invalid={Boolean(errors.alt)} onChange={(e) => setAlt(e.target.value)} />
        </Field>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          {pending ? "Downloading…" : "Add image"}
        </Button>
      </DialogFooter>
    </form>
  );
}
