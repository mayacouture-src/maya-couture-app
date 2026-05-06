import { ChevronLeft } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { createSale } from "../actions";
import { SaleForm } from "../sale-form";

export const dynamic = "force-dynamic";

export default async function NewSalePage() {
  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      select: { id: true, firstName: true, lastName: true, phone: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    }),
    prisma.product.findMany({
      where: { isSellable: true },
      include: {
        variants: {
          select: {
            id: true,
            size: true,
            color: true,
            colorHex: true,
            quantityCurrent: true
          }
        },
        photos: { take: 1, orderBy: { order: "asc" }, select: { url: true } }
      },
      orderBy: { name: "asc" }
    })
  ]);

  const productCatalog = products.map((p) => ({
    id: p.id,
    reference: p.reference,
    name: p.name,
    salePrice: Number(p.salePrice),
    photoUrl: p.photos[0]?.url ?? null,
    variants: p.variants
  }));

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
        eyebrow="Nouvelle vente"
        title="Créer une vente"
        description="Cliente optionnelle (vente anonyme possible). La validation décrémente le stock."
      />

      <div className="surface p-6 sm:p-8">
        <SaleForm action={createSale} customers={customers} catalog={productCatalog} />
      </div>
    </div>
  );
}
