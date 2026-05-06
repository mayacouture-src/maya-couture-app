import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { deleteProduct, updateProduct } from "../actions";
import { ProductForm, type ProductFormValues } from "../product-form";
import { DeleteButton } from "./delete-button";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  const [product, cats] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
        photos: { orderBy: { order: "asc" } }
      }
    }),
    prisma.product.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"]
    })
  ]);

  if (!product) notFound();

  const existingCategories = cats
    .map((c) => c.category)
    .filter((c): c is string => Boolean(c));

  const defaultValues: ProductFormValues = {
    reference: product.reference,
    name: product.name,
    designer: product.designer,
    category: product.category,
    description: product.description,
    purchasePrice: Number(product.purchasePrice),
    rentalPrice: Number(product.rentalPrice),
    salePrice: Number(product.salePrice),
    deposit: Number(product.deposit),
    marginBetweenRentalsDays: product.marginBetweenRentalsDays,
    isRentable: product.isRentable,
    isSellable: product.isSellable,
    variants: product.variants.map((v) => ({
      size: v.size,
      color: v.color,
      colorHex: v.colorHex,
      quantityInitial: v.quantityInitial
    })),
    photos: product.photos.map((p) => ({
      id: p.id,
      url: p.url,
      alt: p.alt
    }))
  };

  const updateAction = updateProduct.bind(null, id);
  const deleteAction = deleteProduct.bind(null, id);

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
        eyebrow={product.reference}
        title={product.name}
        description="Modifie les informations ou les variantes de cette robe."
        action={<DeleteButton onConfirm={deleteAction} productName={product.name} />}
      />

      <div className="surface p-6 sm:p-8">
        <ProductForm
          defaultValues={defaultValues}
          action={updateAction}
          submitLabel="Enregistrer les modifications"
          isAdmin={isAdmin}
          existingCategories={existingCategories}
        />
      </div>
    </div>
  );
}
