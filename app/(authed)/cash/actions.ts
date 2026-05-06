"use server";

import { CashKind, CashMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { notifyEveryone } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const movementSchema = z.object({
  kind: z.nativeEnum(CashKind),
  amount: z.coerce.number().positive(),
  occurredAt: z.string().min(1),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  category: z
    .string()
    .trim()
    .max(100)
    .optional()
    .or(z.literal("").transform(() => undefined))
});

export type CashActionState = { error?: string } | null;

export async function createCashMovement(
  _prev: CashActionState,
  formData: FormData
): Promise<CashActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Non autorisé" };

  const parsed = movementSchema.safeParse({
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    occurredAt: formData.get("occurredAt") ?? new Date().toISOString().slice(0, 10),
    description: formData.get("description") ?? "",
    category: formData.get("category") ?? ""
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: `${first.path.join(".") || "form"}: ${first.message}` };
  }

  const created = await prisma.cashTransaction.create({
    data: {
      kind: parsed.data.kind,
      method: CashMethod.CASH,
      amount: parsed.data.amount,
      description: parsed.data.description,
      category: parsed.data.category,
      occurredAt: new Date(parsed.data.occurredAt),
      recordedById: session.user.id
    }
  });

  await logAudit({
    entityType: "CashTransaction",
    entityId: created.id,
    operation: "CREATE",
    diff: { after: { kind: parsed.data.kind, amount: parsed.data.amount, category: parsed.data.category } }
  });

  // Notif uniquement pour les mouvements libres importants (dépenses / refill / retraits)
  const notifKind: "CASH_EXPENSE" | "CASH_REFILL" | "CASH_WITHDRAWAL" | null =
    parsed.data.kind === "EXPENSE"
      ? "CASH_EXPENSE"
      : parsed.data.kind === "CASH_REFILL"
        ? "CASH_REFILL"
        : parsed.data.kind === "WITHDRAWAL"
          ? "CASH_WITHDRAWAL"
          : null;
  if (notifKind) {
    const titleByKind = {
      CASH_EXPENSE: "Dépense enregistrée",
      CASH_REFILL: "Caisse alimentée",
      CASH_WITHDRAWAL: "Retrait de caisse"
    } as const;
    await notifyEveryone({
      type: notifKind,
      title: `${titleByKind[notifKind]} · ${parsed.data.amount}`,
      body: [parsed.data.category, parsed.data.description].filter(Boolean).join(" · ") || undefined,
      link: "/cash"
    });
  }

  revalidatePath("/cash");
  revalidatePath("/dashboard");
  return null;
}

export async function deleteCashMovement(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non autorisé");

  const tx = await prisma.cashTransaction.findUnique({
    where: { id },
    select: { reservationId: true, saleId: true }
  });
  if (!tx) return;

  await prisma.cashTransaction.delete({ where: { id } });

  await logAudit({ entityType: "CashTransaction", entityId: id, operation: "DELETE" });

  revalidatePath("/cash");
  revalidatePath("/dashboard");
  if (tx.reservationId) revalidatePath(`/rentals/${tx.reservationId}`);
}
