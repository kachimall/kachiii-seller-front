"use client";

import { FileTextIcon } from "lucide-react";
import { useState } from "react";
import { AsyncContent } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApi } from "@/hooks/use-api";
import { getPublicAgreement } from "@/lib/api/onboarding";
import { formatDate } from "@/lib/format";
import { Markdown } from "../../(onboarding)/agreement/markdown";

/** The vendor agreement in force, to read before applying (accepted later, once KACHI approves). */
export function AgreementDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setOpen(true)}>
        <FileTextIcon /> Read the vendor agreement
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">{open && <AgreementBody />}</DialogContent>
      </Dialog>
    </>
  );
}

function AgreementBody() {
  const { data, error, loading, reload } = useApi("public-agreement", getPublicAgreement);
  return (
    <AsyncContent data={data} error={error} loading={loading} onRetry={reload}>
      {(agreement) => (
        <div className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{agreement.title}</DialogTitle>
            <DialogDescription>
              Version {agreement.version} · published {formatDate(agreement.published_at)}. You accept it once KACHI
              approves your application.
            </DialogDescription>
          </DialogHeader>
          <Markdown source={agreement.body} />
        </div>
      )}
    </AsyncContent>
  );
}
