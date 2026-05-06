"use client";

import { AlertTriangle, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldGrid, FormSection } from "@/components/ui/section";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { inclusiveDays, isoDate } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import type { ReservationActionState, SerializableConflict } from "./actions";

type AvailabilityResult = {
  variantId: string;
  capacity: number;
  period1: { available: number; engaged: number };
  period2: { available: number; engaged: number } | null;
};

type Customer = { id: string; firstName: string; lastName: string; phone: string };

type Variant = {
  id: string;
  size: string;
  color: string;
  colorHex: string | null;
  quantityCurrent: number;
};

type CatalogProduct = {
  id: string;
  reference: string;
  name: string;
  rentalPrice: number;
  deposit: number;
  photoUrl: string | null;
  variants: Variant[];
};

type Item = {
  key: string;
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  colorHex: string | null;
  photoUrl: string | null;
  price: number;
  deposit: number;
  quantity: number;
};

export function ReservationForm({
  action,
  customers,
  catalog
}: {
  action: (
    state: ReservationActionState,
    formData: FormData
  ) => Promise<ReservationActionState>;
  customers: Customer[];
  catalog: CatalogProduct[];
}) {
  const today = isoDate(new Date());
  const [state, formAction, pending] = useActionState<ReservationActionState, FormData>(
    action,
    null
  );

  const [customerId, setCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0, 8);
    const q = customerSearch.toLowerCase();
    return customers
      .filter(
        (c) =>
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q) ||
          c.phone.includes(q)
      )
      .slice(0, 12);
  }, [customers, customerSearch]);
  const selectedCustomer = customers.find((c) => c.id === customerId);

  const [startDate1, setStartDate1] = useState(today);
  const [endDate1, setEndDate1] = useState(today);
  const [hasPeriod2, setHasPeriod2] = useState(false);
  const [startDate2, setStartDate2] = useState("");
  const [endDate2, setEndDate2] = useState("");

  const [items, setItems] = useState<Item[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // ─── Disponibilité live ────────────────────────────────────────────────
  // Recalculée dès que les dates ou les items changent.
  const [availability, setAvailability] = useState<Map<string, AvailabilityResult>>(
    () => new Map()
  );
  const [availLoading, setAvailLoading] = useState(false);
  const availRequestId = useRef(0);

  useEffect(() => {
    if (items.length === 0) {
      setAvailability(new Map());
      return;
    }
    if (!startDate1 || !endDate1) return;
    const reqId = ++availRequestId.current;
    setAvailLoading(true);
    const ctrl = new AbortController();
    fetch("/api/rentals/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        variantIds: items.map((i) => i.variantId),
        startDate1,
        endDate1,
        startDate2: hasPeriod2 && startDate2 ? startDate2 : null,
        endDate2: hasPeriod2 && endDate2 ? endDate2 : null
      })
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { items: AvailabilityResult[] } | null) => {
        if (!json || reqId !== availRequestId.current) return;
        const map = new Map<string, AvailabilityResult>();
        for (const r of json.items) map.set(r.variantId, r);
        setAvailability(map);
      })
      .catch(() => undefined)
      .finally(() => {
        if (reqId === availRequestId.current) setAvailLoading(false);
      });
    return () => ctrl.abort();
  }, [items, startDate1, endDate1, hasPeriod2, startDate2, endDate2]);

  // Disponibilité minimale (la plus contraignante entre les 2 périodes)
  const availableFor = (variantId: string): number | null => {
    const a = availability.get(variantId);
    if (!a) return null;
    if (a.period2) return Math.min(a.period1.available, a.period2.available);
    return a.period1.available;
  };

  // Conflits par variant indexés pour affichage sous chaque ligne
  const conflictsByVariant = useMemo(() => {
    const map = new Map<string, SerializableConflict[]>();
    for (const c of state?.conflicts ?? []) {
      const arr = map.get(c.variantId) ?? [];
      arr.push(c);
      map.set(c.variantId, arr);
    }
    return map;
  }, [state?.conflicts]);

  const hasUiConflict = items.some((it) => {
    const avail = availableFor(it.variantId);
    return avail !== null && it.quantity > avail;
  });

  const days1 = inclusiveDays(startDate1, endDate1);
  const days2 = hasPeriod2 && startDate2 && endDate2 ? inclusiveDays(startDate2, endDate2) : 0;
  const totalDays = days1 + days2;

  // Forfait par robe — la durée n'entre pas dans le calcul du total location.
  const totalPrice = items.reduce(
    (acc, it) => acc + it.price * it.quantity,
    0
  );
  const totalDeposit = items.reduce((acc, it) => acc + it.deposit * it.quantity, 0);

  const itemsForServer = useMemo(
    () =>
      items.map((it) => ({
        variantId: it.variantId,
        quantity: it.quantity,
        price: it.price,
        deposit: it.deposit
      })),
    [items]
  );

  const addVariant = (product: CatalogProduct, variant: Variant) => {
    const key = `${product.id}-${variant.id}`;
    if (items.some((i) => i.key === key)) return;
    setItems((curr) => [
      ...curr,
      {
        key,
        variantId: variant.id,
        productId: product.id,
        productName: product.name,
        variantLabel: `${variant.size} · ${variant.color}`,
        colorHex: variant.colorHex,
        photoUrl: product.photoUrl,
        price: product.rentalPrice,
        deposit: product.deposit,
        quantity: 1
      }
    ]);
    setPickerOpen(false);
  };

  return (
    <form action={formAction} className="space-y-10">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="items" value={JSON.stringify(itemsForServer)} />

      <FormSection title="Cliente" description="Choisis la cliente du dossier.">
        {selectedCustomer ? (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-brand-200 bg-brand-50/40 px-4 py-3">
            <div>
              <p className="font-medium text-zinc-900">
                {selectedCustomer.firstName} {selectedCustomer.lastName}
              </p>
              <p className="text-xs text-zinc-500">{selectedCustomer.phone}</p>
            </div>
            <button
              type="button"
              onClick={() => setCustomerId("")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-white"
              aria-label="Changer de cliente"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Rechercher par nom ou téléphone…"
                className="pl-10"
              />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200/70 bg-white">
              {filteredCustomers.length === 0 ? (
                <p className="px-4 py-3 text-sm text-zinc-500">
                  Aucune cliente trouvée. <Link href="/customers/new" className="text-brand-600 hover:underline">Ajouter une fiche</Link> d&apos;abord.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-200/70">
                  {filteredCustomers.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setCustomerId(c.id)}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-zinc-50"
                      >
                        <span className="text-sm font-medium text-zinc-900">
                          {c.firstName} {c.lastName}
                        </span>
                        <span className="text-xs text-zinc-500">{c.phone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </FormSection>

      <FormSection
        title="Dates"
        description="Période 1 obligatoire. Ajoute une 2e période pour les mariages (fiançailles + cérémonie)."
      >
        <FieldGrid cols={2}>
          <DateField id="startDate1" label="Départ" value={startDate1} onChange={setStartDate1} required />
          <DateField id="endDate1" label="Retour" value={endDate1} onChange={setEndDate1} required />
        </FieldGrid>
        <p className="text-[11px] text-zinc-500">
          Période 1 : {days1 || 0} jour{days1 > 1 ? "s" : ""}
        </p>

        {!hasPeriod2 ? (
          <button
            type="button"
            onClick={() => setHasPeriod2(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter une seconde période
          </button>
        ) : (
          <div className="space-y-2 rounded-xl border border-zinc-200/70 bg-zinc-50/40 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-700">Période 2</p>
              <button
                type="button"
                onClick={() => {
                  setHasPeriod2(false);
                  setStartDate2("");
                  setEndDate2("");
                }}
                className="text-xs text-zinc-500 hover:text-rose-600"
              >
                Retirer
              </button>
            </div>
            <FieldGrid cols={2}>
              <DateField id="startDate2" label="Départ" value={startDate2} onChange={setStartDate2} />
              <DateField id="endDate2" label="Retour" value={endDate2} onChange={setEndDate2} />
            </FieldGrid>
            <p className="text-[11px] text-zinc-500">
              Période 2 : {days2 || 0} jour{days2 > 1 ? "s" : ""}
            </p>
          </div>
        )}
      </FormSection>

      <FormSection
        title="Robes louées"
        description="Choisis une variante (taille × couleur). Le prix par jour vient du catalogue mais reste modifiable."
      >
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/40 px-4 py-6 text-center text-sm text-zinc-500">
            Aucune robe ajoutée pour le moment.
          </p>
        )}

        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((it) => {
              const avail = availableFor(it.variantId);
              const overbooked = avail !== null && it.quantity > avail;
              const serverConflicts = conflictsByVariant.get(it.variantId) ?? [];
              return (
                <li
                  key={it.key}
                  className={cn(
                    "rounded-xl border bg-white p-3 transition",
                    overbooked || serverConflicts.length > 0
                      ? "border-rose-300 bg-rose-50/40"
                      : "border-zinc-200/70"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    {it.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.photoUrl}
                        alt={it.productName}
                        className="h-14 w-12 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-100 to-pink-100 text-sm font-serif text-brand-600/60">
                        {it.productName.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {it.productName}
                      </p>
                      <p className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                        {it.colorHex && (
                          <span
                            className="h-2.5 w-2.5 rounded-full ring-1 ring-zinc-300"
                            style={{ backgroundColor: it.colorHex }}
                          />
                        )}
                        {it.variantLabel}
                        <AvailabilityBadge avail={avail} loading={availLoading} />
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Field
                        label="Qté"
                        type="number"
                        value={it.quantity}
                        min={1}
                        onChange={(v) =>
                          setItems((curr) =>
                            curr.map((x) =>
                              x.key === it.key ? { ...x, quantity: Math.max(1, Number(v) || 1) } : x
                            )
                          )
                        }
                        width="w-16"
                        invalid={overbooked}
                      />
                      <Field
                        label="Prix"
                        type="number"
                        value={it.price}
                        min={0}
                        step={0.01}
                        onChange={(v) =>
                          setItems((curr) =>
                            curr.map((x) =>
                              x.key === it.key ? { ...x, price: Math.max(0, Number(v) || 0) } : x
                            )
                          )
                        }
                        width="w-24"
                      />
                      <Field
                        label="Caution"
                        type="number"
                        value={it.deposit}
                        min={0}
                        step={0.01}
                        onChange={(v) =>
                          setItems((curr) =>
                            curr.map((x) =>
                              x.key === it.key ? { ...x, deposit: Math.max(0, Number(v) || 0) } : x
                            )
                          )
                        }
                        width="w-24"
                      />
                      <button
                        type="button"
                        onClick={() => setItems((curr) => curr.filter((x) => x.key !== it.key))}
                        aria-label="Retirer"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {overbooked && avail !== null && (
                    <p className="mt-2 text-xs text-rose-700">
                      Stock insuffisant : {it.quantity} demandée
                      {it.quantity > 1 ? "s" : ""} mais seulement {avail} disponible
                      {avail > 1 ? "s" : ""} sur ces dates.
                    </p>
                  )}
                  {serverConflicts.map((c, i) => (
                    <div
                      key={i}
                      className="mt-2 space-y-1 rounded-lg border border-rose-200 bg-white p-2 text-xs text-rose-800"
                    >
                      <p>
                        <span className="font-semibold">Période {c.period}</span>{" "}
                        — {c.requested} demandée{c.requested > 1 ? "s" : ""}, {c.available}{" "}
                        disponible{c.available > 1 ? "s" : ""} sur {c.capacity} en stock.
                      </p>
                      {c.overlaps.length > 0 && (
                        <ul className="space-y-0.5">
                          {c.overlaps.map((o) => (
                            <li key={o.reservationId}>
                              Bloquée par{" "}
                              <Link
                                href={o.link}
                                target="_blank"
                                className="font-medium underline underline-offset-2 hover:text-rose-900"
                              >
                                {o.reference}
                              </Link>{" "}
                              ({o.customerName}) ·{" "}
                              {new Date(o.start).toLocaleDateString("fr-FR")} →{" "}
                              {new Date(o.end).toLocaleDateString("fr-FR")} ·{" "}
                              {o.quantity} unité{o.quantity > 1 ? "s" : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter une robe
        </button>
      </FormSection>

      <FormSection
        title="Livraison & notes"
        description="Optionnels mais utiles pour le contrat."
      >
        <div key={state?.attempt ?? 0} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="deliveryAddress">Adresse de livraison</Label>
            <Input
              id="deliveryAddress"
              name="deliveryAddress"
              defaultValue={state?.values?.deliveryAddress ?? ""}
              placeholder="Si différente de l'adresse cliente"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="observation">Observation</Label>
            <Textarea
              id="observation"
              name="observation"
              rows={3}
              defaultValue={state?.values?.observation ?? ""}
              placeholder="Détails utiles (livraison, retouches, contraintes…)"
            />
          </div>
        </div>
      </FormSection>

      <div className="surface flex flex-col gap-3 bg-zinc-50/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <p className="text-zinc-500">
            {items.length} robe{items.length > 1 ? "s" : ""} · {totalDays} jour
            {totalDays > 1 ? "s" : ""} de location
          </p>
          <p className="font-serif text-2xl text-zinc-900">
            {formatCurrency(totalPrice)}
            <span className="ml-2 text-sm font-sans text-zinc-500">
              + {formatCurrency(totalDeposit)} de caution
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LinkButton href="/rentals" variant="ghost">
            Annuler
          </LinkButton>
          <Button
            type="submit"
            disabled={pending || !customerId || items.length === 0 || hasUiConflict}
          >
            {pending ? "Création…" : "Créer le brouillon"}
          </Button>
        </div>
      </div>

      {state?.error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {pickerOpen && (
        <ProductPicker
          catalog={catalog}
          onPick={addVariant}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </form>
  );
}

function DateField({
  id,
  label,
  value,
  onChange,
  required
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} required={required}>{label}</Label>
      <Input
        id={id}
        name={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}

function Field({
  label,
  type,
  value,
  min,
  step,
  onChange,
  width,
  invalid
}: {
  label: string;
  type: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (v: string) => void;
  width: string;
  invalid?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-zinc-400">{label}</span>
      <input
        type={type}
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "focus-ring rounded-lg border bg-white px-2 py-1.5 text-sm",
          invalid
            ? "border-rose-300 text-rose-700 ring-1 ring-rose-200"
            : "border-zinc-200",
          width
        )}
      />
    </div>
  );
}

function AvailabilityBadge({
  avail,
  loading
}: {
  avail: number | null;
  loading: boolean;
}) {
  if (loading && avail === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
        Calcul…
      </span>
    );
  }
  if (avail === null) return null;
  const tone =
    avail === 0
      ? "bg-rose-100 text-rose-700"
      : avail < 2
        ? "bg-amber-100 text-amber-800"
        : "bg-emerald-100 text-emerald-800";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        tone
      )}
    >
      {avail} dispo{avail > 1 ? "s" : ""}
    </span>
  );
}

function ProductPicker({
  catalog,
  onPick,
  onClose
}: {
  catalog: CatalogProduct[];
  onPick: (p: CatalogProduct, v: Variant) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!q) return catalog;
    const needle = q.toLowerCase();
    return catalog.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.reference.toLowerCase().includes(needle)
    );
  }, [catalog, q]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="surface flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200/70 px-5 py-4">
          <h3 className="font-serif text-xl text-zinc-900">Choisir une robe</h3>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-zinc-200/70 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher par nom ou référence…"
              className="pl-10"
            />
          </div>
        </div>
        <div className="overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">
              Aucun résultat. <Link href="/products/new" className="text-brand-600 hover:underline">Ajouter une robe</Link>.
            </p>
          ) : (
            <ul className="space-y-3">
              {filtered.map((p) => (
                <li key={p.id} className="rounded-xl border border-zinc-200/70 bg-white p-3">
                  <div className="flex items-center gap-3">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt={p.name} className="h-12 w-10 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-12 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand-100 to-pink-100 font-serif text-brand-600/60">
                        {p.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-900">{p.name}</p>
                      <p className="text-[11px] text-zinc-400">{p.reference}</p>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {formatCurrency(p.rentalPrice)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.variants.length === 0 ? (
                      <span className="text-xs text-zinc-400">Aucune variante</span>
                    ) : (
                      p.variants.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => onPick(p, v)}
                          disabled={v.quantityCurrent === 0}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {v.colorHex && (
                            <span
                              className="h-2.5 w-2.5 rounded-full ring-1 ring-zinc-300"
                              style={{ backgroundColor: v.colorHex }}
                            />
                          )}
                          {v.size} · {v.color}
                          <span className="text-zinc-400">({v.quantityCurrent})</span>
                        </button>
                      ))
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
