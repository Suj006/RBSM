// Fills an EMPTY database with realistic demo buyers at every stage, for
// trying out dashboards and reports.   npm run db:demo
// Refuses to run when buyers already exist.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import type { ItemStatus, BuyerStatus } from "../src/generated/prisma/enums";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { approvedBuyerNo, buyerRegNo, buyerUsername } from "../src/lib/config";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }) });

const BUYERS: [string, string, string, string][] = [
  ["Gulf Fresh Trading LLC", "United Arab Emirates", "Ahmed Al Mansoori", "Head of Procurement"],
  ["Nordic Spice House AB", "Sweden", "Erik Lindqvist", "Category Manager"],
  ["Pacific Rim Imports Pty Ltd", "Australia", "Olivia Bennett", "Sourcing Director"],
  ["Maple Leaf Foods Distribution", "Canada", "Liam Tremblay", "Purchase Manager"],
  ["Al Noor Hypermarkets", "Qatar", "Fatima Al Thani", "Buying Manager"],
  ["Rhine Valley Organics GmbH", "Germany", "Lukas Schneider", "Managing Director"],
  ["Sakura Trading Co", "Japan", "Haruto Sato", "General Manager"],
  ["Lone Star Home Decor Inc", "United States", "Emily Carter", "Senior Buyer"],
  ["Thames Textiles Ltd", "United Kingdom", "Oliver Hughes", "Product Developer"],
  ["Merlion Wellness Pte Ltd", "Singapore", "Wei Ling Tan", "Procurement Lead"],
  ["Atlas Coffee Roasters", "Morocco", "Youssef El Amrani", "Owner"],
  ["Baltic Seafood Group", "Latvia", "Janis Berzins", "Import Manager"],
  ["Sahara Building Supplies", "Egypt", "Omar Hassan", "Commercial Manager"],
  ["Kiwi Natural Products Ltd", "New Zealand", "Charlotte Wilson", "Founder"],
  ["Andes Gourmet SAC", "Peru", "Mateo Rojas", "Import Director"],
  ["Lagos Agro Ventures", "Nigeria", "Chinedu Okafor", "Chief Executive"],
  ["Riyadh Retail Holdings", "Saudi Arabia", "Khalid Al Saud", "Head of Sourcing"],
  ["Iberia Fine Foods SL", "Spain", "Lucia Garcia", "Purchase Manager"],
  ["Danube Handicrafts Kft", "Hungary", "Bence Nagy", "Buyer"],
  ["Cape Wellness Distributors", "South Africa", "Thandiwe Mokoena", "Category Buyer"],
  ["Bosphorus Textile AS", "Turkiye", "Emre Yilmaz", "Sourcing Manager"],
  ["Mekong Trade Partners", "Vietnam", "Nguyen Van An", "Director"],
  ["Lisbon Coir Imports Lda", "Portugal", "Ricardo Santos", "Procurement Officer"],
  ["Muscat Food Industries", "Oman", "Salim Al Harthy", "Supply Chain Head"],
  ["Polar Home Furnishings Oy", "Finland", "Aino Virtanen", "Buyer"],
  ["Kuwait Gulf Mart", "Kuwait", "Fahad Al Sabah", "Purchase Manager"],
  ["Seoul Natural Life Co", "South Korea", "Min-jun Kim", "Import Manager"],
  ["Amsterdam Spice Traders BV", "Netherlands", "Daan de Vries", "Trading Manager"],
  ["Bahrain Fresh Markets", "Bahrain", "Ali Al Khalifa", "Category Manager"],
  ["Mombasa Agri Exports", "Kenya", "Wanjiru Kamau", "Sourcing Lead"],
  ["Milano Design Furniture Srl", "Italy", "Giulia Rossi", "Product Manager"],
  ["Paris Gourmet Distribution", "France", "Camille Martin", "Acheteur"],
  ["Dhaka Garments Sourcing", "Bangladesh", "Rahim Uddin", "Merchandiser"],
  ["Colombo Tea Blenders", "Sri Lanka", "Nimal Perera", "Blending Manager"],
  ["Toronto Wellness Group", "Canada", "Sophie Martin", "Buyer"],
  ["Texas Rubber Industries", "United States", "Michael Brown", "Procurement Manager"],
  ["Sydney Organic Grocers", "Australia", "Jack Thompson", "Owner"],
  ["Jeddah Building Materials", "Saudi Arabia", "Abdullah Al Ghamdi", "Purchase Head"],
  ["Hamburg Coffee Kontor", "Germany", "Anna Fischer", "Green Coffee Buyer"],
  ["Abu Dhabi Hospitality Supplies", "United Arab Emirates", "Mariam Al Hosani", "Sourcing Manager"],
];

