import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, CalendarClock, ClipboardList, Globe2, Handshake, LineChart, ShieldCheck, UserPlus } from "lucide-react";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui";
import { EVENT } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/status";

const STEPS = [
  { icon: UserPlus, title: "Sign up", body: "Country, buyer name and e-mail. Login credentials arrive in your inbox." },
  { icon: Building2, title: "Basic details", body: "Point of contact, company profile and organisation credentials." },
  { icon: ShieldCheck, title: "FIEO verification", body: "FIEO verifies your organisation and unlocks the requirement form." },
  { icon: ClipboardList, title: "Sourcing requirement", body: "Sectors, products, specifications and certifications you need." },
  { icon: BadgeCheck, title: "Directorate approval", body: "Approved buyers receive an RBSM buyer number." },
  { icon: Handshake, title: "Meet MSMEs", body: "Matchmaking and scheduled B2B meetings with verified suppliers." },
];

const FEATURES = [
  { icon: Globe2, title: "Global buyer registry", body: "Structured profiles of international buyers — sourcing needs, target sectors and certifications.", color: "bg-tx-blue" },
  { icon: Handshake, title: "Data-driven matchmaking", body: "Match buyers and MSMEs on sector, products, certifications, capacity and export readiness.", color: "bg-tx-green" },
  { icon: CalendarClock, title: "B2B meeting scheduling", body: "Plan and manage one-to-one meetings during the event, with reminders and tracking.", color: "bg-tx-yellow" },
  { icon: LineChart, title: "Leads, MoUs & impact", body: "Track enquiries, MoUs and post-event outcomes with real-time reports and analytics.", color: "bg-tx-red" },
];

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <div className="bg-white">
      <div className="tx-ribbon h-1" />
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/"><Logo /></Link>
          <nav className="flex items-center gap-2">
            <a href="#process" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-ink md:block">How it works</a>
            <a href="#platform" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-ink md:block">Platform</a>
            {user ? (
              <ButtonLink href={ROLE_HOME[user.role]}>My dashboard</ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost">Sign in</ButtonLink>
                <ButtonLink href="/signup" className="hidden sm:inline-flex">Register as buyer</ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="tx-grid-bg absolute inset-0" aria-hidden />
        <div className="absolute -right-32 top-10 size-96 rounded-full bg-tx-green/15 blur-3xl" aria-hidden />
        <div className="absolute -left-24 bottom-0 size-80 rounded-full bg-tx-yellow/20 blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-800 ring-1 ring-brand-200">
              <span className="size-1.5 rounded-full bg-tx-red" /> Buyer registration open
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-6xl">
              {EVENT.name}<br />
              <span className="bg-gradient-to-r from-brand-700 via-brand-500 to-tx-blue bg-clip-text text-transparent">{EVENT.programme}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-600">
              Meet verified Indian MSMEs through structured, data-driven B2B matchmaking. Register your sourcing requirements,
              get verified, and build lasting trade partnerships — during the event and beyond.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/signup" className="px-6 py-3 text-base">Register as international buyer <ArrowRight className="size-4" /></ButtonLink>
              <ButtonLink href="/seller-register" variant="secondary" className="px-6 py-3 text-base">Register as Kerala MSME seller</ButtonLink>
            </div>
            <p className="mt-6 text-sm text-slate-500">Organised by the {EVENT.organiser} with {EVENT.partner}.</p>
          </div>
          <div className="relative">
            <div className="rounded-3xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={EVENT.logo} alt="TRADEX" className="mx-auto w-full max-w-sm" />
              <div className="mt-8 grid grid-cols-3 gap-3 text-center">
                {[["Buyers", "Global"], ["MSMEs", "Verified"], ["Meetings", "B2B"]].map(([a, b]) => (
                  <div key={a} className="rounded-xl bg-slate-50 px-2 py-4 ring-1 ring-slate-100">
                    <div className="text-lg font-extrabold text-ink">{b}</div>
                    <div className="text-xs text-slate-500">{a}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="process" className="border-t border-slate-100 bg-canvas py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-wider text-brand-700">How it works</div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">From sign-up to B2B meetings</h2>
          </div>
          <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-ink text-white"><s.icon className="size-5" /></span>
                  <span className="text-xs font-bold text-slate-400">STEP {i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-ink">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="platform" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-wider text-brand-700">The platform</div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">A continuing trade facilitation platform</h2>
            <p className="mt-3 text-slate-600">End-to-end management of the programme — registration, profiling, verification, matchmaking, meetings, communication, monitoring and reporting.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="group relative overflow-hidden rounded-2xl p-6 ring-1 ring-slate-200 transition hover:shadow-lg">
                <span className={`absolute inset-x-0 top-0 h-1 ${f.color}`} />
                <f.icon className="size-7 text-ink" />
                <h3 className="mt-4 font-bold text-ink">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-ink px-8 py-14 text-white sm:px-14">
          <div className="absolute -right-10 -top-10 size-64 rounded-full bg-tx-green/30 blur-3xl" aria-hidden />
          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Sourcing from India?</h2>
              <p className="mt-2 max-w-xl text-white/70">Register in under a minute. Your login credentials are sent to your e-mail immediately.</p>
            </div>
            <ButtonLink href="/signup" className="bg-white px-6 py-3 text-base !text-ink hover:bg-brand-50">Register now <ArrowRight className="size-4" /></ButtonLink>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} {EVENT.organiser}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
