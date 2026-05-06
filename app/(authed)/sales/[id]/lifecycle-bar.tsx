"use client";

import { CashKind, type SaleStatus } from "@prisma/client";
import { ArrowRight, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cancelSale, completeSale } from "../actions";

export function LifecycleBar({
  saleId,
  status,
  summary
}: {
  saleId: string;
  status: SaleStatus;
  summary: { totalAmount: number; paid: number };
}) {
  const [pending, startTransition] = useTransition();
  const [completeOpen, setCompleteOpen] = useState(false);
  const [amount, setAmount] = useState<number>(
    Math.max(0, summary.totalAmount - summary.paid)
  );
  const [error, setError] = useState<string | null>(null);

  if (status === "CANCELLED") return null;

  return (
    <div className="flex items-center gap-2">
      {status === "DRAFT" && (
        <>
          <Button onClick={() => setCompleteOpen(true)}>
            Valider la vente
            <ArrowRight className="h-4 w-4" />
          </Button>
          {completeOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 px-4 backdrop-blur-sm"
              onClick={() => setCompleteOpen(false)}
            >
              <div
                className="surface w-full max-w-sm p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-serif text-xl text-zinc-900">Valider la vente</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  La validation décrémentera le stock des articles vendus. Cette action
                  est réversible (annulation = restitution du stock).
                </p>

                <div className="mt-5 space-y-1.5">
                  <Label htmlFor="lc-amount">Paiement encaissé</Label>
                  <div className="relative">
                    <Input
                      id="lc-amount"
                      type="number"
                      min={0}
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value) || 0)}
                      className="pr-12"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-400">
                      DA
                    </span>
                  </div>
                </div>

                {error && (
                  <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                  </p>
                )}

                <div className="mt-6 flex items-center justify-end gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCompleteOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          setError(null);
                          await completeSale(
                            saleId,
                            amount > 0
                              ? { kind: CashKind.CLIENT_PAYMENT, amount }
                              : undefined
                          );
                          setCompleteOpen(false);
                        } catch (e) {
                          setError(
                            e instanceof Error ? e.message : "Erreur inattendue"
                          );
                        }
                      })
                    }
                  >
                    {pending ? "…" : "Valider"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        trigger={
          <Button variant="danger" size="sm">
            <XCircle className="h-3.5 w-3.5" />
            {status === "COMPLETED" ? "Annuler la vente" : "Annuler"}
          </Button>
        }
        title="Annuler cette vente ?"
        description={
          status === "COMPLETED"
            ? "Le stock des articles sera restitué."
            : "Le brouillon passera en Annulée. Les mouvements de caisse déjà enregistrés restent en historique."
        }
        confirmLabel="Confirmer l'annulation"
        onConfirm={() =>
          startTransition(async () => {
            await cancelSale(saleId);
          })
        }
      />

      {pending && <span className="text-xs text-zinc-400">…</span>}
    </div>
  );
}
