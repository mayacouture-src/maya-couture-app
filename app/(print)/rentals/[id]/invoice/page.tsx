import { CashKind } from "@prisma/client";
import { notFound } from "next/navigation";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { inclusiveDays } from "@/lib/dates";
import { DOC_BANNER_BG, DOC_LOGO_SRC } from "@/lib/document-style";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Params }) {
  const { id } = await params;
  const [reservation, settings] = await Promise.all([
    prisma.reservation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: { variant: { include: { product: true } } }
        },
        cashTx: { orderBy: { occurredAt: "asc" } }
      }
    }),
    prisma.siteSettings.findUnique({ where: { id: 1 } })
  ]);

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
  const totalPrice = Number(reservation.totalPrice);
  const balance = totalPrice - paid;

  const company = {
    name: settings?.companyName ?? "Maya Couture",
    address: settings?.companyAddress ?? "",
    phone: settings?.companyPhone ?? "",
    email: settings?.companyEmail ?? ""
  };

  return (
    <>
      <PrintToolbar
        backHref={`/rentals/${reservation.id}`}
        title={`Facture · ${reservation.reference}`}
      />

      <div className="mx-auto my-6 max-w-4xl bg-white p-8 shadow-soft print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <article className="space-y-8 print:p-12">
          {/* En-tête */}
          <header
            style={{
              backgroundColor: DOC_BANNER_BG,
              printColorAdjust: "exact",
              WebkitPrintColorAdjust: "exact"
            }}
            className="-mx-8 -mt-8 flex items-start justify-between gap-6 px-8 pb-6 pt-8 print:-mx-12 print:-mt-12 print:px-12 print:pt-12"
          >
            <div className="flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={DOC_LOGO_SRC}
                alt={company.name}
                className="h-20 w-auto"
                style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
              />
              <div className="pt-2">
                {company.address && (
                  <p className="text-sm text-zinc-600">{company.address}</p>
                )}
                <p className="text-xs text-zinc-500">
                  {[company.phone, company.email].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.18em] text-brand-700/70">
                Facture
              </p>
              <p className="mt-1 font-serif text-2xl text-brand-700">
                {reservation.reference}
              </p>
              <p className="text-xs text-zinc-500">Émise le {formatDate(new Date())}</p>
            </div>
          </header>

          {/* Cliente */}
          <section className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Facturée à
              </p>
              <p className="mt-1 font-medium text-zinc-900">
                {reservation.customer.firstName} {reservation.customer.lastName}
              </p>
              {reservation.customer.address && (
                <p className="text-zinc-600">
                  {reservation.customer.address}
                  {reservation.customer.postalCode || reservation.customer.city
                    ? `, ${reservation.customer.postalCode ?? ""} ${reservation.customer.city ?? ""}`.trim()
                    : ""}
                </p>
              )}
              <p className="text-zinc-600">{reservation.customer.phone}</p>
            </div>
            <div className="text-right text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Période
              </p>
              <p className="mt-1 text-zinc-700">
                {formatDate(reservation.startDate1)} → {formatDate(reservation.endDate1)}
              </p>
              {reservation.startDate2 && reservation.endDate2 && (
                <p className="text-zinc-700">
                  {formatDate(reservation.startDate2)} → {formatDate(reservation.endDate2)}
                </p>
              )}
              <p className="mt-1 text-xs text-zinc-500">
                {totalDays} jour{totalDays > 1 ? "s" : ""} de location
              </p>
            </div>
          </section>

          {/* Lignes facture */}
          <section>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-300 text-left">
                  <th className="py-2 font-medium">Désignation</th>
                  <th className="py-2 text-center font-medium">Qté</th>
                  <th className="py-2 text-right font-medium">Prix unitaire</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {reservation.items.map((it) => {
                  const lineTotal = Number(it.price) * it.quantity;
                  return (
                    <tr key={it.id} className="border-b border-zinc-100">
                      <td className="py-2">
                        <p className="text-zinc-900">
                          {it.variant?.product.name ?? "—"}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {it.variant?.product.reference}
                          {it.variant ? ` · ${it.variant.size} · ${it.variant.color}` : ""}
                        </p>
                      </td>
                      <td className="py-2 text-center">{it.quantity}</td>
                      <td className="py-2 text-right">
                        {formatCurrency(Number(it.price))}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {formatCurrency(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* Totaux */}
          <section className="flex justify-end">
            <div className="w-full max-w-sm space-y-1.5 text-sm">
              <Row label="Total" value={formatCurrency(totalPrice)} strong />
              <Row label="Acompte" value={formatCurrency(paid)} />
              <div className="my-2 border-t border-zinc-200" />
              <Row
                label="Solde à régler"
                value={formatCurrency(balance)}
                strong
                tone={balance > 0 ? "warn" : "ok"}
              />
            </div>
          </section>

          {/* Historique paiements */}
          {reservation.cashTx.filter((t) => t.kind === CashKind.CLIENT_PAYMENT).length > 0 && (
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Historique des paiements
              </p>
              <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                {reservation.cashTx
                  .filter((t) => t.kind === CashKind.CLIENT_PAYMENT)
                  .map((t) => (
                    <li key={t.id} className="flex items-baseline justify-between">
                      <span>
                        {formatDate(t.occurredAt)}
                        {t.description ? ` — ${t.description}` : ""}
                      </span>
                      <span className="font-medium text-zinc-900">
                        {formatCurrency(Number(t.amount))}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          <footer className="border-t border-zinc-200 pt-6 text-center text-xs text-zinc-400">
            Merci de votre confiance · {company.name}
          </footer>
        </article>
      </div>
    </>
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
      <span className="text-zinc-500">{label}</span>
      <span
        className={
          tone === "warn"
            ? "font-medium text-amber-700"
            : tone === "ok"
              ? "font-medium text-emerald-700"
              : strong
                ? "font-serif text-lg text-zinc-900"
                : "text-zinc-900"
        }
      >
        {value}
      </span>
    </div>
  );
}
