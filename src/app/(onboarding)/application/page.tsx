import type { Metadata } from "next";
import { ApplicationPage as Application } from "./application-page";

export const metadata: Metadata = { title: "Application & agreement" };

export default function ApplicationPage() {
  return <Application />;
}
