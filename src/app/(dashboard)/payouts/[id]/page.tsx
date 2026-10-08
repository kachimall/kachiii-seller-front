import type { Metadata } from "next";
import { PayoutDetail } from "./payout-detail";

export const metadata: Metadata = { title: "Payout" };

export default async function PayoutPage({ params }: PageProps<"/payouts/[id]">) {
  const { id } = await params;
  return <PayoutDetail id={id} />;
}
