import { after } from "next/server";
import { uid } from "@/lib/format";
import { sendEmail } from "@/lib/mailer";
import { readStore, updateStore } from "@/lib/store";
import type { AutomationEventName, EmailLog, EmailTemplate } from "@/lib/types";

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    slug: "order_confirmation",
    name: "Confirmation de Commande",
    category: "commande",
    subject: "Confirmation de votre commande {{order_id}} - {{brand_name}}",
    bodyHtml: `
<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">Merci pour votre commande, {{customer_name}} !</h2>
  <p>Nous avons bien enregistré votre commande <strong>#{{order_id}}</strong> d'un montant de <strong>{{total_amount}}</strong>.</p>
  <div style="background: #f7f7f7; padding: 15px; border-radius: 6px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Adresse de livraison :</strong><br/>{{shipping_address}}</p>
  </div>
  <p>Notre atelier prépare vos articles avec le plus grand soin. Vous recevrez un nouvel e-mail dès la remise au transporteur.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="font-size: 12px; color: #888;">{{brand_name}} - {{support_email}}</p>
</div>`,
    variables: ["order_id", "brand_name", "customer_name", "total_amount", "shipping_address", "support_email"],
  },
  {
    slug: "order_shipped",
    name: "Expédition & Suivi Colis",
    category: "suivi",
    subject: "Votre commande {{order_id}} a été expédiée !",
    bodyHtml: `
<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">Votre colis est en route ! 🚀</h2>
  <p>Bonjour {{customer_name}}, votre commande <strong>#{{order_id}}</strong> a été confiée à notre transporteur <strong>{{carrier}}</strong>.</p>
  <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 4px; margin: 20px 0;">
    <p style="margin: 0 0 8px 0;"><strong>Numéro de suivi :</strong> {{tracking_number}}</p>
    <a href="{{tracking_url}}" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 18px; border-radius: 4px; text-decoration: none; font-weight: bold; margin-top: 6px;">Suivre mon colis en direct</a>
  </div>
  <p>Le délai indicatif de livraison est de 2 à 3 jours ouvrés.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="font-size: 12px; color: #888;">{{brand_name}} - Service Client</p>
</div>`,
    variables: ["order_id", "customer_name", "carrier", "tracking_number", "tracking_url", "brand_name"],
  },
  {
    slug: "order_refunded",
    name: "Notification de Remboursement",
    category: "commande",
    subject: "Remboursement traité pour votre commande {{order_id}}",
    bodyHtml: `
<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">Remboursement confirmé</h2>
  <p>Bonjour {{customer_name}}, nous avons procédé au remboursement d'un montant de <strong>{{refund_amount}}</strong> concernant la commande <strong>#{{order_id}}</strong>.</p>
  <p><strong>Motif :</strong> {{refund_reason}}</p>
  <p>Selon votre établissement bancaire, les fonds seront visibles sur votre compte sous 3 à 5 jours ouvrés.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="font-size: 12px; color: #888;">{{brand_name}}</p>
</div>`,
    variables: ["order_id", "customer_name", "refund_amount", "refund_reason", "brand_name"],
  },
  {
    slug: "stock_alert_admin",
    name: "Alerte Administrateur Stock Faible",
    category: "admin",
    subject: "⚠️ ALERTE STOCK : {{product_name}} ({{stock_remaining}} restant(s))",
    bodyHtml: `
<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #b91c1c;">Alerte Seuil de Stock</h2>
  <p>Le produit <strong>{{product_name}}</strong> (SKU: <code>{{product_sku}}</code>) a atteint son seuil d'alerte critique.</p>
  <ul>
    <li>Stock restant : <strong>{{stock_remaining}} unités</strong></li>
    <li>Seuil configuré : {{stock_threshold}} unités</li>
    <li>Réapprovisionnement suggéré : {{reorder_qty}} unités</li>
  </ul>
  <p><a href="{{studio_product_url}}" style="background: #111; color: #fff; padding: 8px 14px; text-decoration: none; border-radius: 4px; display: inline-block;">Gérer le produit dans le Studio</a></p>
</div>`,
    variables: ["product_name", "product_sku", "stock_remaining", "stock_threshold", "reorder_qty", "studio_product_url"],
  },
  {
    slug: "customer_welcome",
    name: "Bienvenue (création de compte)",
    category: "compte",
    subject: "Bienvenue chez {{brand_name}}",
    bodyHtml: `
<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">Bienvenue, {{customer_name}} !</h2>
  <p>Votre compte {{brand_name}} est créé. Vous pouvez suivre vos commandes, enregistrer vos adresses et retrouver vos favoris depuis votre espace client.</p>
  <p><a href="{{account_url}}" style="display: inline-block; background: #111; color: #fff; padding: 10px 18px; border-radius: 4px; text-decoration: none;">Accéder à mon compte</a></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="font-size: 12px; color: #888;">{{brand_name}} - {{support_email}}</p>
</div>`,
    variables: ["customer_name", "brand_name", "account_url", "support_email"],
  },
  {
    slug: "customer_verify",
    name: "Confirmation de l'adresse e-mail",
    category: "compte",
    subject: "Confirmez votre adresse e-mail - {{brand_name}}",
    bodyHtml: `
<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">Bienvenue, {{customer_name}} !</h2>
  <p>Merci d'avoir créé votre compte {{brand_name}}. Confirmez votre adresse e-mail pour pouvoir commander :</p>
  <p><a href="{{verify_url}}" style="display: inline-block; background: #111; color: #fff; padding: 12px 20px; border-radius: 4px; text-decoration: none; font-weight: bold;">Confirmer mon adresse</a></p>
  <p style="font-size: 13px; color: #666;">Ce lien est valable 48 heures. Si vous n'avez pas créé de compte, ignorez cet e-mail.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="font-size: 12px; color: #888;">{{brand_name}} - {{support_email}}</p>
</div>`,
    variables: ["customer_name", "verify_url", "brand_name", "support_email"],
  },
  {
    slug: "customer_password_reset",
    name: "Mot de passe oublié",
    category: "compte",
    subject: "Réinitialisez votre mot de passe {{brand_name}}",
    bodyHtml: `
<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">Nouveau mot de passe</h2>
  <p>Bonjour {{customer_name}}, vous avez demandé à réinitialiser votre mot de passe. Ce lien est valable 1 heure :</p>
  <p><a href="{{reset_url}}" style="display: inline-block; background: #111; color: #fff; padding: 10px 18px; border-radius: 4px; text-decoration: none;">Choisir un nouveau mot de passe</a></p>
  <p style="font-size: 13px; color: #666;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="font-size: 12px; color: #888;">{{brand_name}}</p>
</div>`,
    variables: ["customer_name", "reset_url", "brand_name"],
  },
  {
    slug: "admin_new_order",
    name: "Nouvelle commande (équipe)",
    category: "admin",
    subject: "Nouvelle commande {{order_id}} - {{total_amount}}",
    bodyHtml: `
<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">Nouvelle commande payée</h2>
  <p>Commande <strong>{{order_id}}</strong> de {{customer_name}} pour <strong>{{total_amount}}</strong>.</p>
  <p>Livraison : {{shipping_address}}</p>
  <p><a href="{{studio_order_url}}" style="background: #111; color: #fff; padding: 8px 14px; text-decoration: none; border-radius: 4px; display: inline-block;">Ouvrir dans le studio</a></p>
</div>`,
    variables: ["order_id", "customer_name", "total_amount", "shipping_address", "studio_order_url"],
  },
];

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);
}

