import { ChevronLeft, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { deleteCustomer, updateCustomer } from "../actions";
import { CustomerForm, type CustomerFormValues } from "../customer-form";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({ params }: { params: Params }) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { _count: { select: { reservations: true, sales: true } } }
  });

  if (!customer) notFound();

  const measurements = (customer.measurements ?? null) as
    | { bust?: number; waist?: number; hips?: number; height?: number }
    | null;

  const defaultValues: CustomerFormValues = {
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    city: customer.city,
    postalCode: customer.postalCode,
    idDocumentRef: customer.idDocumentRef,
    measurements,
    notes: customer.notes
  };

  const updateAction = updateCustomer.bind(null, id);
  const deleteAction = deleteCustomer.bind(null, id);

  const fullName = `${customer.firstName} ${customer.lastName}`;
  const totalActivity = customer._count.reservations + customer._count.sales;

  return (
    <div className="space-y-8">
      <div>
        <LinkButton
          href="/customers"
          variant="ghost"
          size="sm"
          className="-ml-2 text-zinc-500"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Retour à l&apos;annuaire
        </LinkButton>
      </div>

      <PageHeader
        eyebrow={
          totalActivity > 0
            ? `${totalActivity} dossier${totalActivity > 1 ? "s" : ""}`
            : "Pas encore de dossier"
        }
        title={fullName}
        description="Modifie les informations de cette cliente."
        action={
          <ConfirmDialog
            trigger={
              <Button variant="danger" size="sm">
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </Button>
            }
            title="Supprimer cette cliente ?"
            description={
              <>
                <span className="font-medium text-zinc-700">{fullName}</span> sera
                définitivement retirée de l&apos;annuaire. Cette action est
                irréversible.
              </>
            }
            confirmLabel="Confirmer la suppression"
            onConfirm={deleteAction}
          />
        }
      />

      <div className="surface p-6 sm:p-8">
        <CustomerForm
          defaultValues={defaultValues}
          action={updateAction}
          submitLabel="Enregistrer les modifications"
        />
      </div>
    </div>
  );
}
