import type { AuditOperation } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type AuditEntityType =
  | "Customer"
  | "Product"
  | "ProductVariant"
  | "Reservation"
  | "Sale"
  | "CashTransaction"
  | "User"
  | "SiteSettings"
  | "Inspection"
  | "DocumentTemplate";

type LogParams = {
  entityType: AuditEntityType;
  entityId: string;
  operation: AuditOperation;
  diff?: unknown;
};

export async function logAudit(params: LogParams): Promise<void> {
  try {
    const session = await auth();
    if (!session?.user) return;
    await prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        operation: params.operation,
        userId: session.user.id,
        diff: params.diff !== undefined ? (params.diff as object) : undefined
      }
    });
  } catch {
    // Best-effort : un audit log ne doit jamais bloquer une action métier.
  }
}

// Calcule un diff minimal entre deux objets (avant/après) pour stockage en JSON.
// Ne descend pas dans les sous-objets — pour les besoins courants c'est suffisant.
export function shallowDiff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>
): { before: Partial<T>; after: Partial<T> } {
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  for (const key of Object.keys(after) as (keyof T)[]) {
    if (before[key] !== after[key]) {
      b[key] = before[key];
      a[key] = after[key];
    }
  }
  return { before: b, after: a };
}
