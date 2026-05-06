// Cron jobs des notifications + récap email.
// À appeler en GET depuis un cron OS sur l'hôte :
//   curl "https://maya/api/cron/run?task=morning&secret=$CRON_SECRET"
//   curl "https://maya/api/cron/run?task=evening&secret=$CRON_SECRET"
//   curl "https://maya/api/cron/run?task=deposits&secret=$CRON_SECRET"
//   curl "https://maya/api/cron/run?task=email-recap&secret=$CRON_SECRET"
//   curl "https://maya/api/cron/run?task=all&secret=$CRON_SECRET"
//
// Idempotent : alreadyNotifiedToday() empêche les doublons en cas d'appels
// multiples dans la même journée. (Le récap email lui n'est pas dédupliqué
// — un cron supposé tourner 1 fois par jour.)

import { NextResponse, type NextRequest } from "next/server";
import { buildDailyRecap, renderRecapEmail } from "@/lib/daily-recap";
import { sendEmail } from "@/lib/email";
import {
  alreadyNotifiedToday,
  notify
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Task = "morning" | "evening" | "deposits" | "email-recap" | "all";

function isTask(s: string | null): s is Task {
  return (
    s === "morning" ||
    s === "evening" ||
    s === "deposits" ||
    s === "email-recap" ||
    s === "all"
  );
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") ?? req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const taskParam = url.searchParams.get("task");
  const task: Task = isTask(taskParam) ? taskParam : "all";

  const summary: Record<string, number | string> = {};

  if (task === "morning" || task === "all") {
    summary.morningBriefingsSent = await runMorningBriefing();
  }
  if (task === "evening" || task === "all") {
    summary.eveningBriefingsSent = await runEveningBriefing();
  }
  if (task === "deposits" || task === "all") {
    summary.depositsAlertsSent = await runDepositsOverdue();
  }
  if (task === "email-recap" || task === "all") {
    const result = await runEmailRecap();
    summary.emailsSent = result.sent;
    if (result.error) summary.emailError = result.error;
  }

  return NextResponse.json({ ok: true, summary });
}

async function recipients() {
  return prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true }
  });
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function countMovementsForDay(date: Date) {
  const dayStart = startOfDay(date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayStart.getDate() + 1);

  const [departuresP1, returnsP1, departuresP2, returnsP2] = await Promise.all([
    prisma.reservation.count({
      where: {
        status: { in: ["CONFIRMED", "DRAFT"] },
        startDate1: { gte: dayStart, lt: dayEnd }
      }
    }),
    prisma.reservation.count({
      where: {
        status: { in: ["IN_PROGRESS", "CONFIRMED"] },
        endDate1: { gte: dayStart, lt: dayEnd }
      }
    }),
    prisma.reservation.count({
      where: {
        startDate2: { gte: dayStart, lt: dayEnd }
      }
    }),
    prisma.reservation.count({
      where: {
        endDate2: { gte: dayStart, lt: dayEnd }
      }
    })
  ]);

  return {
    departures: departuresP1 + departuresP2,
    returns: returnsP1 + returnsP2
  };
}

async function runMorningBriefing(): Promise<number> {
  const today = new Date();
  const counts = await countMovementsForDay(today);
  if (counts.departures === 0 && counts.returns === 0) return 0;

  const dateStr = today.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

  const users = await recipients();
  let sent = 0;
  for (const u of users) {
    if (await alreadyNotifiedToday(u.id, "DAILY_BRIEFING_MORNING")) continue;
    await notify(u.id, {
      type: "DAILY_BRIEFING_MORNING",
      title: `Briefing du matin · ${dateStr}`,
      body: `${counts.departures} sortie${counts.departures > 1 ? "s" : ""} · ${counts.returns} retour${counts.returns > 1 ? "s" : ""}`,
      link: "/dashboard"
    });
    sent++;
  }
  return sent;
}

