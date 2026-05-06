"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Variant = "danger" | "primary";

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "danger",
  onConfirm
}: {
  trigger: React.ReactElement<{ onClick?: React.MouseEventHandler }>;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  onConfirm: () => Promise<unknown> | unknown;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const TriggerEl = trigger;
  const wrappedTrigger = (
    <TriggerEl.type
      {...TriggerEl.props}
      onClick={() => setOpen(true)}
    />
  );

  return (
    <>
      {wrappedTrigger}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 px-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="surface w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={cn("font-serif text-xl text-zinc-900")}>{title}</h3>
            {description && (
              <div className="mt-2 text-sm text-zinc-500">{description}</div>
            )}
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                {cancelLabel}
              </Button>
              <Button
                variant={variant === "danger" ? "danger" : "primary"}
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await onConfirm();
                    setOpen(false);
                  })
                }
              >
                {pending ? "…" : confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
