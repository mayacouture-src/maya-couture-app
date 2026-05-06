// Lib d'import CSV/XLSX pour les entités Maya Couture (catalogue, clientes).
//
// - Parse CSV (UTF-8, séparateur ; ou , auto-détecté, RFC 4180 quoting)
// - Parse XLSX via exceljs
// - Valide chaque ligne avec Zod
// - Retourne un rapport { rowsTotal, rowsOk, errors[] }
// - Persiste si commit=true

import ExcelJS from "exceljs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export type ImportEntity = "products" | "customers";

// Cap dur sur le nombre de lignes acceptées dans un import — protection
// contre les fichiers énormes ou les zip-bombs xlsx (un xlsx 5 Mo peut
// décompresser en plusieurs Go). 10 000 lignes couvre largement les besoins
// d'un atelier de couture.
const MAX_IMPORT_ROWS = 10_000;

export type ImportError = { row: number; field?: string; message: string };

export type ImportReport = {
  rowsTotal: number;
  rowsOk: number;
  errors: ImportError[];
  created: number; // 0 si dry-run
  committed: boolean;
};

// ─── Parse CSV ────────────────────────────────────────────────────────────
// Détection du séparateur : on regarde la première ligne (hors guillemets)
// et on prend ; ou , selon ce qui apparaît le plus.

function detectSep(firstLine: string): string {
  let inQuote = false;
  let semi = 0;
  let comma = 0;
  for (let i = 0; i < firstLine.length; i++) {
    const c = firstLine[i];
    if (c === '"') inQuote = !inQuote;
    else if (!inQuote) {
      if (c === ";") semi++;
      else if (c === ",") comma++;
    }
  }
  return semi >= comma ? ";" : ",";
}

export function parseCsv(text: string): string[][] {
  // strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  // normalize line endings
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const firstNl = text.indexOf("\n");
  const firstLine = firstNl === -1 ? text : text.slice(0, firstNl);
  const sep = detectSep(firstLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cell += c;
      }
    } else {
      if (c === '"') {
        inQuote = true;
      } else if (c === sep) {
        row.push(cell);
        cell = "";
      } else if (c === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        if (rows.length > MAX_IMPORT_ROWS + 1) {
          throw new Error(
            `Trop de lignes (> ${MAX_IMPORT_ROWS}). Maximum ${MAX_IMPORT_ROWS} par import — découpe le fichier.`
          );
        }
      } else {
        cell += c;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // drop trailing fully-empty rows
  while (rows.length > 0 && rows[rows.length - 1].every((v) => v.trim() === "")) {
    rows.pop();
  }
  if (rows.length > MAX_IMPORT_ROWS + 1) {
    throw new Error(
      `Trop de lignes (${rows.length - 1}). Maximum ${MAX_IMPORT_ROWS} par import — découpe le fichier.`
    );
  }
  return rows;
}

// ─── Parse XLSX ───────────────────────────────────────────────────────────

export async function parseXlsx(buf: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  let aborted = false;
  ws.eachRow({ includeEmpty: false }, (row) => {
    if (aborted) return;
    if (rows.length > MAX_IMPORT_ROWS + 1) {
      aborted = true;
      return;
    }
    const cells: string[] = [];
    // exceljs Cell.values est 1-indexed avec un null en [0]
    const vals = row.values as Array<unknown>;
    for (let i = 1; i < vals.length; i++) {
      const v = vals[i];
      cells.push(stringifyCell(v));
    }
    rows.push(cells);
  });
  if (aborted) {
    throw new Error(
      `Trop de lignes (> ${MAX_IMPORT_ROWS}). Maximum ${MAX_IMPORT_ROWS} par import — découpe le fichier.`
    );
  }
  return rows;
}

function stringifyCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const obj = v as { text?: string; result?: unknown; richText?: Array<{ text?: string }> };
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((p) => p.text ?? "").join("");
    }
    if (typeof obj.text === "string") return obj.text;
    if (obj.result !== undefined) return String(obj.result);
    return "";
  }
  return String(v);
}

