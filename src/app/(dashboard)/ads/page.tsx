import type { Metadata } from "next";
import { Suspense } from "react";
import { AdsList } from "./ads-list";

export const metadata: Metadata = { title: "Ads" };

export default function Page() {
  return (
    <Suspense>
      <AdsList />
    </Suspense>
  );
}
