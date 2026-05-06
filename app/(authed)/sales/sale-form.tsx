"use client";

import { Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSection } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import { isoDate } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import type { SaleActionState } from "./actions";

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
  salePrice: number;
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
  unitPrice: number;
  quantity: number;
  stock: number;
};

export function SaleForm({
  action,
  customers,
  catalog
}: {
  action: (state: SaleActionState, formData: FormData) => Promise<SaleActionState>;
  customers: Customer[];
  catalog: CatalogProduct[];
}) {
  const today = isoDate(new Date());
  const [state, formAction, pending] = useActionState<SaleActionState, FormData>(
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

  const [saleDate, setSaleDate] = useState(today);
  const [items, setItems] = useState<Item[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const totalAmount = items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);

  const itemsForServer = useMemo(
    () =>
      items.map((it) => ({
        variantId: it.variantId,
        quantity: it.quantity,
        unitPrice: it.unitPrice
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
        unitPrice: product.salePrice,
        quantity: 1,
        stock: variant.quantityCurrent
      }
    ]);
    setPickerOpen(false);
  };

  return (
    <form action={formAction} className="space-y-10">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="items" value={JSON.stringify(itemsForServer)} />

      <FormSection
        title="Cliente"
        description="Optionnelle — laisse vide pour une vente anonyme."
      >
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
              aria-label="Retirer la cliente"
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
                placeholder="Rechercher (vide = vente anonyme)…"
                className="pl-10"
              />
            </div>
            {customerSearch && (
              <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200/70 bg-white">
                {filteredCustomers.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-zinc-500">
                    Aucune cliente.{" "}
                    <Link href="/customers/new" className="text-brand-600 hover:underline">
                      Ajouter une fiche
                    </Link>
                    .
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
            )}
          </div>
        )}
      </FormSection>

      <FormSection title="Date" description="Date à laquelle la vente a lieu.">
        <div className="space-y-1.5">
          <Label htmlFor="saleDate" required>Date de vente</Label>
          <Input
            id="saleDate"
            name="saleDate"
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            required
            className="max-w-xs"
          />
        </div>
      </FormSection>

      <FormSection
        title="Articles vendus"
        description="Le prix unitaire vient du catalogue mais reste modifiable. La validation décrémentera le stock."
      >
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/40 px-4 py-6 text-center text-sm text-zinc-500">
            Aucun article ajouté.
          </p>
        )}

        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((it) => {
              const overStock = it.quantity > it.stock;
              return (
                <li
                  key={it.key}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-xl border p-3",
                    overStock
                      ? "border-rose-200 bg-rose-50/40"
                      : "border-zinc-200/70 bg-white"
                  )}
                >
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
                    <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                      {it.colorHex && (
                        <span
                          className="h-2.5 w-2.5 rounded-full ring-1 ring-zinc-300"
                          style={{ backgroundColor: it.colorHex }}
                        />
                      )}
                      {it.variantLabel}
                      <span className="text-zinc-400">· stock {it.stock}</span>
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
                            x.key === it.key
                              ? { ...x, quantity: Math.max(1, Number(v) || 1) }
                              : x
                          )
                        )
                      }
                      width="w-16"
                    />
                    <Field
                      label="PU"
                      type="number"
                      value={it.unitPrice}
                      min={0}
                      step={0.01}
                      onChange={(v) =>
                        setItems((curr) =>
                          curr.map((x) =>
                            x.key === it.key
                              ? { ...x, unitPrice: Math.max(0, Number(v) || 0) }
                              : x
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
                  {overStock && (
                    <p className="w-full text-[11px] text-rose-700">
                      ⚠ Stock insuffisant ({it.stock} disponible{it.stock > 1 ? "s" : ""}).
                      La validation sera bloquée.
                    </p>
                  )}
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
          Ajouter un article
        </button>
      </FormSection>

      <div className="surface flex flex-col gap-3 bg-zinc-50/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <p className="text-zinc-500">Total de la vente</p>
          <p className="font-serif text-2xl text-zinc-900">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="flex items-center gap-3">
          <LinkButton href="/sales" variant="ghost">
            Annuler
          </LinkButton>
          <Button type="submit" disabled={pending || items.length === 0}>
            {pending ? "Création…" : "Créer le brouillon"}
          </Button>
        </div>
      </div>

      {state?.error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {state.error}
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

function Field({
  label,
  type,
  value,
  min,
  step,
  onChange,
  width
}: {
  label: string;
  type: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (v: string) => void;
  width: string;
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
          "focus-ring rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm",
          width
        )}
      />
    </div>
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
          <h3 className="font-serif text-xl text-zinc-900">Choisir un article</h3>
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
              Aucun résultat.{" "}
              <Link href="/products/new" className="text-brand-600 hover:underline">
                Ajouter un produit
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-3">
              {filtered.map((p) => (
                <li key={p.id} className="rounded-xl border border-zinc-200/70 bg-white p-3">
                  <div className="flex items-center gap-3">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.photoUrl}
                        alt={p.name}
                        className="h-12 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand-100 to-pink-100 font-serif text-brand-600/60">
                        {p.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-900">{p.name}</p>
                      <p className="text-[11px] text-zinc-400">{p.reference}</p>
                    </div>
                    <p className="text-xs text-zinc-500">{formatCurrency(p.salePrice)}</p>
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
