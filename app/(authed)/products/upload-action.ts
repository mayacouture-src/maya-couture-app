"use server";

import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { publicUrl, uploadObject } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export type UploadResult = { url: string } | { error: string };

export async function uploadProductPhoto(formData: FormData): Promise<UploadResult> {
  const session = await auth();
  if (!session?.user) return { error: "Non autorisé" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Fichier manquant" };
  if (file.size === 0) return { error: "Fichier vide" };
  if (file.size > MAX_BYTES) return { error: "Fichier trop volumineux (max 5 Mo)" };
  if (!ACCEPTED.has(file.type)) return { error: "Format accepté : JPG, PNG, WEBP ou AVIF" };

  const ext =
    file.type === "image/jpeg" ? "jpg" :
    file.type === "image/png"  ? "png" :
    file.type === "image/webp" ? "webp" :
    file.type === "image/avif" ? "avif" : "bin";

  const key = `products/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await uploadObject(key, buffer, file.type);
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Erreur de stockage" };
  }

  return { url: publicUrl(key) };
}
