"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function markAsRead(notificationId: string) {
  const session = await auth();
  if (!session?.user) return;
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.user.id, readAt: null },
    data: { readAt: new Date() }
  });
  revalidatePath("/notifications");
}

export async function markAllAsRead() {
  const session = await auth();
  if (!session?.user) return;
  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() }
  });
  revalidatePath("/notifications");
}

export async function deleteNotification(notificationId: string) {
  const session = await auth();
  if (!session?.user) return;
  await prisma.notification.deleteMany({
    where: { id: notificationId, userId: session.user.id }
  });
  revalidatePath("/notifications");
}

export async function deleteAllRead() {
  const session = await auth();
  if (!session?.user) return;
  await prisma.notification.deleteMany({
    where: { userId: session.user.id, readAt: { not: null } }
  });
  revalidatePath("/notifications");
}
