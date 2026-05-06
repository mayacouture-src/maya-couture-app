"use client";

import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions";

const GROUPS: { title: string; prefix: string; description?: string }[] = [
  { title: "Catalogue", prefix: "products.", description: "Création et édition des produits + variantes" },
  { title: "Clientes", prefix: "customers." },
  { title: "Locations", prefix: "rentals." },
  { title: "Ventes", prefix: "sales." },
  { title: "Caisse", prefix: "cash." },
  { title: "Inspections", prefix: "inspections.", description: "Au départ et au retour des locations" },
  { title: "Documents", prefix: "documents.", description: "Génération et personnalisation des PDF" },
  { title: "Statistiques", prefix: "stats." },
  { title: "Utilisateurs", prefix: "users." },
  { title: "Paramètres", prefix: "settings." },
  { title: "Audit", prefix: "audit." }
];

const ACTION_LABEL: Record<string, string> = {
  create: "Créer",
  update: "Modifier",
  delete: "Supprimer",
  view: "Consulter",
  generate: "Générer",
  edit: "Personnaliser"
};

function labelFor(perm: Permission): string {
  const action = perm.split(".")[1];
  return ACTION_LABEL[action] ?? action;
}

export function PermissionsPicker({
  defaultSelected
}: {
  defaultSelected: Permission[];
}) {
  const selected = new Set(defaultSelected);

  return (
    <div className="space-y-5">
      {GROUPS.map((group) => {
        const perms = ALL_PERMISSIONS.filter((p) => p.startsWith(group.prefix));
        if (perms.length === 0) return null;
        return (
          <div key={group.prefix} className="rounded-xl border border-zinc-200/70 bg-white p-4">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-900">{group.title}</p>
              {group.description && (
                <p className="text-xs text-zinc-400">{group.description}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {perms.map((perm) => {
                const checked = selected.has(perm);
                return (
                  <label
                    key={perm}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700"
                  >
                    <input
                      type="checkbox"
                      name="permissions"
                      value={perm}
                      defaultChecked={checked}
                      className="h-3.5 w-3.5 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
                    />
                    {labelFor(perm)}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
