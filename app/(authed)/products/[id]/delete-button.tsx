"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function DeleteButton({
  onConfirm,
  productName
}: {
  onConfirm: () => Promise<void>;
  productName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-3.5 w-3.5" />
        Supprimer
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
            <h3 className="font-serif text-xl text-zinc-900">Supprimer cette robe ?</h3>
            <p className="mt-2 text-sm text-zinc-500">
              <span className="font-medium text-zinc-700">{productName}</span> sera
              définitivement retirée du catalogue, ainsi que toutes ses variantes.
              Cette action est irréversible.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={pending}
                onClick={() => startTransition(() => onConfirm())}
              >
                {pending ? "Suppression…" : "Confirmer la suppression"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
