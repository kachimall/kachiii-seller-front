import type { Metadata } from "next";
import { Suspense } from "react";
import { PayoutsList } from "./payouts-list";

export const metadata: Metadata = { title: "Payouts" };

export default function Page() {
  return (
    <Suspense>
      <PayoutsList />
    </Suspense>
  );
}
