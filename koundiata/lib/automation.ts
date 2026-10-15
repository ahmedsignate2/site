import { uid } from "@/lib/format";
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
];

export function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return vars[key] ?? `{{${key}}}`;
  });
}

export async function dispatchAutomation(
  event: AutomationEventName,
  recipient: string,
  variables: Record<string, string>,
  templateSlug?: string,
): Promise<EmailLog> {
  const store = await readStore();
  const templates = store.emailTemplates && store.emailTemplates.length > 0 ? store.emailTemplates : DEFAULT_EMAIL_TEMPLATES;
  
  let targetSlug = templateSlug;
  if (!targetSlug) {
    if (event === "order.created" || event === "payment.succeeded") targetSlug = "order_confirmation";
    else if (event === "order.shipped") targetSlug = "order_shipped";
    else if (event === "order.refunded") targetSlug = "order_refunded";
    else if (event === "stock.low") targetSlug = "stock_alert_admin";
    else targetSlug = "order_confirmation";
  }

  const tmpl = templates.find((t) => t.slug === targetSlug) ?? templates[0];
  const renderedSubject = interpolateTemplate(tmpl.subject, variables);
  const idempotencyKey = `${event}_${recipient}_${variables.order_id || variables.product_sku || "evt"}_${Date.now().toString().slice(0, 8)}`;

  const logEntry: EmailLog = {
    id: uid("log"),
    event,
    recipient: recipient.toLowerCase(),
    subject: renderedSubject,
    templateSlug: tmpl.slug,
    status: "envoye",
    sentAt: new Date().toISOString(),
    idempotencyKey,
  };

  await updateStore((data) => {
    if (!data.emailLogs) data.emailLogs = [];
    data.emailLogs.unshift(logEntry);
    // Limite l'historique aux 100 derniers envois
    if (data.emailLogs.length > 100) data.emailLogs.pop();
  });

  return logEntry;
}