// ─── Helpers d'extraction ─────────────────────────────────────────────────

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (r[i] ?? "").trim();
    });
    return obj;
  });
}

const yes = new Set(["1", "true", "vrai", "oui", "yes", "y", "x"]);
const no = new Set(["0", "false", "faux", "non", "no", "n", ""]);
function toBool(v: string, dflt: boolean): boolean {
  const s = v.trim().toLowerCase();
  if (yes.has(s)) return true;
  if (no.has(s)) return false;
  return dflt;
}
function toNum(v: string, dflt = 0): number {
  if (v.trim() === "") return dflt;
  const cleaned = v.replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : dflt;
}

// ─── Schémas par entité ───────────────────────────────────────────────────

export const PRODUCT_HEADERS = [
  "reference",
  "name",
  "designer",
  "category",
  "purchasePrice",
  "rentalPrice",
  "salePrice",
  "deposit",
  "marginBetweenRentalsDays",
  "isRentable",
  "isSellable",
  "size",
  "color",
  "colorHex",
  "quantityInitial"
] as const;

export const PRODUCT_HEADER_DESCRIPTIONS: Record<string, string> = {
  reference: "Référence unique (ex: T001). Plusieurs lignes même référence = variantes du même produit.",
  name: "Nom du modèle.",
  designer: "Créateur (optionnel).",
  category: "Catégorie : soirée, mariage, cocktail… (optionnel)",
  purchasePrice: "Prix d'achat HT (nombre).",
  rentalPrice: "Prix de location (forfait par robe, nombre).",
  salePrice: "Prix de vente (nombre).",
  deposit: "Caution (nombre).",
  marginBetweenRentalsDays: "Jours de battement entre 2 locations (entier, défaut 0).",
  isRentable: "Louable : Oui/Non (défaut Oui).",
  isSellable: "Vendable : Oui/Non (défaut Oui).",
  size: "Taille de la variante (ex: 36, M, Unique).",
  color: "Couleur (texte).",
  colorHex: "Code couleur hex (#RRGGBB) optionnel.",
  quantityInitial: "Quantité initiale en stock (entier, défaut 1)."
};

export const CUSTOMER_HEADERS = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "address",
  "city",
  "postalCode",
  "idDocumentRef",
  "notes"
] as const;

export const CUSTOMER_HEADER_DESCRIPTIONS: Record<string, string> = {
  firstName: "Prénom.",
  lastName: "Nom.",
  phone: "Téléphone (obligatoire — sert de clé de doublon).",
  email: "Email (optionnel).",
  address: "Adresse (optionnel).",
  city: "Ville (optionnel).",
  postalCode: "Code postal (optionnel).",
  idDocumentRef: "Référence pièce d'identité (optionnel).",
  notes: "Notes libres (optionnel)."
};

// ─── Process: products ────────────────────────────────────────────────────

const productRowSchema = z.object({
  reference: z.string().min(1, "Référence requise"),
  name: z.string().min(1, "Nom requis"),
  size: z.string().min(1, "Taille requise"),
  color: z.string().min(1, "Couleur requise")
});

