import { auth } from "@/auth";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  const user = session!.user;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Compte"
        title="Mon profil"
        description="Tes informations de session."
      />
      <div className="surface p-6">
        <dl className="grid gap-5 sm:grid-cols-2">
          <Field label="Nom" value={user.name ?? "—"} />
          <Field label="Email" value={user.email ?? "—"} />
          <Field
            label="Rôle"
            value={
              <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-100">
                {user.role === "ADMIN" ? "Gérante" : "Vendeuse"}
              </span>
            }
          />
        </dl>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-zinc-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-zinc-900">{value}</dd>
    </div>
  );
}
