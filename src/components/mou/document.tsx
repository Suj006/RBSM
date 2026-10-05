import { Logo } from "@/components/logo";
import type { MouDoc } from "@/lib/mou-doc";

/** The MoU on screen — same text as the PDF. */
export function MouDocumentView({ d }: { d: MouDoc }) {
  return (
    <article className="relative overflow-hidden rounded-2xl bg-white px-6 py-7 shadow-sm ring-1 ring-slate-300 sm:px-10">
      {d.draft && <div className="pointer-events-none absolute inset-0 grid place-items-center"><span className="-rotate-[25deg] text-5xl font-extrabold tracking-widest text-red-600/10 sm:text-7xl">NOT YET APPROVED</span></div>}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Logo />
        <div className="text-right">
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">MoU No.</div>
          <div className="font-mono text-lg font-extrabold text-ink">{d.mouNo}</div>
          <div className="text-xs text-slate-500">{d.place} · {d.date}</div>
        </div>
      </div>
      <div className="tx-ribbon my-5 h-1" />
      <h2 className="text-center text-2xl font-extrabold tracking-wide text-ink sm:text-3xl">MEMORANDUM OF UNDERSTANDING</h2>
      <p className="mb-5 mt-1 text-center text-lg font-bold text-brand-800">Intention for Placing Orders</p>
      <p className="text-justify text-sm leading-relaxed text-slate-700">{d.intro}</p>
      <p className="mb-2 mt-4 text-sm text-slate-700">This MoU is made between:</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {d.parties.map((p) => (
          <div key={p.role} className="rounded-xl p-4 ring-1 ring-slate-200">
            <div className="text-[11px] font-bold uppercase tracking-wider text-brand-700">{p.role}</div>
            <div className="font-bold text-ink">{p.name}</div>
            {p.lines.map((l) => <div key={l} className="text-xs text-slate-600">{l}</div>)}
          </div>
        ))}
      </div>
      {d.sections.map((s) => (
        <section key={s.heading} className="mt-5">
          <h3 className="text-base font-bold text-ink">{s.heading}</h3>
          {s.text?.map((t) => <p key={t} className="mt-1 text-justify text-sm text-slate-700">{t}</p>)}
          {s.rows && <dl className="mt-1 divide-y divide-slate-100 text-sm">{s.rows.map(([k, v]) => (
            <div key={k} className="grid gap-1 py-1.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"><dt className="text-slate-500">{k}</dt><dd className="font-semibold text-ink">{v}</dd></div>))}</dl>}
        </section>
      ))}
      <dl className="mt-6 grid gap-1 rounded-xl bg-brand-50 p-4 text-xs sm:grid-cols-3">
        {d.verification.map(([k, v]) => <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-semibold text-ink">{v}</dd></div>)}
      </dl>
      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        {d.signatures.map((g) => (
          <div key={g.party} className="border-t border-ink pt-2 text-sm">
            <div className="font-bold text-ink">{g.party}</div>
            <div className="text-xs text-slate-600">{g.name}</div>
            <div className="text-xs text-slate-600">Name: {g.contact}</div>
            <div className="text-xs text-slate-400">Signature and date</div>
          </div>
        ))}
      </div>
    </article>
  );
}
