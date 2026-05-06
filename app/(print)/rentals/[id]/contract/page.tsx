import { CashKind } from "@prisma/client";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { PrintToolbar } from "@/components/print/print-toolbar";
import {
  DEFAULT_CONTRACT_ARTICLES,
  parseContractArticles
} from "@/lib/contract-template";
import { inclusiveDays } from "@/lib/dates";
import { DOC_BANNER_BG, DOC_LOGO_SRC } from "@/lib/document-style";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ContractArticles } from "./contract-articles";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function ContractPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  const [reservation, settings] = await Promise.all([
    prisma.reservation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: { variant: { include: { product: true } } }
        },
        cashTx: { select: { kind: true, amount: true } }
      }
    }),
    prisma.siteSettings.findUnique({ where: { id: 1 } })
  ]);

  if (!reservation) notFound();

  const customArticles = parseContractArticles(reservation.contractArticles);
  const articles = customArticles ?? DEFAULT_CONTRACT_ARTICLES;

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
  const totalDeposit = Number(reservation.totalDeposit);
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
        title={`Contrat · ${reservation.reference}`}
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
                Contrat de location
              </p>
              <p className="mt-1 font-serif text-2xl text-brand-700">
                {reservation.reference}
              </p>
              <p className="text-xs text-zinc-500">Le {formatDate(reservation.createdAt)}</p>
            </div>
          </header>

          {/* Parties */}
          <section className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Le bailleur
              </p>
              <p className="mt-1 font-medium text-zinc-900">{company.name}</p>
              {company.address && <p className="text-zinc-600">{company.address}</p>}
              {company.phone && <p className="text-zinc-600">{company.phone}</p>}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                La locataire
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
              {reservation.customer.email && (
                <p className="text-zinc-600">{reservation.customer.email}</p>
              )}
              {reservation.customer.idDocumentRef && (
                <p className="mt-1 text-xs text-zinc-500">
                  Pièce d&apos;identité : {reservation.customer.idDocumentRef}
                </p>
              )}
            </div>
          </section>

          {/* Période */}
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Période de location
            </h2>
            <div className="mt-2 rounded-lg bg-zinc-50 p-4 text-sm">
              <p>
                <span className="font-medium">Période 1</span> : du{" "}
                <span className="font-medium">{formatDate(reservation.startDate1)}</span>{" "}
                au{" "}
                <span className="font-medium">{formatDate(reservation.endDate1)}</span>
                <span className="text-zinc-500"> · {days1} jour{days1 > 1 ? "s" : ""}</span>
              </p>
              {reservation.startDate2 && reservation.endDate2 && (
                <p className="mt-1">
                  <span className="font-medium">Période 2</span> : du{" "}
                  <span className="font-medium">{formatDate(reservation.startDate2)}</span>{" "}
                  au{" "}
                  <span className="font-medium">{formatDate(reservation.endDate2)}</span>
                  <span className="text-zinc-500"> · {days2} jour{days2 > 1 ? "s" : ""}</span>
                </p>
              )}
              <p className="mt-2 text-zinc-600">Total : {totalDays} jour{totalDays > 1 ? "s" : ""}</p>
            </div>
          </section>

          {/* Articles loués */}
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Article 1 · Robes louées
            </h2>
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-300 text-left">
                  <th className="py-2 font-medium">Référence</th>
                  <th className="py-2 font-medium">Désignation</th>
                  <th className="py-2 font-medium">Taille / Couleur</th>
                  <th className="py-2 text-center font-medium">Qté</th>
                  <th className="py-2 text-right font-medium">Prix</th>
                  <th className="py-2 text-right font-medium">Caution</th>
                </tr>
              </thead>
              <tbody>
                {reservation.items.map((it) => (
                  <tr key={it.id} className="border-b border-zinc-100">
                    <td className="py-2 text-zinc-600">{it.variant?.product.reference ?? "—"}</td>
                    <td className="py-2 text-zinc-900">{it.variant?.product.name ?? "—"}</td>
                    <td className="py-2 text-zinc-600">
                      {it.variant ? `${it.variant.size} · ${it.variant.color}` : "—"}
                    </td>
                    <td className="py-2 text-center">{it.quantity}</td>
                    <td className="py-2 text-right">{formatCurrency(Number(it.price))}</td>
                    <td className="py-2 text-right">{formatCurrency(Number(it.deposit))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Récap tarif */}
          <section className="flex justify-end">
            <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
              <Row label="Total location" value={formatCurrency(totalPrice)} />
              <Row label="Acompte versé" value={formatCurrency(paid)} />
              <Row label="Solde à régler" value={formatCurrency(balance)} strong />
              <div className="my-3 border-t border-zinc-200" />
              <Row label="Caution" value={formatCurrency(totalDeposit)} />
            </div>
          </section>

          {/* Articles personnalisables (Article 2 et suivants) */}
          <ContractArticles
            reservationId={reservation.id}
            initial={articles}
            isAdmin={isAdmin}
            startNumber={2}
          />

          {/* Notes */}
          {reservation.observation && (
            <section>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Observations
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm text-zinc-700">
                {reservation.observation}
              </p>
            </section>
          )}

          {/* Signatures */}
          <section className="grid grid-cols-2 gap-12 pt-6">
            <div>
              <p className="text-xs text-zinc-500">Le bailleur</p>
              <div className="mt-12 border-t border-zinc-300 pt-1 text-xs text-zinc-400">
                Signature & cachet
              </div>
            </div>
            <div>
              <p className="text-xs text-zinc-500">La locataire</p>
              <div className="mt-12 border-t border-zinc-300 pt-1 text-xs text-zinc-400">
                Lu et approuvé · Signature
              </div>
            </div>
          </section>
        </article>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  strong
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-zinc-500">{label}</span>
      <span className={strong ? "font-serif text-base text-zinc-900" : "text-zinc-900"}>
        {value}
      </span>
    </div>
  );
}
