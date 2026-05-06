import { ChevronLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import type { Permission } from "@/lib/permissions";
import { resetUserPassword, toggleUserStatus, updateUser } from "../actions";
import { UserForm } from "../user-form";
import { ResetPasswordCard } from "./reset-password-card";
import { ToggleStatusButton } from "./toggle-status-button";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }: { params: Params }) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      permissions: true,
      lastLoginAt: true,
      createdAt: true
    }
  });
  if (!user) notFound();

  const isSelf = session.user.id === user.id;
  const updateAction = updateUser.bind(null, user.id);
  const resetAction = resetUserPassword.bind(null, user.id);
  const toggleAction = toggleUserStatus.bind(null, user.id);

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
        eyebrow="Compte"
        title={user.name}
        description={user.email}
      />

      <div className="surface p-6 sm:p-8">
        <UserForm
          mode="edit"
          isSelf={isSelf}
          defaultValues={{
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
            permissions: user.permissions as Permission[]
          }}
          action={updateAction}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ResetPasswordCard action={resetAction} />
        <DangerCard isSelf={isSelf} status={user.status} action={toggleAction} />
      </div>
    </div>
  );
}

function DangerCard({
  isSelf,
  status,
  action
}: {
  isSelf: boolean;
  status: "ACTIVE" | "DISABLED";
  action: () => Promise<void>;
}) {
  const isActive = status === "ACTIVE";
  return (
    <div className="surface p-6">
      <p className="font-serif text-base text-zinc-900">
        {isActive ? "Désactiver le compte" : "Réactiver le compte"}
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        {isActive
          ? "Bloque la connexion sans supprimer l'historique du compte."
          : "Le compte pourra à nouveau se connecter."}
      </p>
      <div className="mt-4">
        <ToggleStatusButton
          action={action}
          isActive={isActive}
          disabled={isSelf}
        />
        {isSelf && (
          <p className="mt-2 text-xs text-zinc-400">
            Vous ne pouvez pas désactiver votre propre compte.
          </p>
        )}
      </div>
    </div>
  );
}
