import type { Metadata } from "next";
import { Suspense } from "react";
import { AgreementPage as Agreement } from "./agreement-page";

export const metadata: Metadata = { title: "Vendor agreement" };

export default function AgreementPage() {
  return (
    <Suspense>
      <Agreement />
    </Suspense>
  );
}
