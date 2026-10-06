import { AppShell } from "@/components/layout/app-shell";
import { AuthGuard } from "@/components/layout/auth-guard";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGuard requireStore>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
