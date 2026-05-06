"use client";

import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteCashMovement } from "./actions";

export function DeleteMovementButton({ id, label }: { id: string; label: string }) {
  return (
    <ConfirmDialog
      trigger={
        <button
          type="button"
          aria-label="Supprimer"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 lg:opacity-60 lg:group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      }
      title="Supprimer ce mouvement ?"
      description={
        <>
          <span className="font-medium text-zinc-700">{label}</span> sera retiré de
          l&apos;historique de caisse. Cette action est irréversible.
        </>
      }
      confirmLabel="Supprimer"
      onConfirm={() => deleteCashMovement(id)}
    />
  );
}
