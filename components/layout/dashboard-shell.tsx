"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { MobileTopBar } from "./mobile-top-bar";

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "STAFF";
};

export function DashboardShell({
  user,
  unreadCount,
  children
}: {
  user: SessionUser;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="relative min-h-screen">
      {/* Décor doux derrière tout */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-brand-radial" />

      {/* Sidebar : permanente sur desktop, drawer sur mobile */}
      <Sidebar
        user={user}
        unreadCount={unreadCount}
        drawerOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Zone principale décalée à droite de la sidebar
          (mini sur tablette portrait, full sur desktop) */}
      <div className="md:pl-20 lg:pl-72">
        <MobileTopBar
          user={user}
          unreadCount={unreadCount}
          onMenuClick={() => setDrawerOpen(true)}
        />
        <main className="px-4 py-6 sm:px-8 sm:py-10 lg:px-12">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
