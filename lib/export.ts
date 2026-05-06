// Helpers d'export CSV / Excel pour les listes du back-office.
// Utilisé par /api/export/[entity]/route.ts.

import ExcelJS from "exceljs";

export type Column<T> = {
  header: string;
  width?: number;
  value: (row: T) => string | number | Date | null | undefined;
};

function formatCsvValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (v instanceof Date) {
    s = v.toISOString();
  } else if (typeof v === "number") {
    s = String(v);
  } else {
    s = String(v);
  }
  // Anti CSV-injection : les cellules commençant par = + - @ \t \r sont
  // évaluées comme formules par Excel/Google Sheets/Numbers à l'ouverture.
  // On les préfixe d'une apostrophe pour forcer l'interprétation texte.
  // Réf: https://owasp.org/www-community/attacks/CSV_Injection
  if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  // Échappe : guillemets doublés, et entoure si contient , ; " \n \r
  if (/[",;\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv<T>(rows: T[], cols: Column<T>[]): string {
  const sep = ";"; // séparateur Excel-FR friendly
  const head = cols.map((c) => formatCsvValue(c.header)).join(sep);
  const lines = rows.map((r) =>
    cols.map((c) => formatCsvValue(c.value(r))).join(sep)
  );
  // BOM UTF-8 pour qu'Excel ouvre proprement les accents
  return "﻿" + [head, ...lines].join("\r\n");
}

export async function toXlsx<T>(
  rows: T[],
  cols: Column<T>[],
  sheetName: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Maya Couture";
  wb.created = new Date();

  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  ws.columns = cols.map((c) => ({
    header: c.header,
    key: c.header,
    width: c.width ?? Math.max(12, Math.min(40, c.header.length + 4))
  }));

  // Style en-tête : fond bordeaux + texte blanc
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF691524" } // brand-700
  };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.height = 22;

  for (const r of rows) {
    const obj: Record<string, unknown> = {};
    for (const c of cols) {
      obj[c.header] = c.value(r) ?? "";
    }
    ws.addRow(obj);
  }

  // Bordure légère + zebra
  const total = rows.length + 1;
  for (let i = 2; i <= total; i++) {
    const row = ws.getRow(i);
    if (i % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF7F5F3" }
      };
    }
    row.alignment = { vertical: "middle" };
  }

  // writeBuffer() peut retourner un ArrayBuffer ou un Uint8Array selon la
  // version d'exceljs. `Buffer.from` gère les deux à l'exécution ; on cast
  // en ArrayBuffer pour satisfaire le typage.
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

export function exportFilename(base: string, format: "csv" | "xlsx"): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `maya-${base}-${stamp}.${format}`;
}
