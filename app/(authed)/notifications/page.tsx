import { Bell, CheckCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { deleteAllRead, markAllAsRead } from "./actions";
import { NotificationItem } from "./notification-item";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ unread?: string }>;

export default async function NotificationsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const onlyUnread = params.unread === "1";

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: session.user.id,
        ...(onlyUnread ? { readAt: null } : {})
      },
      orderBy: { createdAt: "desc" },
      take: 200
    }),
    prisma.notification.count({
      where: { userId: session.user.id, readAt: null }
    })
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Atelier"
        title="Notifications"
        description={
          unreadCount > 0
            ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
            : "Tu es à jour."
        }
        action={<HeaderActions hasUnread={unreadCount > 0} />}
      />

      <div className="flex flex-wrap gap-2">
        <FilterPill href="/notifications" active={!onlyUnread}>
          Toutes
        </FilterPill>
        <FilterPill href="/notifications?unread=1" active={onlyUnread}>
          Non lues
          {unreadCount > 0 && (
            <span
              className={
                onlyUnread
                  ? "ml-1.5 rounded-full bg-white/20 px-1.5 text-[10px]"
                  : "ml-1.5 rounded-full bg-brand-600 px-1.5 text-[10px] text-white"
              }
            >
              {unreadCount}
            </span>
          )}
        </FilterPill>
      </div>

      {notifications.length === 0 ? (
        <EmptyState onlyUnread={onlyUnread} />
      ) : (
        <>
          <p className="-mb-2 text-xs text-zinc-400 sm:hidden">
            Astuce : glisse une notification vers la gauche pour la supprimer.
          </p>
          <div className="surface overflow-hidden">
            <ul className="divide-y divide-zinc-200/70">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={{
                    id: n.id,
                    type: n.type,
                    title: n.title,
                    body: n.body,
                    link: n.link,
                    readAt: n.readAt,
                    createdAtISO: n.createdAt.toISOString(),
                    timestampLabel: formatRelativeFr(n.createdAt)
                  }}
                />
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function FilterPill({
  href,
  active,
  children
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-brand-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-soft"
          : "rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
      }
    >
      {children}
    </Link>
  );
}

function HeaderActions({ hasUnread }: { hasUnread: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasUnread && (
        <form action={markAllAsRead}>
          <Button type="submit" variant="secondary" size="sm">
            <CheckCheck className="h-3.5 w-3.5" />
            Tout marquer lu
          </Button>
        </form>
      )}
      <form action={deleteAllRead}>
        <Button type="submit" variant="ghost" size="sm">
          <Trash2 className="h-3.5 w-3.5" />
          Vider les lues
        </Button>
      </form>
    </div>
  );
}

function EmptyState({ onlyUnread }: { onlyUnread: boolean }) {
  return (
    <div className="surface relative overflow-hidden p-12 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-white to-white" />
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
        <Bell className="h-5 w-5" />
      </div>
      <p className="mt-4 font-serif text-xl text-zinc-900">
        {onlyUnread ? "Tout est lu !" : "Pas de notifications"}
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
        {onlyUnread
          ? "Reviens ici dès qu'un événement intéressant se produira."
          : "Les actions importantes (locations, paiements, dépenses, briefing du matin…) apparaîtront ici."}
      </p>
    </div>
  );
}

function formatRelativeFr(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "hier";
  if (d < 7) return `il y a ${d} j`;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}
