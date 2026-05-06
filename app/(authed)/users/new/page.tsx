import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { createUser } from "../actions";
import { UserForm } from "../user-form";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="space-y-8">
      <div>
        <LinkButton
          href="/users"
          variant="ghost"
          size="sm"
          className="-ml-2 text-zinc-500"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Retour à l&apos;équipe
        </LinkButton>
      </div>
      <PageHeader
        eyebrow="Nouveau compte"
        title="Inviter une personne"
        description="Crée son compte et copie le mot de passe temporaire à lui transmettre."
      />
      <div className="surface p-6 sm:p-8">
        <UserForm mode="create" action={createUser} />
      </div>
    </div>
  );
}
