import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { AwsClient } from "aws4fetch";
import { getConfig } from "@/lib/config";

/**
 * Enregistre un fichier envoyé depuis le studio.
 * S3 / Cloudflare R2 / tout stockage compatible S3 si configuré, sinon le disque local (serveur unique).
 */
export async function storeUpload(name: string, bytes: Uint8Array, contentType: string) {
  const config = await getConfig();
  if (config.s3Bucket && config.s3AccessKeyId && config.s3SecretAccessKey && config.s3Endpoint) {
    const client = new AwsClient({
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
      region: config.s3Region || "auto",
      service: "s3",
    });
    const key = `uploads/${name}`;
    const url = `${config.s3Endpoint.replace(/\/$/, "")}/${config.s3Bucket}/${key}`;
    const response = await client.fetch(url, {
      method: "PUT",
      body: bytes as unknown as BodyInit,
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
    });
    if (!response.ok) throw new Error(`Stockage refusé (${response.status}). Vérifiez les clés S3/R2 dans Installation.`);
    const base = config.s3PublicUrl || `${config.s3Endpoint.replace(/\/$/, "")}/${config.s3Bucket}`;
    return `${base}/${key}`;
  }
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  return `/uploads/${name}`;
}
