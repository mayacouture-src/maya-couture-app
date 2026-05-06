"use client";

import { useActionState, useMemo } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldGrid, FormSection } from "@/components/ui/section";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { PhotoManager, type PhotoInput } from "@/components/ui/photo-manager";
import { CATEGORY_PRESETS } from "@/lib/presets";
import { VariantEditor, type VariantInput } from "./variant-editor";
import type { ProductActionState } from "./actions";

export type ProductFormValues = {
  reference: string;
  name: string;
  designer?: string | null;
  category?: string | null;
  description?: string | null;
  purchasePrice: number;
  rentalPrice: number;
  salePrice: number;
  deposit: number;
  marginBetweenRentalsDays: number;
  isRentable: boolean;
  isSellable: boolean;
  variants: Omit<VariantInput, "id">[];
  photos?: PhotoInput[];
};

export function ProductForm({
  defaultValues,
  action,
  submitLabel = "Enregistrer",
  isAdmin = true,
  existingCategories = []
}: {
  defaultValues?: ProductFormValues;
  action: (state: ProductActionState, formData: FormData) => Promise<ProductActionState>;
  submitLabel?: string;
  isAdmin?: boolean;
  existingCategories?: string[];
}) {
  const [state, formAction, pending] = useActionState<ProductActionState, FormData>(
    action,
    null
  );

  // Fusion des catégories : presets statiques + celles déjà utilisées en BDD,
  // sans doublons et triées par ordre alphabétique.
  const categoryOptions = useMemo(() => {
    const set = new Set<string>([...CATEGORY_PRESETS, ...existingCategories]);
    return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
  }, [existingCategories]);

  // Si le serveur renvoie une erreur, il nous renvoie aussi les valeurs saisies
  // (state.values). On les utilise comme nouveau defaultValue, et on re-monte
  // les sections "simples" via une key pour que React 19 ne reset pas tout.
  const submitted = state?.values;
  const formKey = state?.attempt ?? 0;

  const v = (key: string, fallback?: string) =>
    submitted ? (submitted[key] ?? "") : (fallback ?? "");
  const vNum = (key: string, fallback?: number) =>
    submitted ? (submitted[key] ?? "") : (fallback ?? 0);
  const vBool = (key: string, fallback: boolean) =>
    submitted ? submitted[key] === "on" : fallback;

  return (
    <form action={formAction} className="space-y-10">
      {/* Sections "simples" : re-mount au prochain submit raté pour conserver
          ce que l'utilisateur a tapé. PhotoManager et VariantEditor restent
          en dehors de cette key — ils gèrent déjà leur state localement. */}
      <div key={formKey} className="space-y-10">
        <FormSection
          title="Identification"
          description="Comment retrouver et reconnaître cette robe."
        >
          <FieldGrid cols={2}>
            <div className="space-y-1.5">
              <Label htmlFor="reference" required>Référence</Label>
              <Input
                id="reference"
                name="reference"
                defaultValue={v("reference", defaultValues?.reference)}
                placeholder="ex. MC-001"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name" required>Nom</Label>
              <Input
                id="name"
                name="name"
                defaultValue={v("name", defaultValues?.name)}
                placeholder="Robe blanche royale"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="designer">Créatrice / Maison</Label>
              <Input
                id="designer"
                name="designer"
                defaultValue={v("designer", defaultValues?.designer ?? "")}
                placeholder="Optionnel"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Catégorie</Label>
              <Input
                id="category"
                name="category"
                list="category-presets"
                defaultValue={v("category", defaultValues?.category ?? "")}
                placeholder="Mariage, soirée, karakou…"
              />
              <datalist id="category-presets">
                {categoryOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <p className="text-[11px] text-zinc-500">
                Choisis dans la liste, ou tape un nouveau nom — il sera ajouté
                aux catégories du catalogue.
              </p>
            </div>
          </FieldGrid>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={v("description", defaultValues?.description ?? "")}
              placeholder="Tissu, finitions, pièces incluses, contraintes d'entretien…"
            />
          </div>
        </FormSection>

        <FormSection
          title="Tarification"
          description="Tous les montants en dinars. Tu peux laisser à 0 ce qui ne s'applique pas."
        >
          <FieldGrid cols={2}>
            {isAdmin ? (
              <PriceField
                id="purchasePrice"
                label="Prix d'achat"
                hint="Coût d'acquisition"
                defaultValue={vNum("purchasePrice", defaultValues?.purchasePrice)}
              />
            ) : (
              // Champ caché pour préserver la valeur en BDD lors d'un save
              // par une vendeuse — l'action ignore aussi ce champ pour les
              // STAFF (defense in depth).
              <input
                type="hidden"
                name="purchasePrice"
                value={defaultValues?.purchasePrice ?? 0}
              />
            )}
            <PriceField
              id="rentalPrice"
              label="Prix de location"
              hint="Forfait par robe, toute durée"
              defaultValue={vNum("rentalPrice", defaultValues?.rentalPrice)}
            />
            <PriceField
              id="salePrice"
              label="Prix de vente"
              hint="Si vendable"
              defaultValue={vNum("salePrice", defaultValues?.salePrice)}
            />
            <PriceField
              id="deposit"
              label="Caution"
              hint="Montant bloqué"
              defaultValue={vNum("deposit", defaultValues?.deposit)}
            />
          </FieldGrid>
        </FormSection>

        <FormSection
          title="Disponibilité"
          description="Comment cette robe peut être proposée."
        >
          <div className="space-y-1.5">
            <Label htmlFor="marginBetweenRentalsDays">Marge entre 2 locations (jours)</Label>
            <Input
              id="marginBetweenRentalsDays"
              name="marginBetweenRentalsDays"
              type="number"
              min={0}
              defaultValue={vNum("marginBetweenRentalsDays", defaultValues?.marginBetweenRentalsDays ?? 0)}
              className="max-w-xs"
            />
            <p className="text-[11px] text-zinc-500">
              Délai de battement automatique pour le nettoyage / repassage.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle
              name="isRentable"
              label="Location"
              description="Disponible à la location"
              defaultChecked={vBool("isRentable", defaultValues?.isRentable ?? true)}
            />
            <Toggle
              name="isSellable"
              label="Vente"
              description="Disponible à la vente"
              defaultChecked={vBool("isSellable", defaultValues?.isSellable ?? true)}
            />
          </div>
        </FormSection>
      </div>

      <FormSection
        title="Photos"
        description="La première photo apparaîtra en couverture sur les cartes du catalogue."
      >
        <PhotoManager defaultValue={defaultValues?.photos} />
      </FormSection>

      <FormSection
        title="Variantes"
        description="Une ligne par combinaison taille × couleur que tu possèdes en stock."
      >
        <VariantEditor defaultValue={defaultValues?.variants} />
      </FormSection>

      {state?.error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {state.error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-zinc-200/70 pt-6">
        <LinkButton href="/products" variant="ghost">
          Annuler
        </LinkButton>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function PriceField({
  id,
  label,
  hint,
  defaultValue
}: {
  id: string;
  label: string;
  hint?: string;
  defaultValue?: number | string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} hint={hint}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaultValue ?? 0}
          className="pr-12"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-400">
          DA
        </span>
      </div>
    </div>
  );
}
