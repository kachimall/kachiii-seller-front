import type { Metadata } from "next";
import { ReturnDetail } from "./return-detail";

export const metadata: Metadata = { title: "Return" };

export default async function ReturnPage({ params }: PageProps<"/returns/[id]">) {
  const { id } = await params;
  return <ReturnDetail id={id} />;
}
