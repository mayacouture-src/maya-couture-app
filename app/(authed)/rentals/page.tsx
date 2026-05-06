import { ReservationStatus } from "@prisma/client";
import { Filter, Plus, Search } from "lucide-react";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: { value: ReservationStatus | ""; label: string }[] = [
  { value: "", label: "Tous" },
  { value: "DRAFT", label: "Brouillons" },
  { value: "CONFIRMED", label: "Confirmés" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "RETURNED", label: "Retournés" },
  { value: "COMPLETED", label: "Clôturés" },
  { value: "CANCELLED", label: "Annulés" }
];

type SearchParams = Promise<{
  q?: string;
  status?: string;
  from?: string;
  to?: string;
}>;

export default async function RentalsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const status = isStatus(params.status) ? params.status : undefined;
  const from = params.from ? safeDate(params.from) : undefined;
  const to = params.to ? safeDate(params.to, true) : undefined;

  const reservations = await prisma.reservation.findMany({
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
        from || to
          ? {
              OR: [
                from && to
                  ? { startDate1: { gte: from, lte: to } }
                  : from
                    ? { startDate1: { gte: from } }
                    : { startDate1: { lte: to as Date } }
              ]
            }
          : {}
      ]
    },
    include: {
      customer: { select: { firstName: true, lastName: true } },
      _count: { select: { items: true } }
    },
    orderBy: [{ status: "asc" }, { startDate1: "desc" }],
    take: 200
  });

  const hasFilter = !!(q || status || from || to);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Atelier"
        title="Locations"
        description="Tous les dossiers de location, du brouillon à la clôture."
        action={
          <div className="flex items-center gap-2">
            <ExportButton entity="rentals" />
            <LinkButton href="/rentals/new">
              <Plus className="h-4 w-4" />
              Nouvelle location
            </LinkButton>
          </div>
        }
      />

      <FiltersBar q={q} status={status} from={params.from} to={params.to} />

      {reservations.length === 0 ? (
        <EmptyRentals hasFilter={hasFilter} />
      ) : (
        <div className="surface overflow-hidden">
          <ul className="divide-y divide-zinc-200/70">
            {reservations.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/rentals/${r.id}`}
                  className="flex flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-zinc-50/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <p className="font-medium text-zinc-900">
                        {r.customer.firstName} {r.customer.lastName}
                      </p>
                      <span className="text-xs text-zinc-400">{r.reference}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {formatDate(r.startDate1)} → {formatDate(r.endDate1)}
                      {r.startDate2 && r.endDate2 && (
                        <>
                          {" · "}
                          {formatDate(r.startDate2)} → {formatDate(r.endDate2)}
                        </>
                      )}
                      {" · "}
                      {r._count.items} robe{r._count.items > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-right font-medium text-zinc-900">
                      {formatCurrency(Number(r.totalPrice))}
                    </p>
                    <StatusBadge status={r.status} />
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

function isStatus(s: string | undefined): s is ReservationStatus {
  return !!s && (["DRAFT", "CONFIRMED", "IN_PROGRESS", "RETURNED", "COMPLETED", "CANCELLED"] as string[]).includes(s);
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
  to
}: {
  q: string;
  status?: ReservationStatus;
  from?: string;
  to?: string;
}) {
  return (
    <form action="/rentals" className="surface flex flex-wrap items-end gap-3 p-4">
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
        options={STATUS_OPTIONS}
      />

      <DateField name="from" label="Départ ≥" defaultValue={from} />
      <DateField name="to" label="Départ ≤" defaultValue={to} />

      <div className="ml-auto flex gap-2">
        <Link
          href="/rentals"
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

function EmptyRentals({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="surface relative overflow-hidden p-12 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-white to-white" />
      {hasFilter ? (
        <>
          <p className="font-serif text-xl text-zinc-900">Aucune location trouvée</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            Modifie ou réinitialise les filtres pour voir d&apos;autres dossiers.
          </p>
        </>
      ) : (
        <>
          <p className="font-serif text-xl text-zinc-900">Aucune location</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            Crée ton premier dossier pour démarrer le suivi des départs et des retours.
          </p>
          <div className="mt-5">
            <LinkButton href="/rentals/new">
              <Plus className="h-4 w-4" />
              Nouvelle location
            </LinkButton>
          </div>
        </>
      )}
    </div>
  );
}
