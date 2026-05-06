"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, null);

  return (
    <form action={formAction} className="space-y-4">
      {/* Re-monte le champ email avec la valeur saisie après chaque erreur,
          le password reste vide (best practice). */}
      <div key={state?.attempt ?? 0}>
        <Field
          id="email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          defaultValue={state?.email ?? ""}
        />
      </div>
      <Field
        id="password"
        name="password"
        type="password"
        label="Mot de passe"
        autoComplete="current-password"
      />

      {state?.error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}

function Field({
  id,
  name,
  type,
  label,
  autoComplete,
  defaultValue
}: {
  id: string;
  name: string;
  type: string;
  label: string;
  autoComplete?: string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-zinc-700">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className="focus-ring w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400"
      />
    </div>
  );
}
