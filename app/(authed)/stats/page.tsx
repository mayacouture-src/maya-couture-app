import { CashKind, ReservationStatus } from "@prisma/client";
import {
  ArrowDownRight,
  ArrowUpRight,
  Crown,
  ShoppingBag,
  ShoppingCart,
  Wallet
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BarChartHorizontal, DonutChart, LineChart } from "@/components/ui/charts";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const RANGES = [
  { value: "7d", label: "7 jours", days: 7 },
  { value: "30d", label: "30 jours", days: 30 },
  { value: "90d", label: "90 jours", days: 90 },
  { value: "12m", label: "12 mois", days: 365 }
] as const;
type RangeKey = (typeof RANGES)[number]["value"];

const STATUS_LABEL: Record<ReservationStatus, string> = {
  DRAFT: "Brouillon",
  CONFIRMED: "Confirmé",
  IN_PROGRESS: "En cours",
  RETURNED: "Retourné",
  COMPLETED: "Clôturé",
  CANCELLED: "Annulé"
};

const STATUS_COLOR: Record<ReservationStatus, string> = {
  DRAFT: "#a1a1aa",
  CONFIRMED: "#b48a47",
  IN_PROGRESS: "#a93f51",
  RETURNED: "#977137",
  COMPLETED: "#16a34a",
  CANCELLED: "#9ca3af"
};

type SearchParams = Promise<{ range?: string }>;

