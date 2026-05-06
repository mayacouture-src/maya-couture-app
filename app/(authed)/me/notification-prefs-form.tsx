"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_LABEL,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory
} from "@/lib/notifications";
import { updateNotificationPrefs, type PrefsState } from "./actions";

export function NotificationPrefsForm({
  defaultPrefs,
  isAdmin
}: {
  defaultPrefs: Record<NotificationCategory, boolean>;
  isAdmin: boolean;
}) {
  const [state, formAction, pending] = useActionState<PrefsState, FormData>(
    updateNotificationPrefs,
    { kind: "idle" }
  );

  if (isAdmin) {
    return (
      <p className="text-sm text-zinc-500">
        En tant que gérante, tu reçois <strong>toutes</strong> les notifications. Pas de
        filtrage possible côté admin.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        {NOTIFICATION_CATEGORIES.map((cat) => (
          <label
            key={cat}
            className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-zinc-200/70 bg-white px-4 py-3 transition hover:border-zinc-300"
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-zinc-900">{CATEGORY_LABEL[cat]}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{descriptionFor(cat)}</p>
            </div>
            <input
              name="category"
              value={cat}
              type="checkbox"
              defaultChecked={defaultPrefs[cat]}
              className="mt-1 h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
            />
          </label>
        ))}
      </div>

      {state.kind === "error" && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </p>
      )}
      {state.kind === "saved" && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Préférences mises à jour.
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

function descriptionFor(cat: NotificationCategory): string {
  switch (cat) {
    case "rentals":
      return "Nouvelles locations, paiements de location, rappels de retour.";
    case "sales":
      return "Ventes validées et paiements de ventes.";
    case "cash":
      return "Dépenses, alimentations et retraits de caisse.";
    case "briefing":
      return "Récap matin (~8h) et soir (~18h) des sorties/retours.";
    case "deposits":
      return "Cautions non rendues après 7 jours.";
    case "stock":
      return "Variantes épuisées (stock à 0).";
    case "generic":
      return "Annonces et messages divers.";
  }
}
