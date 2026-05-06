"use server";

import { Role, UserStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { logAudit, shallowDiff } from "@/lib/audit";
import { valuesFromForm } from "@/lib/form";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { generatePassword } from "@/lib/random-password";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Action réservée aux administrateurs");
  }
  return session;
}

const ROLES = ["ADMIN", "STAFF"] as const;

const createSchema = z.object({
  email: z.string().trim().email().max(200),
  name: z.string().trim().min(1).max(100),
  role: z.enum(ROLES)
});

const updateSchema = createSchema.extend({
  status: z.enum(["ACTIVE", "DISABLED"])
});

function pickPermissions(formData: FormData): Permission[] {
  const submitted = new Set(formData.getAll("permissions").map(String));
  return ALL_PERMISSIONS.filter((p) => submitted.has(p));
}

export type CreateUserState =
  | { kind: "idle" }
  | {
      kind: "error";
      error: string;
      values?: Record<string, string>;
      attempt?: number;
    }
  | { kind: "created"; userId: string; email: string; password: string };

function createErr(formData: FormData, error: string): CreateUserState {
  return {
    kind: "error",
    error,
    values: valuesFromForm(formData),
    attempt: Date.now()
  };
}

export async function createUser(
  _prev: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  await requireAdmin();

  const parsed = createSchema.safeParse({
    email: formData.get("email") ?? "",
    name: formData.get("name") ?? "",
    role: formData.get("role") ?? "STAFF"
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return createErr(formData, `${first.path.join(".") || "form"}: ${first.message}`);
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return createErr(formData, "Un compte existe déjà avec cet email");
  }

  const password = generatePassword(14);
  const passwordHash = await hashPassword(password);
  const permissions = parsed.data.role === "ADMIN" ? [] : pickPermissions(formData);

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      role: parsed.data.role as Role,
      passwordHash,
      permissions
    }
  });

  await logAudit({
    entityType: "User",
    entityId: user.id,
    operation: "CREATE",
    diff: { after: { email, name: user.name, role: user.role, permissions } }
  });

  revalidatePath("/users");
  return { kind: "created", userId: user.id, email, password };
}

export type UpdateUserState =
  | { kind: "idle" }
  | {
      kind: "error";
      error: string;
      values?: Record<string, string>;
      attempt?: number;
    }
  | { kind: "saved" };

function updateErr(formData: FormData, error: string): UpdateUserState {
  return {
    kind: "error",
    error,
    values: valuesFromForm(formData),
    attempt: Date.now()
  };
}

export async function updateUser(
  id: string,
  _prev: UpdateUserState,
  formData: FormData
): Promise<UpdateUserState> {
  const session = await requireAdmin();

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    // On a besoin de la cible avant Zod parse pour figer role/status quand
    // on édite son propre compte (les champs disabled ne soumettent pas
    // leur valeur, donc on retombe sur celle en BDD).
    return updateErr(formData, "Utilisateur introuvable");
  }

  // Quand on édite son propre compte, on ignore les valeurs role/status
  // soumises (elles peuvent venir d'un champ disabled = absent du formData)
  // et on garde celles déjà en BDD. Ça évite l'erreur "vous ne pouvez pas
  // modifier votre propre rôle" quand on change juste le nom.
  const isSelf = session.user.id === id;
  const submittedRole = formData.get("role");
  const submittedStatus = formData.get("status");

  const parsed = updateSchema.safeParse({
    email: formData.get("email") ?? "",
    name: formData.get("name") ?? "",
    role: isSelf || !submittedRole ? target.role : submittedRole,
    status: isSelf || !submittedStatus ? target.status : submittedStatus
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return updateErr(formData, `${first.path.join(".") || "form"}: ${first.message}`);
  }

  // Empêcher de retirer le dernier admin actif
  const willBeAdminActive =
    parsed.data.role === "ADMIN" && parsed.data.status === "ACTIVE";
  if (!willBeAdminActive && target.role === "ADMIN" && target.status === "ACTIVE") {
    const otherActiveAdmins = await prisma.user.count({
      where: { role: "ADMIN", status: "ACTIVE", id: { not: id } }
    });
    if (otherActiveAdmins === 0) {
      return updateErr(formData, "Impossible de retirer le dernier administrateur actif");
    }
  }

  const email = parsed.data.email.toLowerCase();
  if (email !== target.email) {
    const collision = await prisma.user.findUnique({ where: { email } });
    if (collision) {
      return updateErr(formData, "Un autre compte utilise déjà cet email");
    }
  }

  const permissions =
    parsed.data.role === "ADMIN" ? [] : pickPermissions(formData);

  await prisma.user.update({
    where: { id },
    data: {
      email,
      name: parsed.data.name,
      role: parsed.data.role as Role,
      status: parsed.data.status as UserStatus,
      permissions
    }
  });

  await logAudit({
    entityType: "User",
    entityId: id,
    operation: "UPDATE",
    diff: shallowDiff(
      { email: target.email, name: target.name, role: target.role, status: target.status, permissions: target.permissions },
      { email, name: parsed.data.name, role: parsed.data.role, status: parsed.data.status, permissions }
    )
  });

  revalidatePath("/users");
  revalidatePath(`/users/${id}`);
  return { kind: "saved" };
}

export type ResetPasswordState =
  | { kind: "idle" }
  | { kind: "error"; error: string }
  | { kind: "reset"; password: string };

export async function resetUserPassword(
  id: string,
  _prev: ResetPasswordState,
  _formData: FormData
): Promise<ResetPasswordState> {
  await requireAdmin();
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { kind: "error", error: "Utilisateur introuvable" };

  const password = generatePassword(14);
  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id }, data: { passwordHash } });

  await logAudit({
    entityType: "User",
    entityId: id,
    operation: "UPDATE",
    diff: { after: { passwordReset: true } }
  });

  revalidatePath(`/users/${id}`);
  return { kind: "reset", password };
}

export async function toggleUserStatus(id: string) {
  const session = await requireAdmin();
  if (session.user.id === id) {
    throw new Error("Vous ne pouvez pas désactiver votre propre compte");
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new Error("Utilisateur introuvable");

  const next: UserStatus = target.status === "ACTIVE" ? "DISABLED" : "ACTIVE";

  if (next === "DISABLED" && target.role === "ADMIN") {
    const otherActiveAdmins = await prisma.user.count({
      where: { role: "ADMIN", status: "ACTIVE", id: { not: id } }
    });
    if (otherActiveAdmins === 0) {
      throw new Error("Impossible de désactiver le dernier administrateur actif");
    }
  }

  await prisma.user.update({ where: { id }, data: { status: next } });

  await logAudit({
    entityType: "User",
    entityId: id,
    operation: "UPDATE",
    diff: { before: { status: target.status }, after: { status: next } }
  });

  revalidatePath("/users");
  revalidatePath(`/users/${id}`);
}
