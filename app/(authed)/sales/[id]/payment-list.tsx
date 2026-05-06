import type { CashKind, CashTransaction } from "@prisma/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { DeletePaymentButton } from "./delete-payment-button";

const KIND_LABEL: Record<CashKind, string> = {
  CLIENT_PAYMENT: "Paiement",
  DEPOSIT_HELD: "Caution prise",
  DEPOSIT_BACK: "Caution rendue",
  EXPENSE: "Dépense",
  CASH_REFILL: "Alimentation",
  WITHDRAWAL: "Retrait",
  REFUND: "Remboursement",
  FEE: "Pénalité"
};

const KIND_TONE: Record<CashKind, string> = {
  CLIENT_PAYMENT: "text-emerald-700",
  DEPOSIT_HELD: "text-amber-700",
  DEPOSIT_BACK: "text-zinc-600",
  EXPENSE: "text-rose-700",
  CASH_REFILL: "text-emerald-700",
  WITHDRAWAL: "text-rose-700",
  REFUND: "text-rose-700",
  FEE: "text-amber-700"
};

export function PaymentList({ items }: { items: CashTransaction[] }) {
  if (items.length === 0) {
    return (
      <p className="mt-3 rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-xs text-zinc-500">
        Aucun mouvement enregistré.
      </p>
    );
  }

  return (
    <ul className="mt-3 divide-y divide-zinc-200/70">
      {items.map((it) => (
        <li
          key={it.id}
          className="group flex items-center justify-between gap-3 py-2 text-sm"
        >
          <div className="min-w-0 flex-1">
            <p className={`font-medium ${KIND_TONE[it.kind]}`}>{KIND_LABEL[it.kind]}</p>
            <p className="text-xs text-zinc-500">
              {formatDate(it.occurredAt)}
              {it.description ? ` · ${it.description}` : ""}
            </p>
          </div>
          <p className={`font-medium ${KIND_TONE[it.kind]}`}>
            {formatCurrency(Number(it.amount))}
          </p>
          <DeletePaymentButton
            id={it.id}
            label={`${KIND_LABEL[it.kind]} ${formatCurrency(Number(it.amount))}`}
          />
        </li>
      ))}
    </ul>
  );
}
