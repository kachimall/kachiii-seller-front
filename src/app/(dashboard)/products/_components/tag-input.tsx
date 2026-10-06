"use client";

import { XIcon } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** A list of short values typed one at a time: Enter or comma adds, × removes. */
export function TagInput({
  id,
  value,
  onChange,
  max,
  maxLength = 30,
  placeholder,
  invalid,
  disabled,
}: {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  max: number;
  maxLength?: number;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function add(text: string) {
    const parts = text
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...value];
    for (const part of parts) {
      if (next.length >= max) break;
      if (!next.some((v) => v.toLowerCase() === part.toLowerCase())) next.push(part.slice(0, maxLength));
    }
    onChange(next);
    setDraft("");
  }

  return (
    <div
      className={cn(
        "flex min-h-8 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-1.5 py-1",
        invalid && "border-destructive",
        disabled && "opacity-50",
      )}
    >
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-sm">
          {v}
          {!disabled && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${v}`}
              onClick={() => onChange(value.filter((x) => x !== v))}
            >
              <XIcon className="size-3" />
            </button>
          )}
        </span>
      ))}
      {value.length < max && !disabled && (
        <Input
          id={id}
          value={draft}
          maxLength={maxLength}
          placeholder={value.length === 0 ? placeholder : "Add another"}
          aria-invalid={invalid}
          className="h-6 min-w-28 flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
          onChange={(e) => {
            if (e.target.value.includes(",")) add(e.target.value);
            else setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => add(draft)}
        />
      )}
    </div>
  );
}
