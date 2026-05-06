"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { valuesFromForm } from "@/lib/form";
import { prisma } from "@/lib/prisma";

const optionalString = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalNumber = z
  .union([z.literal(""), z.coerce.number().nonnegative().max(300)])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : Number(v)));

const measurementsSchema = z
  .object({
    bust: optionalNumber,
    waist: optionalNumber,
    hips: optionalNumber,
    height: optionalNumber
  })
  .transform((m) => {
    const cleaned = Object.fromEntries(
      Object.entries(m).filter(([, v]) => v !== undefined)
    );
    return Object.keys(cleaned).length === 0 ? null : cleaned;
  });

const customerSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1).max(40),
  email: z.string().trim().email().max(200).optional().or(z.literal("").transform(() => undefined)),
  address: optionalString,
  city: optionalString,
  postalCode: z.string().trim().max(20).optional().or(z.literal("").transform(() => undefined)),
  idDocumentRef: optionalString,
  notes: z.string().trim().max(2000).optional().or(z.literal("").transform(() => undefined))
});

export type CustomerActionState = {
  error?: string;
  values?: Record<string, string>;
  attempt?: number;
} | null;

function err(
  formData: FormData,
  payload: { error: string }
): CustomerActionState {
  return { ...payload, values: valuesFromForm(formData), attempt: Date.now() };
}

function buildPayload(formData: FormData) {
  const parsed = customerSchema.safeParse({
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
    city: formData.get("city") ?? "",
    postalCode: formData.get("postalCode") ?? "",
    idDocumentRef: formData.get("idDocumentRef") ?? "",
    notes: formData.get("notes") ?? ""
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false as const, error: `${first.path.join(".") || "form"}: ${first.message}` };
  }

  const measurements = measurementsSchema.parse({
    bust: formData.get("bust") ?? "",
    waist: formData.get("waist") ?? "",
    hips: formData.get("hips") ?? "",
    height: formData.get("height") ?? ""
  });

  // Prisma exige Prisma.DbNull plutôt que `null` pour les champs Json nullable.
  return {
    ok: true as const,
    data: {
      ...parsed.data,
      measurements: measurements === null ? Prisma.DbNull : measurements
    }
  };
}

export async function createCustomer(
  _prev: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const session = await auth();
  if (!session?.user) return err(formData, { error: "Non autorisé" });

  const result = buildPayload(formData);
  if (!result.ok) return err(formData, { error: result.error });

  let createdId: string;
  try {
    const created = await prisma.customer.create({ data: result.data });
    createdId = created.id;
  } catch (e: unknown) {
    return err(formData, {
      error: e instanceof Error ? e.message : "Erreur inattendue"
    });
  }
  await logAudit({
    entityType: "Customer",
    entityId: createdId,
    operation: "CREATE",
    diff: { after: result.data }
  });
  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomer(
  id: string,
  _prev: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const session = await auth();
  if (!session?.user) return err(formData, { error: "Non autorisé" });

  const result = buildPayload(formData);
  if (!result.ok) return err(formData, { error: result.error });

  try {
    await prisma.customer.update({ where: { id }, data: result.data });
  } catch (e: unknown) {
    return err(formData, {
      error: e instanceof Error ? e.message : "Erreur inattendue"
    });
  }
  await logAudit({
    entityType: "Customer",
    entityId: id,
    operation: "UPDATE",
    diff: { after: result.data }
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect("/customers");
}

export async function deleteCustomer(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non autorisé");

  await prisma.customer.delete({ where: { id } });
  await logAudit({ entityType: "Customer", entityId: id, operation: "DELETE" });
  revalidatePath("/customers");
  redirect("/customers");
}
