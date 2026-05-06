"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import {
  contractArticlesSchema,
  type ContractArticle
} from "@/lib/contract-template";
import { prisma } from "@/lib/prisma";

export type ContractArticlesActionState = {
  error?: string;
  ok?: boolean;
} | null;

// Sauvegarde les articles personnalisés d'un contrat. Admin uniquement —
// les vendeuses ne peuvent pas modifier les clauses légales d'une location.
export async function updateContractArticles(
  reservationId: string,
  articles: ContractArticle[]
): Promise<ContractArticlesActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Non autorisé" };
  if (session.user.role !== "ADMIN") {
    return { error: "Réservé aux administrateurs" };
  }

  const parsed = contractArticlesSchema.safeParse(articles);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Articles invalides" };
  }

  // Tableau vide = retour au défaut → SQL NULL (Prisma.DbNull).
  // Sinon on stocke le tableau JSON tel quel.
  try {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        contractArticles:
          parsed.data.length === 0 ? Prisma.DbNull : parsed.data
      }
    });
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Erreur lors de la sauvegarde"
    };
  }

  await logAudit({
    entityType: "Reservation",
    entityId: reservationId,
    operation: "UPDATE",
    diff: {
      after: {
        contractArticles: parsed.data.length === 0 ? null : parsed.data
      }
    }
  });

  revalidatePath(`/rentals/${reservationId}/contract`);
  revalidatePath(`/rentals/${reservationId}`);
  return { ok: true };
}
