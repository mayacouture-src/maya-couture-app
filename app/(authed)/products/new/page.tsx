import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createProduct } from "../actions";
import { ProductForm } from "../product-form";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";
  const cats = await prisma.product.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ["category"]
  });
  const existingCategories = cats
    .map((c) => c.category)
    .filter((c): c is string => Boolean(c));


  return (
    <div className="space-y-8">
      <div>
        <LinkButton
          href="/products"
          variant="ghost"
          size="sm"
          className="-ml-2 text-zinc-500"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Retour au catalogue
        </LinkButton>
      </div>
      <PageHeader
        eyebrow="Nouvelle pièce"
        title="Ajouter une robe"
        description="Renseigne les informations de la pièce et liste les variantes que tu possèdes en stock."
      />
      <div className="surface p-6 sm:p-8">
        <ProductForm
          action={createProduct}
          submitLabel="Créer la robe"
          isAdmin={isAdmin}
          existingCategories={existingCategories}
        />
      </div>
    </div>
  );
}
