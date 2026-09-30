import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
});

// Phase-1 staff logins (change before going live).
const STAFF = [
  { username: "fieo", password: "pass@123", role: "FIEO", displayName: "FIEO Desk" },
  { username: "dic123", password: "dic123", role: "DIC", displayName: "Directorate of Industries & Commerce" },
  { username: "admin", password: "admin", role: "ADMIN", displayName: "Portal Administrator" },
] as const;

const SECTORS = [
  "Agriculture & Allied Products",
  "Spices & Condiments",
  "Tea & Coffee",
  "Cashew & Dry Fruits",
  "Marine & Seafood Products",
  "Processed Food & Beverages",
  "Coir & Coir Products",
  "Handloom & Textiles",
  "Apparel & Garments",
  "Handicrafts & Home Décor",
  "Bamboo & Wood Products",
  "Furniture",
  "Rubber & Rubber Products",
  "Ayurveda, Herbal & Wellness",
  "Pharmaceuticals & Healthcare",
  "Cosmetics & Personal Care",
  "Chemicals & Plastics",
  "Engineering & Capital Goods",
  "Electrical & Electronics",
  "IT & Software Services",
  "Leather & Footwear",
  "Gems & Jewellery",
  "Paper & Packaging",
  "Building Materials",
  "Toys & Sports Goods",
];

const CERTIFICATIONS = [
  "ISO 9001 (Quality Management)",
  "ISO 14001 (Environmental Management)",
  "ISO 22000 (Food Safety)",
  "ISO 45001 (Occupational Health & Safety)",
  "FSSC 22000",
  "HACCP",
  "BRCGS",
  "GMP",
  "WHO-GMP",
  "US FDA Registration",
  "CE Marking",
  "BIS Certification",
  "FSSAI Licence",
  "NPOP / India Organic",
  "USDA Organic",
  "EU Organic",
  "Fairtrade",
  "Rainforest Alliance",
  "Halal",
  "Kosher",
  "GOTS (Organic Textile)",
  "OEKO-TEX",
  "SA8000",
  "Sedex / SMETA",
  "RoHS",
  "AYUSH Premium Mark",
  "APEDA / Export Promotion Council RCMC",
];

async function main() {
  for (const s of STAFF) {
    await prisma.user.upsert({
      where: { username: s.username },
      update: {},
      create: {
        username: s.username,
        passwordHash: await bcrypt.hash(s.password, 10),
        role: s.role,
        displayName: s.displayName,
      },
    });
  }
  for (const [i, name] of SECTORS.entries()) {
    await prisma.sector.upsert({ where: { name }, update: {}, create: { name, sortOrder: i + 1 } });
  }
  for (const name of CERTIFICATIONS) {
    await prisma.certification.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`Seeded ${STAFF.length} staff logins, ${SECTORS.length} sectors, ${CERTIFICATIONS.length} certifications.`);
}

main().finally(() => prisma.$disconnect());
