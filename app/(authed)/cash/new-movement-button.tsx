"use client";

import { CashKind } from "@prisma/client";
import { Plus, X } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isoDate } from "@/lib/dates";
import { createCashMovement, type CashActionState } from "./actions";

const FREE_KINDS: { value: CashKind; label: string; sign: "in" | "out" }[] = [
  { value: "EXPENSE", label: "Dépense", sign: "out" },
  { value: "CASH_REFILL", label: "Alimentation caisse", sign: "in" },
  { value: "WITHDRAWAL", label: "Retrait", sign: "out" },
  { value: "FEE", label: "Pénalité reçue", sign: "in" }
];

export function NewMovementButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CashActionState, FormData>(
    async (prev, formData) => {
      const result = await createCashMovement(prev, formData);
      if (!result) setOpen(false);
      return result;
    },
    null
  );

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nouveau mouvement
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/40 px-4 backdrop-blur-sm sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="surface w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-serif text-xl text-zinc-900">Nouveau mouvement</h3>
                <p className="text-xs text-zinc-500">
                  Pour les paiements clients, utilise plutôt la fiche location.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={formAction} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="kind">Type</Label>
                <select
                  id="kind"
                  name="kind"
                  defaultValue="EXPENSE"
                  className="focus-ring w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm"
                >
                  {FREE_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label} {k.sign === "in" ? "(+)" : "(−)"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="amount">Montant</Label>
                  <div className="relative">
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      className="pr-12"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-400">
                      DA
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="occurredAt">Date</Label>
                  <Input
                    id="occurredAt"
                    name="occurredAt"
                    type="date"
                    defaultValue={isoDate(new Date())}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="category">Catégorie (optionnel)</Label>
                <Input
                  id="category"
                  name="category"
                  placeholder="ex. Électricité, fournitures…"
                  list="cash-categories"
                />
                <datalist id="cash-categories">
                  <option value="Électricité" />
                  <option value="Eau" />
                  <option value="Loyer" />
                  <option value="Fournitures" />
                  <option value="Nettoyage" />
                  <option value="Couture / retouches" />
                  <option value="Marketing" />
                  <option value="Salaire" />
                  <option value="Internet / téléphone" />
                </datalist>
              </div>

              <div className="space-y-1">
                <Label htmlFor="description">Note</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={2}
                  placeholder="Détails du mouvement…"
                />
              </div>

              {state?.error && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {state.error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)} type="button">
                  Annuler
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
