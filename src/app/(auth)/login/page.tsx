import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Growth OS</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Show up. Log the number. Watch it compound.
        </h1>
        <Link
          href="/dashboard"
          className="mt-10 flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          Enter
        </Link>
      </div>
    </main>
  );
}
