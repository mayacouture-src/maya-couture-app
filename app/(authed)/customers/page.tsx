import { Filter, Phone, Plus, Search } from "lucide-react";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  city?: string;
  activity?: "with" | "without" | "";
}>;

export default async function CustomersPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const city = params.city ?? "";
  const activity = params.activity ?? "";

  const customers = await prisma.customer.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { email: { contains: q, mode: "insensitive" } }
              ]
            }
          : {},
        city ? { city } : {}
      ]
    },
    include: {
      _count: { select: { reservations: true, sales: true } }
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 300
  });

  const filtered = customers.filter((c) => {
    const total = c._count.reservations + c._count.sales;
    if (activity === "with") return total > 0;
    if (activity === "without") return total === 0;
    return true;
  });

  const cities = await prisma.customer.findMany({
    where: { city: { not: null } },
    select: { city: true },
    distinct: ["city"],
    orderBy: { city: "asc" }
  });

  const hasFilter = !!(q || city || activity);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Atelier"
        title="Clientes"
        description="Annuaire de toutes les personnes qui louent ou achètent chez toi."
        action={
          <div className="flex items-center gap-2">
            <ExportButton entity="customers" />
            <LinkButton href="/customers/new">
              <Plus className="h-4 w-4" />
              Nouvelle cliente
            </LinkButton>
          </div>
        }
      />

      <FiltersBar
        q={q}
        city={city}
        activity={activity}
        cities={cities.map((c) => c.city).filter(Boolean) as string[]}
      />

      {filtered.length === 0 ? (
        <EmptyCustomers hasFilter={hasFilter} />
      ) : (
        <div className="surface overflow-hidden">
          <ul className="divide-y divide-zinc-200/70">
            {filtered.map((c) => {
              const fullName = `${c.firstName} ${c.lastName}`.trim();
              const totalActivity = c._count.reservations + c._count.sales;
              return (
                <li key={c.id}>
                  <Link
                    href={`/customers/${c.id}`}
                    className="group flex items-center gap-4 px-5 py-4 transition hover:bg-zinc-50/60"
                  >
                    <Avatar name={fullName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <p className="truncate font-medium text-zinc-900">{fullName}</p>
                        {c.city && (
                          <span className="text-xs text-zinc-400">· {c.city}</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {c.phone}
                        </span>
                        {c.email && <span className="truncate">{c.email}</span>}
                      </div>
                    </div>
                    <div className="hidden text-right text-xs sm:block">
                      <p className="text-zinc-500">
                        {totalActivity > 0 ? (
                          <>
                            <span className="font-medium text-zinc-900">
                              {totalActivity}
                            </span>{" "}
                            dossier{totalActivity > 1 ? "s" : ""}
                          </>
                        ) : (
                          <span className="text-zinc-400">Pas encore de dossier</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-zinc-400">
                        Ajoutée le {formatDate(c.createdAt)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function FiltersBar({
  q,
  city,
  activity,
  cities
}: {
  q: string;
  city: string;
  activity: string;
  cities: string[];
}) {
  return (
    <form action="/customers" className="surface flex flex-wrap items-end gap-3 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
        <Filter className="h-3.5 w-3.5" />
        Filtres
      </div>

      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Nom, téléphone, email…"
          className="focus-ring w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm placeholder:text-zinc-400"
        />
      </div>

      <FilterSelect
        name="city"
        label="Ville"
        defaultValue={city}
        options={[
          { value: "", label: "Toutes" },
          ...cities.map((c) => ({ value: c, label: c }))
        ]}
      />

      <FilterSelect
        name="activity"
        label="Activité"
        defaultValue={activity}
        options={[
          { value: "", label: "Toutes" },
          { value: "with", label: "Avec dossier" },
          { value: "without", label: "Sans dossier" }
        ]}
      />

      <div className="ml-auto flex gap-2">
        <Link
          href="/customers"
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

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-pink-100 text-sm font-semibold text-brand-700">
      {initials || "·"}
    </div>
  );
}

function EmptyCustomers({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="surface relative overflow-hidden p-12 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-white to-white" />
      {hasFilter ? (
        <>
          <p className="font-serif text-xl text-zinc-900">Aucune cliente trouvée</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            Modifie ou réinitialise les filtres.
          </p>
        </>
      ) : (
        <>
          <p className="font-serif text-xl text-zinc-900">Aucune cliente pour l&apos;instant</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            Ajoute une première fiche pour pouvoir créer des locations.
          </p>
          <div className="mt-5">
            <LinkButton href="/customers/new">
              <Plus className="h-4 w-4" />
              Ajouter ma première cliente
            </LinkButton>
          </div>
        </>
      )}
    </div>
  );
}
