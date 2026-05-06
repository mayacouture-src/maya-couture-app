import {
  Box,
  Download,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Upload,
  Users
} from "lucide-react";
import { auth } from "@/auth";
import { PageHeader } from "@/components/ui/page-header";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Aide"
        title="Documentation"
        description="Comment exporter tes données et comment importer en masse depuis Excel."
      />

      <section className="surface space-y-4 p-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Download className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-serif text-xl text-zinc-900">Exporter</h2>
            <p className="text-sm text-zinc-500">
              Récupère tes données pour les ouvrir dans Excel, Google Sheets ou
              les archiver.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-zinc-50/70 p-4 text-sm text-zinc-700">
          <p>
            Sur chaque page liste (catalogue, locations, ventes, clientes,
            caisse, équipe, audit), un bouton{" "}
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold">
              <Download className="h-3 w-3" /> Exporter
            </span>{" "}
            apparaît en haut à droite. Il propose deux formats :
          </p>
          <ul className="mt-2 space-y-1.5">
            <li className="flex items-start gap-2">
              <FileSpreadsheet className="mt-0.5 h-4 w-4 text-emerald-600" />
              <span>
                <span className="font-medium">Excel (.xlsx)</span> — fichier
                prêt à ouvrir avec en-têtes mis en forme et colonnes auto-réglées.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 text-zinc-500" />
              <span>
                <span className="font-medium">CSV (.csv)</span> — texte brut
                (séparateur ;) compatible avec n&apos;importe quel tableur.
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-zinc-500">
            L&apos;export reflète exactement les filtres actifs sur la page —
            change-les pour cibler ce que tu veux exporter.
          </p>
        </div>
      </section>

      <section className="surface space-y-5 p-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Upload className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-serif text-xl text-zinc-900">
              Importer en masse
            </h2>
            <p className="text-sm text-zinc-500">
              Remplis un fichier Excel modèle puis injecte-le pour créer les
              fiches d&apos;un coup.
            </p>
          </div>
        </div>

        <ol className="space-y-3 rounded-xl bg-zinc-50/70 p-4 text-sm text-zinc-700">
          <li className="flex gap-2">
            <Step n={1} />
            <span>
              Télécharge le <strong>template</strong> correspondant (Excel
              recommandé — il contient une feuille &quot;Mode d&apos;emploi&quot;).
            </span>
          </li>
          <li className="flex gap-2">
            <Step n={2} />
            <span>
              Remplis-le. Garde la première ligne (en-têtes) intacte et
              respecte les noms de colonnes.
            </span>
          </li>
          <li className="flex gap-2">
            <Step n={3} />
            <span>
              Reviens ici, choisis le fichier, et lance d&apos;abord en{" "}
              <strong>simulation</strong>. Tu verras le rapport (lignes OK +
              erreurs ligne par ligne).
            </span>
          </li>
          <li className="flex gap-2">
            <Step n={4} />
            <span>
              Si tout est bon, clique sur <strong>Confirmer l&apos;import</strong>{" "}
              pour réellement créer les fiches.
            </span>
          </li>
        </ol>

        {!isAdmin && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            L&apos;import en masse est réservé aux comptes <strong>Admin</strong>.
            Les templates restent téléchargeables ci-dessous pour préparer les
            fichiers.
          </div>
        )}

        <ImportEntityCard
          icon={<Box className="h-4 w-4" />}
          entity="products"
          title="Catalogue"
          subtitle="Une ligne par variante (taille / couleur). Plusieurs lignes même référence = variantes du même modèle."
          canCommit={isAdmin}
        />

        <ImportEntityCard
          icon={<Users className="h-4 w-4" />}
          entity="customers"
          title="Clientes"
          subtitle="Une ligne par cliente. Le téléphone sert de clé de doublon — les fiches déjà existantes sont signalées et ignorées."
          canCommit={isAdmin}
        />
      </section>

      <section className="surface flex items-start gap-3 p-5 text-sm">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
        <p className="text-zinc-600">
          Astuce : pour pré-remplir le template avec des données existantes,
          fais d&apos;abord un export, supprime les colonnes que tu ne veux pas
          modifier, puis remplis. Les colonnes manquantes prennent leurs valeurs
          par défaut.
        </p>
      </section>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-700 text-[11px] font-semibold text-white">
      {n}
    </span>
  );
}

function ImportEntityCard({
  icon,
  entity,
  title,
  subtitle,
  canCommit
}: {
  icon: React.ReactNode;
  entity: "products" | "customers";
  title: string;
  subtitle: string;
  canCommit: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            {icon}
          </span>
          <div>
            <p className="font-medium text-zinc-900">{title}</p>
            <p className="text-xs text-zinc-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/import/${entity}/template?format=xlsx`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50/40 hover:text-emerald-700"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </a>
          <a
            href={`/api/import/${entity}/template?format=csv`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
          >
            <FileText className="h-3.5 w-3.5" />
            CSV
          </a>
        </div>
      </div>

      {canCommit && <ImportForm entity={entity} />}
    </div>
  );
}
