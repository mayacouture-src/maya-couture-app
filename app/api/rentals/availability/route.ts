// Endpoint live pour le form de location : étant donnés des variantIds et
// les dates choisies, retourne la disponibilité par variant pour chaque
// période. Le form l'appelle dès que les dates ou les items changent pour
// afficher un badge "X dispo" et bloquer la sauvegarde côté UX.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getVariantAvailability } from "@/lib/availability";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  variantIds: z.array(z.string().min(1)).max(50),
  startDate1: z.string().min(1),
  endDate1: z.string().min(1),
  startDate2: z.string().optional().nullable(),
  endDate2: z.string().optional().nullable(),
  excludeReservationId: z.string().optional()
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid input" },
      { status: 400 }
    );
  }

  const { variantIds, excludeReservationId } = parsed.data;
  const start1 = new Date(parsed.data.startDate1);
  const end1 = new Date(parsed.data.endDate1);
  const start2 = parsed.data.startDate2 ? new Date(parsed.data.startDate2) : null;
  const end2 = parsed.data.endDate2 ? new Date(parsed.data.endDate2) : null;

  if (Number.isNaN(start1.getTime()) || Number.isNaN(end1.getTime())) {
    return NextResponse.json({ error: "invalid dates" }, { status: 400 });
  }

  const results = await Promise.all(
    variantIds.map(async (variantId) => {
      const period1 = await getVariantAvailability(
        variantId,
        { start: start1, end: end1 },
        excludeReservationId
      );
      const period2 =
        start2 && end2 && !Number.isNaN(start2.getTime()) && !Number.isNaN(end2.getTime())
          ? await getVariantAvailability(
              variantId,
              { start: start2, end: end2 },
              excludeReservationId
            )
          : null;
      return {
        variantId,
        capacity: period1.capacity,
        period1: {
          available: period1.available,
          engaged: period1.engaged
        },
        period2: period2
          ? { available: period2.available, engaged: period2.engaged }
          : null
      };
    })
  );

  return NextResponse.json({ items: results });
}
