"use client";

import { useActionState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldGrid, FormSection } from "@/components/ui/section";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerActionState } from "./actions";

export type CustomerFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  idDocumentRef?: string | null;
  measurements?: { bust?: number; waist?: number; hips?: number; height?: number } | null;
  notes?: string | null;
};

export function CustomerForm({
  defaultValues,
  action,
  submitLabel = "Enregistrer"
}: {
  defaultValues?: CustomerFormValues;
  action: (state: CustomerActionState, formData: FormData) => Promise<CustomerActionState>;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<CustomerActionState, FormData>(
    action,
    null
  );

  const submitted = state?.values;
  const formKey = state?.attempt ?? 0;
  const v = (key: string, fallback?: string) =>
    submitted ? (submitted[key] ?? "") : (fallback ?? "");
  const vNum = (key: string, fallback?: number) =>
    submitted ? (submitted[key] ?? "") : (fallback ?? "");

  return (
    <form action={formAction} className="space-y-10">
      <div key={formKey} className="space-y-10">
        <FormSection
          title="Identité"
          description="Les informations essentielles pour la contacter."
        >
          <FieldGrid cols={2}>
            <FieldText
              id="firstName"
              label="Prénom"
              required
              defaultValue={v("firstName", defaultValues?.firstName)}
            />
            <FieldText
              id="lastName"
              label="Nom"
              required
              defaultValue={v("lastName", defaultValues?.lastName)}
            />
            <FieldText
              id="phone"
              label="Téléphone"
              required
              type="tel"
              defaultValue={v("phone", defaultValues?.phone)}
              placeholder="06 12 34 56 78"
            />
            <FieldText
              id="email"
              label="Email"
              type="email"
              defaultValue={v("email", defaultValues?.email ?? "")}
              placeholder="Optionnel"
            />
          </FieldGrid>
        </FormSection>

        <FormSection
          title="Adresse"
          description="Apparaîtra sur le contrat et la facture."
        >
          <FieldText
            id="address"
            label="Adresse"
            defaultValue={v("address", defaultValues?.address ?? "")}
            placeholder="12 rue de la Paix"
          />
          <FieldGrid cols={2}>
            <FieldText
              id="postalCode"
              label="Code postal"
              defaultValue={v("postalCode", defaultValues?.postalCode ?? "")}
            />
            <FieldText
              id="city"
              label="Ville"
              defaultValue={v("city", defaultValues?.city ?? "")}
            />
          </FieldGrid>
        </FormSection>

        <FormSection
          title="Pièce d'identité"
          description="Référence textuelle uniquement — ne stocke jamais la photo de la pièce."
        >
          <FieldText
            id="idDocumentRef"
            label="N° de pièce d'identité"
            defaultValue={v("idDocumentRef", defaultValues?.idDocumentRef ?? "")}
            placeholder="ex. CNI 1234567890"
          />
        </FormSection>

        <FormSection
          title="Mensurations"
          description="Optionnel. Utile pour proposer la bonne taille à la prochaine visite."
        >
          <FieldGrid cols={2}>
            <FieldNumber
              id="bust"
              label="Poitrine"
              unit="cm"
              defaultValue={vNum("bust", defaultValues?.measurements?.bust)}
            />
            <FieldNumber
              id="waist"
              label="Taille"
              unit="cm"
              defaultValue={vNum("waist", defaultValues?.measurements?.waist)}
            />
            <FieldNumber
              id="hips"
              label="Hanches"
              unit="cm"
              defaultValue={vNum("hips", defaultValues?.measurements?.hips)}
            />
            <FieldNumber
              id="height"
              label="Hauteur"
              unit="cm"
              defaultValue={vNum("height", defaultValues?.measurements?.height)}
            />
          </FieldGrid>
        </FormSection>

        <FormSection
          title="Notes"
          description="Informations utiles pour les prochaines visites."
        >
          <Textarea
            name="notes"
            rows={4}
            defaultValue={v("notes", defaultValues?.notes ?? "")}
            placeholder="Préfère le bordeaux, allergique au polyester, paye toujours en CB…"
          />
        </FormSection>
      </div>

      {state?.error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {state.error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-zinc-200/70 pt-6">
        <LinkButton href="/customers" variant="ghost">
          Annuler
        </LinkButton>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function FieldText({
  id,
  label,
  required,
  type = "text",
  defaultValue,
  placeholder
}: {
  id: string;
  label: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} required={required}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
    </div>
  );
}

function FieldNumber({
  id,
  label,
  unit,
  defaultValue
}: {
  id: string;
  label: string;
  unit?: string;
  defaultValue?: number | string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} hint={unit}>{label}</Label>
      <Input
        id={id}
        name={id}
        type="number"
        min={0}
        step="0.5"
        defaultValue={defaultValue ?? ""}
      />
    </div>
  );
}
