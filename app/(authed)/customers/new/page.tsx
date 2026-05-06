import { ChevronLeft } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { createCustomer } from "../actions";
import { CustomerForm } from "../customer-form";

export default function NewCustomerPage() {
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
        eyebrow="Nouvelle cliente"
        title="Ajouter une fiche"
        description="Coordonnées, mensurations et notes — tout ce qui sera utile à la prochaine location."
      />
      <div className="surface p-6 sm:p-8">
        <CustomerForm action={createCustomer} submitLabel="Créer la fiche" />
      </div>
    </div>
  );
}
