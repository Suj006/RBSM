import { FileSpreadsheet, FileText, FileImage, EyeOff, RotateCcw } from "lucide-react";
import { hideMessageAction } from "@/app/actions/comms";
import { ActionButton } from "@/components/match/action-button";
import { Badge } from "@/components/ui";
import { authorLabel } from "@/lib/comms";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export type ThreadMessage = {
  id: string; body: string; createdAt: Date; authorId: string; authorRole: string; hiddenAt: Date | null;
  author: { displayName: string };
  attachments: { id: string; name: string; mimeType: string; size: number }[];
};

const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const kind = (m: string) => (m.includes("sheet") ? { Icon: FileSpreadsheet, t: "Excel" } : m.includes("word") ? { Icon: FileText, t: "Word" } : m.startsWith("image/") ? { Icon: FileImage, t: m === "image/png" ? "PNG" : "JPG" } : { Icon: FileText, t: "PDF" });

/** Shared documents, by the name the sender gave them. */
export function DocList({ docs }: { docs: ThreadMessage["attachments"] }) {
  if (!docs.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {docs.map((d) => {
        const { Icon, t } = kind(d.mimeType);
        return (
          <li key={d.id}>
            <a href={`/api/attachments/${d.id}`} target="_blank" rel="noopener"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-ink ring-1 ring-slate-200 hover:ring-brand-300">
              <Icon className="size-4 text-brand-700" /> {d.name} <span className="text-xs font-normal text-slate-500">{t} · {kb(d.size)}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** A conversation, oldest first. Own messages on the right; programme-team messages highlighted. */
export function Thread({ messages, viewerId, moderate }: { messages: ThreadMessage[]; viewerId: string; moderate: boolean }) {
  if (!messages.length) return <p className="px-2 py-10 text-center text-sm text-slate-500">No messages yet. Start the conversation below.</p>;
  return (
    <ol className="space-y-4">
      {messages.map((m) => {
        const mine = m.authorId === viewerId;
        const a = authorLabel(m);
        const staff = m.authorRole === "DIC" || m.authorRole === "FIEO";
        const hidden = !!m.hiddenAt;
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[min(42rem,92%)] rounded-2xl px-4 py-3 ring-1",
              hidden ? "bg-slate-50 ring-slate-200" : mine ? "bg-brand-50 ring-brand-200" : staff ? "bg-sky-50 ring-sky-200" : "bg-white ring-slate-200")}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-ink">{mine ? "You" : a.name}</span>
                <Badge tone={a.tone}>{a.org}</Badge>
                <span className="text-slate-500">{fmtDateTime(m.createdAt)}</span>
              </div>
              {hidden && !moderate ? (
                <p className="mt-1.5 text-sm italic text-slate-500">This message was withdrawn by the programme team.</p>
              ) : (
                <>
                  {hidden && <p className="mt-1.5 text-xs font-semibold text-tx-red">Withdrawn — hidden from the buyer and seller</p>}
                  {m.body && <p className={cn("mt-1.5 whitespace-pre-line text-sm text-slate-800", hidden && "line-through opacity-60")}>{m.body}</p>}
                  <DocList docs={m.attachments} />
                </>
              )}
              {moderate && (
                <div className="mt-2 flex justify-end">
                  <ActionButton action={hideMessageAction} fields={{ messageId: m.id, op: hidden ? "restore" : "hide" }} compact variant="ghost"
                    confirm={hidden ? undefined : "Withdraw this message? The buyer and seller will no longer see its text or documents; it stays here for the record."}
                    label={hidden ? <><RotateCcw className="size-3.5" /> Restore</> : <><EyeOff className="size-3.5" /> Withdraw</>} />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
