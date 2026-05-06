"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { valuesFromForm } from "@/lib/form";
import { prisma } from "@/lib/prisma";
import { deleteObject, keyFromPublicUrl } from "@/lib/storage";

const variantSchema = z.object({
  size: z.string().trim().min(1, "Taille requise").max(20),
  color: z.string().trim().min(1, "Couleur requise").max(50),
  colorHex: z
    .string()
    .trim()
    .regex(/^#?[0-9a-fA-F]{6}$/, "Hex invalide")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  quantityInitial: z.coerce.number().int().positive("Quantité ≥ 1")
});

const photoSchema = z.object({
  id: z.string().optional(),
  url: z.string().url(),
  alt: z.string().nullable().optional()
});

const productSchema = z.object({
  reference: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  designer: z.string().trim().max(200).optional().or(z.literal("").transform(() => undefined)),
  category: z.string().trim().max(100).optional().or(z.literal("").transform(() => undefined)),
  description: z.string().trim().max(2000).optional().or(z.literal("").transform(() => undefined)),
  purchasePrice: z.coerce.number().nonnegative(),
  rentalPrice: z.coerce.number().nonnegative(),
  salePrice: z.coerce.number().nonnegative(),
  deposit: z.coerce.number().nonnegative(),
  marginBetweenRentalsDays: z.coerce.number().int().nonnegative(),
  variants: z.array(variantSchema).min(1, "Ajoute au moins un variant (taille × couleur)"),
  photos: z.array(photoSchema).default([])
});

export type ProductActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  attempt?: number;
} | null;

function safeJsonParse<T = unknown>(value: FormDataEntryValue | null): T | null {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function parseFormData(formData: FormData) {
  return productSchema.safeParse({
    reference: formData.get("reference") ?? "",
    name: formData.get("name") ?? "",
    designer: formData.get("designer") ?? "",
    category: formData.get("category") ?? "",
    description: formData.get("description") ?? "",
    purchasePrice: formData.get("purchasePrice") ?? 0,
    rentalPrice: formData.get("rentalPrice") ?? 0,
    salePrice: formData.get("salePrice") ?? 0,
    deposit: formData.get("deposit") ?? 0,
    marginBetweenRentalsDays: formData.get("marginBetweenRentalsDays") ?? 0,
    variants: safeJsonParse(formData.get("variants")) ?? [],
    photos: safeJsonParse(formData.get("photos")) ?? []
  });
}

function readBooleans(formData: FormData) {
  return {
    isRentable: formData.get("isRentable") === "on",
    isSellable: formData.get("isSellable") === "on"
  };
}

function flattenErrors(error: z.ZodError): { error: string; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  const first = error.issues[0];
  return {
    error: first ? `${first.path.join(".")}: ${first.message}` : "Validation échouée",
    fieldErrors
  };
}

function normalizeColorHex(hex: string | undefined): string | null {
  if (!hex) return null;
  return hex.startsWith("#") ? hex : `#${hex}`;
}

// Garde les saisies de l'utilisateur dans le state d'erreur — sinon React 19
// reset le formulaire après chaque submit raté.
function errorWithValues(
  formData: FormData,
  payload: { error?: string; fieldErrors?: Record<string, string> }
): ProductActionState {
  return {
    ...payload,
    values: valuesFromForm(formData),
    attempt: Date.now()
  };
}

export async function createProduct(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const session = await auth();
  if (!session?.user) return errorWithValues(formData, { error: "Non autorisé" });

  const parsed = parseFormData(formData);
  if (!parsed.success) return errorWithValues(formData, flattenErrors(parsed.error));

  const bools = readBooleans(formData);

  // Le prix d'achat est admin-only — une vendeuse ne le voit pas dans le form
  // et ne peut pas le définir. Mise à 0 par défaut, l'admin la complétera.
  const purchasePrice =
    session.user.role === "ADMIN" ? parsed.data.purchasePrice : 0;

  let createdId: string;
  try {
    const created = await prisma.product.create({
      data: {
        reference: parsed.data.reference,
        name: parsed.data.name,
        designer: parsed.data.designer,
        category: parsed.data.category,
        description: parsed.data.description,
        purchasePrice,
        rentalPrice: parsed.data.rentalPrice,
        salePrice: parsed.data.salePrice,
        deposit: parsed.data.deposit,
        marginBetweenRentalsDays: parsed.data.marginBetweenRentalsDays,
        ...bools,
        variants: {
          create: parsed.data.variants.map((v) => ({
            size: v.size,
            color: v.color,
            colorHex: normalizeColorHex(v.colorHex),
            quantityInitial: v.quantityInitial,
            quantityCurrent: v.quantityInitial
          }))
        },
        photos: {
          create: parsed.data.photos.map((p, i) => ({
            url: p.url,
            alt: p.alt ?? null,
            order: i
          }))
        }
      }
    });
    createdId = created.id;
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      return errorWithValues(formData, { error: "Cette référence existe déjà." });
    }
    return errorWithValues(formData, {
      error: e instanceof Error ? e.message : "Erreur inattendue"
    });
  }

  await logAudit({
    entityType: "Product",
    entityId: createdId,
    operation: "CREATE",
    diff: { after: { reference: parsed.data.reference, name: parsed.data.name } }
  });

  revalidatePath("/products");
  redirect("/products");
}

