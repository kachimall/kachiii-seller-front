import type { Metadata } from "next";
import { TwoFactorGate } from "./two-factor-gate";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default function TwoFactorPage() {
  return <TwoFactorGate />;
}
