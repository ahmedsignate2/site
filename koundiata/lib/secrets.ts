import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/*
 * Chiffrement des clés saisies dans le studio (Stripe, Resend, S3…).
 * Clé dérivée de AUTH_SECRET : changer AUTH_SECRET oblige à ressaisir ces clés.
 */

function key() {
  const secret = process.env.AUTH_SECRET || "dev-only-secret-change-me-dev-only-secret";
  return createHash("sha256").update(`kd-integrations:${secret}`).digest();
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `enc:v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${data.toString("base64url")}`;
}

export function decryptSecret(value: string | undefined) {
  if (!value) return "";
  if (!value.startsWith("enc:v1:")) return value;
  try {
    const [, , iv, tag, data] = value.split(":");
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

/** Affichage d'une clé dans le studio sans la révéler : « sk_live_…4f2a ». */
export function maskSecret(value: string) {
  if (!value) return "";
  if (value.length <= 10) return "••••";
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}
