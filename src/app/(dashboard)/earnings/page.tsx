import type { Metadata } from "next";
import { Suspense } from "react";
import { EarningsPage } from "./earnings-page";

export const metadata: Metadata = { title: "Earnings" };

export default function Page() {
  return (
    <Suspense>
      <EarningsPage />
    </Suspense>
  );
}
