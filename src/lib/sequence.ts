import type { Prisma } from "@/generated/prisma/client";

/** Increments and returns a named counter inside the given transaction. */
export async function nextSeq(tx: Prisma.TransactionClient, name: string) {
  const c = await tx.counter.upsert({
    where: { name },
    create: { name, value: 1 },
    update: { value: { increment: 1 } },
  });
  return c.value;
}
