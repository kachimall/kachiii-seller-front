import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";
import { ApiError, errorMessage } from "@/lib/api/client";

/**
 * Shows an API failure on a form: 422 field errors go next to their fields (unknown fields
 * and everything else become a toast). Returns the message shown, if any.
 */
export function handleFormError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
): void {
  if (error instanceof ApiError && error.status === 422) {
    const unknown: string[] = [];
    for (const [field, messages] of Object.entries(error.errors)) {
      // "metadata.0.name" -> "metadata"; nested errors attach to the top-level field.
      const name = fields.includes(field) ? field : field.split(".")[0];
      if (fields.includes(name)) setError(name as Path<T>, { type: "server", message: messages[0] });
      else unknown.push(messages[0]);
    }
    if (unknown.length > 0) toast.error(unknown[0]);
    else if (Object.keys(error.errors).length === 0) toast.error(error.message);
    return;
  }
  toast.error(errorMessage(error));
}

/** Runs an action with a success/error toast. Returns true on success. */
export async function runAction(action: () => Promise<unknown>, success: string): Promise<boolean> {
  try {
    await action();
    toast.success(success);
    return true;
  } catch (error) {
    toast.error(errorMessage(error));
    return false;
  }
}

/** Empty string -> null, for optional text fields the API takes as nullable. */
export function nullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}
