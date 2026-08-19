#!/usr/bin/env node
/**
 * Import produits_complet.csv into Convex. Stock quantities are never written.
 *
 * Usage:
 *   node scripts/import-library-csv.mjs /path/to/produits_complet.csv
 *   node scripts/import-library-csv.mjs /path/to/produits_complet.csv --dry-run
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BATCH = 80;

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const csvPath = argv.find((arg) => !arg.startsWith("--"));
if (!csvPath) {
  throw new Error(
    "Usage: node scripts/import-library-csv.mjs /path/to/produits_complet.csv [--dry-run]",
  );
}

function parseMad(value) {
  if (value == null) return 0;
  const n = Number(String(value).trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function includesAny(haystack, needles) {
  return needles.some((needle) => haystack.includes(needle));
}

function classifyCategory(name) {
  const n = name.toLowerCase();

  if (
    includesAny(n, [
      "آلة حاسبة",
      "الة حايبة",
      "مكنة حساب",
      "مكينة حساب",
      "محسبة",
      "casio",
      "kenko",
      "مسطرة",
      "بركار",
      "منقلة",
      "مثلث",
      "متلت",
      "نصف دائرة",
      "نصف  دائرة",
      "protractor",
      "regle",
      "règle",
      "compas",
      "équerre",
      "سوروبان",
      "soroban",
      "kit de tracage",
      "kit de traçage",
    ])
  ) {
    return "Géométrie & calculatrices";
  }

  if (
    includesAny(n, [
      "مقلمة",
      "محفظة",
      "كرطابل",
      "cartable",
      "trousse",
      "طابلية",
      "طبلية",
    ])
  ) {
    return "Sacs & trousses";
  }

  if (
    includesAny(n, [
      "عجينة",
      "الوان",
      "ألوان",
      "ملون",
      "كرافوز",
      "صباغة",
      "اكواش",
      "طباشير",
      "باليط",
      "palette",
      "gouache",
      "aquarelle",
      "peinture",
      "craie",
      "فلوريسون",
      "فلوريصون",
      "شيتة صباغة",
      "encre a dessiner",
      "encre à dessiner",
    ])
  ) {
    return "Arts plastiques";
  }

  if (
    includesAny(n, [
      "usb",
      "souris",
      "clavier",
      "فيش كلافيي",
      "robotique",
      "informatique",
      "flash",
    ])
  ) {
    return "Informatique";
  }

  if (
    includesAny(n, [
      "دفتر",
      "اوراق",
      "أوراق",
      "ورق",
      "غلاف",
      "ملف",
      "فوطوكوبي",
      "مدكرة",
      "مذكرة",
      "registre",
      "notebook",
      "note book",
      "classeur",
      "كلاسور",
      "chemise",
      "pochette",
      "بوشيط",
      "double feuille",
      "papier",
      "photocop",
      "couverture",
      "protege",
      "protégé",
      "بورطريف",
      "porte-vue",
      "protege-documents",
      "protège-documents",
      "enveloppe",
      "ظرف",
      "تكربون",
      "carnet",
      "cahier",
      "a4",
      "a5",
    ])
  ) {
    return "Cahiers & papier";
  }

  if (
    includesAny(n, [
      "ستيلو",
      "قلم",
      "بيك",
      "ماركو",
      "marker",
      "marqueur",
      "عمارة",
      "بلونكو",
      "سكوتش",
      "scotch",
      "اهي",
      "uhu",
      "فلتر",
      "بومادا",
      "كومة",
      "جوا",
      "كولة",
      "stylo",
      "bic",
      "crayon",
      "blanc",
      "gomme",
      "منجرة",
      "ممحاة",
      "ممسحة",
      "stick",
      "لصاق",
      "agrafe",
      "mine 0",
      "porte mini",
      "encreur",
      "tampon",
      "بادج",
      "تيكيتات",
      "مقص",
      "سكين موس",
      "لكوم",
      "لاكوم",
      "باط فيكس",
      "patafix",
    ])
  ) {
    return "Écriture";
  }

  if (
    includesAny(n, [
      "قصة",
      "قصص",
      "رواية",
      "قاموس",
      "مصحف",
      "قرآن",
      "قران",
      "dictionnaire",
      "le robert",
      "منجد",
      "contes",
      "histoires",
    ])
  ) {
    return "Lecture";
  }

  if (
    includesAny(n, [
      "كتاب",
      "كتب",
      "باك",
      "bac",
      "جذع",
      "مفيد",
      "منار",
      "في رحاب",
      "ابتدائي",
      "اعدادي",
      "إعدادي",
      "ثانوي",
      "التربية",
      "الرياضيات",
      "العربية",
      "الاسلام",
      "الإسلام",
      "الاجتماعيات",
      "العلوم",
      "manuel",
      "livre",
      "pack ",
      "top kids",
      "arc en ciel",
      "coquelicot",
      "je progresse",
      "mes apprentiss",
      "mes premiere",
      "kids zone",
      "english",
      "maths",
      "math ",
      "svt",
      "francais",
      "français",
      "primaire",
      "college",
      "collège",
      "ce1",
      "ce2",
      "cm1",
      "cm2",
      " 1ac",
      " 2ac",
      " 3ac",
      "1 ac",
      "2 ac",
      "3 ac",
      "workbook",
      "student book",
      "activité",
      "activite",
      "انشطتي",
      "قطاري",
      "واحتي",
    ])
  ) {
    return "Livres scolaires";
  }

  return "Livres scolaires";
}

function loadProducts(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const header = parseCsvLine(lines[0] ?? "");
  if (!header[1]?.includes("المنتوج")) {
    throw new Error(`Unexpected CSV header in ${filePath}: ${header.join(",")}`);
  }

  const seen = new Set();
  const products = [];
  const categories = new Map();

  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const name = (cols[1] ?? "").trim().replace(/\s+/g, " ");
    const unit = (cols[2] ?? "").trim().toLowerCase();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const categoryLabel = classifyCategory(name);
    categories.set(categoryLabel, (categories.get(categoryLabel) ?? 0) + 1);
    products.push({
      legacyId: `complet:${key}`,
      name,
      categoryLabel,
      sellPriceMad: parseMad(cols[3]),
      costPriceMad: parseMad(cols[4]),
      soldByWeight: unit === "kg",
    });
  }

  return { products, categories: Object.fromEntries(categories), rawRows: lines.length - 1 };
}

function convexRun(functionPath, jsonArgs) {
  const result = spawnSync(
    "npx",
    ["convex", "run", functionPath, JSON.stringify(jsonArgs)],
    {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(`convex run ${functionPath} failed (${result.status}): ${err}`);
  }
  const out = (result.stdout || "").trim();
  try {
    return JSON.parse(out);
  } catch {
    return out;
  }
}

function main() {
  const abs = path.resolve(csvPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`CSV not found: ${abs}`);
  }

  const { products, categories, rawRows } = loadProducts(abs);
  console.log(
    JSON.stringify(
      {
        file: abs,
        rawRows,
        uniqueProducts: products.length,
        categories,
        dryRun,
        sample: products.slice(0, 3),
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log("Dry run only — no Convex writes.");
    return;
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  for (let i = 0; i < products.length; i += BATCH) {
    const slice = products.slice(i, i + BATCH);
    const result = convexRun("libraryCsvImport:importBatch", { products: slice });
    inserted += result.inserted ?? 0;
    updated += result.updated ?? 0;
    skipped += result.skipped ?? 0;
    console.log(
      `import ${Math.min(i + BATCH, products.length)}/${products.length}`,
      result,
    );
  }

  console.log(
    JSON.stringify({ done: true, inserted, updated, skipped, total: products.length }, null, 2),
  );
}

main();
