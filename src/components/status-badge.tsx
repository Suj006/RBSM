import type { BuyerStatus } from "@/generated/prisma/enums";
import { STATUS_META } from "@/lib/status";
import { Badge } from "@/components/ui";

export function StatusBadge({ status }: { status: BuyerStatus }) {
  const m = STATUS_META[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
