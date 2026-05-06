import { CashKind } from "@prisma/client";
import {
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  Wallet
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ExportButton } from "@/components/ui/export-button";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { DeleteMovementButton } from "./delete-movement-button";
import { NewMovementButton } from "./new-movement-button";

export const dynamic = "force-dynamic";

type Range = "today" | "week" | "month" | "all" | "custom";

const KIND_LABEL: Record<CashKind, string> = {
  CLIENT_PAYMENT: "Paiement",
  DEPOSIT_HELD: "Caution prise",
  DEPOSIT_BACK: "Caution rendue",
  EXPENSE: "Dépense",
  CASH_REFILL: "Alimentation",
  WITHDRAWAL: "Retrait",
  REFUND: "Remboursement",
  FEE: "Pénalité"
};

const INCOMING: CashKind[] = ["CLIENT_PAYMENT", "DEPOSIT_HELD", "CASH_REFILL", "FEE"];
const OUTGOING: CashKind[] = ["DEPOSIT_BACK", "EXPENSE", "WITHDRAWAL", "REFUND"];

const KIND_TONE: Record<CashKind, string> = {
  CLIENT_PAYMENT: "text-emerald-700",
  DEPOSIT_HELD: "text-amber-700",
  DEPOSIT_BACK: "text-zinc-600",
  EXPENSE: "text-rose-700",
  CASH_REFILL: "text-emerald-700",
  WITHDRAWAL: "text-rose-700",
  REFUND: "text-rose-700",
  FEE: "text-amber-700"
};

const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "7 jours" },
  { value: "month", label: "30 jours" },
  { value: "all", label: "Tout" },
  { value: "custom", label: "Personnalisé" }
];

