import "server-only";
import { prisma } from "@/lib/prisma";

/** Active sectors, in display order. */
export const activeSectors = () =>
  prisma.sector.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });

/** Names of the active certifications in the master. */
export const certificationNames = async () =>
  (await prisma.certification.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true } })).map((c) => c.name);