export async function updateProduct(
  id: string,
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const session = await auth();
  if (!session?.user) return errorWithValues(formData, { error: "Non autorisé" });

  const parsed = parseFormData(formData);
  if (!parsed.success) return errorWithValues(formData, flattenErrors(parsed.error));

  const bools = readBooleans(formData);

  // Le prix d'achat est admin-only. Si STAFF, on ignore la valeur soumise
  // et on garde celle déjà en BDD (defense in depth — le form la cache déjà).
  let purchasePrice = parsed.data.purchasePrice;
  if (session.user.role !== "ADMIN") {
    const current = await prisma.product.findUnique({
      where: { id },
      select: { purchasePrice: true }
    });
    purchasePrice = current ? Number(current.purchasePrice) : 0;
  }

  // Photos : compute diff before the transaction.
  const existing = await prisma.photo.findMany({
    where: { productId: id },
    select: { id: true, url: true }
  });
  const submittedIds = new Set(
    parsed.data.photos.filter((p) => p.id).map((p) => p.id as string)
  );
  const photosToDelete = existing.filter((p) => !submittedIds.has(p.id));

  try {
    await prisma.$transaction(async (tx) => {
      // Variants : on remplace tous les variants à chaque update tant qu'aucune
      // résa/vente ne pointe dessus. Quand on aura des relations live, on fera
      // un diff fin.
      await tx.productVariant.deleteMany({ where: { productId: id } });

      // Photos : delete those removed from form
      if (photosToDelete.length > 0) {
        await tx.photo.deleteMany({
          where: { id: { in: photosToDelete.map((p) => p.id) } }
        });
      }

      await tx.product.update({
        where: { id },
        data: {
          reference: parsed.data.reference,
          name: parsed.data.name,
          designer: parsed.data.designer,
          category: parsed.data.category,
          description: parsed.data.description,
          purchasePrice,
          rentalPrice: parsed.data.rentalPrice,
          salePrice: parsed.data.salePrice,
          deposit: parsed.data.deposit,
          marginBetweenRentalsDays: parsed.data.marginBetweenRentalsDays,
          ...bools,
          variants: {
            create: parsed.data.variants.map((v) => ({
              size: v.size,
              color: v.color,
              colorHex: normalizeColorHex(v.colorHex),
              quantityInitial: v.quantityInitial,
              quantityCurrent: v.quantityInitial
            }))
          },
          // Update each retained photo's order; create new ones.
          photos: {
            updateMany: parsed.data.photos
              .filter((p) => p.id)
              .map((p, i) => ({
                where: { id: p.id! },
                data: { order: i, alt: p.alt ?? null }
              })),
            create: parsed.data.photos
              .filter((p) => !p.id)
              .map((p, i) => ({
                url: p.url,
                alt: p.alt ?? null,
                order: parsed.data.photos.findIndex((x) => x.url === p.url) + i
              }))
          }
        }
      });
    });
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      return errorWithValues(formData, { error: "Cette référence existe déjà." });
    }
    return errorWithValues(formData, {
      error: e instanceof Error ? e.message : "Erreur inattendue"
    });
  }

  // Best-effort cleanup côté MinIO (non bloquant).
  for (const p of photosToDelete) {
    const key = keyFromPublicUrl(p.url);
    if (key) await deleteObject(key);
  }

  await logAudit({
    entityType: "Product",
    entityId: id,
    operation: "UPDATE",
    diff: { after: { reference: parsed.data.reference, name: parsed.data.name } }
  });

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  redirect("/products");
}

export async function deleteProduct(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non autorisé");

  // Récupère les photos pour les nettoyer côté MinIO.
  const photos = await prisma.photo.findMany({
    where: { productId: id },
    select: { url: true }
  });

  await prisma.product.delete({ where: { id } });

  for (const p of photos) {
    const key = keyFromPublicUrl(p.url);
    if (key) await deleteObject(key);
  }

  await logAudit({ entityType: "Product", entityId: id, operation: "DELETE" });

  revalidatePath("/products");
  redirect("/products");
}
