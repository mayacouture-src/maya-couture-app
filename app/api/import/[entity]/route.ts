// Import en masse depuis un fichier CSV ou XLSX.
// POST /api/import/<entity>
//   FormData :
//     file   : le fichier (.csv ou .xlsx)
//     commit : "true" pour créer réellement les enregistrements
//              (sinon dry-run = simulation, retourne juste le rapport)
// Réponse : { rowsTotal, rowsOk, errors[], created, committed }

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { processImport, type ImportEntity } from "@/lib/import";

export const dynamic = "force-dynamic";

function isEntity(s: string): s is ImportEntity {
  return s === "products" || s === "customers";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { entity } = await params;
  if (!isEntity(entity)) {
    return NextResponse.json({ error: "unknown entity" }, { status: 400 });
  }

  // Hard cap 5 Mo : on rejette le plus tôt possible avant même de lire le body
  // (économise mémoire et évite qu'un upload massif ne sature le worker).
  const MAX_BYTES = 5 * 1024 * 1024;
  const declared = req.headers.get("content-length");
  if (declared && Number(declared) > MAX_BYTES) {
    return NextResponse.json({ error: "fichier > 5 Mo" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "fichier manquant" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "fichier > 5 Mo" }, { status: 413 });
  }

  const commit = form.get("commit") === "true";
  const arrBuf = await file.arrayBuffer();
  const buf = Buffer.from(arrBuf);

  try {
    const report = await processImport(
      entity,
      { name: file.name, buf },
      commit,
      session.user.id
    );
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import a échoué" },
      { status: 500 }
    );
  }
}
