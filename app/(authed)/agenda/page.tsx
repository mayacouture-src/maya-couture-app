import { ReservationStatus } from "@prisma/client";
import { ArrowLeft, ArrowRight, Calendar } from "lucide-react";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ ym?: string; status?: string }>;

const STATUS_COLOR: Record<
  ReservationStatus,
  { dot: string; chip: string; label: string }
> = {
  DRAFT: {
    dot: "bg-zinc-400",
    chip: "bg-zinc-100 text-zinc-700 border-zinc-200",
    label: "Brouillon"
  },
  CONFIRMED: {
    dot: "bg-brand-600",
    chip: "bg-brand-50 text-brand-800 border-brand-200",
    label: "Confirmé"
  },
  IN_PROGRESS: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    label: "En cours"
  },
  RETURNED: {
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    label: "Retourné"
  },
  COMPLETED: {
    dot: "bg-sky-500",
    chip: "bg-sky-50 text-sky-800 border-sky-200",
    label: "Clôturé"
  },
  CANCELLED: {
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700 border-rose-200",
    label: "Annulé"
  }
};

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const MONTH_NAMES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre"
];

function parseYm(s: string | undefined): { year: number; month: number } {
  if (s && /^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m - 1 };
  }
  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth() };
}

function ym(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(year, month + delta, 1);
  return ym(d.getFullYear(), d.getMonth());
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Lundi de la 1re semaine qui contient le 1er du mois (ISO-like).
function gridStart(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const dow = first.getDay(); // 0 = dim, 1 = lun, …
  const diff = dow === 0 ? 6 : dow - 1; // jours à reculer pour atteindre lundi
  const start = new Date(year, month, 1 - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

type Event = {
  id: string;
  reference: string;
  customerName: string;
  status: ReservationStatus;
  kind: "OUT" | "IN"; // sortie / retour
  period: 1 | 2;
};

export default async function AgendaPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const { ym: ymParam, status: statusParam } = await searchParams;
  const { year, month } = parseYm(ymParam);

  const startGrid = gridStart(year, month);
  const endGrid = new Date(startGrid);
  endGrid.setDate(startGrid.getDate() + 42); // 6 semaines

  const showCancelled = statusParam === "all";
  const statuses: ReservationStatus[] = showCancelled
    ? [
        ReservationStatus.DRAFT,
        ReservationStatus.CONFIRMED,
        ReservationStatus.IN_PROGRESS,
        ReservationStatus.RETURNED,
        ReservationStatus.COMPLETED,
        ReservationStatus.CANCELLED
      ]
    : [
        ReservationStatus.DRAFT,
        ReservationStatus.CONFIRMED,
        ReservationStatus.IN_PROGRESS,
        ReservationStatus.RETURNED,
        ReservationStatus.COMPLETED
      ];

  // Récupère toutes les locations dont une période chevauche la grille (6 semaines)
  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: statuses },
      OR: [
        { startDate1: { gte: startGrid, lt: endGrid } },
        { endDate1: { gte: startGrid, lt: endGrid } },
        { startDate2: { gte: startGrid, lt: endGrid } },
        { endDate2: { gte: startGrid, lt: endGrid } }
      ]
    },
    select: {
      id: true,
      reference: true,
      status: true,
      startDate1: true,
      endDate1: true,
      startDate2: true,
      endDate2: true,
      customer: { select: { firstName: true, lastName: true } }
    }
  });

  // Indexe les events par jour
  const eventsByDay = new Map<string, Event[]>();
  const pushEvent = (date: Date, ev: Event) => {
    const key = dayKey(startOfDay(date));
    const arr = eventsByDay.get(key) ?? [];
    arr.push(ev);
    eventsByDay.set(key, arr);
  };
  for (const r of reservations) {
    const customerName = `${r.customer.firstName} ${r.customer.lastName}`;
    pushEvent(r.startDate1, {
      id: r.id,
      reference: r.reference,
      customerName,
      status: r.status,
      kind: "OUT",
      period: 1
    });
    pushEvent(r.endDate1, {
      id: r.id,
      reference: r.reference,
      customerName,
      status: r.status,
      kind: "IN",
      period: 1
    });
    if (r.startDate2) {
      pushEvent(r.startDate2, {
        id: r.id,
        reference: r.reference,
        customerName,
        status: r.status,
        kind: "OUT",
        period: 2
      });
    }
    if (r.endDate2) {
      pushEvent(r.endDate2, {
        id: r.id,
        reference: r.reference,
        customerName,
        status: r.status,
        kind: "IN",
        period: 2
      });
    }
  }

  // Construit la grille de 42 jours
  const days: Array<{ date: Date; inMonth: boolean; events: Event[] }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startGrid);
    d.setDate(startGrid.getDate() + i);
    days.push({
      date: d,
      inMonth: d.getMonth() === month,
      events: eventsByDay.get(dayKey(d)) ?? []
    });
  }

  const todayKey = dayKey(startOfDay(new Date()));
  const monthLabel = `${MONTH_NAMES[month]} ${year}`;
  const prevYm = shiftMonth(year, month, -1);
  const nextYm = shiftMonth(year, month, 1);

  // Compteurs en haut
  const counts = {
    departures: reservations.filter(
      (r) =>
        r.startDate1.getMonth() === month && r.startDate1.getFullYear() === year
    ).length,
    returns: reservations.filter(
      (r) => r.endDate1.getMonth() === month && r.endDate1.getFullYear() === year
    ).length
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Activité"
        title="Agenda"
        description="Vue d'ensemble des sorties et retours de location."
      />

      <div className="surface flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/agenda?ym=${prevYm}${statusParam ? `&status=${statusParam}` : ""}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
            aria-label="Mois précédent"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <p className="font-serif text-xl capitalize text-zinc-900">
            {monthLabel}
          </p>
          <Link
            href={`/agenda?ym=${nextYm}${statusParam ? `&status=${statusParam}` : ""}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
            aria-label="Mois suivant"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
          <LinkButton
            href="/agenda"
            variant="ghost"
            size="sm"
            className="ml-2 text-xs"
          >
            <Calendar className="h-3.5 w-3.5" />
            Aujourd&apos;hui
          </LinkButton>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-zinc-500">
            <span className="font-semibold text-zinc-700">{counts.departures}</span>{" "}
            sortie{counts.departures > 1 ? "s" : ""} ·{" "}
            <span className="font-semibold text-zinc-700">{counts.returns}</span>{" "}
            retour{counts.returns > 1 ? "s" : ""} ce mois
          </span>
          <Link
            href={`/agenda?ym=${ym(year, month)}${showCancelled ? "" : "&status=all"}`}
            className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 hover:border-zinc-300"
          >
            {showCancelled ? "Cacher annulés" : "Inclure annulés"}
          </Link>
        </div>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-3 text-xs">
        {(Object.keys(STATUS_COLOR) as ReservationStatus[])
          .filter((s) => showCancelled || s !== "CANCELLED")
          .map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-zinc-600">
              <span className={cn("h-2 w-2 rounded-full", STATUS_COLOR[s].dot)} />
              {STATUS_COLOR[s].label}
            </span>
          ))}
      </div>

      {/* Calendrier */}
      <div className="surface overflow-hidden">
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50/60 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const isToday = dayKey(d.date) === todayKey;
            const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6;
            return (
              <div
                key={i}
                className={cn(
                  "min-h-[110px] border-b border-r border-zinc-200/70 p-1.5",
                  !d.inMonth && "bg-zinc-50/40 text-zinc-400",
                  isWeekend && d.inMonth && "bg-zinc-50/30",
                  i % 7 === 6 && "border-r-0"
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-medium",
                      isToday
                        ? "bg-brand-700 text-white"
                        : d.inMonth
                          ? "text-zinc-700"
                          : "text-zinc-400"
                    )}
                  >
                    {d.date.getDate()}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {d.events.slice(0, 4).map((ev, j) => {
                    const tone = STATUS_COLOR[ev.status];
                    return (
                      <Link
                        key={`${ev.id}-${ev.kind}-${ev.period}-${j}`}
                        href={`/rentals/${ev.id}`}
                        title={`${ev.kind === "OUT" ? "Sortie" : "Retour"} · ${ev.reference} · ${ev.customerName}`}
                        className={cn(
                          "block truncate rounded border px-1.5 py-0.5 text-[10px] font-medium transition hover:translate-x-0.5",
                          tone.chip
                        )}
                      >
                        <span className="mr-1">
                          {ev.kind === "OUT" ? "→" : "←"}
                        </span>
                        {ev.customerName}
                      </Link>
                    );
                  })}
                  {d.events.length > 4 && (
                    <p className="px-1 text-[10px] text-zinc-500">
                      +{d.events.length - 4} de plus
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-zinc-500">
        <span className="mr-1">→</span> Sortie · <span className="mx-1">←</span> Retour
        · click sur un événement pour ouvrir la fiche location.
      </p>
    </div>
  );
}
