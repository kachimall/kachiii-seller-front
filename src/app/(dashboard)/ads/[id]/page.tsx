import type { Metadata } from "next";
import { AdDetail } from "./ad-detail";

export const metadata: Metadata = { title: "Ad" };

export default async function AdPage({ params }: PageProps<"/ads/[id]">) {
  const { id } = await params;
  return <AdDetail id={id} />;
}
