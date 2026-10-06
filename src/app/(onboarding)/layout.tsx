import { AuthGuard } from "@/components/layout/auth-guard";
import { AgreementTokenKeeper, OnboardingFrame } from "./onboarding-frame";

/**
 * The application and the agreement: open to any signed-in vendor account, not only open stores.
 * Approved and suspended vendors see them inside the dashboard; applicants get a slim header.
 */
export default function OnboardingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AgreementTokenKeeper />
      <AuthGuard>
        <OnboardingFrame>{children}</OnboardingFrame>
      </AuthGuard>
    </>
  );
}
