"use server";

import { CashKind, CashMethod, SaleStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { valuesFromForm } from "@/lib/form";
import { notifyEveryone } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const itemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative()
});

const saleSchema = z.object({
  customerId: z.string().optional().or(z.literal("").transform(() => undefined)),
  saleDate: z.string().min(1),
  items: z.array(itemSchema).min(1, "Ajoute au moins un article")
});

export type SaleActionState = {
  error?: string;
  values?: Record<string, string>;
  attempt?: number;
} | null;

function err(formData: FormData, error: string): SaleActionState {
  return { error, values: valuesFromForm(formData), attempt: Date.now() };
}

function safeJsonParse<T>(v: FormDataEntryValue | null): T | null {
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

async function nextReference(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `VTE-${year}-`;
  const count = await prisma.sale.count({ where: { reference: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function createSale(
  _prev: SaleActionState,
  formData: FormData
): Promise<SaleActionState> {
  const session = await auth();
  if (!session?.user) return err(formData, "Non autorisé");

  const items = safeJsonParse<unknown[]>(formData.get("items")) ?? [];
  const parsed = saleSchema.safeParse({
    customerId: formData.get("customerId") ?? "",
    saleDate: formData.get("saleDate") ?? "",
    items
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(formData, `${first.path.join(".") || "form"}: ${first.message}`);
  }

  const totalAmount = parsed.data.items.reduce(
    (acc, it) => acc + it.unitPrice * it.quantity,
    0
  );
  const reference = await nextReference();

  let createdId: string;
  try {
    const created = await prisma.sale.create({
      data: {
        reference,
        customerId: parsed.data.customerId || null,
        saleDate: new Date(parsed.data.saleDate),
        totalAmount,
        status: SaleStatus.DRAFT,
        createdById: session.user.id,
        items: {
          create: parsed.data.items.map((it) => ({
            variantId: it.variantId,
            quantity: it.quantity,
            unitPrice: it.unitPrice
          }))
        }
      },
      select: { id: true }
    });
    createdId = created.id;
  } catch (e: unknown) {
    return err(formData, e instanceof Error ? e.message : "Erreur inattendue");
  }

  await logAudit({
    entityType: "Sale",
    entityId: createdId,
    operation: "CREATE",
    diff: { after: { reference, customerId: parsed.data.customerId, totalAmount } }
  });

  revalidatePath("/sales");
  redirect(`/sales/${createdId}`);
}

export async function completeSale(
  saleId: string,
  payment?: { kind: CashKind; amount: number }
) {
  const session = await auth();
  if (!session?.user) throw new Error("Non autorisé");

  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: { items: true }
    });
    if (!sale) throw new Error("Vente introuvable");
    if (sale.status !== "DRAFT") throw new Error("La vente n'est pas en brouillon");

    // Vérifie le stock + décrémente
    for (const it of sale.items) {
      if (!it.variantId) continue;
      const variant = await tx.productVariant.findUnique({
        where: { id: it.variantId },
        select: { quantityCurrent: true }
      });
      if (!variant) throw new Error("Variante manquante");
      if (variant.quantityCurrent < it.quantity) {
        throw new Error(
          `Stock insuffisant : ${variant.quantityCurrent} disponible(s)`
        );
      }
      await tx.productVariant.update({
        where: { id: it.variantId },
        data: { quantityCurrent: { decrement: it.quantity } }
      });
    }

    await tx.sale.update({
      where: { id: saleId },
      data: { status: SaleStatus.COMPLETED }
    });

    if (payment && payment.amount > 0) {
      await tx.cashTransaction.create({
        data: {
          saleId,
          kind: payment.kind,
          method: CashMethod.CASH,
          amount: payment.amount,
          recordedById: session.user.id
        }
      });
    }
  });

  await logAudit({
    entityType: "Sale",
    entityId: saleId,
    operation: "UPDATE",
    diff: { after: { status: "COMPLETED", payment: payment ?? null } }
  });

  // Notif vente validée + détection stock épuisé
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      customer: { select: { firstName: true, lastName: true } },
      items: {
        include: {
          variant: {
            include: { product: { select: { name: true, reference: true } } }
          }
        }
      }
    }
  });
  if (sale) {
    await notifyEveryone({
      type: "SALE_COMPLETED",
      title: `Vente validée — ${sale.reference}`,
      body: sale.customer
        ? `${sale.customer.firstName} ${sale.customer.lastName} · ${Number(sale.totalAmount)}`
        : `Anonyme · ${Number(sale.totalAmount)}`,
      link: `/sales/${saleId}`,
      data: { saleId }
    });

    for (const it of sale.items) {
      if (it.variant && it.variant.quantityCurrent === 0) {
        const v = it.variant;
        await notifyEveryone({
          type: "STOCK_OUT",
          title: `Stock épuisé : ${v.product.name}`,
          body: `${v.size} · ${v.color} (${v.product.reference}) — plus aucune unité disponible.`,
          link: `/products/${v.productId}`,
          data: { variantId: v.id }
        });
      }
    }
  }

  revalidatePath("/sales");
  revalidatePath(`/sales/${saleId}`);
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

export async function cancelSale(saleId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non autorisé");

  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: { items: true }
    });
    if (!sale) throw new Error("Vente introuvable");
    if (sale.status === "CANCELLED") return;

    // Si la vente était validée, on rend le stock
    if (sale.status === "COMPLETED") {
      for (const it of sale.items) {
        if (!it.variantId) continue;
        await tx.productVariant.update({
          where: { id: it.variantId },
          data: { quantityCurrent: { increment: it.quantity } }
        });
      }
    }

    await tx.sale.update({
      where: { id: saleId },
      data: { status: SaleStatus.CANCELLED }
    });
  });

  await logAudit({
    entityType: "Sale",
    entityId: saleId,
    operation: "UPDATE",
    diff: { after: { status: "CANCELLED" } }
  });

  revalidatePath("/sales");
  revalidatePath(`/sales/${saleId}`);
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

const paymentSchema = z.object({
  kind: z.nativeEnum(CashKind),
  amount: z.coerce.number().positive(),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined))
});

export async function recordSalePayment(
  saleId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth();
  if (!session?.user) return { error: "Non autorisé" };

  const parsed = paymentSchema.safeParse({
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    description: formData.get("description") ?? ""
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: `${first.path.join(".") || "form"}: ${first.message}` };
  }

  const created = await prisma.cashTransaction.create({
    data: {
      saleId,
      kind: parsed.data.kind,
      method: CashMethod.CASH,
      amount: parsed.data.amount,
      description: parsed.data.description,
      recordedById: session.user.id
    }
  });

  await logAudit({
    entityType: "CashTransaction",
    entityId: created.id,
    operation: "CREATE",
    diff: { after: { kind: parsed.data.kind, amount: parsed.data.amount, saleId } }
  });

  if (parsed.data.kind === "CLIENT_PAYMENT") {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: { reference: true, customer: { select: { firstName: true, lastName: true } } }
    });
    await notifyEveryone({
      type: "SALE_PAYMENT",
      title: `Paiement reçu — ${sale?.reference ?? "vente"}`,
      body: sale?.customer
        ? `${parsed.data.amount} de ${sale.customer.firstName} ${sale.customer.lastName}`
        : `${parsed.data.amount}`,
      link: `/sales/${saleId}`
    });
  }

  revalidatePath(`/sales/${saleId}`);
  revalidatePath("/sales");
  revalidatePath("/dashboard");
  return null;
}
