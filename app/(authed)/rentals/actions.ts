"use server";

import { CashKind, CashMethod, ReservationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import {
  checkRentalConflicts,
  formatConflictMessage,
  type ItemConflict
} from "@/lib/availability";
import { inclusiveDays } from "@/lib/dates";
import { valuesFromForm } from "@/lib/form";
import { notifyEveryone } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const itemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().positive().max(99),
  price: z.coerce.number().nonnegative(),
  deposit: z.coerce.number().nonnegative()
});

const reservationSchema = z
  .object({
    customerId: z.string().min(1, "Cliente requise"),
    startDate1: z.string().min(1, "Date de départ requise"),
    endDate1: z.string().min(1, "Date de retour requise"),
    startDate2: z.string().optional().or(z.literal("").transform(() => undefined)),
    endDate2: z.string().optional().or(z.literal("").transform(() => undefined)),
    deliveryAddress: z.string().trim().max(500).optional().or(z.literal("").transform(() => undefined)),
    observation: z.string().trim().max(2000).optional().or(z.literal("").transform(() => undefined)),
    items: z.array(itemSchema).min(1, "Ajoute au moins une robe")
  })
  .refine((d) => new Date(d.endDate1) >= new Date(d.startDate1), {
    message: "Période 1 : la date de retour doit être ≥ la date de départ",
    path: ["endDate1"]
  })
  .refine(
    (d) => !d.startDate2 || !d.endDate2 || new Date(d.endDate2) >= new Date(d.startDate2),
    {
      message: "Période 2 : la date de retour doit être ≥ la date de départ",
      path: ["endDate2"]
    }
  );

// État sérialisable retourné par les actions du form de location.
// `conflicts` permet au form de rendre des badges/erreurs ciblés par item,
// avec liens vers les locations bloquantes.
export type SerializableConflict = {
  variantId: string;
  productName: string;
  variantLabel: string;
  capacity: number;
  requested: number;
  engaged: number;
  available: number;
  period: 1 | 2;
  windowStart: string;
  windowEnd: string;
  overlaps: Array<{
    reservationId: string;
    reference: string;
    customerName: string;
    start: string;
    end: string;
    quantity: number;
    status: ReservationStatus;
    link: string;
  }>;
};

export type ReservationActionState = {
  error?: string;
  conflicts?: SerializableConflict[];
  values?: Record<string, string>;
  attempt?: number;
} | null;

function err(formData: FormData, error: string): ReservationActionState {
  return { error, values: valuesFromForm(formData), attempt: Date.now() };
}

function serializeConflict(c: ItemConflict): SerializableConflict {
  return {
    variantId: c.variantId,
    productName: c.productName,
    variantLabel: c.variantLabel,
    capacity: c.capacity,
    requested: c.requested,
    engaged: c.engaged,
    available: c.available,
    period: c.period,
    windowStart: c.windowStart.toISOString(),
    windowEnd: c.windowEnd.toISOString(),
    overlaps: c.overlaps.map((o) => ({
      reservationId: o.reservationId,
      reference: o.reference,
      customerName: o.customerName,
      start: o.start.toISOString(),
      end: o.end.toISOString(),
      quantity: o.quantity,
      status: o.status,
      link: o.link
    }))
  };
}

function conflictErr(
  formData: FormData,
  conflicts: ItemConflict[]
): ReservationActionState {
  const summary =
    conflicts.length === 1
      ? formatConflictMessage(conflicts[0])
      : `${conflicts.length} robe${conflicts.length > 1 ? "s" : ""} en conflit sur ces dates — voir le détail sous chaque ligne.`;
  return {
    error: summary,
    conflicts: conflicts.map(serializeConflict),
    values: valuesFromForm(formData),
    attempt: Date.now()
  };
}

