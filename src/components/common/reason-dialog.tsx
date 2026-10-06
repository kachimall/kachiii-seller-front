"use client";

import { Loader2Icon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, errorMessage } from "@/lib/api/client";

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  /** Whether a reason must be given; the backend rule is min:5 when required. */
  required: boolean;
  min?: number;
  max?: number;
  label?: string;
  /** Extra controls, e.g. a checkbox; rendered above the reason. */
  children?: ReactNode;
  /** Throw to keep the dialog open; a 422 on `reason` is shown under the field. */
  onSubmit: (reason: string | null) => Promise<void>;
}

/** A confirmation that asks for a reason (moderation, suspensions, cancellations). */
export function ReasonDialog(props: ReasonDialogProps) {
  // Remount the body each time it opens so the text starts empty.
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">{props.open && <ReasonForm {...props} />}</DialogContent>
    </Dialog>
  );
}

function ReasonForm({
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  required,
  min = 5,
  max = 1000,
  label = "Reason",
  children,
  onSubmit,
}: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = reason.trim();
    if (required && text.length < min) return setError(`Give a reason of at least ${min} characters.`);
    if (text.length > 0 && text.length < min) return setError(`A reason needs at least ${min} characters.`);
    if (text.length > max) return setError(`Keep the reason under ${max} characters.`);

    setPending(true);
    setError(undefined);
    try {
      await onSubmit(text === "" ? null : text);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? (err.firstError("reason") ?? errorMessage(err)) : errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      {children}
      <Field
        label={required ? label : `${label} (optional)`}
        htmlFor="reason"
        error={error}
        hint={`${reason.trim().length}/${max}`}
      >
        <Textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          maxLength={max}
          aria-invalid={Boolean(error)}
          autoFocus
        />
      </Field>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" />} disabled={pending}>
          Cancel
        </DialogClose>
        <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
