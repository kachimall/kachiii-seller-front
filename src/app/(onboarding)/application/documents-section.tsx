"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileTextIcon, Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Section } from "@/components/common/section";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ApiError, errorMessage } from "@/lib/api/client";
import { deleteDocument, openDocument, uploadDocument } from "@/lib/api/onboarding";
import { formatBytes, formatDateTime } from "@/lib/format";
import { handleFormError } from "@/lib/forms";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_TYPE_LABELS,
  documentUploadSchema,
  MAX_DOCUMENT_KB,
  MAX_DOCUMENTS,
  type DocumentUploadValues,
} from "@/lib/schemas/onboarding";
import type { VendorDocument, VendorStatus } from "@/types/api";
import type { VendorApplication } from "@/types/onboarding";

/**
 * The application's documents. They open through an authed download; while the application can
 * change, the applicant can add (up to the limit) and remove them. Each change bumps the revision.
 */
export function DocumentsSection({
  vendor,
  editable,
  onChanged,
}: {
  vendor: VendorApplication;
  editable: boolean;
  /** After an upload or delete, with the status before it (a rejected application goes back to review). */
  onChanged: (statusBefore: VendorStatus) => Promise<void> | void;
}) {
  const documents = vendor.documents ?? [];
  const [removing, setRemoving] = useState<VendorDocument | null>(null);

  async function open(doc: VendorDocument) {
    try {
      await openDocument(doc.id);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function remove(): Promise<boolean> {
    if (!removing) return false;
    try {
      await deleteDocument(removing.id);
      toast.success("Document removed.");
      await onChanged(vendor.status);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      if (error instanceof ApiError && error.status === 409) await onChanged(vendor.status);
      return false;
    }
  }

  return (
    <Section title={`Documents (${documents.length})`}>
      {documents.length > 0 ? (
        <ul className="divide-y">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
              <FileTextIcon className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {doc.original_name} · {formatBytes(doc.size_bytes)} · {formatDateTime(doc.uploaded_at)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => open(doc)}>
                Open
              </Button>
              {editable && (
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${doc.original_name}`} onClick={() => setRemoving(doc)}>
                  <Trash2Icon />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No documents uploaded.</p>
      )}

      {editable &&
        (documents.length < MAX_DOCUMENTS ? (
          <UploadForm vendor={vendor} onUploaded={() => onChanged(vendor.status)} />
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            An application can have at most {MAX_DOCUMENTS} documents. Remove one to add another.
          </p>
        ))}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove this document?"
        description={
          vendor.status === "rejected"
            ? `${removing?.original_name ?? "The file"} is removed, and your application goes back to KACHI for review.`
            : `${removing?.original_name ?? "The file"} is removed from your application.`
        }
        confirmLabel="Remove"
        destructive
        onConfirm={remove}
      />
    </Section>
  );
}

function UploadForm({ vendor, onUploaded }: { vendor: VendorApplication; onUploaded: () => Promise<void> | void }) {
  // Bumped to remount (and so empty) the file input after an upload.
  const [inputKey, setInputKey] = useState(0);
  const hasLicence = vendor.documents?.some((d) => d.type === "trade_license");
  const form = useForm<DocumentUploadValues>({
    resolver: zodResolver(documentUploadSchema),
    defaultValues: { type: hasLicence ? "other" : "trade_license", file: null },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async ({ type, file }) => {
    try {
      await uploadDocument(type, file as File);
      toast.success(vendor.status === "rejected" ? "Document uploaded. Your application is back in review." : "Document uploaded.");
      form.reset({ type: "other", file: null });
      setInputKey((n) => n + 1);
      await onUploaded();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error(errorMessage(error));
        await onUploaded();
      } else {
        handleFormError(error, form.setError, ["type", "file"]);
      }
    }
  });

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 border-t pt-4" noValidate>
      <p className="text-sm font-medium">Add a document</p>
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-start">
        <Field label="Type" htmlFor="upload-type" error={errors.type?.message}>
          <NativeSelect id="upload-type" aria-invalid={Boolean(errors.type)} {...form.register("type")}>
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Controller
          control={form.control}
          name="file"
          render={({ field }) => (
            <Field
              label="File"
              htmlFor="upload-file"
              error={errors.file?.message}
              hint={`PDF, JPG or PNG, up to ${MAX_DOCUMENT_KB / 1024} MB.`}
            >
              <Input
                id="upload-file"
                type="file"
                accept={DOCUMENT_ACCEPT}
                name={field.name}
                key={inputKey}
                ref={field.ref}
                onBlur={field.onBlur}
                aria-invalid={Boolean(errors.file)}
                onChange={(e) => field.onChange(e.target.files?.[0] ?? null)}
              />
            </Field>
          )}
        />
        <Button type="submit" className="sm:mt-6" disabled={isSubmitting}>
          {isSubmitting ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
          Upload
        </Button>
      </div>
    </form>
  );
}
