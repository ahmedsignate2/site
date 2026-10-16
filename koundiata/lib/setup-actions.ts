"use server";

import Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { runAfterResponse } from "@/lib/automation";
import { envNameFor, getConfig, invalidateConfig, SECRET_FIELDS } from "@/lib/config";
import { isEmail } from "@/lib/format";
import { sendEmail } from "@/lib/mailer";
import { encryptSecret, maskSecret } from "@/lib/secrets";
import { readStore, storageBackend, updateStore } from "@/lib/store";
import { siteOrigin } from "@/lib/origin";
import type { IntegrationSettings } from "@/lib/types";

const FIELDS: (keyof IntegrationSettings)[] = [
  "siteUrl",
  "stripeSecretKey",
  "stripeWebhookSecret",
  "resendApiKey",
  "emailFrom",
  "adminNotifyEmail",
  "s3Endpoint",
  "s3Bucket",
  "s3AccessKeyId",
  "s3SecretAccessKey",
  "s3PublicUrl",
  "s3Region",
];

export type SetupField = { field: keyof IntegrationSettings; env: string; secret: boolean; source: "env" | "studio" | null; display: string };
export type SetupCheck = { id: string; label: string; ok: boolean; warn?: boolean; detail: string };

export async function getSetupStatus() {
  await requirePermission("team");
  invalidateConfig();
  const config = await getConfig();
  const data = await readStore();
  const origin = await siteOrigin();
  const fields: SetupField[] = FIELDS.map((field) => {
    const value = String(config[field as keyof typeof config] ?? "");
    const secret = SECRET_FIELDS.includes(field);
    return { field, env: envNameFor(field), secret, source: config.sources[field] ?? null, display: secret ? maskSecret(value) : value };
  });
  const settings = data.published.settings;
  const serverless = Boolean(process.env.VERCEL || process.env.CF_PAGES || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const checks: SetupCheck[] = [
    {
      id: "auth",
      label: "Clé de sécurité des sessions (AUTH_SECRET)",
      ok: Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32),
      detail: "Variable d'environnement de 32 caractères minimum, à définir chez l'hébergeur.",
    },
    {
      id: "db",
      label: "Base de données",
      ok: storageBackend() === "postgres",
      warn: storageBackend() === "file" && !serverless,
      detail:
        storageBackend() === "postgres"
          ? "Postgres connecté (DATABASE_URL)."
          : serverless
            ? "Fichier local : les données seront perdues sur cet hébergeur. Définissez DATABASE_URL (Neon, Supabase…)."
            : "Fichier local data/store.json : convient à un serveur unique. Pour Vercel / Cloudflare, définissez DATABASE_URL.",
    },
    {
      id: "site",
      label: "Adresse du site",
      ok: Boolean(config.siteUrl),
      warn: !config.siteUrl,
      detail: config.siteUrl ? config.siteUrl : `Non renseignée : déduite de la requête (${origin}). Renseignez-la pour les liens des e-mails.`,
    },
    {
      id: "stripe",
      label: "Paiement Stripe",
      ok: Boolean(config.stripeSecretKey),
      detail: config.stripeSecretKey
        ? config.stripeSecretKey.startsWith("sk_live")
          ? "Clé live : paiements réels."
          : "Clé de test : aucun vrai débit."
        : "Non configuré : les commandes sont simulées.",
    },
    {
      id: "webhook",
      label: "Webhook Stripe",
      ok: Boolean(config.stripeWebhookSecret),
      detail: `Dans Stripe → Développeurs → Webhooks, ajoutez ${origin}/api/stripe/webhook avec les événements checkout.session.completed, checkout.session.async_payment_succeeded et checkout.session.expired, puis collez le secret whsec_…`,
    },
    {
      id: "email",
      label: "E-mails automatiques (Resend)",
      ok: Boolean(config.resendApiKey && config.emailFrom),
      warn: Boolean(config.resendApiKey && !config.emailFrom),
      detail: !config.resendApiKey
        ? "Créez un compte gratuit sur resend.com, puis collez la clé API (re_…). Sans clé, aucun e-mail ne part et la vérification des adresses est désactivée."
        : config.emailFrom
          ? `Envoi depuis ${config.emailFrom}. Le domaine doit être vérifié sur resend.com/domains, sinon seuls les e-mails vers votre propre adresse Resend partent.`
          : "Clé présente mais pas d'expéditeur : l'adresse de test onboarding@resend.dev est utilisée et n'écrit qu'au titulaire du compte Resend. Vérifiez votre domaine puis renseignez l'expéditeur.",
    },
    {
      id: "uploads",
      label: "Stockage des images",
      ok: Boolean(config.s3Bucket && config.s3AccessKeyId && config.s3SecretAccessKey),
      warn: !config.s3Bucket && !serverless,
      detail: config.s3Bucket
        ? `Bucket ${config.s3Bucket} (S3 / Cloudflare R2).`
        : serverless
          ? "Les images envoyées seraient perdues sur cet hébergeur : configurez Cloudflare R2 ou S3."
          : "Disque local (public/uploads) : convient à un serveur unique.",
    },
    {
      id: "legal",
      label: "Mentions légales",
      ok: Boolean(settings.legalName && settings.siret && settings.address),
      detail: "Raison sociale, SIRET et adresse dans Paramètres généraux (obligatoires pour vendre en France).",
    },
    {
      id: "notify",
      label: "Alerte nouvelle commande",
      ok: Boolean(config.adminNotifyEmail),
      warn: !config.adminNotifyEmail,
      detail: config.adminNotifyEmail ? `Envoyée à ${config.adminNotifyEmail}.` : "Adresse de l'équipe à prévenir à chaque commande payée.",
    },
  ];
  return { fields, checks, webhookUrl: `${origin}/api/stripe/webhook`, backend: storageBackend() };
}

