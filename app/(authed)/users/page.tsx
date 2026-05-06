import { Plus, Search, Shield, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LinkButton } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  role?: "ADMIN" | "STAFF";
  status?: "ACTIVE" | "DISABLED";
}>;

export default async function UsersPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const { q = "", role, status } = await searchParams;

  const users = await prisma.user.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } }
              ]
            }
          : {},
        role ? { role } : {},
        status ? { status } : {}
      ]
    },
    orderBy: [{ status: "asc" }, { role: "asc" }, { name: "asc" }],
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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Équipe"
        description="Comptes staff, rôles et permissions granulaires."
        action={
          <div className="flex items-center gap-2">
            <ExportButton entity="users" />
            <LinkButton href="/users/new">
              <Plus className="h-4 w-4" />
              Nouveau compte
            </LinkButton>
          </div>
        }
      />

      <FiltersBar q={q} role={role} status={status} />

      {users.length === 0 ? (
        <EmptyState hasFilter={!!(q || role || status)} />
      ) : (
        <div className="surface overflow-hidden">
          <ul className="divide-y divide-zinc-200/70">
            {users.map((u) => {
              const isMe = u.id === session.user.id;
              return (
                <li key={u.id}>
                  <Link
                    href={`/users/${u.id}`}
                    className="group flex items-center gap-4 px-5 py-4 transition hover:bg-zinc-50/60"
                  >
                    <Avatar name={u.name} disabled={u.status === "DISABLED"} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <p className="truncate font-medium text-zinc-900">
                          {u.name}
                          {isMe && (
                            <span className="ml-2 text-[10px] uppercase tracking-wider text-brand-600">
                              vous
                            </span>
                          )}
                        </p>
                        <RoleBadge role={u.role} />
                        {u.status === "DISABLED" && (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                            désactivé
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">{u.email}</p>
                    </div>
                    <div className="hidden text-right text-xs sm:block">
                      <p className="text-zinc-500">
                        {u.lastLoginAt ? (
                          <>Connexion {formatDate(u.lastLoginAt)}</>
                        ) : (
                          <span className="text-zinc-400">Jamais connecté</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-zinc-400">
                        {u.role === "ADMIN"
                          ? "Toutes permissions"
                          : `${u.permissions.length} permission${u.permissions.length > 1 ? "s" : ""}`}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function FiltersBar({
  q,
  role,
  status
}: {
  q: string;
  role?: "ADMIN" | "STAFF";
  status?: "ACTIVE" | "DISABLED";
}) {
  return (
    <form action="/users" className="flex flex-wrap items-center gap-3">
      <div className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Rechercher un nom ou un email…"
          className="focus-ring w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm placeholder:text-zinc-400"
        />
      </div>
      <FilterSelect name="role" defaultValue={role ?? ""} options={[
        { value: "", label: "Tous les rôles" },
        { value: "ADMIN", label: "Gérante" },
        { value: "STAFF", label: "Vendeuse" }
      ]} />
      <FilterSelect name="status" defaultValue={status ?? ""} options={[
        { value: "", label: "Tous les statuts" },
        { value: "ACTIVE", label: "Actifs" },
        { value: "DISABLED", label: "Désactivés" }
      ]} />
      <button
        type="submit"
        className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Filtrer
      </button>
    </form>
  );
}

function FilterSelect({
  name,
  defaultValue,
  options
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="focus-ring rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-700 shadow-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function RoleBadge({ role }: { role: "ADMIN" | "STAFF" }) {
  const isAdmin = role === "ADMIN";
  const Icon = isAdmin ? ShieldCheck : Shield;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
        (isAdmin
          ? "bg-brand-100 text-brand-700"
          : "bg-zinc-100 text-zinc-600")
      }
    >
      <Icon className="h-3 w-3" />
      {isAdmin ? "Gérante" : "Vendeuse"}
    </span>
  );
}

function Avatar({ name, disabled }: { name: string; disabled?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className={
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold " +
        (disabled
          ? "bg-zinc-100 text-zinc-400"
          : "bg-gradient-to-br from-brand-100 to-pink-100 text-brand-700")
      }
    >
      {initials || "·"}
    </div>
  );
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="surface relative overflow-hidden p-12 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-white to-white" />
      {hasFilter ? (
        <>
          <p className="font-serif text-xl text-zinc-900">Aucun compte ne correspond</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            Modifie les filtres ou ajoute un nouveau compte.
          </p>
        </>
      ) : (
        <>
          <p className="font-serif text-xl text-zinc-900">Aucun compte pour l&apos;instant</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            Crée ton premier compte staff pour démarrer.
          </p>
          <div className="mt-5">
            <LinkButton href="/users/new">
              <Plus className="h-4 w-4" />
              Nouveau compte
            </LinkButton>
          </div>
        </>
      )}
    </div>
  );
}
