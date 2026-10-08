import type { Metadata } from "next";
import { AdBook } from "./ad-book";

export const metadata: Metadata = { title: "Book an ad" };

export default function Page() {
  return <AdBook />;
}