export async function saveIntegrations(patch: Partial<Record<keyof IntegrationSettings, string>>) {
  const user = await requirePermission("team");
  const changed: string[] = [];
  for (const [field, raw] of Object.entries(patch) as [keyof IntegrationSettings, string][]) {
    if (!FIELDS.includes(field) || typeof raw !== "string") continue;
    const value = raw.trim();
    if (field === "stripeSecretKey" && value && !/^(sk|rk)_(test|live)_/.test(value)) throw new Error("La clé Stripe doit commencer par sk_test_, sk_live_ ou rk_.");
    if (field === "stripeWebhookSecret" && value && !value.startsWith("whsec_")) throw new Error("Le secret du webhook commence par whsec_.");
    if (field === "resendApiKey" && value && !value.startsWith("re_")) throw new Error("La clé Resend commence par re_.");
    if ((field === "adminNotifyEmail") && value && !isEmail(value)) throw new Error("Adresse d'alerte invalide.");
    if ((field === "siteUrl" || field === "s3Endpoint" || field === "s3PublicUrl") && value && !/^https?:\/\//.test(value)) {
      throw new Error("Les adresses doivent commencer par https://");
    }
    changed.push(field);
  }
  await updateStore((data) => {
    const target = data.integrations || (data.integrations = {});
    for (const field of changed as (keyof IntegrationSettings)[]) {
      const value = (patch[field] || "").trim();
      if (!value) delete target[field];
      else target[field] = SECRET_FIELDS.includes(field) ? encryptSecret(value) : value;
    }
  });
  invalidateConfig();
  runAfterResponse(() => logAuditEvent("setup.update", "Installation", `Réglages modifiés : ${changed.join(", ") || "aucun"}`, user));
  revalidatePath("/", "layout");
  return getSetupStatus();
}

export async function testStripe() {
  await requirePermission("team");
  const key = (await getConfig()).stripeSecretKey;
  if (!key) return { ok: false, message: "Aucune clé Stripe." };
  try {
    const account = await new Stripe(key).accounts.retrieveCurrent();
    return { ok: true, message: `Connecté au compte Stripe ${account.settings?.dashboard?.display_name || account.id}${account.charges_enabled ? "" : " (paiements pas encore activés chez Stripe)"}.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Clé refusée par Stripe." };
  }
}

export async function testEmail(to: string) {
  const user = await requirePermission("team");
  if (!isEmail(to)) return { ok: false, message: "Adresse invalide." };
  const brand = (await readStore()).published.settings.brandName;
  const result = await sendEmail({
    to,
    subject: `Test d'envoi - ${brand}`,
    html: `<p>Les e-mails automatiques de <strong>${brand}</strong> fonctionnent.</p>`,
  });
  runAfterResponse(() => logAuditEvent("setup.test_email", "Installation", `E-mail de test vers ${to} : ${result.status}`, user));
  if (result.status === "envoye") return { ok: true, message: `E-mail envoyé à ${to}.` };
  return { ok: false, message: result.error || "Échec de l'envoi." };
}
