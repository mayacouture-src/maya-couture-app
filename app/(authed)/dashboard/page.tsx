import { CashKind, ReservationStatus } from "@prisma/client";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  PackageCheck,
  PackageOpen,
  ShieldAlert,
  Wallet
} from "lucide-react";
import Link from "next/link";
import { auth } from "@/auth";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const greeting = (date: Date) => {
  const h = date.getHours();
  if (h < 6) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
};

const formatLongDate = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);

const formatShortWeekday = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date);

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default async function DashboardPage() {
  const session = await auth();
  const firstName = (session?.user.name ?? "").split(" ")[0] || "";
  const today = new Date();
  const todayStart = startOfDay(today);
  const tomorrow = addDays(todayStart, 1);
  const weekEnd = addDays(todayStart, 7);

  // ── Données du jour ──────────────────────────────────────────────────
  const activeStatuses: ReservationStatus[] = ["CONFIRMED", "IN_PROGRESS", "RETURNED"];

  const [departuresToday, returnsToday] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "IN_PROGRESS"] },
        OR: [
          { startDate1: { gte: todayStart, lt: tomorrow } },
          { startDate2: { gte: todayStart, lt: tomorrow } }
        ]
      },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        _count: { select: { items: true } }
      },
      orderBy: { startDate1: "asc" }
    }),
    prisma.reservation.findMany({
      where: {
        status: { in: ["IN_PROGRESS"] },
        OR: [
          { endDate1: { gte: todayStart, lt: tomorrow } },
          { endDate2: { gte: todayStart, lt: tomorrow } }
        ]
      },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        _count: { select: { items: true } }
      },
      orderBy: { endDate1: "asc" }
    })
  ]);

  // ── 7 jours à venir : agenda compact ─────────────────────────────────
  const weekReservations = await prisma.reservation.findMany({
    where: {
      status: { in: activeStatuses },
      OR: [
        { startDate1: { gte: todayStart, lt: weekEnd } },
        { startDate2: { gte: todayStart, lt: weekEnd } },
        { endDate1: { gte: todayStart, lt: weekEnd } },
        { endDate2: { gte: todayStart, lt: weekEnd } }
      ]
    },
    select: {
      id: true,
      startDate1: true,
      endDate1: true,
      startDate2: true,
      endDate2: true
    }
  });

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(todayStart, i);
    const dStr = d.toISOString().slice(0, 10);
    const departures = weekReservations.filter(
      (r) =>
        r.startDate1.toISOString().slice(0, 10) === dStr ||
        (r.startDate2 && r.startDate2.toISOString().slice(0, 10) === dStr)
    ).length;
    const returns = weekReservations.filter(
      (r) =>
        r.endDate1.toISOString().slice(0, 10) === dStr ||
        (r.endDate2 && r.endDate2.toISOString().slice(0, 10) === dStr)
    ).length;
    return { date: d, departures, returns, isToday: i === 0 };
  });

  // ── Métriques globales ───────────────────────────────────────────────
  const [activeCount, returnedRentals, allOpenRentals, todayPayments, recentMovements] =
    await Promise.all([
      prisma.reservation.count({
        where: { status: { in: ["CONFIRMED", "IN_PROGRESS"] } }
      }),
      prisma.reservation.findMany({
        where: { status: "RETURNED" },
        include: { cashTx: { select: { kind: true, amount: true } } }
      }),
      prisma.reservation.findMany({
        where: { status: { in: activeStatuses } },
        select: {
          totalPrice: true,
          cashTx: { select: { kind: true, amount: true } }
        }
      }),
      prisma.cashTransaction.aggregate({
        where: {
          kind: CashKind.CLIENT_PAYMENT,
          occurredAt: { gte: todayStart, lt: tomorrow }
        },
        _sum: { amount: true },
        _count: true
      }),
      prisma.cashTransaction.findMany({
        where: {
          kind: { in: [CashKind.CLIENT_PAYMENT, CashKind.DEPOSIT_HELD, CashKind.DEPOSIT_BACK] }
        },
        orderBy: { occurredAt: "desc" },
        take: 6,
        include: {
          reservation: {
            select: {
              id: true,
              reference: true,
              customer: { select: { firstName: true, lastName: true } }
            }
          }
        }
      })
    ]);

  const cautionsToReturn = returnedRentals.reduce((acc, r) => {
    const held = r.cashTx
      .filter((t) => t.kind === "DEPOSIT_HELD")
      .reduce((s, t) => s + Number(t.amount), 0);
    const back = r.cashTx
      .filter((t) => t.kind === "DEPOSIT_BACK")
      .reduce((s, t) => s + Number(t.amount), 0);
    return acc + Math.max(0, held - back);
  }, 0);

  const balanceDue = allOpenRentals.reduce((acc, r) => {
    const paid = r.cashTx
      .filter((t) => t.kind === "CLIENT_PAYMENT")
      .reduce((s, t) => s + Number(t.amount), 0);
    return acc + Math.max(0, Number(r.totalPrice) - paid);
  }, 0);

  const todayCashAmount = Number(todayPayments._sum.amount ?? 0);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">
          {formatLongDate(today)}
        </p>
        <h1 className="font-serif text-4xl tracking-tight text-zinc-900 sm:text-5xl">
          {greeting(today)}
          {firstName && <span className="text-zinc-400">, {firstName}.</span>}
        </h1>
        <p className="mt-2 max-w-xl text-zinc-500">
          {departuresToday.length === 0 && returnsToday.length === 0
            ? "Pas de mouvement attendu aujourd'hui. Bonne journée à l'atelier."
            : `${departuresToday.length} départ${departuresToday.length > 1 ? "s" : ""} et ${returnsToday.length} retour${returnsToday.length > 1 ? "s" : ""} prévus aujourd'hui.`}
        </p>
      </header>

      {/* Métriques */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Metric
          label="Locations actives"
          value={String(activeCount)}
          hint="Confirmées ou en cours"
          href="/rentals?status=active"
          icon={PackageOpen}
          accent="from-brand-500/15 to-brand-500/0"
        />
        <Metric
          label="Cautions à rendre"
          value={formatCurrency(cautionsToReturn)}
          hint={`${returnedRentals.length} dossier${returnedRentals.length > 1 ? "s" : ""} retournée${returnedRentals.length > 1 ? "s" : ""}`}
          href="/rentals"
          icon={ShieldAlert}
          accent="from-amber-500/15 to-amber-500/0"
        />
        <Metric
          label="Solde dû"
          value={formatCurrency(balanceDue)}
          hint="Sur tous les dossiers ouverts"
          href="/rentals"
          icon={Wallet}
          accent="from-rose-500/15 to-rose-500/0"
        />
        <Metric
          label="Encaissé aujourd'hui"
          value={formatCurrency(todayCashAmount)}
          hint={`${todayPayments._count} mouvement${todayPayments._count > 1 ? "s" : ""}`}
          href="/cash"
          icon={Wallet}
          accent="from-emerald-500/15 to-emerald-500/0"
        />
      </section>

      {/* Aujourd'hui */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TodayColumn
          icon={PackageOpen}
          title="Départs aujourd'hui"
          empty="Aucun départ prévu."
          items={departuresToday.map((r) => ({
            id: r.id,
            reference: r.reference,
            customerName: `${r.customer.firstName} ${r.customer.lastName}`,
            phone: r.customer.phone,
            count: r._count.items,
            status: r.status
          }))}
        />
        <TodayColumn
          icon={PackageCheck}
          title="Retours aujourd'hui"
          empty="Aucun retour attendu."
          items={returnsToday.map((r) => ({
            id: r.id,
            reference: r.reference,
            customerName: `${r.customer.firstName} ${r.customer.lastName}`,
            phone: r.customer.phone,
            count: r._count.items,
            status: r.status
          }))}
        />
      </section>

      {/* Semaine */}
      <section className="surface p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl text-zinc-900">7 prochains jours</h2>
            <p className="text-sm text-zinc-500">Aperçu des départs et des retours.</p>
          </div>
          <Link
            href="/rentals"
            className="hidden text-xs font-medium text-brand-600 hover:text-brand-700 sm:inline-flex sm:items-center sm:gap-1"
          >
            Voir toutes les locations <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {week.map((day) => (
            <div
              key={day.date.toISOString()}
              className={`flex flex-col gap-2 rounded-xl border px-2 py-3 text-center transition ${
                day.isToday
                  ? "border-brand-300 bg-brand-50/60 shadow-soft"
                  : "border-zinc-200/70 bg-white"
              }`}
            >
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                  {formatShortWeekday(day.date)}
                </p>
                <p
                  className={`font-serif text-lg ${
                    day.isToday ? "text-brand-700" : "text-zinc-900"
                  }`}
                >
                  {day.date.getDate()}
                </p>
              </div>
              <div className="space-y-1 text-[10px]">
                {day.departures > 0 && (
                  <p className="rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-800">
                    ↑ {day.departures}
                  </p>
                )}
                {day.returns > 0 && (
                  <p className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-emerald-800">
                    ↓ {day.returns}
                  </p>
                )}
                {day.departures === 0 && day.returns === 0 && (
                  <p className="text-zinc-300">·</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Activité récente */}
      <section className="surface p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl text-zinc-900">Activité récente</h2>
            <p className="text-sm text-zinc-500">
              Derniers paiements et cautions enregistrés.
            </p>
          </div>
          <Link
            href="/cash"
            className="hidden text-xs font-medium text-brand-600 hover:text-brand-700 sm:inline-flex sm:items-center sm:gap-1"
          >
            Voir la caisse <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {recentMovements.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
            Aucun mouvement pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200/70">
            {recentMovements.map((m) => (
              <li key={m.id}>
                <Link
                  href={m.reservation ? `/rentals/${m.reservation.id}` : "/cash"}
                  className="flex items-center justify-between gap-3 py-3 transition hover:bg-zinc-50/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {m.reservation
                        ? `${m.reservation.customer.firstName} ${m.reservation.customer.lastName}`
                        : "Mouvement libre"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {kindLabel(m.kind)} · {formatDate(m.occurredAt)}
                      {m.reservation ? ` · ${m.reservation.reference}` : ""}
                    </p>
                  </div>
                  <p
                    className={`font-medium ${
                      m.kind === "CLIENT_PAYMENT"
                        ? "text-emerald-700"
                        : m.kind === "DEPOSIT_HELD"
                          ? "text-amber-700"
                          : "text-zinc-600"
                    }`}
                  >
                    {formatCurrency(Number(m.amount))}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  href,
  icon: Icon,
  accent
}: {
  label: string;
  value: string;
  hint: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group surface relative flex flex-col gap-2 overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:shadow-glow sm:p-5"
    >
      <div className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br ${accent}`} />
      <div className="flex items-start justify-between">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 ring-1 ring-zinc-200/80">
          <Icon className="h-4 w-4 text-zinc-600" />
        </span>
        <ArrowUpRight className="h-4 w-4 text-zinc-300 transition-colors group-hover:text-brand-600" />
      </div>
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="mt-0.5 font-serif text-xl text-zinc-900 sm:text-2xl">{value}</p>
        <p className="mt-0.5 text-[11px] text-zinc-400">{hint}</p>
      </div>
    </Link>
  );
}

function TodayColumn({
  icon: Icon,
  title,
  empty,
  items
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  empty: string;
  items: Array<{
    id: string;
    reference: string;
    customerName: string;
    phone: string;
    count: number;
    status: ReservationStatus;
  }>;
}) {
  return (
    <div className="surface p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-serif text-xl text-zinc-900">{title}</h2>
          <p className="text-xs text-zinc-500">
            {items.length} dossier{items.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
          {empty}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200/70">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={`/rentals/${it.id}`}
                className="flex items-center justify-between gap-3 py-3 transition hover:bg-zinc-50/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {it.customerName}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {it.reference} · {it.phone} · {it.count} robe
                    {it.count > 1 ? "s" : ""}
                  </p>
                </div>
                <StatusBadge status={it.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function kindLabel(k: CashKind): string {
  const labels: Record<CashKind, string> = {
    CLIENT_PAYMENT: "Paiement",
    DEPOSIT_HELD: "Caution prise",
    DEPOSIT_BACK: "Caution rendue",
    EXPENSE: "Dépense",
    CASH_REFILL: "Alimentation",
    WITHDRAWAL: "Retrait",
    REFUND: "Remboursement",
    FEE: "Pénalité"
  };
  return labels[k];
}
