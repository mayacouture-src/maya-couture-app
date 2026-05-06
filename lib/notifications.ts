import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Catégories pour les préférences (un STAFF peut désactiver une catégorie complète).
export const NOTIFICATION_CATEGORIES = [
  "rentals",
  "sales",
  "cash",
  "briefing",
  "deposits",
  "stock",
  "generic"
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  rentals: "Locations",
  sales: "Ventes",
  cash: "Caisse",
  briefing: "Briefing quotidien",
  deposits: "Cautions",
  stock: "Stock",
  generic: "Général"
};

export const CATEGORY_OF: Record<NotificationType, NotificationCategory> = {
  RENTAL_CREATED: "rentals",
  RENTAL_PAYMENT: "rentals",
  SALE_COMPLETED: "sales",
  SALE_PAYMENT: "sales",
  CASH_EXPENSE: "cash",
  CASH_REFILL: "cash",
  CASH_WITHDRAWAL: "cash",
  DAILY_BRIEFING_MORNING: "briefing",
  DAILY_BRIEFING_EVENING: "briefing",
  DEPOSIT_OVERDUE: "deposits",
  STOCK_OUT: "stock",
  GENERIC: "generic"
};

export function defaultPrefs(): Record<NotificationCategory, boolean> {
  return {
    rentals: true,
    sales: true,
    cash: true,
    briefing: true,
    deposits: true,
    stock: true,
    generic: true
  };
}

function readPrefs(raw: unknown): Record<NotificationCategory, boolean> {
  const prefs = defaultPrefs();
  if (raw && typeof raw === "object") {
    for (const cat of NOTIFICATION_CATEGORIES) {
      const v = (raw as Record<string, unknown>)[cat];
      if (typeof v === "boolean") prefs[cat] = v;
    }
  }
  return prefs;
}

type NotifyPayload = {
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  link?: string;
};

// Notifie un user spécifique (ignore ses prefs si force=true, sinon respecte).
export async function notify(
  userId: string,
  payload: NotifyPayload,
  opts: { force?: boolean } = {}
): Promise<void> {
  try {
    if (!opts.force) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, status: true, notificationPrefs: true }
      });
      if (!user || user.status !== "ACTIVE") return;
      // ADMIN reçoit tout. STAFF respecte ses prefs.
      if (user.role === "STAFF") {
        const prefs = readPrefs(user.notificationPrefs);
        const cat = CATEGORY_OF[payload.type];
        if (!prefs[cat]) return;
      }
    }
    await prisma.notification.create({
      data: {
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: (payload.data ?? undefined) as object | undefined,
        link: payload.link,
        userId
      }
    });
  } catch {
    // Best-effort : un échec de notif ne doit jamais bloquer une action métier.
  }
}

// Notifie tous les users actifs (en respectant leurs prefs).
export async function notifyEveryone(payload: NotifyPayload): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, role: true, notificationPrefs: true }
    });
    const cat = CATEGORY_OF[payload.type];
    const recipientIds = users
      .filter((u) => {
        if (u.role === "ADMIN") return true;
        const prefs = readPrefs(u.notificationPrefs);
        return prefs[cat];
      })
      .map((u) => u.id);

    if (recipientIds.length === 0) return;

    await prisma.notification.createMany({
      data: recipientIds.map((userId) => ({
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: (payload.data ?? undefined) as object | undefined,
        link: payload.link,
        userId
      }))
    });
  } catch {
    // best-effort
  }
}

// Vérifie qu'aucune notif de ce type n'a été créée pour ce user aujourd'hui (idempotence cron).
export async function alreadyNotifiedToday(
  userId: string,
  type: NotificationType
): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const found = await prisma.notification.findFirst({
    where: { userId, type, createdAt: { gte: startOfDay } },
    select: { id: true }
  });
  return found !== null;
}
