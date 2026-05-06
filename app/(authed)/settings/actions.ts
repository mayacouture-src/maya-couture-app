"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { valuesFromForm } from "@/lib/form";
import { prisma } from "@/lib/prisma";

const settingsSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  companyAddress: z.string().trim().max(500).optional().or(z.literal("").transform(() => undefined)),
  companyPhone: z.string().trim().max(50).optional().or(z.literal("").transform(() => undefined)),
  companyEmail: z.string().trim().email().max(200).optional().or(z.literal("").transform(() => undefined)),
  currency: z.enum(["DZD", "EUR"]).default("DZD")
});

export type SettingsActionState = {
  error?: string;
  success?: boolean;
  values?: Record<string, string>;
  attempt?: number;
} | null;

function err(formData: FormData, error: string): SettingsActionState {
  return { error, values: valuesFromForm(formData), attempt: Date.now() };
}

export async function updateSettings(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return err(formData, "Non autorisé");
  }

  const parsed = settingsSchema.safeParse({
    companyName: formData.get("companyName") ?? "",
    companyAddress: formData.get("companyAddress") ?? "",
    companyPhone: formData.get("companyPhone") ?? "",
    companyEmail: formData.get("companyEmail") ?? "",
    currency: formData.get("currency") ?? "DZD"
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(formData, `${first.path.join(".") || "form"}: ${first.message}`);
  }

  await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data
  });

  await logAudit({
    entityType: "SiteSettings",
    entityId: "1",
    operation: "UPDATE",
    diff: { after: parsed.data }
  });

  revalidatePath("/settings");
  return { success: true };
}
