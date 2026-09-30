import Link from "next/link";
import { Logo } from "@/components/logo";
import { EVENT } from "@/lib/config";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="tx-grid-bg absolute inset-0 opacity-[0.35] invert" aria-hidden />
        <div className="absolute -right-24 -top-24 size-80 rounded-full bg-tx-green/25 blur-3xl" aria-hidden />
        <div className="absolute -bottom-28 -left-10 size-80 rounded-full bg-tx-blue/20 blur-3xl" aria-hidden />
        <Link href="/" className="relative inline-flex w-fit rounded-xl bg-white px-4 py-3">
          <Logo />
        </Link>
        <div className="relative max-w-lg">
          <div className="mb-4 flex gap-1.5" aria-hidden>
            <span className="h-1.5 w-10 rounded bg-tx-red" /><span className="h-1.5 w-10 rounded bg-tx-yellow" />
            <span className="h-1.5 w-10 rounded bg-tx-green" /><span className="h-1.5 w-10 rounded bg-tx-blue" />
          </div>
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
            Connecting global buyers with India&apos;s finest MSMEs.
          </h2>
          <p className="mt-4 text-white/70">
            {EVENT.name} {EVENT.programme} — register your sourcing interests, get verified, and meet
            pre-qualified suppliers in structured B2B meetings.
          </p>
        </div>
        <div className="relative text-xs text-white/50">
          Organised by the {EVENT.organiser} in association with {EVENT.partner}.
        </div>
      </aside>
      <main className="flex flex-col bg-white">
        <div className="tx-ribbon h-1 lg:hidden" />
        <div className="flex items-center justify-between px-6 py-5 lg:hidden">
          <Link href="/"><Logo /></Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}
