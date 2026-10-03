import Link from "next/link";
import { CheckCircle2, Circle, Eye, EyeOff, FileSpreadsheet, Lock, LockOpen, Rocket, Snowflake, Sparkles, Unlock } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { loadBoard, matchChecks, preferenceOutcomes } from "@/lib/matchmaking";
import { matchControlAction } from "@/app/actions/matchmaking";
import { fmtDateTime } from "@/lib/format";
import { Alert, Badge, Card, CardHeader, PageHeader, StatCard } from "@/components/ui";
import { DownloadButtons } from "@/components/staff/download-buttons";
import { ActionButton } from "./action-button";
import { CapForm } from "./cap-form";
import { cn } from "@/lib/cn";

function Step({ n, title, done, current, children, status }: {
  n: number; title: string; done: boolean; current: boolean; children: React.ReactNode; status: React.ReactNode;
}) {
  return (
    <li className={cn("relative rounded-2xl bg-white p-5 shadow-sm ring-1", current ? "ring-2 ring-brand-300" : "ring-slate-200")}>
      <div className="flex items-start gap-4">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold",
          done ? "bg-brand-600 text-white" : current ? "bg-tx-yellow text-ink" : "bg-slate-100 text-slate-500")}>
          {done ? <CheckCircle2 className="size-5" /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-ink">{title}</h3>
            {status}
          </div>
          <div className="mt-2 text-sm text-slate-600">{children}</div>
        </div>
      </div>
    </li>
  );
}

/** Downloads for one step: Excel and PDF of each report. */
function StepReports({ items }: { items: { label: string; href: string }[] }) {
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500"><FileSpreadsheet className="size-3.5" /> Reports for this step</div>
      {items.map((it) => (
        <div key={it.href} className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-ink">{it.label}</span>
          <DownloadButtons href={it.href} compact />
        </div>
      ))}
    </div>
  );
}

