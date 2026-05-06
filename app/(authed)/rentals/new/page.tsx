import { ChevronLeft } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { createReservation } from "../actions";
import { ReservationForm } from "../reservation-form";

export const dynamic = "force-dynamic";

export default async function NewReservationPage() {
  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      select: { id: true, firstName: true, lastName: true, phone: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    }),
    prisma.product.findMany({
      where: { isRentable: true },
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
    rentalPrice: Number(p.rentalPrice),
    deposit: Number(p.deposit),
    photoUrl: p.photos[0]?.url ?? null,
    variants: p.variants
  }));

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
        eyebrow="Nouveau dossier"
        title="Créer une location"
        description="Sélectionne la cliente, les dates, et les robes louées."
      />

      <div className="surface p-6 sm:p-8">
        <ReservationForm
          action={createReservation}
          customers={customers}
          catalog={productCatalog}
        />
      </div>
    </div>
  );
}
