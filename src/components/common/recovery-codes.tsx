"use client";

import { CopyIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** One-time display of 2FA recovery codes, with copy and download. */
export function RecoveryCodes({ codes }: { codes: string[] }) {
  const text = codes.join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Recovery codes copied.");
    } catch {
      toast.error("Could not copy. Select the codes and copy them by hand.");
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([`KACHI Seller Centre recovery codes\n\n${text}\n`], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "kachi-seller-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-3">
      <ul className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          <CopyIcon /> Copy
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <DownloadIcon /> Download
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Keep these somewhere safe. Each code signs you in once if you lose your phone. They will not be shown again.
      </p>
    </div>
  );
}
