"use client";

import { Copy, KeyRound } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ResetPasswordState } from "../actions";

export function ResetPasswordCard({
  action
}: {
  action: (state: ResetPasswordState, formData: FormData) => Promise<ResetPasswordState>;
}) {
  const [state, formAction, pending] = useActionState<ResetPasswordState, FormData>(
    action,
    { kind: "idle" }
  );
  const [copied, setCopied] = useState(false);

  return (
    <div className="surface p-6">
      <p className="font-serif text-base text-zinc-900">Réinitialiser le mot de passe</p>
      <p className="mt-1 text-sm text-zinc-500">
        Génère un nouveau mot de passe temporaire. L&apos;ancien sera invalidé immédiatement.
      </p>

      {state.kind === "reset" ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Nouveau mot de passe
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900">
              {state.password}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(state.password).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
          <p className="mt-2 text-xs text-emerald-700">
            Transmets-le à la personne — il ne sera plus affiché.
          </p>
        </div>
      ) : (
        <form action={formAction} className="mt-4">
          {state.kind === "error" && state.error && (
            <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {state.error}
            </p>
          )}
          <Button type="submit" variant="secondary" disabled={pending}>
            <KeyRound className="h-4 w-4" />
            {pending ? "Génération…" : "Générer un nouveau mot de passe"}
          </Button>
        </form>
      )}
    </div>
  );
}