export default async function StatsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const rangeKey: RangeKey = (RANGES.find((r) => r.value === params.range)?.value ?? "30d") as RangeKey;
  const days = RANGES.find((r) => r.value === rangeKey)!.days;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const from = new Date(today);
  from.setDate(today.getDate() - (days - 1));

  // ─── Cash on period ─────────────────────────────────────────────────
  const txs = await prisma.cashTransaction.findMany({
    where: { occurredAt: { gte: from, lt: tomorrow } },
    select: {
      kind: true,
      amount: true,
      occurredAt: true,
      reservationId: true,
      saleId: true,
      category: true
    }
  });

  let rentalRevenue = 0;
  let saleRevenue = 0;
  let depositsHeld = 0;
  let depositsBack = 0;
  let expenses = 0;
  for (const t of txs) {
    const amt = Number(t.amount);
    if (t.kind === "CLIENT_PAYMENT") {
      if (t.saleId) saleRevenue += amt;
      else rentalRevenue += amt;
    } else if (t.kind === "DEPOSIT_HELD") depositsHeld += amt;
    else if (t.kind === "DEPOSIT_BACK") depositsBack += amt;
    else if (t.kind === "EXPENSE") expenses += amt;
  }
  const totalRevenue = rentalRevenue + saleRevenue;
  const netMargin = totalRevenue - expenses;

  // ─── Daily series for line chart ────────────────────────────────────
  const daily = buildDailySeries(from, days, txs);

  // ─── Top variants rented (count over period from active reservations) ──
  const topRented = await prisma.reservationItem.groupBy({
    by: ["variantId"],
    where: {
      reservation: {
        startDate1: { gte: from, lt: tomorrow },
        status: { not: "CANCELLED" }
      }
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 5
  });

  // ─── Top variants sold (completed sales in period) ──────────────────
  const topSold = await prisma.saleItem.groupBy({
    by: ["variantId"],
    where: {
      sale: {
        saleDate: { gte: from, lt: tomorrow },
        status: "COMPLETED"
      }
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 5
  });

  const variantIds = [
    ...topRented.map((r) => r.variantId),
    ...topSold.map((r) => r.variantId)
  ];
  const variants =
    variantIds.length > 0
      ? await prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          include: { product: { select: { name: true, reference: true } } }
        })
      : [];
  const variantById = new Map(variants.map((v) => [v.id, v]));

  function variantLabel(id: string) {
    const v = variantById.get(id);
    if (!v) return "—";
    return `${v.product.name} · ${v.size} · ${v.color}`;
  }

  // ─── Top customers by total spent in period ─────────────────────────
  const customerCash = await prisma.cashTransaction.findMany({
    where: {
      occurredAt: { gte: from, lt: tomorrow },
      kind: "CLIENT_PAYMENT",
      OR: [{ reservationId: { not: null } }, { saleId: { not: null } }]
    },
    include: {
      reservation: { select: { customer: { select: { id: true, firstName: true, lastName: true } } } },
      sale: { select: { customer: { select: { id: true, firstName: true, lastName: true } } } }
    }
  });
  const customerTotals = new Map<string, { name: string; total: number }>();
  for (const t of customerCash) {
    const c = t.reservation?.customer ?? t.sale?.customer;
    if (!c) continue;
    const key = c.id;
    const prev = customerTotals.get(key);
    customerTotals.set(key, {
      name: `${c.firstName} ${c.lastName}`,
      total: (prev?.total ?? 0) + Number(t.amount)
    });
  }
  const topCustomers = Array.from(customerTotals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // ─── Reservations by status (active in period, ie any overlap) ──────
  const reservationsForStatus = await prisma.reservation.groupBy({
    by: ["status"],
    where: { createdAt: { gte: from, lt: tomorrow } },
    _count: { _all: true }
  });
  const statusData = (Object.keys(STATUS_LABEL) as ReservationStatus[])
    .map((s) => {
      const found = reservationsForStatus.find((r) => r.status === s);
      return {
        label: STATUS_LABEL[s],
        value: found?._count._all ?? 0,
        color: STATUS_COLOR[s]
      };
    })
    .filter((d) => d.value > 0);

  // ─── Cash kind breakdown (donut) ────────────────────────────────────
  const kindBreakdown = aggregateByKind(txs);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Statistiques"
        description="Aperçu des revenus, dépenses, top robes et clientes — sur la période choisie."
      />

      <RangeSelector current={rangeKey} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Kpi
          icon={ShoppingBag}
          label="Revenus locations"
          value={formatCurrency(rentalRevenue)}
          tone="brand"
        />
        <Kpi
          icon={ShoppingCart}
          label="Revenus ventes"
          value={formatCurrency(saleRevenue)}
          tone="emerald"
        />
        <Kpi
          icon={ArrowDownRight}
          label="Dépenses"
          value={formatCurrency(expenses)}
          tone="rose"
        />
        <Kpi
          icon={Wallet}
          label="Marge nette"
          value={formatCurrency(netMargin)}
          tone={netMargin >= 0 ? "amber" : "rose"}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Revenus jour par jour" subtitle={`Sur ${days} jours`} className="lg:col-span-2">
          <div className="text-brand-700">
            <LineChart data={daily} height={200} />
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
            <Legend color="bg-brand-700" label="Revenus jour" />
            <span>Total : <strong className="text-zinc-900">{formatCurrency(totalRevenue)}</strong></span>
          </div>
        </Card>

        <Card title="Dossiers par statut" subtitle="Locations créées sur la période">
          {statusData.length === 0 ? (
            <p className="text-sm text-zinc-400">Aucune location sur la période.</p>
          ) : (
            <DonutChart data={statusData} size={160} />
          )}
        </Card>

        <Card title="Top 5 robes louées" subtitle="Quantité de variantes louées">
          <BarChartHorizontal
            data={topRented.map((r) => ({
              label: variantLabel(r.variantId),
              value: r._sum.quantity ?? 0
            }))}
            barColor="#691524"
          />
        </Card>

        <Card title="Top 5 robes vendues" subtitle="Quantité de variantes vendues">
          <BarChartHorizontal
            data={topSold.map((r) => ({
              label: variantLabel(r.variantId),
              value: r._sum.quantity ?? 0
            }))}
            barColor="#16a34a"
          />
        </Card>

        <Card title="Top 5 clientes" subtitle="Cumul des paiements reçus">
          {topCustomers.length === 0 ? (
            <p className="text-sm text-zinc-400">Aucun paiement sur la période.</p>
          ) : (
            <ul className="space-y-2">
              {topCustomers.map((c, i) => (
                <li
                  key={c.name}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200/70 bg-white px-3 py-2"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm text-zinc-800">{c.name}</span>
                  <span className="text-sm font-semibold text-zinc-900">
                    {formatCurrency(c.total)}
                  </span>
                  {i === 0 && <Crown className="h-3.5 w-3.5 text-gold-600" />}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Mouvements de caisse" subtitle="Répartition par type">
          {kindBreakdown.length === 0 ? (
            <p className="text-sm text-zinc-400">Pas de mouvements sur la période.</p>
          ) : (
            <DonutChart data={kindBreakdown} size={160} />
          )}
        </Card>

        <Card title="Cautions" subtitle="Sur la période">
          <dl className="space-y-3 text-sm">
            <Row label="Cautions prises" value={formatCurrency(depositsHeld)} icon={ArrowUpRight} tone="amber" />
            <Row label="Cautions rendues" value={formatCurrency(depositsBack)} icon={ArrowDownRight} tone="zinc" />
            <Row
              label="Solde net cautions"
              value={formatCurrency(depositsHeld - depositsBack)}
              tone="brand"
              strong
            />
          </dl>
        </Card>
      </div>
    </div>
  );
}

function buildDailySeries(
  from: Date,
  days: number,
  txs: { kind: CashKind; amount: number | { toString(): string }; occurredAt: Date }[]
) {
  const series: { label: string; value: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    series.push({ label, value: 0 });
  }
  for (const t of txs) {
    if (t.kind !== "CLIENT_PAYMENT") continue;
    const idx = Math.floor(
      (new Date(t.occurredAt).setHours(0, 0, 0, 0) - from.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (idx >= 0 && idx < days) {
      series[idx].value += Number(t.amount);
    }
  }
  return series;
}

function aggregateByKind(txs: { kind: CashKind; amount: number | { toString(): string } }[]) {
  const totals = new Map<CashKind, number>();
  for (const t of txs) {
    totals.set(t.kind, (totals.get(t.kind) ?? 0) + Number(t.amount));
  }
  const palette: Record<CashKind, string> = {
    CLIENT_PAYMENT: "#16a34a",
    DEPOSIT_HELD: "#b48a47",
    DEPOSIT_BACK: "#a1a1aa",
    EXPENSE: "#e11d48",
    CASH_REFILL: "#0ea5e9",
    WITHDRAWAL: "#dc2626",
    REFUND: "#f97316",
    FEE: "#7c3aed"
  };
  const labels: Record<CashKind, string> = {
    CLIENT_PAYMENT: "Paiements",
    DEPOSIT_HELD: "Cautions prises",
    DEPOSIT_BACK: "Cautions rendues",
    EXPENSE: "Dépenses",
    CASH_REFILL: "Alim. caisse",
    WITHDRAWAL: "Retraits",
    REFUND: "Rembours.",
    FEE: "Pénalités"
  };
  return Array.from(totals.entries())
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ label: labels[k], value: Math.round(v), color: palette[k] }));
}

function RangeSelector({ current }: { current: RangeKey }) {
  return (
    <div className="flex flex-wrap gap-2">
      {RANGES.map((r) => (
        <Link
          key={r.value}
          href={`/stats?range=${r.value}`}
          className={
            r.value === current
              ? "rounded-full bg-brand-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-soft"
              : "rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
          }
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "brand" | "emerald" | "rose" | "amber";
}) {
  const tones = {
    brand: { bg: "from-brand-500/15 to-brand-500/0", text: "text-brand-700" },
    emerald: { bg: "from-emerald-500/15 to-emerald-500/0", text: "text-emerald-700" },
    rose: { bg: "from-rose-500/15 to-rose-500/0", text: "text-rose-700" },
    amber: { bg: "from-amber-500/15 to-amber-500/0", text: "text-amber-800" }
  } as const;
  const t = tones[tone];
  return (
    <div className="surface relative flex flex-col gap-2 overflow-hidden p-4">
      <div className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br ${t.bg}`} />
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 ring-1 ring-zinc-200/80">
        <Icon className={`h-4 w-4 ${t.text}`} />
      </span>
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className={`font-serif text-xl ${t.text}`}>{value}</p>
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
  className
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`surface p-5 ${className ?? ""}`}>
      <div className="mb-4">
        <p className="font-serif text-base text-zinc-900">{title}</p>
        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-3 rounded ${color}`} />
      <span>{label}</span>
    </span>
  );
}

function Row({
  label,
  value,
  icon: Icon,
  tone = "zinc",
  strong
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "amber" | "zinc" | "brand";
  strong?: boolean;
}) {
  const colors = {
    amber: "text-amber-700",
    zinc: "text-zinc-700",
    brand: "text-brand-700"
  } as const;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="flex items-center gap-2 text-zinc-500">
        {Icon && <Icon className="h-3.5 w-3.5 text-zinc-400" />}
        {label}
      </dt>
      <dd className={`${strong ? "font-serif text-lg" : "font-medium"} ${colors[tone]}`}>
        {value}
      </dd>
    </div>
  );
}
