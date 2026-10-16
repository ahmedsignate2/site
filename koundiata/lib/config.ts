import { decryptSecret } from "@/lib/secrets";
import { readStore } from "@/lib/store";
import type { IntegrationSettings } from "@/lib/types";

/*
 * Configuration effective de la boutique.
 * Ordre de priorité : variable d'environnement, puis valeur saisie dans Studio → Installation.
 * Ainsi la même base de code se déploie partout (Vercel, Cloudflare, VPS, Docker) :
 * soit on renseigne les variables chez l'hébergeur, soit on colle les clés dans le studio.
 */

export type EffectiveConfig = {
  siteUrl: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  resendApiKey: string;
  emailFrom: string;
  adminNotifyEmail: string;
  s3Endpoint: string;
  s3Bucket: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3PublicUrl: string;
  s3Region: string;
  sources: Partial<Record<keyof IntegrationSettings, "env" | "studio">>;
};

const ENV: Record<keyof IntegrationSettings, string> = {
  siteUrl: "NEXT_PUBLIC_SITE_URL",
  stripeSecretKey: "STRIPE_SECRET_KEY",
  stripeWebhookSecret: "STRIPE_WEBHOOK_SECRET",
  resendApiKey: "RESEND_API_KEY",
  emailFrom: "EMAIL_FROM",
  adminNotifyEmail: "ADMIN_NOTIFY_EMAIL",
  s3Endpoint: "S3_ENDPOINT",
  s3Bucket: "S3_BUCKET",
  s3AccessKeyId: "S3_ACCESS_KEY_ID",
  s3SecretAccessKey: "S3_SECRET_ACCESS_KEY",
  s3PublicUrl: "S3_PUBLIC_URL",
  s3Region: "S3_REGION",
};

export const SECRET_FIELDS: (keyof IntegrationSettings)[] = ["stripeSecretKey", "stripeWebhookSecret", "resendApiKey", "s3SecretAccessKey"];

export function envNameFor(field: keyof IntegrationSettings) {
  return ENV[field];
}

let cached: { at: number; value: EffectiveConfig } | null = null;

export function invalidateConfig() {
  cached = null;
}

export async function getConfig(): Promise<EffectiveConfig> {
  if (cached && Date.now() - cached.at < 5_000) return cached.value;
  const stored = (await readStore()).integrations || {};
  const sources: EffectiveConfig["sources"] = {};
  const pick = (field: keyof IntegrationSettings) => {
    const fromEnv = process.env[ENV[field]]?.trim();
    if (fromEnv) {
      sources[field] = "env";
      return fromEnv;
    }
    const raw = stored[field];
    const value = SECRET_FIELDS.includes(field) ? decryptSecret(raw) : raw || "";
    if (value) sources[field] = "studio";
    return value;
  };
  const value: EffectiveConfig = {
    siteUrl: pick("siteUrl").replace(/\/$/, ""),
    stripeSecretKey: pick("stripeSecretKey"),
    stripeWebhookSecret: pick("stripeWebhookSecret"),
    resendApiKey: pick("resendApiKey"),
    emailFrom: pick("emailFrom"),
    adminNotifyEmail: pick("adminNotifyEmail"),
    s3Endpoint: pick("s3Endpoint"),
    s3Bucket: pick("s3Bucket"),
    s3AccessKeyId: pick("s3AccessKeyId"),
    s3SecretAccessKey: pick("s3SecretAccessKey"),
    s3PublicUrl: pick("s3PublicUrl").replace(/\/$/, ""),
    s3Region: pick("s3Region") || "auto",
    sources,
  };
  cached = { at: Date.now(), value };
  return value;
}

/** Les e-mails partent réellement : la vérification des adresses est alors exigée pour commander. */
export async function mailEnabled() {
  return Boolean((await getConfig()).resendApiKey);
}
