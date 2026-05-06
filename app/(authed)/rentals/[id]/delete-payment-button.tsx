"use client";

import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteCashTransaction } from "../actions";

export function DeletePaymentButton({
  id,
  label
}: {
  id: string;
  label: string;
}) {
  return (
    <ConfirmDialog
      trigger={
        <button
          type="button"
          aria-label="Supprimer ce mouvement"
          className="rounded-md p-1 text-zinc-300 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      }
      title="Supprimer ce mouvement ?"
      description={
        <>
          <span className="font-medium text-zinc-700">{label}</span> sera retiré de
          l&apos;historique. Cette action est irréversible.
        </>
      }
      confirmLabel="Supprimer"
      onConfirm={() => deleteCashTransaction(id)}
    />
  );
}
