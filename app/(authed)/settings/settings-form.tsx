"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldGrid, FormSection } from "@/components/ui/section";
import { updateSettings, type SettingsActionState } from "./actions";

type Defaults = {
  companyName: string;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  currency: string;
};

export function SettingsForm({ defaults }: { defaults: Defaults }) {
  const [state, formAction, pending] = useActionState<SettingsActionState, FormData>(
    updateSettings,
    null
  );

  const submitted = state?.values;
  const formKey = state?.attempt ?? 0;
  const v = (key: string, fallback: string) =>
    submitted ? (submitted[key] ?? "") : fallback;

  return (
    <form action={formAction} className="space-y-10">
      <div key={formKey} className="space-y-10">
        <FormSection
          title="Boutique"
          description="Ces informations apparaîtront sur les contrats et les factures imprimés."
        >
          <Field
            id="companyName"
            label="Nom de la boutique"
            required
            defaultValue={v("companyName", defaults.companyName)}
          />
          <Field
            id="companyAddress"
            label="Adresse"
            defaultValue={v("companyAddress", defaults.companyAddress ?? "")}
          />
          <FieldGrid cols={2}>
            <Field
              id="companyPhone"
              label="Téléphone"
              defaultValue={v("companyPhone", defaults.companyPhone ?? "")}
            />
            <Field
              id="companyEmail"
              label="Email"
              type="email"
              defaultValue={v("companyEmail", defaults.companyEmail ?? "")}
            />
          </FieldGrid>
        </FormSection>

        <FormSection
          title="Devise"
          description="Devise par défaut affichée dans toute l'application."
        >
          <div className="space-y-1.5">
            <Label htmlFor="currency">Devise</Label>
            <select
              id="currency"
              name="currency"
              defaultValue={v("currency", defaults.currency)}
              className="focus-ring w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="DZD">DZD — Dinar algérien</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </div>
        </FormSection>
      </div>

      {state?.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Paramètres enregistrés.
        </div>
      )}

      <div className="flex items-center justify-end border-t border-zinc-200/70 pt-6">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  type = "text",
  defaultValue
}: {
  id: string;
  label: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} required={required}>{label}</Label>
      <Input id={id} name={id} type={type} required={required} defaultValue={defaultValue} />
    </div>
  );
}
