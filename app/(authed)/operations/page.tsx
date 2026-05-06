import { AuditOperation } from "@prisma/client";
import {
  ArrowRight,
  Box,
  CalendarDays,
  Filter,
  PenSquare,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  User2,
  Users,
  Wallet
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ExportButton } from "@/components/ui/export-button";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ENTITY_TYPES = [
  "Customer",
  "Product",
  "ProductVariant",
  "Reservation",
  "Sale",
  "CashTransaction",
  "User",
  "SiteSettings",
  "Inspection",
  "DocumentTemplate"
] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

const ENTITY_LABELS: Record<EntityType, string> = {
  Customer: "Cliente",
  Product: "Produit",
  ProductVariant: "Variante",
  Reservation: "Location",
  Sale: "Vente",
  CashTransaction: "Caisse",
  User: "Compte",
  SiteSettings: "Paramètres",
  Inspection: "Inspection",
  DocumentTemplate: "Modèle doc."
};

const ENTITY_ICONS: Record<EntityType, React.ComponentType<{ className?: string }>> = {
  Customer: Users,
  Product: Box,
  ProductVariant: Box,
  Reservation: ShoppingBag,
  Sale: ShoppingCart,
  CashTransaction: Wallet,
  User: User2,
  SiteSettings: PenSquare,
  Inspection: PenSquare,
  DocumentTemplate: PenSquare
};

function entityHref(type: EntityType, id: string): string | null {
  switch (type) {
    case "Customer":
      return `/customers/${id}`;
    case "Product":
      return `/products/${id}`;
    case "Reservation":
      return `/rentals/${id}`;
    case "Sale":
      return `/sales/${id}`;
    case "User":
      return `/users/${id}`;
    case "SiteSettings":
      return `/settings`;
    case "CashTransaction":
      return `/cash`;
    default:
      return null;
  }
}

type SearchParams = Promise<{
  entity?: string;
  operation?: string;
  user?: string;
  from?: string;
  to?: string;
}>;

export default async function OperationsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const filters = await searchParams;

  const entity = ENTITY_TYPES.includes(filters.entity as EntityType)
    ? (filters.entity as EntityType)
    : undefined;
  const operation = (["CREATE", "UPDATE", "DELETE"] as const).includes(
    filters.operation as AuditOperation
  )
    ? (filters.operation as AuditOperation)
    : undefined;
  const userId = filters.user || undefined;

  const fromDate = filters.from ? safeDate(filters.from) : undefined;
  const toDate = filters.to ? safeDate(filters.to, true) : undefined;

  const [logs, users] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        AND: [
          entity ? { entityType: entity } : {},
          operation ? { operation } : {},
          userId ? { userId } : {},
          fromDate ? { occurredAt: { gte: fromDate } } : {},
          toDate ? { occurredAt: { lte: toDate } } : {}
        ]
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { occurredAt: "desc" },
      take: 200
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    })
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Audit"
        description="Journal complet des créations, modifications et suppressions — qui, quoi, quand."
        action={<ExportButton entity="operations" />}
      />

      <FiltersBar
        entity={entity}
        operation={operation}
        userId={userId}
        from={filters.from}
        to={filters.to}
        users={users}
      />

      {logs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="surface overflow-hidden">
          <ul className="divide-y divide-zinc-200/70">
            {logs.map((log) => {
              const Icon = ENTITY_ICONS[log.entityType as EntityType] ?? PenSquare;
              const href = entityHref(log.entityType as EntityType, log.entityId);
              const label = ENTITY_LABELS[log.entityType as EntityType] ?? log.entityType;
              return (
                <li key={log.id} className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    <OperationBadge op={log.operation} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
                        <span className="inline-flex items-center gap-1.5 font-medium text-zinc-900">
                          <Icon className="h-3.5 w-3.5 text-zinc-400" />
                          {label}
                        </span>
                        <code className="text-xs text-zinc-400">{log.entityId.slice(0, 8)}</code>
                        {href && (
                          <Link
                            href={href}
                            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                          >
                            Voir <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Par <span className="font-medium text-zinc-700">{log.user.name}</span>{" "}
                        ·{" "}
                        <time dateTime={log.occurredAt.toISOString()}>
                          {log.occurredAt.toLocaleString("fr-FR")}
                        </time>
                      </p>
                      {log.diff !== null && log.diff !== undefined ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-wider text-zinc-400 hover:text-zinc-600">
                            Détails
                          </summary>
                          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-zinc-50 p-3 text-[11px] text-zinc-700">
                            {JSON.stringify(log.diff, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-zinc-200/70 bg-zinc-50/50 px-5 py-2 text-xs text-zinc-400">
            200 entrées les plus récentes affichées.
          </p>
        </div>
      )}
    </div>
  );
}

function safeDate(s: string, endOfDay = false): Date | undefined {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) {
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

function OperationBadge({ op }: { op: AuditOperation }) {
  const styles: Record<AuditOperation, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
    CREATE: { bg: "bg-emerald-50", text: "text-emerald-700", icon: Plus },
    UPDATE: { bg: "bg-amber-50", text: "text-amber-700", icon: PenSquare },
    DELETE: { bg: "bg-rose-50", text: "text-rose-700", icon: Trash2 }
  };
  const s = styles[op];
  const Icon = s.icon;
  return (
    <span
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.bg} ${s.text}`}
      aria-label={op}
      title={op}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

function FiltersBar({
  entity,
  operation,
  userId,
  from,
  to,
  users
}: {
  entity?: EntityType;
  operation?: AuditOperation;
  userId?: string;
  from?: string;
  to?: string;
  users: { id: string; name: string }[];
}) {
  return (
    <form action="/operations" className="surface flex flex-wrap items-end gap-3 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
        <Filter className="h-3.5 w-3.5" />
        Filtres
      </div>

      <FilterSelect
        name="entity"
        label="Type"
        defaultValue={entity ?? ""}
        options={[
          { value: "", label: "Tout" },
          ...ENTITY_TYPES.map((t) => ({ value: t, label: ENTITY_LABELS[t] }))
        ]}
      />

      <FilterSelect
        name="operation"
        label="Opération"
        defaultValue={operation ?? ""}
        options={[
          { value: "", label: "Toutes" },
          { value: "CREATE", label: "Création" },
          { value: "UPDATE", label: "Modification" },
          { value: "DELETE", label: "Suppression" }
        ]}
      />

      <FilterSelect
        name="user"
        label="Utilisateur"
        defaultValue={userId ?? ""}
        options={[
          { value: "", label: "Tous" },
          ...users.map((u) => ({ value: u.id, label: u.name }))
        ]}
      />

      <DateField name="from" label="Du" defaultValue={from} />
      <DateField name="to" label="Au" defaultValue={to} />

      <div className="ml-auto flex gap-2">
        <Link
          href="/operations"
          className="rounded-xl px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
        >
          Réinitialiser
        </Link>
        <button
          type="submit"
          className="rounded-xl bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800"
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
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input
          type="date"
          name={name}
          defaultValue={defaultValue ?? ""}
          className="focus-ring rounded-lg border border-zinc-200 bg-white py-1.5 pl-7 pr-2 text-xs text-zinc-700"
        />
      </div>
    </label>
  );
}

function EmptyState() {
  return (
    <div className="surface relative overflow-hidden p-12 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-white to-white" />
      <p className="font-serif text-xl text-zinc-900">Aucune entrée</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
        Aucun événement ne correspond aux filtres choisis.
      </p>
    </div>
  );
}
