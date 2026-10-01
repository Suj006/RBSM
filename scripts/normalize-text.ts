// One-off clean-up for records saved before the English-only / Title Case
// rules: re-formats names, designations and e-mails, and lists any record that
// still contains non-English characters so it can be corrected.
//   npm run db:normalize
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { personCase, titleCase, toPlainText } from "../src/lib/text";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
});
const nonEnglish = (s: string | null) => !!s && /[^\x20-\x7E\n]/.test(toPlainText(s));

async function main() {
  const buyers = await prisma.buyer.findMany({ include: { requirement: { include: { items: true } } } });
  let changed = 0;
  for (const b of buyers) {
    const data = {
      name: titleCase(b.name),
      pocName: b.pocName && personCase(b.pocName),
      pocDesignation: b.pocDesignation && titleCase(b.pocDesignation),
      pocEmail: b.pocEmail && b.pocEmail.trim().toLowerCase(),
      pocMobile: b.pocMobile && b.pocMobile.replace(/\s+/g, " ").trim(),
    };
    if (Object.entries(data).some(([k, v]) => v !== b[k as keyof typeof data])) {
      await prisma.buyer.update({ where: { id: b.id }, data });
      await prisma.user.update({ where: { id: b.userId }, data: { displayName: data.name } });
      console.log(`Formatted ${b.regNo}: ${b.name} → ${data.name}${data.pocName !== b.pocName ? `; ${b.pocName} → ${data.pocName}` : ""}`);
      changed++;
    }
    const texts = [b.name, b.pocName, b.pocDesignation, b.pocEmail, b.requirement?.procurementInterests ?? null,
      ...(b.requirement?.items.flatMap((i) => [i.products, i.specifications, i.quantity, i.certifications]) ?? [])];
    if (texts.some(nonEnglish)) console.warn(`! ${b.regNo} (${b.name}) contains non-English text — ask the buyer to correct it.`);
  }
  console.log(`Done. ${changed} of ${buyers.length} buyer records re-formatted.`);
}

main().finally(() => prisma.$disconnect());
