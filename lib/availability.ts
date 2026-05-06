// Disponibilité et conflits de location.
//
// Une location bloque ses variants pour la fenêtre [start, end + margin] où
// margin = product.marginBetweenRentalsDays (battement de nettoyage). Le
// stock disponible pour une fenêtre = quantityCurrent du variant - somme
// des quantités déjà engagées par d'autres locations qui chevauchent la
// fenêtre.
//
// Statuts qui bloquent : DRAFT, CONFIRMED, IN_PROGRESS, RETURNED.
// (RETURNED bloque jusqu'à end+margin pour laisser le temps au nettoyage.)
// COMPLETED et CANCELLED ne bloquent jamais.

import { ReservationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const BLOCKING_STATUSES: ReservationStatus[] = [
  ReservationStatus.DRAFT,
  ReservationStatus.CONFIRMED,
  ReservationStatus.IN_PROGRESS,
  ReservationStatus.RETURNED
];

export type DateWindow = {
  start: Date;
  end: Date;
};

export type ReservationOverlap = {
  reservationId: string;
  reference: string;
  customerName: string;
  start: Date; // début effectif de la période en conflit
  end: Date; // fin effective (sans la marge)
  marginDays: number;
  quantity: number;
  status: ReservationStatus;
  link: string; // lien vers /rentals/[id]
};

export type ItemConflict = {
  variantId: string;
  productName: string;
  variantLabel: string;
  capacity: number;
  requested: number;
  engaged: number;
  available: number;
  // Indicateur de quelle période du form est en conflit (1 ou 2)
  period: 1 | 2;
  windowStart: Date;
  windowEnd: Date;
  overlaps: ReservationOverlap[];
};

// Ajoute N jours à une date sans muter l'argument.
function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

// Deux fenêtres se chevauchent si chacune commence avant la fin de l'autre,
// en jours pleins (les bornes sont inclusives — startDate / endDate sont les
// dates de départ/retour, donc une location du 5 au 10 occupe le 10 lui aussi).
function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart.getTime() <= bEnd.getTime() && aEnd.getTime() >= bStart.getTime();
}

// ─── Disponibilité d'un variant sur une fenêtre ──────────────────────────

export type VariantAvailability = {
  variantId: string;
  capacity: number;
  engaged: number;
  available: number;
  overlaps: ReservationOverlap[];
};

export async function getVariantAvailability(
  variantId: string,
  window: DateWindow,
  excludeReservationId?: string
): Promise<VariantAvailability> {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: {
      quantityCurrent: true,
      product: { select: { marginBetweenRentalsDays: true } }
    }
  });

  if (!variant) {
    return {
      variantId,
      capacity: 0,
      engaged: 0,
      available: 0,
      overlaps: []
    };
  }

  const margin = variant.product.marginBetweenRentalsDays ?? 0;

  // On va chercher les ReservationItem qui pointent ce variant, puis on
  // filtre côté JS pour tenir compte des deux périodes possibles + de la
  // marge. C'est plus simple et plus correct qu'une requête SQL avec OR.
  const items = await prisma.reservationItem.findMany({
    where: {
      variantId,
      ...(excludeReservationId
        ? { reservationId: { not: excludeReservationId } }
        : {}),
      reservation: {
        status: { in: BLOCKING_STATUSES }
      }
    },
    include: {
      reservation: {
        select: {
          id: true,
          reference: true,
          status: true,
          startDate1: true,
          endDate1: true,
          startDate2: true,
          endDate2: true,
          customer: { select: { firstName: true, lastName: true } }
        }
      }
    }
  });

  const overlaps: ReservationOverlap[] = [];
  let engaged = 0;

  for (const it of items) {
    const r = it.reservation;
    const periods: Array<{ s: Date; e: Date }> = [
      { s: r.startDate1, e: r.endDate1 }
    ];
    if (r.startDate2 && r.endDate2) {
      periods.push({ s: r.startDate2, e: r.endDate2 });
    }

    for (const p of periods) {
      const blockEnd = addDays(p.e, margin);
      if (rangesOverlap(window.start, window.end, p.s, blockEnd)) {
        engaged += it.quantity;
        overlaps.push({
          reservationId: r.id,
          reference: r.reference,
          customerName: `${r.customer.firstName} ${r.customer.lastName}`,
          start: p.s,
          end: p.e,
          marginDays: margin,
          quantity: it.quantity,
          status: r.status,
          link: `/rentals/${r.id}`
        });
        break; // une seule période compte par réservation
      }
    }
  }

  return {
    variantId,
    capacity: variant.quantityCurrent,
    engaged,
    available: Math.max(0, variant.quantityCurrent - engaged),
    overlaps
  };
}