export function interpolateTemplate(template: string, vars: Record<string, string>, html = false): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = vars[key];
    if (value === undefined) return "";
    return html ? escapeHtml(value) : value;
  });
}

const EVENT_TEMPLATES: Partial<Record<AutomationEventName, string>> = {
  "order.created": "order_confirmation",
  "payment.succeeded": "order_confirmation",
  "order.shipped": "order_shipped",
  "order.refunded": "order_refunded",
  "stock.low": "stock_alert_admin",
  "customer.welcome": "customer_welcome",
  "customer.verify": "customer_verify",
  "customer.password_reset": "customer_password_reset",
  "admin.new_order": "admin_new_order",
};

export async function dispatchAutomation(
  event: AutomationEventName,
  recipient: string,
  variables: Record<string, string>,
  templateSlug?: string,
): Promise<EmailLog> {
  const store = await readStore();
  const templates = store.emailTemplates && store.emailTemplates.length > 0 ? store.emailTemplates : DEFAULT_EMAIL_TEMPLATES;
  const targetSlug = templateSlug || EVENT_TEMPLATES[event] || "order_confirmation";
  const tmpl =
    templates.find((t) => t.slug === targetSlug) ?? DEFAULT_EMAIL_TEMPLATES.find((t) => t.slug === targetSlug) ?? templates[0];
  const settings = store.published.settings;
  const vars = { brand_name: settings.brandName, support_email: settings.supportEmail, ...variables };
  const renderedSubject = interpolateTemplate(tmpl.subject, vars);
  const renderedBody = interpolateTemplate(tmpl.bodyHtml, vars, true);
  const idempotencyKey = `${event}_${recipient}_${variables.order_id || variables.product_sku || uid("evt")}`;

  const result = await sendEmail({
    to: recipient,
    subject: renderedSubject,
    html: renderedBody,
    replyTo: settings.supportEmail || undefined,
    idempotencyKey,
  });

  const logEntry: EmailLog = {
    id: uid("log"),
    event,
    recipient: recipient.toLowerCase(),
    subject: renderedSubject,
    templateSlug: tmpl.slug,
    status: result.status,
    sentAt: new Date().toISOString(),
    errorMessage: result.error,
    idempotencyKey,
  };

  await updateStore((data) => {
    if (!data.emailLogs) data.emailLogs = [];
    data.emailLogs.unshift(logEntry);
    if (data.emailLogs.length > 300) data.emailLogs.length = 300;
  });

  return logEntry;
}

/**
 * Lance une tâche après l'envoi de la réponse, sans la perdre.
 * Sur Vercel / Cloudflare, une promesse « oubliée » est coupée dès que la page est renvoyée :
 * after() garde la fonction en vie jusqu'à la fin de la tâche.
 */
export function runAfterResponse(task: () => Promise<unknown>) {
  const safe = () => task().catch((error) => console.error("Tâche en arrière-plan :", error));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

/** Envoie un e-mail automatique après la réponse (inscription, expédition, remboursement…). */
export function queueAutomation(event: AutomationEventName, recipient: string, variables: Record<string, string>, templateSlug?: string) {
  runAfterResponse(() => dispatchAutomation(event, recipient, variables, templateSlug));
}