const NEEDS: Record<string, [string, string][]> = {
  "Spices & Condiments": [["Black pepper, Cardamom, Turmeric powder", "ASTA cleaned, 25 kg PP bags"], ["Cloves, Nutmeg, Mace", "Hand-picked, moisture below 12%"]],
  "Tea & Coffee": [["Orthodox black tea, Green tea", "FOP grade, 1 kg retail packs"], ["Arabica coffee beans", "Plantation A, screen 17/18"]],
  "Marine & Seafood Products": [["Frozen shrimp, Squid rings", "Size 16/20, 20% glaze, IQF"], ["Tuna loins", "Sashimi grade, -60 C"]],
  "Coir & Coir Products": [["Coir mats, Coir pith blocks", "5 kg blocks, low EC"]],
  "Ayurveda, Herbal & Wellness": [["Ayurvedic oils, Herbal supplements", "GMP certified, private label"]],
  "Handicrafts & Home Decor": [["Brass lamps, Wooden handicrafts", "Gift packaging"]],
  "Apparel & Garments": [["Cotton kurtas, Linen shirts", "GOTS certified cotton"]],
  "Cashew & Dry Fruits": [["Cashew kernels W240, W320", "Vacuum packed tins"]],
  "Furniture": [["Teak dining sets, Rattan chairs", "Knock-down packing"]],
  "Rubber & Rubber Products": [["Rubber mats, Industrial gloves", "EN 388 compliant"]],
  "Building Materials": [["Granite slabs, Ceramic tiles", "Polished, 20 mm"]],
  "Processed Food & Beverages": [["Ready-to-eat curries, Pickles", "Shelf life 12 months"]],
};
const DIAL: Record<string, string> = {
  "United Arab Emirates": "+971 50", Sweden: "+46 70", Australia: "+61 412", Canada: "+1 416", Qatar: "+974 55", Germany: "+49 151",
  Japan: "+81 90", "United States": "+1 512", "United Kingdom": "+44 7700", Singapore: "+65 9123", Morocco: "+212 661", Latvia: "+371 2",
  Egypt: "+20 100", "New Zealand": "+64 21", Peru: "+51 987", Nigeria: "+234 803", "Saudi Arabia": "+966 50", Spain: "+34 612",
  Hungary: "+36 30", "South Africa": "+27 82", Turkiye: "+90 532", Vietnam: "+84 91", Portugal: "+351 912", Oman: "+968 92",
  Finland: "+358 40", Kuwait: "+965 66", "South Korea": "+82 10", Netherlands: "+31 6", Bahrain: "+973 36", Kenya: "+254 712",
  Italy: "+39 347", France: "+33 6", Bangladesh: "+880 171", "Sri Lanka": "+94 77",
};
const CERTS = ["ISO 22000 (Food Safety)", "HACCP", "Halal", "FSSAI Licence", "USDA Organic", "GOTS (Organic Textile)", "BRCGS", "ISO 9001 (Quality Management)"];
const ORG = ["Importer", "Distributor / Wholesaler", "Retail Chain", "E-commerce Platform", "Trading House"];
const VALUE = ["USD 100,000 - 500,000", "USD 500,000 - 1 million", "USD 1 - 5 million", "USD 5 - 10 million"];
const TIME = ["Immediate (within 3 months)", "3 - 6 months", "6 - 12 months"];

