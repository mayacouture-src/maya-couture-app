import { CashKind } from "@prisma/client";
import { notFound } from "next/navigation";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { DOC_BANNER_BG, DOC_LOGO_SRC } from "@/lib/document-style";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function SaleInvoicePage({ params }: { params: Params }) {
  const { id } = await params;
  const [sale, settings] = await Promise.all([
    prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { variant: { include: { product: true } } } },
        cashTx: { orderBy: { occurredAt: "asc" } }
      }
    }),
    prisma.siteSettings.findUnique({ where: { id: 1 } })
  ]);

  if (!sale) notFound();

  const paid = sale.cashTx
    .filter((t) => t.kind === CashKind.CLIENT_PAYMENT)
    .reduce((acc, t) => acc + Number(t.amount), 0);
  const totalAmount = Number(sale.totalAmount);
  const balance = totalAmount - paid;

  const company = {
    name: settings?.companyName ?? "Maya Couture",
    address: settings?.companyAddress ?? "",
    phone: settings?.companyPhone ?? "",
    email: settings?.companyEmail ?? ""
  };

  return (
    <>
      <PrintToolbar
        backHref={`/sales/${sale.id}`}
        title={`Facture · ${sale.reference}`}
      />

      <div className="mx-auto my-6 max-w-4xl bg-white p-8 shadow-soft print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <article className="space-y-8 print:p-12">
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
                Facture · Vente
              </p>
              <p className="mt-1 font-serif text-2xl text-brand-700">
                {sale.reference}
              </p>
              <p className="text-xs text-zinc-500">Émise le {formatDate(new Date())}</p>
            </div>
          </header>

          <section className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Facturée à
              </p>
              {sale.customer ? (
                <>
                  <p className="mt-1 font-medium text-zinc-900">
                    {sale.customer.firstName} {sale.customer.lastName}
                  </p>
                  {sale.customer.address && (
                    <p className="text-zinc-600">
                      {sale.customer.address}
                      {sale.customer.postalCode || sale.customer.city
                        ? `, ${sale.customer.postalCode ?? ""} ${sale.customer.city ?? ""}`.trim()
                        : ""}
                    </p>
                  )}
                  <p className="text-zinc-600">{sale.customer.phone}</p>
                </>
              ) : (
                <p className="mt-1 text-zinc-500">Vente anonyme</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Date de vente
              </p>
              <p className="mt-1 text-zinc-700">{formatDate(sale.saleDate)}</p>
            </div>
          </section>

          <section>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-300 text-left">
                  <th className="py-2 font-medium">Désignation</th>
                  <th className="py-2 text-center font-medium">Qté</th>
                  <th className="py-2 text-right font-medium">PU</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((it) => {
                  const lineTotal = Number(it.unitPrice) * it.quantity;
                  return (
                    <tr key={it.id} className="border-b border-zinc-100">
                      <td className="py-2">
                        <p className="text-zinc-900">{it.variant?.product.name ?? "—"}</p>
                        <p className="text-xs text-zinc-500">
                          {it.variant?.product.reference}
                          {it.variant ? ` · ${it.variant.size} · ${it.variant.color}` : ""}
                        </p>
                      </td>
                      <td className="py-2 text-center">{it.quantity}</td>
                      <td className="py-2 text-right">
                        {formatCurrency(Number(it.unitPrice))}
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

          <section className="flex justify-end">
            <div className="w-full max-w-sm space-y-1.5 text-sm">
              <Row label="Total" value={formatCurrency(totalAmount)} strong />
              <Row label="Encaissé" value={formatCurrency(paid)} />
              <div className="my-2 border-t border-zinc-200" />
              <Row
                label="Solde à régler"
                value={formatCurrency(balance)}
                strong
                tone={balance > 0 ? "warn" : "ok"}
              />
            </div>
          </section>

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
