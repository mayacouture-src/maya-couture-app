"use client";

import { Power, PowerOff } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function ToggleStatusButton({
  action,
  isActive,
  disabled
}: {
  action: () => Promise<void>;
  isActive: boolean;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant={isActive ? "danger" : "secondary"}
      disabled={disabled || pending}
      onClick={() => {
        const ok = window.confirm(
          isActive
            ? "Désactiver ce compte ? La personne ne pourra plus se connecter."
            : "Réactiver ce compte ?"
        );
        if (!ok) return;
        start(async () => {
          try {
            await action();
          } catch (e: unknown) {
            window.alert(e instanceof Error ? e.message : "Erreur inattendue");
          }
        });
      }}
    >
      {isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
      {pending ? "…" : isActive ? "Désactiver" : "Réactiver"}
    </Button>
  );
}
