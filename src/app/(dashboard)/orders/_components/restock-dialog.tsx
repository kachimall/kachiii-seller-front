"use client";

// Copied from the admin back office's components/common/restock-dialog.tsx.
import { Loader2Icon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api/client";

interface RestockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  /** Throw to keep the dialog open with the error shown. */
  onSubmit: (restock: boolean) => Promise<void>;
}

/** Confirms items are back with the store, asking whether they go back on sale (the default). */
export function RestockDialog(props: RestockDialogProps) {
  // Remount the body each time it opens so the checkbox starts ticked.
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">{props.open && <RestockForm {...props} />}</DialogContent>
    </Dialog>
  );
}

function RestockForm({ onOpenChange, title, description, confirmLabel, onSubmit }: RestockDialogProps) {
  const [restock, setRestock] = useState(true);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await onSubmit(restock);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
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
      <div className="grid gap-1">
        <Label className="font-normal">
          <Checkbox checked={restock} onCheckedChange={(checked) => setRestock(checked === true)} />
          Put the items back on sale
        </Label>
        <p className="pl-6 text-xs text-muted-foreground">Untick it when an item came back broken or unsellable.</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" />} disabled={pending}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
