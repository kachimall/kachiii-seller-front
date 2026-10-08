import type { Metadata } from "next";
import { MessagesFrame } from "./messages-frame";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesLayout({ children }: LayoutProps<"/messages">) {
  return <MessagesFrame>{children}</MessagesFrame>;
}
