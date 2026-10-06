import type { Metadata } from "next";
import { AccountPage as Account } from "./account-page";

export const metadata: Metadata = { title: "Account & security" };

export default function AccountPage() {
  return <Account />;
}
