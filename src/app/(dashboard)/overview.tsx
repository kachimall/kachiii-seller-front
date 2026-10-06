"use client";

import { PageHeader } from "@/components/common/page-header";
import { useAuth } from "@/store/auth";

export function Overview() {
  const name = useAuth((s) => s.user?.name);
  return <PageHeader title="Overview" description={name ? `Welcome back, ${name}.` : undefined} />;
}
