import type { ReservationStatus } from "@prisma/client";

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  DRAFT: "Brouillon",
  CONFIRMED: "Confirmée",
  IN_PROGRESS: "Sortie",
  RETURNED: "Retournée",
  COMPLETED: "Clôturée",
  CANCELLED: "Annulée"
};

export const STATUS_TONE: Record<ReservationStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  CONFIRMED: "bg-amber-50 text-amber-800 ring-amber-200",
  IN_PROGRESS: "bg-brand-50 text-brand-700 ring-brand-200",
  RETURNED: "bg-pink-50 text-pink-700 ring-pink-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200"
};

// Le bouton d'action principal selon l'état courant.
export const PRIMARY_ACTION: Partial<
  Record<ReservationStatus, { label: string; nextStatus: ReservationStatus }>
> = {
  DRAFT: { label: "Confirmer la location", nextStatus: "CONFIRMED" },
  CONFIRMED: { label: "Marquer la sortie", nextStatus: "IN_PROGRESS" },
  IN_PROGRESS: { label: "Marquer le retour", nextStatus: "RETURNED" },
  RETURNED: { label: "Clôturer la location", nextStatus: "COMPLETED" }
};
