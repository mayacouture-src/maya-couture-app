import { Client } from "minio";

let _client: Client | null = null;

function getClient(): Client {
  if (_client) return _client;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  if (!endpoint || !accessKey || !secretKey) {
    throw new Error("Configuration S3 manquante (S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY)");
  }
  const url = new URL(endpoint);
  _client = new Client({
    endPoint: url.hostname,
    port: Number(url.port) || (url.protocol === "https:" ? 443 : 80),
    useSSL: url.protocol === "https:",
    accessKey,
    secretKey
  });
  return _client;
}

export const BUCKET = process.env.S3_BUCKET ?? "maya-photos";

export function publicUrl(key: string): string {
  const base = process.env.S3_PUBLIC_URL ?? "";
  return `${base.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const client = getClient();
  await client.putObject(BUCKET, key, body, body.length, {
    "Content-Type": contentType
  });
}

export async function deleteObject(key: string): Promise<void> {
  try {
    const client = getClient();
    await client.removeObject(BUCKET, key);
  } catch {
    // Ignore — un fichier déjà absent ne doit pas faire planter une suppression.
  }
}

// Extrait la "key" (chemin objet dans le bucket) à partir d'une URL publique.
// Permet la suppression côté MinIO quand on retire une photo de la DB.
export function keyFromPublicUrl(url: string): string | null {
  const base = (process.env.S3_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (base && url.startsWith(base)) {
    return url.slice(base.length).replace(/^\//, "");
  }
  return null;
}
