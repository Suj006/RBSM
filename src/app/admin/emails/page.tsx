import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { isMailConfigured } from "@/lib/mail";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "E-mail outbox" };

export default async function Page() {
  const mails = await prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title="E-mail outbox" subtitle="Every e-mail the portal has generated (latest 200)." />
      {!isMailConfigured() && (
        <Alert tone="amber" className="mb-6" title="Outgoing mail is not configured">
          Set SMTP_HOST, SMTP_USER and SMTP_PASS in the server environment to deliver e-mails. Until then they are recorded here only.
        </Alert>
      )}
      <Card className="overflow-hidden">
        {mails.length ? (
          <ul className="divide-y divide-slate-100">
            {mails.map((m) => (
              <li key={m.id}>
                <details className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1">
                    <Badge tone={m.status === "SENT" ? "green" : m.status === "FAILED" ? "red" : "slate"}>{m.status === "LOGGED" ? "Not sent" : m.status === "SENT" ? "Sent" : "Failed"}</Badge>
                    <span className="font-semibold text-ink">{m.subject}</span>
                    <span className="text-sm text-slate-500">→ {m.to}</span>
                    <span className="ml-auto text-xs text-slate-400">{fmtDateTime(m.createdAt)}</span>
                  </summary>
                  <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 font-sans text-sm text-slate-700 ring-1 ring-slate-200">{m.body}</pre>
                  {m.error && <p className="mt-2 text-xs text-tx-red">{m.error}</p>}
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Mail className="size-5" />} title="No e-mails yet" />
        )}
      </Card>
    </>
  );
}
