"use client";

import type { NotificationType } from "@prisma/client";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  Coins,
  PackageMinus,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Wallet
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ComponentType } from "react";
import { cn } from "@/lib/cn";
import { deleteNotification, markAsRead } from "./actions";

const SWIPE_THRESHOLD = 120;

const TYPE_ICON: Record<NotificationType, ComponentType<{ className?: string }>> = {
  RENTAL_CREATED: ShoppingBag,
  RENTAL_PAYMENT: ShoppingBag,
  SALE_COMPLETED: ShoppingCart,
  SALE_PAYMENT: ShoppingCart,
  CASH_EXPENSE: ArrowDownRight,
  CASH_REFILL: ArrowUpRight,
  CASH_WITHDRAWAL: Wallet,
  DAILY_BRIEFING_MORNING: CalendarDays,
  DAILY_BRIEFING_EVENING: CalendarClock,
  DEPOSIT_OVERDUE: Coins,
  STOCK_OUT: PackageMinus,
  GENERIC: Bell
};

const TYPE_TONE: Record<NotificationType, string> = {
  RENTAL_CREATED: "bg-brand-100 text-brand-700 ring-brand-200",
  RENTAL_PAYMENT: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  SALE_COMPLETED: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  SALE_PAYMENT: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  CASH_EXPENSE: "bg-rose-100 text-rose-700 ring-rose-200",
  CASH_REFILL: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  CASH_WITHDRAWAL: "bg-rose-100 text-rose-700 ring-rose-200",
  DAILY_BRIEFING_MORNING: "bg-amber-100 text-amber-700 ring-amber-200",
  DAILY_BRIEFING_EVENING: "bg-amber-100 text-amber-700 ring-amber-200",
  DEPOSIT_OVERDUE: "bg-amber-100 text-amber-800 ring-amber-200",
  STOCK_OUT: "bg-rose-100 text-rose-700 ring-rose-200",
  GENERIC: "bg-zinc-100 text-zinc-700 ring-zinc-200"
};

export type NotificationItemData = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAtISO: string;
  timestampLabel: string;
};

export function NotificationItem({
  notification
}: {
  notification: NotificationItemData;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dragX, setDragX] = useState(0);
  const [removing, setRemoving] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);

  const unread = !notification.readAt;
  const Icon = TYPE_ICON[notification.type] ?? Bell;
  const toneClass = TYPE_TONE[notification.type] ?? "bg-zinc-100 text-zinc-700 ring-zinc-200";

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    dragging.current = false;
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!dragging.current) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        dragging.current = true;
      } else if (Math.abs(dy) > 8) {
        return;
      }
    }
    if (dragging.current) {
      setDragX(Math.min(0, dx));
    }
  }

  function onTouchEnd() {
    if (dragging.current && Math.abs(dragX) > SWIPE_THRESHOLD) {
      setRemoving(true);
      setTimeout(() => {
        startTransition(async () => {
          await deleteNotification(notification.id);
        });
      }, 180);
    } else {
      setDragX(0);
    }
    dragging.current = false;
  }

  function onClick() {
    if (Math.abs(dragX) > 5) return;
    if (unread) {
      startTransition(async () => {
        await markAsRead(notification.id);
      });
    }
    if (notification.link) {
      router.push(notification.link);
    }
  }

  function onMarkRead(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      await markAsRead(notification.id);
    });
  }

  function onDeleteClick(e: React.MouseEvent) {
    e.stopPropagation();
    setRemoving(true);
    setTimeout(() => {
      startTransition(async () => {
        await deleteNotification(notification.id);
      });
    }, 180);
  }

  const translate = removing
    ? -(typeof window !== "undefined" ? window.innerWidth : 600)
    : dragX;
  const swipeProgress = Math.min(1, Math.abs(dragX) / SWIPE_THRESHOLD);

  return (
    <li
      className="relative overflow-hidden"
      style={{
        maxHeight: removing ? 0 : 320,
        transition: removing ? "max-height 220ms 180ms ease-out" : "none"
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-end bg-rose-600 px-6 text-white"
        style={{ opacity: removing ? 1 : swipeProgress }}
      >
        <Trash2 className="h-5 w-5" />
        <span className="ml-2 text-sm font-semibold">Supprimer</span>
      </div>

      <div
        role={notification.link ? "button" : undefined}
        tabIndex={notification.link ? 0 : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn(
          "relative flex items-start gap-4 bg-white px-5 py-5 sm:px-6",
          unread && "border-l-4 border-brand-600 bg-brand-50/40",
          notification.link && "cursor-pointer hover:bg-zinc-50/60"
        )}
        style={{
          transform: `translateX(${translate}px)`,
          transition: dragging.current
            ? "none"
            : removing
              ? "transform 200ms ease-out"
              : "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          touchAction: "pan-y"
        }}
      >
        <span
          className={cn(
            "mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-inset",
            toneClass
          )}
        >
          <Icon className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "leading-snug",
              unread
                ? "text-base font-semibold text-zinc-900 sm:text-[17px]"
                : "text-base font-medium text-zinc-800"
            )}
          >
            {notification.title}
          </p>
          {notification.body && (
            <p className="mt-1 text-sm leading-relaxed text-zinc-600">
              {notification.body}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            <time
              dateTime={notification.createdAtISO}
              title={new Date(notification.createdAtISO).toLocaleString("fr-FR")}
            >
              {notification.timestampLabel}
            </time>
            {notification.link && (
              <span className="inline-flex items-center gap-1 font-medium text-brand-700">
                Voir le détail
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          {unread && (
            <button
              type="button"
              onClick={onMarkRead}
              aria-label="Marquer comme lue"
              className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <CheckCheck className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onDeleteClick}
            aria-label="Supprimer"
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