async function processProducts(
  rows: Record<string, string>[],
  commit: boolean,
  userId: string
): Promise<ImportReport> {
  const errors: ImportError[] = [];

  // Validation ligne par ligne
  type ValidRow = {
    rowIdx: number;
    reference: string;
    name: string;
    designer: string | null;
    category: string | null;
    purchasePrice: number;
    rentalPrice: number;
    salePrice: number;
    deposit: number;
    marginBetweenRentalsDays: number;
    isRentable: boolean;
    isSellable: boolean;
    size: string;
    color: string;
    colorHex: string | null;
    quantityInitial: number;
  };

  const valid: ValidRow[] = [];
  rows.forEach((r, i) => {
    const rowIdx = i + 2; // +2 = 1 pour l'index 1-based, +1 pour l'en-tête
    const parsed = productRowSchema.safeParse(r);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({ row: rowIdx, field: issue.path.join("."), message: issue.message });
      }
      return;
    }
    valid.push({
      rowIdx,
      reference: r.reference.trim(),
      name: r.name.trim(),
      designer: r.designer?.trim() || null,
      category: r.category?.trim() || null,
      purchasePrice: toNum(r.purchasePrice),
      rentalPrice: toNum(r.rentalPrice),
      salePrice: toNum(r.salePrice),
      deposit: toNum(r.deposit),
      marginBetweenRentalsDays: Math.floor(toNum(r.marginBetweenRentalsDays, 0)),
      isRentable: toBool(r.isRentable ?? "", true),
      isSellable: toBool(r.isSellable ?? "", true),
      size: r.size.trim(),
      color: r.color.trim(),
      colorHex: r.colorHex?.trim() || null,
      quantityInitial: Math.max(0, Math.floor(toNum(r.quantityInitial, 1)))
    });
  });

  // Group by reference
  const byRef = new Map<string, ValidRow[]>();
  for (const v of valid) {
    const arr = byRef.get(v.reference) ?? [];
    arr.push(v);
    byRef.set(v.reference, arr);
  }

  // Vérifier conflits avec la BDD (références existantes)
  const refs = [...byRef.keys()];
  const existing = await prisma.product.findMany({
    where: { reference: { in: refs } },
    select: { reference: true }
  });
  const existingSet = new Set(existing.map((p) => p.reference));

  let created = 0;
  for (const [ref, variants] of byRef) {
    if (existingSet.has(ref)) {
      for (const v of variants) {
        errors.push({
          row: v.rowIdx,
          field: "reference",
          message: `Référence déjà existante : ${ref}`
        });
      }
      continue;
    }

    if (commit) {
      const head = variants[0];
      try {
        const product = await prisma.product.create({
          data: {
            reference: head.reference,
            name: head.name,
            designer: head.designer,
            category: head.category,
            purchasePrice: head.purchasePrice,
            rentalPrice: head.rentalPrice,
            salePrice: head.salePrice,
            deposit: head.deposit,
            marginBetweenRentalsDays: head.marginBetweenRentalsDays,
            isRentable: head.isRentable,
            isSellable: head.isSellable,
            variants: {
              create: variants.map((v) => ({
                size: v.size,
                color: v.color,
                colorHex: v.colorHex,
                quantityInitial: v.quantityInitial,
                quantityCurrent: v.quantityInitial
              }))
            }
          }
        });
        created++;
        // audit (best-effort, ne bloque pas l'import si ça plante)
        await prisma.auditLog
          .create({
            data: {
              entityType: "Product",
              entityId: product.id,
              operation: "CREATE",
              userId,
              diff: {
                source: "bulk-import",
                reference: head.reference,
                variants: variants.length
              }
            }
          })
          .catch(() => undefined);
      } catch (e) {
        for (const v of variants) {
          errors.push({
            row: v.rowIdx,
            message: e instanceof Error ? e.message : "Erreur lors de la création"
          });
        }
      }
    }
  }

  const errorRows = new Set(errors.map((e) => e.row));
  return {
    rowsTotal: rows.length,
    rowsOk: Math.max(0, rows.length - errorRows.size),
    errors,
    created,
    committed: commit
  };
}

// ─── Process: customers ───────────────────────────────────────────────────

const customerRowSchema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  phone: z.string().min(1, "Téléphone requis")
});