// Stage per buyer (cycled): basic stages, then sector mixes.
const PLAN: { status: BuyerStatus; items: ItemStatus[] }[] = [
  { status: "APPROVED", items: ["APPROVED", "APPROVED"] },
  { status: "APPROVED", items: ["APPROVED", "SUBMITTED"] },
  { status: "BASIC_APPROVED", items: ["FIEO_RECOMMENDED", "FIEO_RETURNED"] },
  { status: "BASIC_APPROVED", items: ["SUBMITTED"] },
  { status: "APPROVED", items: ["APPROVED", "FIEO_RECOMMENDED", "DRAFT"] },
  { status: "BASIC_SUBMITTED", items: [] },
  { status: "BASIC_APPROVED", items: ["DIC_RETURNED", "SUBMITTED"] },
  { status: "SIGNED_UP", items: [] },
  { status: "APPROVED", items: ["APPROVED"] },
  { status: "BASIC_RETURNED", items: [] },
];

async function main() {
  if (await prisma.buyer.count() || await prisma.seller.count()) { console.error("Buyers or sellers already exist — demo data is only loaded into an empty database."); process.exit(1); }
  const sectors = await prisma.sector.findMany();
  const fieo = await prisma.user.findUniqueOrThrow({ where: { username: "fieo" } });
  const dic = await prisma.user.findUniqueOrThrow({ where: { username: "dic123" } });
  const hash = await bcrypt.hash("pass@123", 10);
  const needSectors = Object.keys(NEEDS).map((n) => sectors.find((s) => s.name === n)).filter(Boolean) as typeof sectors;
  let approvedSeq = 0;
  const day = 86400000;
  // Staggered stage dates (never in the future) so turnaround figures look realistic.
  const after = (d: Date, days: number) => new Date(Math.min(d.getTime() + days * day, Date.now() - 3600000));

  for (const [i, [name, country, poc, desig]] of BUYERS.entries()) {
    const seq = i + 1;
    const plan = PLAN[i % PLAN.length];
    const created = new Date(Date.now() - (BUYERS.length - i) * day * 0.6);
    const email = `${poc.split(" ")[0].toLowerCase()}@${name.split(" ")[0].toLowerCase()}.example`;
    const user = await prisma.user.create({ data: { username: buyerUsername(seq), passwordHash: hash, role: "BUYER", displayName: name, createdAt: created } });
    const approved = plan.status === "APPROVED";
    if (approved) approvedSeq++;
    const basicDone = plan.status !== "SIGNED_UP";
    const buyer = await prisma.buyer.create({
      data: {
        userId: user.id, seq, regNo: buyerRegNo(seq), name, country, signupEmail: email, createdAt: created, status: plan.status,
        ...(basicDone ? { pocName: poc, pocDesignation: desig, pocEmail: email, pocMobile: `${DIAL[country] ?? "+1 555"} ${String(1000000 + i * 73519).slice(0, 7)}`, basicSubmittedAt: created } : {}),
        ...(plan.status === "BASIC_APPROVED" || approved ? { basicApprovedAt: new Date(created.getTime() + day / 2) } : {}),
        ...(approved ? { approvedSeq, approvedNo: approvedBuyerNo(approvedSeq), approvedAt: new Date(created.getTime() + day) } : {}),
      },
    });
    const log = (action: string, actorId: string | null, actorRole: "BUYER" | "FIEO" | "DIC", at: Date, extra: object = {}) =>
      prisma.reviewLog.create({ data: { buyerId: buyer.id, actorId, actorRole, action: action as never, createdAt: at, ...extra } });
    await log("SIGNED_UP", user.id, "BUYER", created);
    if (basicDone) await log("BASIC_SUBMITTED", user.id, "BUYER", created);
    if (plan.status === "BASIC_RETURNED") await log("BASIC_RETURNED", fieo.id, "FIEO", created, { comment: "Please upload a clearer copy of the trade licence." });
    if (plan.status === "BASIC_APPROVED" || approved) await log("BASIC_APPROVED", fieo.id, "FIEO", new Date(created.getTime() + day / 2));
    if (!plan.items.length) continue;

    const req = await prisma.requirement.create({
      data: {
        buyerId: buyer.id, organisationType: ORG[i % ORG.length], annualSourcingValue: VALUE[i % VALUE.length], sourcingTimeline: TIME[i % TIME.length],
        preferredEngagement: "Regular / long-term supply",
      },
    });
    for (const [j, st] of plan.items.entries()) {
      const sector = needSectors[(i + j * 5) % needSectors.length];
      const [products, spec] = NEEDS[Object.keys(NEEDS).find((k) => sector.name.startsWith(k.slice(0, 10)))!][0];
      const at = after(created, 0.7);
      const recAt = after(at, 1 + (i % 3));
      const apprAt = after(recAt, 1 + ((i + j) % 4));
      const item = await prisma.requirementItem.create({
        data: {
          // Some buyers also ask for products no demo seller offers (shows up as supply gaps).
          requirementId: req.id, sectorId: sector.id, products: i % 3 === 0 ? `${products}, ${["Private-label retail packs", "Organic certified range", "Gift hampers"][(i + j) % 3]}` : products,
          specifications: spec, updatedAt: st === "APPROVED" ? apprAt : ["FIEO_RECOMMENDED", "DIC_RETURNED"].includes(st) ? recAt : at, quantity: `${1 + (i % 4)} container${i % 4 ? "s" : ""} per quarter`,
          certifications: JSON.stringify([CERTS[(i + j) % CERTS.length], CERTS[(i + j + 3) % CERTS.length]]), sortOrder: j, status: st,
          submittedAt: st === "DRAFT" ? null : at, recommendedAt: ["FIEO_RECOMMENDED", "DIC_RETURNED", "APPROVED"].includes(st) ? recAt : null,
          approvedAt: st === "APPROVED" ? apprAt : null, everApproved: st === "APPROVED",
        },
      });
      const extra = { itemId: item.id, sectorName: sector.name };
      if (st !== "DRAFT") await log("REQ_SUBMITTED", user.id, "BUYER", at, extra);
      if (st === "FIEO_RETURNED") await log("REQ_RETURNED", fieo.id, "FIEO", at, { ...extra, comment: "Please add packaging and quantity details." });
      if (["FIEO_RECOMMENDED", "DIC_RETURNED", "APPROVED"].includes(st)) await log("FIEO_RECOMMENDED", fieo.id, "FIEO", recAt, extra);
      if (st === "DIC_RETURNED") await log("DIC_RETURNED", dic.id, "DIC", at, { ...extra, comment: "Verify the export licence before recommending." });
      if (st === "APPROVED") await log("DIC_APPROVED", dic.id, "DIC", apprAt, extra);
    }
  }
  await prisma.counter.upsert({ where: { name: "buyer" }, create: { name: "buyer", value: BUYERS.length }, update: { value: BUYERS.length } });
  await prisma.counter.upsert({ where: { name: "approved-2026" }, create: { name: "approved-2026", value: approvedSeq }, update: { value: approvedSeq } });
  // ---- sellers: 8–14 per district at every stage
  const TALUKS: Record<string, string[]> = {
    Thiruvananthapuram: ["Neyyattinkara", "Nedumangad"], Kollam: ["Karunagappally", "Kottarakkara"], Pathanamthitta: ["Adoor", "Thiruvalla"],
    Alappuzha: ["Cherthala", "Ambalappuzha"], Kottayam: ["Changanassery", "Vaikom"], Idukki: ["Thodupuzha", "Devikulam"],
    Ernakulam: ["Aluva", "Kanayannur"], Thrissur: ["Chalakudy", "Kodungallur"], Palakkad: ["Ottapalam", "Alathur"],
    Malappuram: ["Tirur", "Perinthalmanna"], Kozhikode: ["Vadakara", "Koyilandy"], Wayanad: ["Mananthavady", "Vythiri"],
    Kannur: ["Thalassery", "Taliparamba"], Kasaragod: ["Hosdurg", "Manjeshwaram"],
  };
  const FIRMS = ["Spices", "Coir Works", "Cashew Exports", "Agro Foods", "Handlooms", "Ayurveda", "Rubber Products", "Bamboo Crafts", "Tea Estates", "Seafoods", "Furniture", "Herbals"];
  const PEOPLE = ["Anil Kumar", "Suresh Nair", "Lakshmi Menon", "Joseph Thomas", "Fathima Beevi", "Rajesh Pillai", "Mini Joseph", "Abdul Rahman", "Deepa Varghese", "Vinod Krishnan"];
  const STATES: ("WITH_DISTRICT" | "RECOMMENDED" | "RETURNED" | "APPROVED" | "REJECTED")[] = ["APPROVED", "APPROVED", "RECOMMENDED", "WITH_DISTRICT", "APPROVED", "RETURNED", "WITH_DISTRICT", "APPROVED", "RECOMMENDED", "REJECTED"];
  const districtUsers = await prisma.user.findMany({ where: { role: "DISTRICT" } });
  let sSeq = 0, sApproved = 0;
  for (const [di, [district, taluks]] of Object.entries(TALUKS).entries()) {
    const du = districtUsers.find((u) => u.district === district);
    const count = 8 + ((di * 5) % 7);
    for (let k = 0; k < count; k++) {
      sSeq++;
      const source = k % 4 === 0 ? "SELF" : k % 4 === 1 ? "BULK" : "DISTRICT";
      // Some online applications are back with the applicant for correction.
      const status = source === "SELF" && STATES[(sSeq + di) % STATES.length] === "WITH_DISTRICT" && k % 8 === 0
        ? "WITH_SELLER" : STATES[(sSeq + di) % STATES.length];
      const firm = `${district.slice(0, 3)}${["ra", "vi", "ka", "na", "sha"][k % 5]} ${FIRMS[(sSeq + k) % FIRMS.length]}`;
      const created = new Date(Date.now() - (200 - sSeq) * day * 0.15);
      const mobile = `9${String(400000000 + sSeq * 7351).slice(0, 9)}`;
      const person = PEOPLE[(sSeq + di) % PEOPLE.length];
      let userId: string | undefined, approvedNo: string | undefined, aSeq: number | undefined;
      if (status === "APPROVED") {
        sApproved++; aSeq = sApproved;
        approvedNo = `RBSM-Seller-2026${String(sApproved).padStart(3, "0")}`;
      }
      // Approved sellers have a login; online applicants have one from registration.
      if (status === "APPROVED" || source === "SELF") {
        const u = await prisma.user.create({ data: { username: `Tradex2027-S${String(sSeq).padStart(3, "0")}`, passwordHash: hash, role: "SELLER", displayName: firm } });
        userId = u.id;
      }
      const seller = await prisma.seller.create({
        data: {
          seq: sSeq, regNo: `RBSM-S-${String(sSeq).padStart(3, "0")}`, name: firm, district, taluk: taluks[k % 2],
          localBodyType: (["PANCHAYAT", "MUNICIPALITY", "CORPORATION"] as const)[k % 3], localBodyName: `${taluks[k % 2]}`,
          udyamNo: `UDYAM-KL-${String(di + 1).padStart(2, "0")}-${String(1000000 + sSeq * 37).slice(0, 7)}`,
          exportExperience: k % 3 !== 0, contactName: person, contactMobile: mobile, contactWhatsapp: mobile,
          contactEmail: `${person.split(" ")[0].toLowerCase()}${sSeq}@msme.example`, source, createdById: source === "SELF" ? null : du?.id,
          status, createdAt: created, recommendedAt: ["RECOMMENDED", "RETURNED", "APPROVED"].includes(status) ? after(created, 1 + (k % 4)) : null,
          approvedAt: status === "APPROVED" ? after(created, 3 + (k % 4) + (sSeq % 3)) : null,
          updatedAt: ["RECOMMENDED", "RETURNED", "APPROVED"].includes(status) ? after(created, 1 + (k % 4)) : created, approvedSeq: aSeq, approvedNo, userId,
          products: {
            create: [0, 1].slice(0, 1 + (k % 2)).map((j) => {
              const sector = needSectors[(sSeq + j * 3) % needSectors.length];
              const key = Object.keys(NEEDS).find((n) => n === sector.name)!;
              return { sectorId: sector.id, products: NEEDS[key][0][0], sortOrder: j };
            }),
          },
        },
      });
      const slog = (action: string, actorId: string | null | undefined, actorRole: "DISTRICT" | "DIC" | null, comment?: string) =>
        prisma.sellerLog.create({ data: { sellerId: seller.id, actorId: actorId ?? null, actorRole, action: action as never, createdAt: created, comment } });
      await slog("REGISTERED", source === "SELF" ? null : du?.id, source === "SELF" ? null : "DISTRICT", source === "SELF" ? "Self-registered on the portal" : source === "BULK" ? "Added by bulk upload" : undefined);
      if (["RECOMMENDED", "RETURNED", "APPROVED"].includes(status)) await slog("RECOMMENDED", du?.id, "DISTRICT");
      if (status === "RETURNED") await slog("RETURNED", dic.id, "DIC", "Udyam certificate details do not match. Please verify.");
      if (status === "APPROVED") await slog("APPROVED", dic.id, "DIC");
      if (status === "WITH_SELLER") await slog("SENT_TO_SELLER", du?.id, "DISTRICT", "Please upload the correct Udyam number and add the products you can export.");
      if (status === "REJECTED") await slog("REJECTED", du?.id, "DISTRICT", "Enterprise is not export-ready at present.");
    }
  }
  await prisma.counter.upsert({ where: { name: "seller" }, create: { name: "seller", value: sSeq }, update: { value: sSeq } });
  await prisma.counter.upsert({ where: { name: "seller-approved-2026" }, create: { name: "seller-approved-2026", value: sApproved }, update: { value: sApproved } });

  // Matchmaking: buyer directory open; about half the approved sellers have given tentative preferences.
  await prisma.matchSetting.upsert({ where: { key: "buyersVisible" }, create: { key: "buyersVisible", value: "true" }, update: { value: "true" } });
  const approvedBuyers = await prisma.buyer.findMany({
    where: { status: "APPROVED" }, orderBy: { approvedSeq: "asc" },
    select: { id: true, requirement: { select: { items: { where: { status: "APPROVED" }, select: { sectorId: true } } } } },
  });
  const approvedSellers = await prisma.seller.findMany({ where: { status: "APPROVED" }, orderBy: { approvedSeq: "asc" }, select: { id: true, products: { select: { sectorId: true } } } });
  let prefSellers = 0;
  for (const [k, sl] of approvedSellers.entries()) {
    if (k % 2) continue;
    const mine = new Set(sl.products.map((p) => p.sectorId));
    const relevant = approvedBuyers.filter((b) => b.requirement?.items.some((i) => mine.has(i.sectorId)));
    const picks = [...relevant, ...approvedBuyers.filter((b) => !relevant.includes(b))].slice(0, 1 + (k % 5)).map((b) => b.id);
    if (!picks.length) continue;
    await prisma.sellerPreference.createMany({ data: picks.map((buyerId, r) => ({ sellerId: sl.id, buyerId, rank: r + 1 })) });
    await prisma.seller.update({ where: { id: sl.id }, data: { prefSubmittedAt: new Date(Date.now() - (k % 7) * day) } });
    prefSellers++;
  }

  console.log(`Loaded ${BUYERS.length} demo buyers (${approvedSeq} approved) and ${sSeq} demo sellers (${sApproved} approved; ${prefSellers} with buyer preferences). Demo password: pass@123`);
}

main().finally(() => prisma.$disconnect());
