import type { Metadata } from "next";
import { Suspense } from "react";
import { LowStockList } from "./low-stock-list";

export const metadata: Metadata = { title: "Low stock" };

export default function LowStockPage() {
  return (
    <Suspense>
      <LowStockList />
    </Suspense>
  );
}
