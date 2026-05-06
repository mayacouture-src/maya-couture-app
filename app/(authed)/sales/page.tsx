import type { SaleStatus } from "@prisma/client";
import { Filter, Plus, Search } from "lucide-react";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<SaleStatus, string> = {
  DRAFT: "Brouillon",
  COMPLETED: "Validée",
  CANCELLED: "Annulée"
};

const STATUS_TONE: Record<SaleStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200"
};

type SearchParams = Promise<{
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  customer?: "with" | "anon" | "";
}>;

export default async function SalesPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const status = isStatus(params.status) ? params.status : undefined;
  const from = params.from ? safeDate(params.from) : undefined;
  const to = params.to ? safeDate(params.to, true) : undefined;
  const customer = params.customer ?? "";

  const sales = await prisma.sale.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { reference: { contains: q, mode: "insensitive" } },
                { customer: { firstName: { contains: q, mode: "insensitive" } } },
                { customer: { lastName: { contains: q, mode: "insensitive" } } }
              ]
            }
          : {},
        status ? { status } : {},
        from ? { saleDate: { gte: from } } : {},
        to ? { saleDate: { lte: to } } : {},
        customer === "with" ? { customerId: { not: null } } : {},
        customer === "anon" ? { customerId: null } : {}
      ]
    },
    include: {
      customer: { select: { firstName: true, lastName: true } },
      _count: { select: { items: true } }
    },
    orderBy: { saleDate: "desc" },
    take: 200
  });

  const hasFilter = !!(q || status || from || to || customer);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Atelier"
        title="Ventes"
        description="Toutes les ventes définitives — décrémentent le stock à la validation."
        action={
          <div className="flex items-center gap-2">
            <ExportButton entity="sales" />
            <LinkButton href="/sales/new">
              <Plus className="h-4 w-4" />
              Nouvelle vente
            </LinkButton>
          </div>
        }
      />

      <FiltersBar
        q={q}
        status={status}
        from={params.from}
        to={params.to}
        customer={customer}
      />

      {sales.length === 0 ? (
        <div className="surface relative overflow-hidden p-12 text-center">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-white to-white" />
          <p className="font-serif text-xl text-zinc-900">
            {hasFilter ? "Aucune vente trouvée" : "Aucune vente"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            {hasFilter
              ? "Modifie ou réinitialise les filtres."
              : "Crée ta première vente définitive."}
          </p>
          {!hasFilter && (
            <div className="mt-5">
              <LinkButton href="/sales/new">
                <Plus className="h-4 w-4" />
                Nouvelle vente
              </LinkButton>
            </div>
          )}
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <ul className="divide-y divide-zinc-200/70">
            {sales.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/sales/${s.id}`}
                  className="flex flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-zinc-50/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <p className="font-medium text-zinc-900">
                        {s.customer
                          ? `${s.customer.firstName} ${s.customer.lastName}`
                          : "Vente anonyme"}
                      </p>
                      <span className="text-xs text-zinc-400">{s.reference}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {formatDate(s.saleDate)} · {s._count.items} article
                      {s._count.items > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-right font-medium text-zinc-900">
                      {formatCurrency(Number(s.totalAmount))}
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1",
                        STATUS_TONE[s.status]
                      )}
                    >
                      {STATUS_LABEL[s.status]}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function isStatus(s: string | undefined): s is SaleStatus {
  return !!s && (["DRAFT", "COMPLETED", "CANCELLED"] as string[]).includes(s);
}

function safeDate(s: string, endOfDay = false): Date | undefined {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

function FiltersBar({
  q,
  status,
  from,
  to,
  customer
}: {
  q: string;
  status?: SaleStatus;
  from?: string;
  to?: string;
  customer: string;
}) {
  return (
    <form action="/sales" className="surface flex flex-wrap items-end gap-3 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
        <Filter className="h-3.5 w-3.5" />
        Filtres
      </div>

      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Référence, nom de cliente…"
          className="focus-ring w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm placeholder:text-zinc-400"
        />
      </div>

      <FilterSelect
        name="status"
        label="Statut"
        defaultValue={status ?? ""}
        options={[
          { value: "", label: "Tous" },
          { value: "DRAFT", label: "Brouillons" },
          { value: "COMPLETED", label: "Validées" },
          { value: "CANCELLED", label: "Annulées" }
        ]}
      />

      <FilterSelect
        name="customer"
        label="Cliente"
        defaultValue={customer}
        options={[
          { value: "", label: "Toutes" },
          { value: "with", label: "Avec cliente" },
          { value: "anon", label: "Anonymes" }
        ]}
      />

      <DateField name="from" label="Vente ≥" defaultValue={from} />
      <DateField name="to" label="Vente ≤" defaultValue={to} />

      <div className="ml-auto flex gap-2">
        <Link
          href="/sales"
          className="rounded-lg px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
        >
          Réinitialiser
        </Link>
        <button
          type="submit"
          className="rounded-lg bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800"
        >
          Appliquer
        </button>
      </div>
    </form>
  );
}

function FilterSelect({
  name,
  label,
  defaultValue,
  options
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="focus-ring rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateField({
  name,
  label,
  defaultValue
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      <input
        type="date"
        name={name}
        defaultValue={defaultValue ?? ""}
        className="focus-ring rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700"
      />
    </label>
  );
}
