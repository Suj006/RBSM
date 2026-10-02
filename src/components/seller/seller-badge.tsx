import type { SellerStatus } from "@/generated/prisma/enums";
import { SELLER_META } from "@/lib/status";
import { Badge } from "@/components/ui";

export function SellerBadge({ status }: { status: SellerStatus }) {
  const m = SELLER_META[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
