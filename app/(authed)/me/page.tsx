import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/ui/page-header";
import { defaultPrefs, type NotificationCategory } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { NotificationPrefsForm } from "./notification-prefs-form";
import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      role: true,
      lastLoginAt: true,
      createdAt: true,
      notificationPrefs: true
    }
  });
  if (!user) redirect("/login");

  const prefs = readPrefs(user.notificationPrefs);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Mes paramètres"
        title="Mon compte"
        description="Tes informations personnelles et ton mot de passe."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface p-6">
          <p className="font-serif text-base text-zinc-900">Profil</p>
          <p className="mt-1 text-sm text-zinc-500">
            Pour modifier ton nom ou ton email, demande à une gérante.
          </p>
          <dl className="mt-5 space-y-3 text-sm">
            <Row label="Nom" value={user.name} />
            <Row label="Email" value={user.email} />
            <Row label="Rôle" value={user.role === "ADMIN" ? "Gérante" : "Vendeuse"} />
            <Row
              label="Dernière connexion"
              value={user.lastLoginAt ? formatDate(user.lastLoginAt) : "Première connexion"}
            />
            <Row label="Compte créé le" value={formatDate(user.createdAt)} />
          </dl>
        </section>

        <section className="surface p-6">
          <p className="font-serif text-base text-zinc-900">Mot de passe</p>
          <p className="mt-1 text-sm text-zinc-500">
            Choisis quelque chose que tu retiens, mais difficile à deviner.
          </p>
          <div className="mt-5">
            <PasswordForm />
          </div>
        </section>
      </div>

      <section className="surface p-6">
        <p className="font-serif text-base text-zinc-900">Notifications</p>
        <p className="mt-1 text-sm text-zinc-500">
          Choisis les catégories que tu veux recevoir dans la cloche.
        </p>
        <div className="mt-5">
          <NotificationPrefsForm defaultPrefs={prefs} isAdmin={user.role === "ADMIN"} />
        </div>
      </section>
    </div>
  );
}

function readPrefs(raw: unknown): Record<NotificationCategory, boolean> {
  const prefs = defaultPrefs();
  if (raw && typeof raw === "object") {
    for (const key of Object.keys(prefs) as NotificationCategory[]) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === "boolean") prefs[key] = v;
    }
  }
  return prefs;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900">{value}</dd>
    </div>
  );
}
