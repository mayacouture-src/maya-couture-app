import { CashKind } from "@prisma/client";
import { ChevronLeft, FileText, MapPin, Phone, Receipt, StickyNote } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { inclusiveDays } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { LifecycleBar } from "./lifecycle-bar";
import { PaymentForm } from "./payment-form";
import { PaymentList } from "./payment-list";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function ReservationDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      customer: true,
      items: {
        include: {
          variant: { include: { product: { include: { photos: { take: 1, orderBy: { order: "asc" } } } } } }
        }
      },
      cashTx: { orderBy: { occurredAt: "desc" } }
    }
  });

  if (!reservation) notFound();

  const days1 = inclusiveDays(reservation.startDate1, reservation.endDate1);
  const days2 =
    reservation.startDate2 && reservation.endDate2
      ? inclusiveDays(reservation.startDate2, reservation.endDate2)
      : 0;
  const totalDays = days1 + days2;

  const paid = reservation.cashTx
    .filter((t) => t.kind === CashKind.CLIENT_PAYMENT)
    .reduce((acc, t) => acc + Number(t.amount), 0);
  const depositHeld = reservation.cashTx
    .filter((t) => t.kind === CashKind.DEPOSIT_HELD)
    .reduce((acc, t) => acc + Number(t.amount), 0);
  const depositBack = reservation.cashTx
    .filter((t) => t.kind === CashKind.DEPOSIT_BACK)
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const totalPrice = Number(reservation.totalPrice);
  const totalDeposit = Number(reservation.totalDeposit);
  const balance = totalPrice - paid;
  const depositBalance = depositHeld - depositBack;

  return (
    <div className="space-y-8">
      <div>
        <LinkButton
          href="/rentals"
          variant="ghost"
          size="sm"
          className="-ml-2 text-zinc-500"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Retour aux locations
        </LinkButton>
      </div>

      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            {reservation.reference}
            <StatusBadge status={reservation.status} />
          </span>
        }
        title={`${reservation.customer.firstName} ${reservation.customer.lastName}`}
        description={`Du ${formatDate(reservation.startDate1)} au ${formatDate(reservation.endDate1)}${
          reservation.startDate2 && reservation.endDate2
            ? ` · puis du ${formatDate(reservation.startDate2)} au ${formatDate(reservation.endDate2)}`
            : ""
        } · ${totalDays} jour${totalDays > 1 ? "s" : ""}`}
        action={
          <LifecycleBar
            reservationId={reservation.id}
            status={reservation.status}
            summary={{
              totalPrice,
              totalDeposit,
              paid,
              depositHeld,
              depositBack
            }}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/rentals/${reservation.id}/contract`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
        >
          <FileText className="h-3.5 w-3.5" />
          Contrat
        </Link>
        <Link
          href={`/rentals/${reservation.id}/invoice`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
        >
          <Receipt className="h-3.5 w-3.5" />
          Facture
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Colonne principale : items + cliente */}
        <div className="space-y-6 lg:col-span-2">
          <section className="surface p-6">
            <h2 className="font-serif text-lg text-zinc-900">Robes louées</h2>
            <ul className="mt-4 divide-y divide-zinc-200/70">
              {reservation.items.map((it) => {
                const photo = it.variant?.product.photos[0]?.url ?? null;
                return (
                  <li key={it.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo}
                        alt={it.variant?.product.name ?? ""}
                        className="h-14 w-12 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-100 to-pink-100 font-serif text-brand-600/60">
                        {(it.variant?.product.name ?? "·").charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {it.variant?.product.name ?? "Produit supprimé"}
                      </p>
                      <p className="flex items-center gap-2 text-xs text-zinc-500">
                        {it.variant?.colorHex && (
                          <span
                            className="h-2.5 w-2.5 rounded-full ring-1 ring-zinc-300"
                            style={{ backgroundColor: it.variant.colorHex }}
                          />
                        )}
                        {it.variant ? `${it.variant.size} · ${it.variant.color}` : "—"}
                        <span className="text-zinc-400">· × {it.quantity}</span>
                      </p>
                    </div>
                    <div className="text-right text-xs text-zinc-500">
                      <p>{formatCurrency(Number(it.price))}</p>
                      <p>caution {formatCurrency(Number(it.deposit))}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="surface p-6">
            <h2 className="font-serif text-lg text-zinc-900">Cliente</h2>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-zinc-500">Nom</p>
                <p className="font-medium text-zinc-900">
                  {reservation.customer.firstName} {reservation.customer.lastName}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Téléphone</p>
                <p className="inline-flex items-center gap-1 font-medium text-zinc-900">
                  <Phone className="h-3.5 w-3.5 text-zinc-400" />
                  {reservation.customer.phone}
                </p>
              </div>
              {reservation.customer.email && (
                <div>
                  <p className="text-zinc-500">Email</p>
                  <p className="font-medium text-zinc-900">{reservation.customer.email}</p>
                </div>
              )}
              {reservation.customer.address && (
                <div className="sm:col-span-2">
                  <p className="text-zinc-500">Adresse</p>
                  <p className="font-medium text-zinc-900">
                    {reservation.customer.address}
                    {reservation.customer.postalCode || reservation.customer.city
                      ? `, ${reservation.customer.postalCode ?? ""} ${reservation.customer.city ?? ""}`.trim()
                      : ""}
                  </p>
                </div>
              )}
            </div>

            {reservation.deliveryAddress && (
              <div className="mt-4 rounded-xl border border-zinc-200/70 bg-zinc-50/40 p-3 text-sm">
                <p className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500">
                  <MapPin className="h-3.5 w-3.5" />
                  Livraison
                </p>
                <p className="mt-0.5 text-zinc-900">{reservation.deliveryAddress}</p>
              </div>
            )}

            {reservation.observation && (
              <div className="mt-3 rounded-xl border border-zinc-200/70 bg-zinc-50/40 p-3 text-sm">
                <p className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500">
                  <StickyNote className="h-3.5 w-3.5" />
                  Note
                </p>
                <p className="mt-0.5 whitespace-pre-line text-zinc-900">{reservation.observation}</p>
              </div>
            )}
          </section>
        </div>

        {/* Colonne droite : récap financier + paiements */}
        <div className="space-y-6">
          <section className="surface p-6">
            <h2 className="font-serif text-lg text-zinc-900">Récapitulatif</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <Row label="Total location" value={formatCurrency(totalPrice)} strong />
              <Row label="Encaissé" value={formatCurrency(paid)} />
              <Row
                label="Solde dû"
                value={formatCurrency(balance)}
                tone={balance > 0 ? "warn" : "ok"}
              />
              <div className="my-3 border-t border-zinc-200/70" />
              <Row label="Caution prévue" value={formatCurrency(totalDeposit)} />
              <Row label="Caution prise" value={formatCurrency(depositHeld)} />
              <Row label="Caution rendue" value={formatCurrency(depositBack)} />
              <Row
                label="Caution en cours"
                value={formatCurrency(depositBalance)}
                tone={depositBalance > 0 ? "warn" : "ok"}
              />
            </dl>
          </section>

          <section className="surface p-6">
            <h2 className="font-serif text-lg text-zinc-900">Mouvements de caisse</h2>
            <PaymentList items={reservation.cashTx} />
            <div className="mt-4 border-t border-zinc-200/70 pt-4">
              <PaymentForm reservationId={reservation.id} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  tone
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd
        className={
          strong
            ? "font-serif text-lg text-zinc-900"
            : tone === "warn"
              ? "font-medium text-amber-700"
              : tone === "ok"
                ? "font-medium text-emerald-700"
                : "font-medium text-zinc-900"
        }
      >
        {value}
      </dd>
    </div>
  );
}
