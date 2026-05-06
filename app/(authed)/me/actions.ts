"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory
} from "@/lib/notifications";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
    newPassword: z.string().min(8, "Nouveau mot de passe : 8 caractères minimum").max(200),
    confirmPassword: z.string()
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Les deux mots de passe ne correspondent pas",
    path: ["confirmPassword"]
  });

export type ChangePasswordState =
  | { kind: "idle" }
  | { kind: "error"; error: string }
  | { kind: "saved" };

export async function changeOwnPassword(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user) return { kind: "error", error: "Non autorisé" };

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? "",
    newPassword: formData.get("newPassword") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? ""
  });
  if (!parsed.success) {
    return { kind: "error", error: parsed.error.issues[0].message };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true }
  });
  if (!user) return { kind: "error", error: "Compte introuvable" };

  const ok = await verifyPassword(user.passwordHash, parsed.data.currentPassword);
  if (!ok) return { kind: "error", error: "Mot de passe actuel incorrect" };

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: newHash }
  });

  await logAudit({
    entityType: "User",
    entityId: session.user.id,
    operation: "UPDATE",
    diff: { after: { passwordChanged: true } }
  });

  revalidatePath("/me");
  return { kind: "saved" };
}

export type PrefsState =
  | { kind: "idle" }
  | { kind: "saved" }
  | { kind: "error"; error: string };

export async function updateNotificationPrefs(
  _prev: PrefsState,
  formData: FormData
): Promise<PrefsState> {
  const session = await auth();
  if (!session?.user) return { kind: "error", error: "Non autorisé" };

  const submitted = new Set(formData.getAll("category").map(String));
  const prefs: Record<NotificationCategory, boolean> = {
    rentals: false,
    sales: false,
    cash: false,
    briefing: false,
    deposits: false,
    stock: false,
    generic: false
  };
  for (const cat of NOTIFICATION_CATEGORIES) {
    prefs[cat] = submitted.has(cat);
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { notificationPrefs: prefs }
  });

  revalidatePath("/me");
  return { kind: "saved" };
}
