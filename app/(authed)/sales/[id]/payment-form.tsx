"use client";

import { CashKind } from "@prisma/client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordSalePayment } from "../actions";

const KIND_LABEL: Record<CashKind, string> = {
  CLIENT_PAYMENT: "Paiement cliente",
  DEPOSIT_HELD: "Caution prise",
  DEPOSIT_BACK: "Caution rendue",
  EXPENSE: "Dépense",
  CASH_REFILL: "Alimentation caisse",
  WITHDRAWAL: "Retrait",
  REFUND: "Remboursement",
  FEE: "Pénalité"
};

const RELEVANT_KINDS: CashKind[] = ["CLIENT_PAYMENT", "REFUND", "FEE"];

export function PaymentForm({ saleId }: { saleId: string }) {
  const action = recordSalePayment.bind(null, saleId);
  const [state, formAction, pending] = useActionState<
    { error?: string } | null,
    FormData
  >(action, null);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
        Enregistrer un mouvement
      </p>

      <div className="space-y-1">
        <Label htmlFor="kind">Type</Label>
        <select
          id="kind"
          name="kind"
          defaultValue="CLIENT_PAYMENT"
          className="focus-ring w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm"
        >
          {RELEVANT_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </div>

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
        <Label htmlFor="description">Note (optionnel)</Label>
        <Input id="description" name="description" placeholder="ex. Paiement total" />
      </div>

      {state?.error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
