import type { Metadata } from "next";
import { MessageSettingsPage } from "./message-settings-page";

export const metadata: Metadata = { title: "Message settings" };

export default function Page() {
  return <MessageSettingsPage />;
}
