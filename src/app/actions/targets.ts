"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { DISTRICT_NAMES } from "@/lib/config";
import type { FormState } from "./auth";

const count = (label: string, max: number) =>
  z.coerce.number({ message: `${label}: enter a number.` }).int(`${label}: enter a whole number.`).min(0, `${label} cannot be negative.`).max(max, `${label} is too large.`);

export async function saveTargetsAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["DIC", "ADMIN"]);
  const errors: Record<string, string> = {};
  const read = (key: string, label: string, max: number, min = 0) => {
    const r = count(label, max).min(min, `${label} must be at least ${min}.`).safeParse(String(form.get(key) ?? "").trim() || "x");
    if (!r.success) errors[key] = r.error.issues[0].message;
    return r.success ? r.data : 0;
  };
  const sellers = read("sellers", "Approved sellers target", 100000, 1);
  const buyers = read("buyers", "Approved buyers target", 10000, 1);
  const perBuyer = read("sellersPerBuyer", "Sellers per buyer", 1000, 1);
  const district = Object.fromEntries(DISTRICT_NAMES.map((d) => [d, read(`d:${d}`, d, 100000)]));
  if (Object.keys(errors).length) return { fieldErrors: errors, error: "Please correct the highlighted targets." };

  const entries: [string, number][] = [
    ["sellers", sellers], ["buyers", buyers], ["sellersPerBuyer", perBuyer],
    ...DISTRICT_NAMES.map((d) => [`district:${d}`, district[d]] as [string, number]),
  ];
  await prisma.$transaction(entries.map(([key, value]) =>
    prisma.target.upsert({ where: { key }, create: { key, value, updatedById: user.id }, update: { value, updatedById: user.id } }),
  ));
  for (const p of ["/dic", "/admin", "/fieo", "/district"]) revalidatePath(p, "layout");
  const sum = DISTRICT_NAMES.reduce((a, d) => a + district[d], 0);
  return {
    ok: true,
    message: sum === sellers
      ? "Targets saved."
      : `Targets saved. Note: district targets add up to ${sum}, while the overall target is ${sellers}.`,
  };
}
