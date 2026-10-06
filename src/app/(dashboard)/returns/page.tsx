import type { Metadata } from "next";
import { Suspense } from "react";
import { ReturnsList } from "./returns-list";

export const metadata: Metadata = { title: "Returns" };

export default function ReturnsPage() {
  return (
    <Suspense>
      <ReturnsList />
    </Suspense>
  );
}
