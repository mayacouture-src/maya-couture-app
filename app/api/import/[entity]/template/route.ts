// Téléchargement d'un fichier template (CSV ou XLSX) à remplir puis réinjecter.
// URL : /api/import/<entity>/template?format=csv|xlsx
//
// Le template contient :
//   - une ligne d'en-tête avec les noms de colonnes attendus
//   - une ligne d'exemple
//   - (xlsx uniquement) une 2e feuille "Mode d'emploi" avec la description
//     de chaque colonne

import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { templateFor, type ImportEntity } from "@/lib/import";

export const dynamic = "force-dynamic";

function isEntity(s: string): s is ImportEntity {
  return s === "products" || s === "customers";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Le téléchargement du template ne révèle aucune donnée — on l'autorise à
  // tout utilisateur authentifié pour qu'un STAFF puisse préparer un fichier
  // qu'une ADMIN injectera ensuite.

  const { entity } = await params;
  if (!isEntity(entity)) {
    return NextResponse.json({ error: "unknown entity" }, { status: 400 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const tpl = templateFor(entity);

  if (format === "csv") {
    const sep = ";";
    const head = tpl.headers.join(sep);
    const example = tpl.headers
      .map((h) => {
        const v = tpl.example[h] ?? "";
        return /[",;\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      })
      .join(sep);
    const body = "﻿" + [head, example].join("\r\n");
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${tpl.filename}.csv"`
      }
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Maya Couture";

  const ws = wb.addWorksheet("Données", {
    views: [{ state: "frozen", ySplit: 1 }]
  });
  ws.columns = tpl.headers.map((h) => ({
    header: h,
    key: h,
    width: Math.max(14, Math.min(36, h.length + 6))
  }));
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF691524" }
  };
  headerRow.height = 22;
  ws.addRow(tpl.example);

  // 2e feuille : description colonne par colonne
  const help = wb.addWorksheet("Mode d'emploi");
  help.columns = [
    { header: "Colonne", key: "col", width: 28 },
    { header: "Description", key: "desc", width: 80 }
  ];
  const helpHeader = help.getRow(1);
  helpHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
  helpHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF691524" }
  };
  for (const h of tpl.headers) {
    help.addRow({ col: h, desc: tpl.description[h] ?? "" });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${tpl.filename}.xlsx"`
    }
  });
}