function rangeBounds(
  range: Range,
  from?: string,
  to?: string
): { from?: Date; to?: Date } {
  if (range === "all") return {};
  if (range === "custom") {
    return {
      from: from ? safeDate(from) : undefined,
      to: to ? safeDate(to, true) : undefined
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (range === "today") return { from: today, to: tomorrow };
  if (range === "week") {
    const f = new Date(today);
    f.setDate(today.getDate() - 6);
    return { from: f, to: tomorrow };
  }
  // month
  const f = new Date(today);
  f.setDate(today.getDate() - 29);
  return { from: f, to: tomorrow };
}

function safeDate(s: string, endOfDay = false): Date | undefined {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

function isRange(s: string | undefined): s is Range {
  return !!s && (["today", "week", "month", "all", "custom"] as string[]).includes(s);
}

function isKind(s: string | undefined): s is CashKind {
  return !!s && (Object.keys(KIND_LABEL) as string[]).includes(s);
}

type SearchParams = Promise<{
  range?: Range;
  kind?: string;
  from?: string;
  to?: string;
  min?: string;
  max?: string;
}>;

export default async function CashPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const range = isRange(params.range) ? params.range : "today";
  const kind = isKind(params.kind) ? params.kind : undefined;
  const min = params.min ? Number(params.min) : undefined;
  const max = params.max ? Number(params.max) : undefined;
  const bounds = rangeBounds(range, params.from, params.to);

  const movements = await prisma.cashTransaction.findMany({
    where: {
      AND: [
        bounds.from ? { occurredAt: { gte: bounds.from } } : {},
        bounds.to ? { occurredAt: { lt: bounds.to } } : {},
        kind ? { kind } : {},
        min !== undefined && !Number.isNaN(min) ? { amount: { gte: min } } : {},
        max !== undefined && !Number.isNaN(max) ? { amount: { lte: max } } : {}
      ]
    },
    orderBy: { occurredAt: "desc" },
    include: {
      reservation: {
        select: {
          id: true,
          reference: true,
          customer: { select: { firstName: true, lastName: true } }
        }
      }
    },
    take: 500
  });

  const totalIn = movements
    .filter((m) => INCOMING.includes(m.kind))
    .reduce((s, m) => s + Number(m.amount), 0);
  const totalOut = movements
    .filter((m) => OUTGOING.includes(m.kind))
    .reduce((s, m) => s + Number(m.amount), 0);
  const net = totalIn - totalOut;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Atelier"
        title="Caisse"
        description="Tous les mouvements d'espèces — paiements clientes, cautions, dépenses."
        action={
          <div className="flex items-center gap-2">
            <ExportButton entity="cash" />
            <NewMovementButton />
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.value}
            href={`/cash?range=${r.value}`}
            className={
              r.value === range
                ? "rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-soft"
                : "rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
            }
          >
            {r.label}
          </Link>
        ))}
      </div>

      <FiltersBar
        range={range}
        kind={kind}
        from={params.from}
        to={params.to}
        min={params.min}
        max={params.max}
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <SummaryCard icon={ArrowUpRight} label="Entrées" value={formatCurrency(totalIn)} tone="emerald" />
        <SummaryCard icon={ArrowDownRight} label="Sorties" value={formatCurrency(totalOut)} tone="rose" />
        <SummaryCard
          icon={Wallet}
          label="Solde net"
          value={formatCurrency(net)}
          tone={net >= 0 ? "brand" : "amber"}
        />
      </section>

      {movements.length === 0 ? (
        <div className="surface p-10 text-center">
          <p className="font-serif text-xl text-zinc-900">Aucun mouvement</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            Pas d&apos;activité pour ces filtres. Ajuste-les ou crée un mouvement libre.
          </p>
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <ul className="divide-y divide-zinc-200/70">
            {movements.map((m) => {
              const isOut = OUTGOING.includes(m.kind);
              return (
                <li
                  key={m.id}
                  className="group flex items-center gap-3 px-5 py-3 transition hover:bg-zinc-50/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className={`font-medium ${KIND_TONE[m.kind]}`}>
                        {KIND_LABEL[m.kind]}
                      </p>
                      {m.category && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                          {m.category}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">
                      {formatDate(m.occurredAt)}
                      {m.reservation && (
                        <>
                          {" · "}
                          <Link
                            href={`/rentals/${m.reservation.id}`}
                            className="text-brand-600 hover:underline"
                          >
                            {m.reservation.customer.firstName} {m.reservation.customer.lastName} ·{" "}
                            {m.reservation.reference}
                          </Link>
                        </>
                      )}
                      {m.description ? ` · ${m.description}` : ""}
                    </p>
                  </div>
                  <p className={`font-medium ${KIND_TONE[m.kind]}`}>
                    {isOut ? "−" : "+"}
                    {formatCurrency(Number(m.amount))}
                  </p>
                  <DeleteMovementButton
                    id={m.id}
                    label={`${KIND_LABEL[m.kind]} ${formatCurrency(Number(m.amount))}`}
                  />
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
  range,
  kind,
  from,
  to,
  min,
  max
}: {
  range: Range;
  kind?: CashKind;
  from?: string;
  to?: string;
  min?: string;
  max?: string;
}) {
  return (
    <form action="/cash" className="surface flex flex-wrap items-end gap-3 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
        <Filter className="h-3.5 w-3.5" />
        Filtres
      </div>
      <input type="hidden" name="range" value={range} />

      <FilterSelect
        name="kind"
        label="Type"
        defaultValue={kind ?? ""}
        options={[
          { value: "", label: "Tous" },
          ...Object.entries(KIND_LABEL).map(([v, l]) => ({ value: v, label: l }))
        ]}
      />

      {range === "custom" && (
        <>
          <DateField name="from" label="Du" defaultValue={from} />
          <DateField name="to" label="Au" defaultValue={to} />
        </>
      )}

      <NumberField name="min" label="Min" defaultValue={min} />
      <NumberField name="max" label="Max" defaultValue={max} />

      <div className="ml-auto flex gap-2">
        <Link
          href="/cash"
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

function NumberField({
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
        type="number"
        step="0.01"
        min={0}
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder="—"
        className="focus-ring w-24 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700"
      />
    </label>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "emerald" | "rose" | "brand" | "amber";
}) {
  const tones = {
    emerald: { bg: "from-emerald-500/15 to-emerald-500/0", text: "text-emerald-700" },
    rose: { bg: "from-rose-500/15 to-rose-500/0", text: "text-rose-700" },
    brand: { bg: "from-brand-500/15 to-brand-500/0", text: "text-brand-700" },
    amber: { bg: "from-amber-500/15 to-amber-500/0", text: "text-amber-800" }
  } as const;
  const t = tones[tone];
  return (
    <div className="surface relative flex flex-col gap-3 overflow-hidden p-5">
      <div className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br ${t.bg}`} />
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 ring-1 ring-zinc-200/80">
        <Icon className={`h-4 w-4 ${t.text}`} />
      </span>
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className={`font-serif text-2xl ${t.text}`}>{value}</p>
      </div>
    </div>
  );
}