async function runEveningBriefing(): Promise<number> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const counts = await countMovementsForDay(tomorrow);
  if (counts.departures === 0 && counts.returns === 0) return 0;

  const dateStr = tomorrow.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

  const users = await recipients();
  let sent = 0;
  for (const u of users) {
    if (await alreadyNotifiedToday(u.id, "DAILY_BRIEFING_EVENING")) continue;
    await notify(u.id, {
      type: "DAILY_BRIEFING_EVENING",
      title: `Demain · ${dateStr}`,
      body: `${counts.departures} sortie${counts.departures > 1 ? "s" : ""} prévue${counts.departures > 1 ? "s" : ""} · ${counts.returns} retour${counts.returns > 1 ? "s" : ""}`,
      link: "/dashboard"
    });
    sent++;
  }
  return sent;
}

type EmailRecapResult = { sent: number; error?: string };

async function runEmailRecap(): Promise<EmailRecapResult> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return { sent: 0, error: "GMAIL_USER ou GMAIL_APP_PASSWORD manquant" };
  }

  // Cible : ADMIN reçoit toujours, STAFF si pref `briefing` cochée.
  type RecipientUser = {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "STAFF";
    notificationPrefs: unknown;
  };
  const users: RecipientUser[] = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, email: true, name: true, role: true, notificationPrefs: true }
  });

  const recipients = users.filter((u: RecipientUser) => {
    if (u.role === "ADMIN") return true;
    const prefs = u.notificationPrefs as Record<string, unknown> | null;
    if (!prefs || typeof prefs !== "object") return true; // défaut = recevoir
    const v = (prefs as Record<string, unknown>).briefing;
    return typeof v === "boolean" ? v : true;
  });

  if (recipients.length === 0) return { sent: 0 };

  let recap;
  try {
    recap = await buildDailyRecap();
  } catch (e) {
    return { sent: 0, error: e instanceof Error ? e.message : "buildDailyRecap failed" };
  }

  const subject = `Récap du ${recap.dateLabel} · Maya Couture`;
  let sent = 0;
  let lastError: string | undefined;
  for (const u of recipients) {
    try {
      const html = renderRecapEmail(recap, u.name);
      await sendEmail({ to: u.email, subject, html });
      sent++;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return lastError ? { sent, error: lastError } : { sent };
}

async function runDepositsOverdue(): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Locations RETURNED (ou COMPLETED) avec une caution prise dont une partie reste due
  const candidates = await prisma.reservation.findMany({
    where: {
      status: { in: ["RETURNED"] },
      updatedAt: { lt: sevenDaysAgo }
    },
    include: {
      customer: { select: { firstName: true, lastName: true } },
      cashTx: {
        select: { kind: true, amount: true }
      }
    },
    take: 100
  });

  const overdue: typeof candidates = [];
  for (const r of candidates) {
    const held = r.cashTx
      .filter((t) => t.kind === "DEPOSIT_HELD")
      .reduce((acc, t) => acc + Number(t.amount), 0);
    const back = r.cashTx
      .filter((t) => t.kind === "DEPOSIT_BACK")
      .reduce((acc, t) => acc + Number(t.amount), 0);
    if (held > 0 && held - back > 0.01) overdue.push(r);
  }

  if (overdue.length === 0) return 0;

  const users = await recipients();
  let sent = 0;
  for (const u of users) {
    if (await alreadyNotifiedToday(u.id, "DEPOSIT_OVERDUE")) continue;
    await notify(u.id, {
      type: "DEPOSIT_OVERDUE",
      title: `${overdue.length} caution${overdue.length > 1 ? "s" : ""} non rendue${overdue.length > 1 ? "s" : ""}`,
      body: overdue
        .slice(0, 3)
        .map((r) => `${r.reference} · ${r.customer.firstName} ${r.customer.lastName}`)
        .join(" · "),
      link: "/rentals?status=RETURNED"
    });
    sent++;
  }
  return sent;
}