// ─── Vérification globale d'une réservation ──────────────────────────────

export type CheckRentalInput = {
  items: { variantId: string; quantity: number }[];
  startDate1: Date;
  endDate1: Date;
  startDate2?: Date | null;
  endDate2?: Date | null;
  excludeReservationId?: string;
};

export async function checkRentalConflicts(
  input: CheckRentalInput
): Promise<ItemConflict[]> {
  if (input.items.length === 0) return [];

  const variantIds = [...new Set(input.items.map((i) => i.variantId))];
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      size: true,
      color: true,
      product: {
        select: { name: true, marginBetweenRentalsDays: true }
      }
    }
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  // Préfetch tous les ReservationItem en conflit potentiel pour les variants
  // demandés (1 query pour toute la réservation).
  const blockingItems = await prisma.reservationItem.findMany({
    where: {
      variantId: { in: variantIds },
      ...(input.excludeReservationId
        ? { reservationId: { not: input.excludeReservationId } }
        : {}),
      reservation: { status: { in: BLOCKING_STATUSES } }
    },
    include: {
      reservation: {
        select: {
          id: true,
          reference: true,
          status: true,
          startDate1: true,
          endDate1: true,
          startDate2: true,
          endDate2: true,
          customer: { select: { firstName: true, lastName: true } }
        }
      }
    }
  });

  const periodsToCheck: Array<{ p: 1 | 2; start: Date; end: Date }> = [
    { p: 1, start: input.startDate1, end: input.endDate1 }
  ];
  if (input.startDate2 && input.endDate2) {
    periodsToCheck.push({ p: 2, start: input.startDate2, end: input.endDate2 });
  }

  const conflicts: ItemConflict[] = [];

  for (const wanted of input.items) {
    const vInfo = variantMap.get(wanted.variantId);
    if (!vInfo) continue;
    const margin = vInfo.product.marginBetweenRentalsDays ?? 0;

    for (const period of periodsToCheck) {
      let engaged = 0;
      const overlaps: ReservationOverlap[] = [];

      for (const it of blockingItems) {
        if (it.variantId !== wanted.variantId) continue;
        const r = it.reservation;
        const existingPeriods: Array<{ s: Date; e: Date }> = [
          { s: r.startDate1, e: r.endDate1 }
        ];
        if (r.startDate2 && r.endDate2) {
          existingPeriods.push({ s: r.startDate2, e: r.endDate2 });
        }
        for (const ep of existingPeriods) {
          const blockEnd = addDays(ep.e, margin);
          if (rangesOverlap(period.start, period.end, ep.s, blockEnd)) {
            engaged += it.quantity;
            overlaps.push({
              reservationId: r.id,
              reference: r.reference,
              customerName: `${r.customer.firstName} ${r.customer.lastName}`,
              start: ep.s,
              end: ep.e,
              marginDays: margin,
              quantity: it.quantity,
              status: r.status,
              link: `/rentals/${r.id}`
            });
            break;
          }
        }
      }

      // Récupère la capacité du variant
      const cap = await prisma.productVariant.findUnique({
        where: { id: wanted.variantId },
        select: { quantityCurrent: true }
      });
      const capacity = cap?.quantityCurrent ?? 0;
      const available = Math.max(0, capacity - engaged);

      if (wanted.quantity > available) {
        conflicts.push({
          variantId: wanted.variantId,
          productName: vInfo.product.name,
          variantLabel: `${vInfo.size} · ${vInfo.color}`,
          capacity,
          requested: wanted.quantity,
          engaged,
          available,
          period: period.p,
          windowStart: period.start,
          windowEnd: period.end,
          overlaps
        });
      }
    }
  }

  return conflicts;
}

export function formatConflictMessage(c: ItemConflict): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  return `${c.productName} (${c.variantLabel}) — ${c.requested} demandé${c.requested > 1 ? "s" : ""}, ${c.available} disponible${c.available > 1 ? "s" : ""} sur la période ${c.period} (${fmt(c.windowStart)} → ${fmt(c.windowEnd)})`;
}