async function processCustomers(
  rows: Record<string, string>[],
  commit: boolean,
  userId: string
): Promise<ImportReport> {
  const errors: ImportError[] = [];

  type ValidRow = {
    rowIdx: number;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    idDocumentRef: string | null;
    notes: string | null;
  };

  const valid: ValidRow[] = [];
  rows.forEach((r, i) => {
    const rowIdx = i + 2;
    const parsed = customerRowSchema.safeParse(r);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({ row: rowIdx, field: issue.path.join("."), message: issue.message });
      }
      return;
    }
    valid.push({
      rowIdx,
      firstName: r.firstName.trim(),
      lastName: r.lastName.trim(),
      phone: r.phone.trim(),
      email: r.email?.trim() || null,
      address: r.address?.trim() || null,
      city: r.city?.trim() || null,
      postalCode: r.postalCode?.trim() || null,
      idDocumentRef: r.idDocumentRef?.trim() || null,
      notes: r.notes?.trim() || null
    });
  });

  // Doublons par téléphone
  const phones = valid.map((v) => v.phone);
  const existing = await prisma.customer.findMany({
    where: { phone: { in: phones } },
    select: { phone: true }
  });
  const existingPhones = new Set(existing.map((c) => c.phone));

  // Détecter aussi les doublons internes au fichier
  const seenInFile = new Set<string>();

  let created = 0;
  for (const v of valid) {
    if (seenInFile.has(v.phone)) {
      errors.push({
        row: v.rowIdx,
        field: "phone",
        message: `Doublon dans le fichier : ${v.phone}`
      });
      continue;
    }
    seenInFile.add(v.phone);

    if (existingPhones.has(v.phone)) {
      errors.push({
        row: v.rowIdx,
        field: "phone",
        message: `Téléphone déjà existant : ${v.phone}`
      });
      continue;
    }

    if (commit) {
      try {
        const c = await prisma.customer.create({
          data: {
            firstName: v.firstName,
            lastName: v.lastName,
            phone: v.phone,
            email: v.email,
            address: v.address,
            city: v.city,
            postalCode: v.postalCode,
            idDocumentRef: v.idDocumentRef,
            notes: v.notes
          }
        });
        created++;
        await prisma.auditLog
          .create({
            data: {
              entityType: "Customer",
              entityId: c.id,
              operation: "CREATE",
              userId,
              diff: { source: "bulk-import" }
            }
          })
          .catch(() => undefined);
      } catch (e) {
        errors.push({
          row: v.rowIdx,
          message: e instanceof Error ? e.message : "Erreur lors de la création"
        });
      }
    }
  }

  const errorRows = new Set(errors.map((e) => e.row));
  return {
    rowsTotal: rows.length,
    rowsOk: Math.max(0, rows.length - errorRows.size),
    errors,
    created,
    committed: commit
  };
}

// ─── Entrée principale ────────────────────────────────────────────────────

export async function processImport(
  entity: ImportEntity,
  file: { name: string; buf: Buffer },
  commit: boolean,
  userId: string
): Promise<ImportReport> {
  const lower = file.name.toLowerCase();
  let rows: string[][];
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    rows = await parseXlsx(file.buf);
  } else {
    rows = parseCsv(file.buf.toString("utf8"));
  }

  const records = rowsToObjects(rows);

  if (entity === "products") {
    return processProducts(records, commit, userId);
  }
  return processCustomers(records, commit, userId);
}

export function templateFor(entity: ImportEntity): {
  headers: readonly string[];
  example: Record<string, string>;
  description: Record<string, string>;
  filename: string;
} {
  if (entity === "products") {
    return {
      headers: PRODUCT_HEADERS,
      description: PRODUCT_HEADER_DESCRIPTIONS,
      example: {
        reference: "T001",
        name: "Robe de mariée traînée",
        designer: "Création maison",
        category: "mariage",
        purchasePrice: "12000",
        rentalPrice: "3500",
        salePrice: "25000",
        deposit: "20000",
        marginBetweenRentalsDays: "1",
        isRentable: "Oui",
        isSellable: "Non",
        size: "38",
        color: "Ivoire",
        colorHex: "#F8F1E5",
        quantityInitial: "1"
      },
      filename: "maya-template-catalogue"
    };
  }
  return {
    headers: CUSTOMER_HEADERS,
    description: CUSTOMER_HEADER_DESCRIPTIONS,
    example: {
      firstName: "Yasmine",
      lastName: "Belkacem",
      phone: "0555123456",
      email: "yasmine@example.com",
      address: "12 rue des Lilas",
      city: "Alger",
      postalCode: "16000",
      idDocumentRef: "",
      notes: ""
    },
    filename: "maya-template-clientes"
  };
}
