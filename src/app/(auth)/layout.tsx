export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-surface-container-low px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="font-heading text-3xl font-extrabold tracking-tight text-primary">KACHI</span>
          <span className="rounded bg-secondary px-1.5 py-0.5 text-label-xs text-secondary-foreground uppercase">Seller Centre</span>
        </div>
        <div className="rounded-xl bg-card p-6 shadow-card ring-1 ring-foreground/10 sm:p-8">{children}</div>
      </div>
    </main>
  );
}
