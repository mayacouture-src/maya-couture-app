import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Paramètres"
        description="Informations de la boutique utilisées sur les contrats et factures."
      />
      <div className="surface p-6 sm:p-8">
        <SettingsForm
          defaults={{
            companyName: settings?.companyName ?? "Maya Couture",
            companyAddress: settings?.companyAddress ?? null,
            companyPhone: settings?.companyPhone ?? null,
            companyEmail: settings?.companyEmail ?? null,
            currency: settings?.currency ?? "DZD"
          }}
        />
      </div>
    </div>
  );
}
