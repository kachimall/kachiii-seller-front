import type { Metadata } from "next";
import { StorePage as Store } from "./store-page";

export const metadata: Metadata = { title: "Store profile" };

export default function StorePage() {
  return <Store />;
}