/** The matchmaking control room: process steps, controls, position and activity. */
export async function MatchOverview({ user, base }: { user: User; base: string }) {
  const dic = user.role === "DIC";
  const admin = user.role === "ADMIN";
  const [board, prefs, events] = await Promise.all([
    loadBoard(),
    preferenceOutcomes(),
    prisma.matchEvent.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: { actor: { select: { displayName: true } } } }),
  ]);
  const issues = await matchChecks(board);
  const { state, rows, pool, changes } = board;
  const pairs = rows.reduce((n, r) => n + r.matches.length, 0);
  const atTarget = rows.filter((r) => r.matches.length >= pool.target).length;
  const bySource = (src: string) => rows.reduce((n, r) => n + r.matches.filter((m) => m.source === src).length, 0);
  const high = issues.filter((i) => i.severity === "high").length;
  const editable = state.prefsFrozen && !state.locked;
  const ps = prefs.summary;
  const stage = state.locked ? 6 : state.version ? 5 : state.prefsFrozen ? 4 : state.buyersVisible ? 2 : 1;

  return (
    <>
      <PageHeader eyebrow="Core module" title="Matchmaking"
        subtitle="From seller preferences to the final buyer–seller mapping: open the buyer directory, collect preferences, freeze, build and refine the mapping, check, publish and lock."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={state.buyersVisible ? "green" : "slate"}>Buyer directory {state.buyersVisible ? "open" : "hidden"}</Badge>
            <Badge tone={state.prefsFrozen ? "violet" : "amber"}>Preferences {state.prefsFrozen ? "frozen" : "open"}</Badge>
            <Badge tone={state.locked ? "red" : state.version ? "green" : "slate"}>{state.locked ? `Locked · v${state.version}` : state.version ? `Published · v${state.version}` : "Not published"}</Badge>
          </div>
        } />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Approved buyers / sellers" value={`${pool.buyers.length} / ${pool.sellers.length}`} accent="blue"
          hint={`Target ${pool.target} sellers per buyer · up to ${board.cap} buyers per seller`} />
        <StatCard label="Sellers who gave preferences" value={`${ps.submitted} / ${ps.sellers}`} accent="violet" hint={`${ps.preferences} preferences in all`} href={`${base}/preferences`} />
        <StatCard label="Buyer–seller pairs (working list)" value={pairs} accent="green"
          hint={`${bySource("PREFERENCE")} preference · ${bySource("SYSTEM")} system · ${bySource("MANUAL")} manual`} href={`${base}/board`} />
        <StatCard label="Buyers at target" value={`${atTarget} / ${rows.length}`} accent="yellow"
          hint={ps.preferences ? `${ps.honouredDraft} of ${ps.preferences} seller preferences included` : "No preferences yet"} href={`${base}/board`} />
      </div>

      {state.version > 0 && (changes.added || changes.removed) ? (
        <Alert tone="amber" className="mt-6" title="Unpublished changes">
          The working list differs from published version {state.version}: {changes.added} pair{changes.added === 1 ? "" : "s"} added, {changes.removed} removed.
          Buyers and sellers keep seeing version {state.version} until you publish again.
        </Alert>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <ol className="space-y-4">
          <Step n={1} title="Open the buyer directory to approved sellers" done={state.buyersVisible || state.prefsFrozen} current={stage === 1}
            status={<Badge tone={state.buyersVisible ? "green" : "slate"}>{state.buyersVisible ? "Open" : "Hidden"}</Badge>}>
            Approved sellers see approved buyers with their sectors, products, specifications and certifications, and can choose up to 5 buyers as tentative preferences.
            {dic && (
              <div className="mt-3">
                {state.buyersVisible
                  ? <ActionButton action={matchControlAction} fields={{ op: "hideBuyers" }} label={<><EyeOff className="size-4" /> Hide buyer directory</>} />
                  : <ActionButton action={matchControlAction} fields={{ op: "showBuyers" }} variant="primary" label={<><Eye className="size-4" /> Show buyer directory to sellers</>} />}
              </div>
            )}
            <StepReports items={[{ label: "Buyer directory as sellers see it", href: "/api/reports/match-buyer-directory" }]} />
          </Step>

          <Step n={2} title="Sellers give preferences" done={state.prefsFrozen} current={stage === 2}
            status={<Badge tone="violet">{ps.submitted} of {ps.sellers} sellers</Badge>}>
            Each seller ranks up to 5 buyers, once, after completing the seller profile. {ps.sellers - ps.submitted} approved seller{ps.sellers - ps.submitted === 1 ? " has" : "s have"} not given preferences yet.{" "}
            <Link href={`${base}/preferences`} className="font-semibold text-brand-700 hover:underline">See every seller&apos;s preferences →</Link>
            <StepReports items={[{ label: "Seller preferences — with both sides' sectors & products, and sellers yet to respond", href: "/api/reports/seller-preferences" }]} />
          </Step>

          <Step n={3} title="Freeze seller preferences" done={state.prefsFrozen} current={stage === 2}
            status={<Badge tone={state.prefsFrozen ? "violet" : "amber"}>{state.prefsFrozen ? "Frozen" : "Open"}</Badge>}>
            After freezing, sellers cannot give or change preferences, and the mapping can be built. Only Admin can reopen preferences.
            <div className="mt-3 flex flex-wrap gap-2">
              {dic && !state.prefsFrozen && (
                <ActionButton action={matchControlAction} fields={{ op: "freeze" }} variant="primary" label={<><Snowflake className="size-4" /> Freeze preferences</>}
                  confirm="Freeze seller preferences? Sellers will no longer be able to give or change preferences. Only Admin can reopen them." />
              )}
              {admin && state.prefsFrozen && (
                <ActionButton action={matchControlAction} fields={{ op: "unfreeze" }} label={<><Unlock className="size-4" /> Reopen preferences (Admin)</>}
                  confirm="Reopen seller preferences? Sellers who have not submitted can submit; the Directorate can freeze again later." />
              )}
            </div>
            {state.prefsFrozen && <StepReports items={[{ label: "Frozen preferences (final list of seller choices)", href: "/api/reports/seller-preferences" }]} />}
          </Step>

          <Step n={4} title="Build and refine the mapping" done={pairs > 0 && atTarget === rows.length} current={stage === 4}
            status={<Badge tone={pairs ? "green" : "slate"}>{pairs} pairs</Badge>}>
            The portal suggests up to {pool.target} sellers per buyer from sellers sharing the buyer&apos;s sectors — seller preferences first, then the best fit on matching products, certifications the buyer requires and export experience.
            Add or remove sellers for any buyer; manual changes are kept when suggestions are refreshed.
            {dic && editable && (
              <div className="mt-3 flex flex-wrap items-start gap-2">
                <ActionButton action={matchControlAction} fields={{ op: "fill" }} variant="primary" label={<><Sparkles className="size-4" /> {pairs ? "Fill gaps with suggestions" : "Generate suggestions"}</>} />
                {pairs > 0 && (
                  <ActionButton action={matchControlAction} fields={{ op: "rebuild" }} label="Rebuild suggestions"
                    confirm="Rebuild suggestions? Earlier suggestions are replaced; your manual additions and removals are kept." />
                )}
              </div>
            )}
            {dic && !editable && <p className="mt-2 text-xs text-slate-500">{state.locked ? "Locked — no changes (Admin can unlock)." : "Available once preferences are frozen."}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link href={`${base}/board`} className="font-semibold text-brand-700 hover:underline">Open the mapping board →</Link>
              {dic && editable && <CapForm current={state.maxPerSeller} auto={board.cap} />}
            </div>
            {pairs > 0 && <StepReports items={[
              { label: "Working list — every pair with both sides' sectors & products and why matched", href: "/api/reports/match-list?v=draft" },
              { label: "Results & gaps of the working list", href: "/api/reports/match-coverage?v=draft" },
            ]} />}
          </Step>

          <Step n={5} title="Check and publish" done={state.version > 0} current={stage === 4 || stage === 5}
            status={<Badge tone={state.version ? "green" : "slate"}>{state.version ? `v${state.version} · ${fmtDateTime(state.publishedAt)}` : "Not published"}</Badge>}>
            <p>
              The system lists mappings that look incorrect —{" "}
              <Link href={`${base}/checks`} className={cn("font-semibold hover:underline", high ? "text-tx-red" : "text-brand-700")}>
                {issues.length ? `${issues.length} to review (${high} high)` : "none found"}
              </Link>. They are for your reference only and do not stop publishing.
              Publishing shows the mapping to buyers, sellers, FIEO and district centres; you can change and republish until you lock.
            </p>
            {dic && editable && (
              <div className="mt-3">
                <ActionButton action={matchControlAction} fields={{ op: "publish" }} variant="success" label={<><Rocket className="size-4" /> {state.version ? "Republish" : "Publish"} mapping</>}
                  confirm={`${state.version ? "Republish" : "Publish"} the mapping (${pairs} pairs)?${issues.length ? ` ${issues.length} item(s) are flagged for review (${high} high).` : ""} Buyers, sellers, FIEO and district centres will see it.`} />
              </div>
            )}
            {(pairs > 0 || state.version > 0) && <StepReports items={[
              ...(pairs > 0 ? [{ label: "Checks — mappings to review", href: "/api/reports/match-checks" }] : []),
              ...(state.version ? [
                { label: `Published mapping (version ${state.version})`, href: "/api/reports/match-list" },
                { label: "Results & gaps of the published mapping", href: "/api/reports/match-coverage" },
              ] : []),
            ]} />}
          </Step>

          <Step n={6} title="Lock the final mapping" done={state.locked} current={stage === 5 || stage === 6}
            status={<Badge tone={state.locked ? "red" : "slate"}>{state.locked ? "Locked" : "Not locked"}</Badge>}>
            Locking makes the published version final: no more changes or republishing. Only Admin can unlock.
            <div className="mt-3 flex flex-wrap gap-2">
              {dic && !state.locked && state.version > 0 && (
                <ActionButton action={matchControlAction} fields={{ op: "lock" }} variant="danger" label={<><Lock className="size-4" /> Lock final mapping</>}
                  confirm={`Lock version ${state.version} as final? No further changes can be made unless Admin unlocks it.`} />
              )}
              {admin && state.locked && (
                <ActionButton action={matchControlAction} fields={{ op: "unlock" }} label={<><LockOpen className="size-4" /> Unlock (Admin)</>}
                  confirm="Unlock the final mapping? The Directorate can then change, republish and lock again." />
              )}
            </div>
            {state.locked && <StepReports items={[
              { label: `Final mapping (version ${state.version})`, href: "/api/reports/match-list" },
              { label: "Final results & gaps", href: "/api/reports/match-coverage" },
              { label: "Seller preferences and final outcome", href: "/api/reports/seller-preferences" },
            ]} />}
          </Step>
        </ol>

        <div className="space-y-6">
          <Card>
            <CardHeader title="All matchmaking reports" icon={<FileSpreadsheet className="size-4" />} subtitle="Excel for full detail; PDF for printing." />
            <div className="space-y-3 p-5 text-sm">
              {[
                ["1", "Buyer directory for sellers", "/api/reports/match-buyer-directory"],
                ["2–3", "Seller preferences and outcome", "/api/reports/seller-preferences"],
                ["4", "Working list (draft)", "/api/reports/match-list?v=draft"],
                ["5", "Checks", "/api/reports/match-checks"],
                ["5–6", state.locked ? "Final mapping" : "Published mapping", "/api/reports/match-list"],
                ["5–6", "Results & gaps (published)", "/api/reports/match-coverage"],
                ["4", "Results & gaps (working list)", "/api/reports/match-coverage?v=draft"],
              ].map(([n, label, href]) => (
                <div key={href} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink"><span className="mr-2 inline-block w-8 rounded bg-slate-100 text-center text-[11px] font-bold text-slate-500">{n}</span>{label}</span>
                  <DownloadButtons href={href} compact />
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Where each pair comes from" />
            <ul className="space-y-2 p-5 text-sm">
              <li className="flex items-center justify-between"><Badge tone="violet">Seller preference</Badge><b className="tabular-nums">{bySource("PREFERENCE")}</b></li>
              <li className="flex items-center justify-between"><Badge tone="blue">System match</Badge><b className="tabular-nums">{bySource("SYSTEM")}</b></li>
              <li className="flex items-center justify-between"><Badge tone="amber">Manual (Directorate)</Badge><b className="tabular-nums">{bySource("MANUAL")}</b></li>
              <li className="border-t border-slate-100 pt-2 text-xs text-slate-500">
                Seller preferences included: <b className="text-ink">{ps.honouredDraft}</b> of {ps.preferences}
                {state.version > 0 && <> (published: <b className="text-ink">{ps.honouredPublished}</b>)</>} ·
                sellers whose first choice is included: <b className="text-ink">{ps.firstChoiceDraft}</b>
              </li>
            </ul>
          </Card>
          <Card>
            <CardHeader title="Activity" />
            <ol className="space-y-3 p-5 text-sm">
              {events.map((e) => (
                <li key={e.id}>
                  <div className="flex items-start gap-2">
                    <Circle className="mt-1 size-2.5 shrink-0 fill-brand-500 text-brand-500" />
                    <div><div className="font-medium text-ink">{e.action}{e.detail ? <span className="font-normal text-slate-500"> · {e.detail}</span> : null}</div>
                      <div className="text-xs text-slate-500">{e.actor?.displayName ?? "—"} · {fmtDateTime(e.createdAt)}</div></div>
                  </div>
                </li>
              ))}
              {!events.length && <li className="text-slate-500">No activity yet.</li>}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
