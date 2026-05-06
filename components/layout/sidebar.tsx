"use client";

import {
  BarChart3,
  Box,
  CalendarRange,
  ChevronRight,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
  ShoppingBag,
  ShoppingCart,
  UserCog,
  Users,
  Wallet,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { signOutAction } from "@/app/actions/auth";
import { BrandMark } from "@/components/layout/brand-mark";
import { NotificationBell } from "@/components/layout/notification-bell";
import { cn } from "@/lib/cn";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;
type MenuItem = { href: string; label: string; icon: IconType };

const primaryItems: MenuItem[] = [
  { href: "/dashboard", label: "Aperçu", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarRange },
  { href: "/products", label: "Catalogue", icon: Box },
  { href: "/rentals", label: "Locations", icon: ShoppingBag },
  { href: "/sales", label: "Ventes", icon: ShoppingCart },
  { href: "/customers", label: "Clientes", icon: Users }
];

// Caisse + outils admin : visibles uniquement aux comptes ADMIN.
const adminItems: MenuItem[] = [
  { href: "/cash", label: "Caisse", icon: Wallet },
  { href: "/stats", label: "Statistiques", icon: BarChart3 },
  { href: "/users", label: "Équipe", icon: UserCog },
  { href: "/operations", label: "Audit", icon: ScrollText },
  { href: "/settings", label: "Paramètres", icon: Settings }
];

const supportItems: MenuItem[] = [
  { href: "/help", label: "Aide & Import", icon: HelpCircle }
];

type Props = {
  user: { name: string; email: string; role: "ADMIN" | "STAFF" };
  unreadCount: number;
  drawerOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ user, unreadCount, drawerOpen, onClose }: Props) {
  return (
    <>
      {/* Backdrop : seulement en mode drawer mobile */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-sm transition-opacity md:hidden",
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
        aria-hidden
      />

      {/*
        Sidebar responsive :
        - mobile (< md)     : drawer w-72, translate-x dynamique
        - tablette portrait : mini permanente w-20, icônes seules
        - desktop (lg+)     : full permanente w-72
      */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-brand-700/15 bg-[#e4e0dd] backdrop-blur-xl transition-transform",
          "md:w-20 md:translate-x-0 lg:w-72",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarBody user={user} unreadCount={unreadCount} onNavigate={onClose} />

        {/* Bouton fermer : uniquement en mode drawer mobile */}
        <button
          onClick={onClose}
          aria-label="Fermer le menu"
          className="absolute right-3 top-3 rounded-full p-2 text-zinc-500 hover:bg-zinc-100 md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </aside>
    </>
  );
}

function SidebarBody({
  user,
  unreadCount,
  onNavigate
}: {
  user: { name: string; email: string; role: "ADMIN" | "STAFF" };
  unreadCount: number;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex flex-col items-start px-5 pt-5 md:items-center md:px-2 lg:items-start lg:px-5">
        {/* Brand complet : mobile drawer + desktop */}
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="inline-block md:hidden lg:inline-block"
        >
          <BrandMark variant="navbar" width={250} />
        </Link>
        {/* Logo compact (carré) : tablette portrait uniquement */}
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="hidden md:inline-block lg:hidden"
          aria-label="Maya Couture — Dashboard"
        >
          <BrandMark variant="icon" width={44} />
        </Link>
        <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-brand-700/70 md:hidden lg:block">
          Espace de gestion
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 pt-8 md:px-2 lg:px-4">
        <NavSection title="Atelier">
          {primaryItems.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isActive(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </NavSection>

        {isAdmin && (
          <NavSection title="Administration" className="mt-7">
            {adminItems.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                active={isActive(pathname, item.href)}
                onNavigate={onNavigate}
              />
            ))}
          </NavSection>
        )}

        <NavSection title="Aide" className="mt-7">
          {supportItems.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isActive(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </NavSection>
      </nav>

      {/* User card */}
      <div className="border-t border-brand-700/15 p-4 md:p-3 lg:p-4">
        <UserCard user={user} unreadCount={unreadCount} />
      </div>
    </div>
  );
}

function NavSection({
  title,
  children,
  className
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700/60 md:hidden lg:block">
        {title}
      </p>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate
}: MenuItem & { active: boolean; onNavigate: () => void }) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        title={label}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
          "md:justify-center md:px-2 md:py-3 lg:justify-start lg:px-3 lg:py-2.5",
          active
            ? "bg-brand-700 text-white shadow-soft"
            : "text-brand-900 hover:bg-white/50 hover:text-brand-700"
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5 shrink-0 transition-colors md:h-5 md:w-5 lg:h-4 lg:w-4",
            active ? "text-white" : "text-brand-700/60 group-hover:text-brand-700"
          )}
        />
        <span className="flex-1 font-medium md:hidden lg:inline">{label}</span>
        {active && <ChevronRight className="hidden h-3.5 w-3.5 text-white/80 lg:block" />}
      </Link>
    </li>
  );
}

function UserCard({
  user,
  unreadCount
}: {
  user: { name: string; email: string; role: "ADMIN" | "STAFF" };
  unreadCount: number;
}) {
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      {/* Compacte : tablette portrait — 3 boutons icône empilés */}
      <div className="hidden flex-col items-center gap-2 md:flex lg:hidden">
        <NotificationBell initialCount={unreadCount} variant="sidebar" />
        <Link
          href="/me"
          aria-label="Mes paramètres"
          title={user.name}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white transition hover:opacity-90"
        >
          {initials || "·"}
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            aria-label="Déconnexion"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-brand-700/70 hover:bg-white hover:text-brand-700"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </div>

      {/* Complète : mobile drawer + desktop */}
      <div className="flex items-center gap-3 rounded-xl bg-white/50 p-3 md:hidden lg:flex">
        <Link
          href="/me"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white transition hover:opacity-90"
          aria-label="Mes paramètres"
        >
          {initials || "·"}
        </Link>
        <Link href="/me" className="min-w-0 flex-1 group">
          <p className="truncate text-sm font-medium text-brand-900 group-hover:underline">
            {user.name}
          </p>
          <p className="truncate text-xs text-brand-700/70">
            {user.role === "ADMIN" ? "Gérante" : "Vendeuse"}
          </p>
        </Link>
        <NotificationBell initialCount={unreadCount} variant="sidebar" />
        <form action={signOutAction}>
          <button
            type="submit"
            aria-label="Déconnexion"
            className="rounded-lg p-2.5 text-brand-700/70 hover:bg-white hover:text-brand-700"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}