function safeJsonParse<T>(v: FormDataEntryValue | null): T | null {
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

async function nextReference(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LOC-${year}-`;
  const count = await prisma.reservation.count({
    where: { reference: { startsWith: prefix } }
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

function computeTotals(
  items: { quantity: number; price: number; deposit: number }[],
  startDate1: string,
  endDate1: string,
  startDate2?: string,
  endDate2?: string
) {
  // Forfait par robe : la durée n'entre PAS dans le total location.
  const days1 = inclusiveDays(startDate1, endDate1);
  const days2 = startDate2 && endDate2 ? inclusiveDays(startDate2, endDate2) : 0;
  const totalDays = days1 + days2;
  const totalPrice = items.reduce(
    (acc, it) => acc + it.price * it.quantity,
    0
  );
  const totalDeposit = items.reduce((acc, it) => acc + it.deposit * it.quantity, 0);
  return { totalDays, totalPrice, totalDeposit };
}

export async function createReservation(
  _prev: ReservationActionState,
  formData: FormData
): Promise<ReservationActionState> {
  const session = await auth();
  if (!session?.user) return err(formData, "Non autorisé");

  const items = safeJsonParse<unknown[]>(formData.get("items")) ?? [];

  const parsed = reservationSchema.safeParse({
    customerId: formData.get("customerId") ?? "",
    startDate1: formData.get("startDate1") ?? "",
    endDate1: formData.get("endDate1") ?? "",
    startDate2: formData.get("startDate2") ?? "",
    endDate2: formData.get("endDate2") ?? "",
    deliveryAddress: formData.get("deliveryAddress") ?? "",
    observation: formData.get("observation") ?? "",
    items
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(formData, `${first.path.join(".") || "form"}: ${first.message}`);
  }

  // Vérification des conflits de location AVANT la création.
  // On agrège les quantités par variant pour gérer le cas où un même
  // variantId apparaît dans plusieurs lignes du form (jamais en pratique,
  // mais robust).
  const aggregated = new Map<string, number>();
  for (const it of parsed.data.items) {
    aggregated.set(it.variantId, (aggregated.get(it.variantId) ?? 0) + it.quantity);
  }
  const conflicts = await checkRentalConflicts({
    items: [...aggregated.entries()].map(([variantId, quantity]) => ({
      variantId,
      quantity
    })),
    startDate1: new Date(parsed.data.startDate1),
    endDate1: new Date(parsed.data.endDate1),
    startDate2: parsed.data.startDate2 ? new Date(parsed.data.startDate2) : null,
    endDate2: parsed.data.endDate2 ? new Date(parsed.data.endDate2) : null
  });
  if (conflicts.length > 0) {
    return conflictErr(formData, conflicts);
  }

  const { totalPrice, totalDeposit } = computeTotals(
    parsed.data.items,
    parsed.data.startDate1,
    parsed.data.endDate1,
    parsed.data.startDate2,
    parsed.data.endDate2
  );

  const reference = await nextReference();

  let createdId: string;
  try {
    const created = await prisma.reservation.create({
      data: {
        reference,
        customerId: parsed.data.customerId,
        startDate1: new Date(parsed.data.startDate1),
        endDate1: new Date(parsed.data.endDate1),
        startDate2: parsed.data.startDate2 ? new Date(parsed.data.startDate2) : null,
        endDate2: parsed.data.endDate2 ? new Date(parsed.data.endDate2) : null,
        deliveryAddress: parsed.data.deliveryAddress,
        observation: parsed.data.observation,
        totalPrice,
        totalDeposit,
        status: ReservationStatus.DRAFT,
        createdById: session.user.id,
        items: {
          create: parsed.data.items.map((it) => ({
            variantId: it.variantId,
            quantity: it.quantity,
            price: it.price,
            deposit: it.deposit
          }))
        }
      },
      select: { id: true }
    });
    createdId = created.id;
  } catch (e: unknown) {
    return err(formData, e instanceof Error ? e.message : "Erreur inattendue");
  }

  await logAudit({
    entityType: "Reservation",
    entityId: createdId,
    operation: "CREATE",
    diff: { after: { reference, customerId: parsed.data.customerId, totalPrice, totalDeposit } }
  });

  const customer = await prisma.customer.findUnique({
    where: { id: parsed.data.customerId },
    select: { firstName: true, lastName: true }
  });
  await notifyEveryone({
    type: "RENTAL_CREATED",
    title: `Nouvelle location ${reference}`,
    body: customer
      ? `Pour ${customer.firstName} ${customer.lastName} · départ le ${new Date(parsed.data.startDate1).toLocaleDateString("fr-FR")}`
      : undefined,
    link: `/rentals/${createdId}`,
    data: { reservationId: createdId, totalPrice }
  });

  revalidatePath("/rentals");
  redirect(`/rentals/${createdId}`);
}

export async function transitionStatus(
  reservationId: string,
  next: ReservationStatus,
  payment?: { kind: CashKind; method: CashMethod; amount: number; description?: string }
) {
  const session = await auth();
  if (!session?.user) throw new Error("Non autorisé");

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: reservationId },
      data: { status: next }
    });
    if (payment && payment.amount > 0) {
      await tx.cashTransaction.create({
        data: {
          reservationId,
          kind: payment.kind,
          method: payment.method,
          amount: payment.amount,
          description: payment.description,
          recordedById: session.user.id
        }
      });
    }
  });

  await logAudit({
    entityType: "Reservation",
    entityId: reservationId,
    operation: "UPDATE",
    diff: { after: { status: next, payment: payment ?? null } }
  });

  revalidatePath("/rentals");
  revalidatePath(`/rentals/${reservationId}`);
  revalidatePath("/dashboard");
}

export async function cancelReservation(reservationId: string) {
  await transitionStatus(reservationId, ReservationStatus.CANCELLED);
}

export async function deleteCashTransaction(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non autorisé");

  const tx = await prisma.cashTransaction.findUnique({
    where: { id },
    select: { reservationId: true, saleId: true }
  });
  if (!tx) return;

  await prisma.cashTransaction.delete({ where: { id } });

  await logAudit({ entityType: "CashTransaction", entityId: id, operation: "DELETE" });

  if (tx.reservationId) revalidatePath(`/rentals/${tx.reservationId}`);
  if (tx.saleId) revalidatePath(`/sales/${tx.saleId}`);
  revalidatePath("/rentals");
  revalidatePath("/dashboard");
}

const paymentSchema = z.object({
  kind: z.nativeEnum(CashKind),
  method: z.nativeEnum(CashMethod),
  amount: z.coerce.number().positive(),
  description: z.string().trim().max(500).optional().or(z.literal("").transform(() => undefined))
});

export async function recordPayment(
  reservationId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth();
  if (!session?.user) return { error: "Non autorisé" };

  const parsed = paymentSchema.safeParse({
    kind: formData.get("kind"),
    method: formData.get("method"),
    amount: formData.get("amount"),
    description: formData.get("description") ?? ""
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: `${first.path.join(".") || "form"}: ${first.message}` };
  }

  const created = await prisma.cashTransaction.create({
    data: {
      reservationId,
      kind: parsed.data.kind,
      method: parsed.data.method,
      amount: parsed.data.amount,
      description: parsed.data.description,
      recordedById: session.user.id
    }
  });

  await logAudit({
    entityType: "CashTransaction",
    entityId: created.id,
    operation: "CREATE",
    diff: { after: { kind: parsed.data.kind, amount: parsed.data.amount, reservationId } }
  });

  if (parsed.data.kind === "CLIENT_PAYMENT") {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        reference: true,
        customer: { select: { firstName: true, lastName: true } }
      }
    });
    await notifyEveryone({
      type: "RENTAL_PAYMENT",
      title: `Paiement reçu — ${reservation?.reference ?? "location"}`,
      body: reservation
        ? `${parsed.data.amount} de ${reservation.customer.firstName} ${reservation.customer.lastName}`
        : undefined,
      link: `/rentals/${reservationId}`
    });
  }

  revalidatePath(`/rentals/${reservationId}`);
  revalidatePath("/rentals");
  revalidatePath("/dashboard");
  return null;
}
