"use client";

import { Menu } from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { NotificationBell } from "@/components/layout/notification-bell";

type Props = {
  user: { name: string; email: string };
  unreadCount: number;
  onMenuClick: () => void;
};

export function MobileTopBar({ unreadCount, onMenuClick }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-brand-700/15 bg-[#e4e0dd] backdrop-blur-md md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={onMenuClick}
          aria-label="Ouvrir le menu"
          className="-ml-2 rounded-lg p-2.5 text-brand-700 hover:bg-white/50"
        >
          <Menu className="h-5 w-5" />
        </button>

        <BrandMark variant="navbar" width={150} />

        <NotificationBell initialCount={unreadCount} variant="topbar" />
      </div>
    </header>
  );
}
