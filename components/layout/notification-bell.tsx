"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function NotificationBell({
  initialCount,
  variant = "sidebar"
}: {
  initialCount: number;
  variant?: "sidebar" | "topbar";
}) {
  const [count, setCount] = useState(initialCount);
  const pathname = usePathname();

  // Garde le state aligné avec ce que rend le serveur (utile quand le layout
  // re-rend avec un nouveau initialCount).
  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/notifications/count", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { count: number };
        if (!cancelled) setCount(data.count);
      } catch {
        // ignore
      }
    }

    // 1) Fetch immédiat au montage et à chaque changement de route — comme ça,
    //    après n'importe quelle navigation (y compris post-action), le badge
    //    reflète l'état réel sans attendre le prochain poll.
    refresh();

    // 2) Poll régulier, plus court qu'avant.
    const id = setInterval(refresh, 10_000);

    // 3) Refresh quand l'onglet redevient visible.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  const display = count > 99 ? "99+" : String(count);
  const hasUnread = count > 0;

  return (
    <Link
      href="/notifications"
      aria-label={hasUnread ? `${count} notifications non lues` : "Notifications"}
      className={
        variant === "sidebar"
          ? "relative inline-flex h-11 w-11 items-center justify-center rounded-lg text-brand-700/70 transition hover:bg-white hover:text-brand-700"
          : "relative -mr-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-brand-700 hover:bg-white/50"
      }
    >
      <Bell className="h-5 w-5" />
      {hasUnread && (
        <span
          className={
            "absolute -right-0.5 -top-0.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-white"
          }
        >
          {display}
        </span>
      )}
    </Link>
  );
}
