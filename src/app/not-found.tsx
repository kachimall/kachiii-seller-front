import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-heading text-headline-xl text-primary">404</p>
      <p className="text-muted-foreground">This page does not exist.</p>
      <Link href="/" className="text-sm text-secondary hover:underline">
        Back to the overview
      </Link>
    </main>
  );
}
