import { CashKind, type SaleStatus } from "@prisma/client";
import { ChevronLeft, Receipt } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { LifecycleBar } from "./lifecycle-bar";
import { PaymentForm } from "./payment-form";
import { PaymentList } from "./payment-list";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<SaleStatus, string> = {
  DRAFT: "Brouillon",
  COMPLETED: "Validée",
  CANCELLED: "Annulée"
};

const STATUS_TONE: Record<SaleStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200"
};

export default async function SaleDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const sale = await prisma.sale.findUnique({
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

  if (!sale) notFound();

  const paid = sale.cashTx
    .filter((t) => t.kind === CashKind.CLIENT_PAYMENT)
    .reduce((acc, t) => acc + Number(t.amount), 0);
  const totalAmount = Number(sale.totalAmount);
  const balance = totalAmount - paid;

  return (
    <div className="space-y-8">
      <div>
        <LinkButton
          href="/sales"
          variant="ghost"
          size="sm"
          className="-ml-2 text-zinc-500"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Retour aux ventes
        </LinkButton>
      </div>

      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            {sale.reference}
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1",
                STATUS_TONE[sale.status]
              )}
            >
              {STATUS_LABEL[sale.status]}
            </span>
          </span>
        }
        title={
          sale.customer
            ? `${sale.customer.firstName} ${sale.customer.lastName}`
            : "Vente anonyme"
        }
        description={`Vente du ${formatDate(sale.saleDate)}`}
        action={
          <LifecycleBar
            saleId={sale.id}
            status={sale.status}
            summary={{ totalAmount, paid }}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/sales/${sale.id}/invoice`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
        >
          <Receipt className="h-3.5 w-3.5" />
          Facture
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="surface p-6">
            <h2 className="font-serif text-lg text-zinc-900">Articles vendus</h2>
            <ul className="mt-4 divide-y divide-zinc-200/70">
              {sale.items.map((it) => {
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
                    <div className="text-right text-sm">
                      <p className="text-zinc-500">
                        {formatCurrency(Number(it.unitPrice))}
                      </p>
                      <p className="font-medium text-zinc-900">
                        {formatCurrency(Number(it.unitPrice) * it.quantity)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {sale.customer && (
            <section className="surface p-6">
              <h2 className="font-serif text-lg text-zinc-900">Cliente</h2>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-zinc-500">Nom</p>
                  <p className="font-medium text-zinc-900">
                    {sale.customer.firstName} {sale.customer.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Téléphone</p>
                  <p className="font-medium text-zinc-900">{sale.customer.phone}</p>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="surface p-6">
            <h2 className="font-serif text-lg text-zinc-900">Récapitulatif</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <Row label="Total" value={formatCurrency(totalAmount)} strong />
              <Row label="Encaissé" value={formatCurrency(paid)} />
              <Row
                label="Solde dû"
                value={formatCurrency(balance)}
                tone={balance > 0 ? "warn" : "ok"}
              />
            </dl>
          </section>

          <section className="surface p-6">
            <h2 className="font-serif text-lg text-zinc-900">Mouvements</h2>
            <PaymentList items={sale.cashTx} />
            {sale.status !== "CANCELLED" && (
              <div className="mt-4 border-t border-zinc-200/70 pt-4">
                <PaymentForm saleId={sale.id} />
              </div>
            )}
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
