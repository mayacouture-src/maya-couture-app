"use client";

import type { ReservationStatus } from "@prisma/client";
import { CashKind, CashMethod } from "@prisma/client";
import { ArrowRight, XCircle } from "lucide-react";
// Toujours en espèces — la boutique n'accepte pas d'autre moyen.
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { cancelReservation, transitionStatus } from "../actions";

type Summary = {
  totalPrice: number;
  totalDeposit: number;
  paid: number;
  depositHeld: number;
  depositBack: number;
};

export function LifecycleBar({
  reservationId,
  status,
  summary
}: {
  reservationId: string;
  status: ReservationStatus;
  summary: Summary;
}) {
  const [pending, startTransition] = useTransition();
  const isFinal = status === "COMPLETED" || status === "CANCELLED";

  return (
    <div className="flex items-center gap-2">
      {status === "DRAFT" && (
        <TransitionWithPayment
          reservationId={reservationId}
          buttonLabel="Confirmer la location"
          modalTitle="Confirmer la location"
          modalIntro="La cliente verse-t-elle un acompte maintenant ?"
          paymentLabel="Acompte versé"
          defaultAmount={Math.max(0, summary.totalPrice - summary.paid)}
          paymentKind={CashKind.CLIENT_PAYMENT}
          nextStatus="CONFIRMED"
          allowZero
        />
      )}
      {status === "CONFIRMED" && (
        <TransitionWithPayment
          reservationId={reservationId}
          buttonLabel="Marquer la sortie"
          modalTitle="Marquer la sortie"
          modalIntro="Combien de caution prends-tu maintenant ?"
          paymentLabel="Caution prise"
          defaultAmount={Math.max(0, summary.totalDeposit - summary.depositHeld)}
          paymentKind={CashKind.DEPOSIT_HELD}
          nextStatus="IN_PROGRESS"
          extraNote={
            summary.totalPrice - summary.paid > 0
              ? `Solde restant à encaisser : ${formatCurrency(summary.totalPrice - summary.paid)}`
              : undefined
          }
          allowZero
        />
      )}
      {status === "IN_PROGRESS" && (
        <ConfirmDialog
          trigger={
            <Button>
              Marquer le retour
              <ArrowRight className="h-4 w-4" />
            </Button>
          }
          title="Marquer le retour"
          description="Les robes sont revenues en boutique. Tu pourras gérer la caution à la clôture."
          confirmLabel="Confirmer le retour"
          variant="primary"
          onConfirm={() =>
            startTransition(async () => {
              await transitionStatus(reservationId, "RETURNED");
            })
          }
        />
      )}
      {status === "RETURNED" && (
        <TransitionWithPayment
          reservationId={reservationId}
          buttonLabel="Clôturer la location"
          modalTitle="Clôturer la location"
          modalIntro="Combien de caution rends-tu à la cliente ?"
          paymentLabel="Caution rendue"
          defaultAmount={Math.max(0, summary.depositHeld - summary.depositBack)}
          paymentKind={CashKind.DEPOSIT_BACK}
          nextStatus="COMPLETED"
          extraNote={
            summary.totalPrice - summary.paid > 0
              ? `⚠ Solde non payé : ${formatCurrency(summary.totalPrice - summary.paid)}. Pense à l'encaisser avant clôture.`
              : "Solde réglé. La location peut être clôturée."
          }
          allowZero
        />
      )}

      {!isFinal && (
        <ConfirmDialog
          trigger={
            <Button variant="danger" size="sm">
              <XCircle className="h-3.5 w-3.5" />
              Annuler
            </Button>
          }
          title="Annuler ce dossier ?"
          description="Le dossier passera en Annulée. Les mouvements de caisse déjà enregistrés restent en historique."
          confirmLabel="Confirmer l'annulation"
          onConfirm={() =>
            startTransition(async () => {
              await cancelReservation(reservationId);
            })
          }
        />
      )}

      {pending && <span className="text-xs text-zinc-400">…</span>}
    </div>
  );
}

function TransitionWithPayment({
  reservationId,
  buttonLabel,
  modalTitle,
  modalIntro,
  paymentLabel,
  defaultAmount,
  paymentKind,
  nextStatus,
  extraNote,
  allowZero
}: {
  reservationId: string;
  buttonLabel: string;
  modalTitle: string;
  modalIntro: string;
  paymentLabel: string;
  defaultAmount: number;
  paymentKind: CashKind;
  nextStatus: ReservationStatus;
  extraNote?: string;
  allowZero?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        {buttonLabel}
        <ArrowRight className="h-4 w-4" />
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 px-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="surface w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-xl text-zinc-900">{modalTitle}</h3>
            <p className="mt-1 text-sm text-zinc-500">{modalIntro}</p>

            <div className="mt-5 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="lc-amount">{paymentLabel}</Label>
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
            </div>

            {extraNote && (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {extraNote}
              </p>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              {allowZero && amount === 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await transitionStatus(reservationId, nextStatus);
                      setOpen(false);
                    })
                  }
                >
                  Passer sans paiement
                </Button>
              )}
              <Button
                size="sm"
                disabled={pending || (amount === 0 && !allowZero)}
                onClick={() =>
                  startTransition(async () => {
                    await transitionStatus(
                      reservationId,
                      nextStatus,
                      amount > 0
                        ? { kind: paymentKind, method: CashMethod.CASH, amount }
                        : undefined
                    );
                    setOpen(false);
                  })
                }
              >
                {pending ? "…" : "Confirmer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
