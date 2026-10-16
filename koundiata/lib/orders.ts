import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getStripe, stripeEnabled } from "@/lib/payment";
import { restoreStock } from "@/lib/stock";
import { readStore, updateStore } from "@/lib/store";
import { queueAutomation, runAfterResponse } from "@/lib/automation";
import { logAuditEvent } from "@/lib/audit";
import { getConfig } from "@/lib/config";

/*
 * Opérations internes sur les commandes.
 * Ce fichier n'est PAS un module "use server" : ces fonctions ne sont appelables
 * que depuis le serveur (webhook Stripe, pages serveur), jamais depuis le navigateur.
 */

function touch() {
  try {
    revalidatePath("/", "layout");
  } catch {
    // Appelé pendant un rendu serveur : les pages sont dynamiques, rien à invalider.
  }
}

/** Identifiant lisible et non devinable, ex. KD-261016-7XK2Q. */
export function newOrderId() {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(5);
  const suffix = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `KD-${date}-${suffix}`;
}

export function newCancelToken() {
  return randomBytes(16).toString("base64url");
}

export async function getOrder(id: string) {
  const data = await readStore();
  return data.orders.find((order) => order.id === id) ?? null;
}

/** E-mails envoyés quand une commande est payée : confirmation au client, alerte à l'équipe. */
export async function notifyOrderPaid(id: string) {
  const order = await getOrder(id);
  if (!order) return;
  const config = await getConfig();
  const total = `${(order.total / 100).toFixed(2).replace(".", ",")} €`;
  const shippingAddress = `${order.customer.address}, ${order.customer.postal} ${order.customer.city}, ${order.customer.country}`;
  queueAutomation("order.created", order.customer.email, {
    order_id: id,
    customer_name: `${order.customer.firstName} ${order.customer.lastName}`,
    total_amount: total,
    shipping_address: shippingAddress,
  });
  if (config.adminNotifyEmail) {
    const origin = config.siteUrl || "";
    queueAutomation("admin.new_order", config.adminNotifyEmail, {
      order_id: id,
      customer_name: `${order.customer.firstName} ${order.customer.lastName}`,
      total_amount: total,
      shipping_address: shippingAddress,
      studio_order_url: `${origin}/studio/commandes`,
    });
  }
}

export async function markOrderPaid(id: string, reference: string) {
  let changed = false;
  let total = 0;
  await updateStore((data) => {
    const order = data.orders.find((item) => item.id === id);
    if (!order || order.status !== "en_attente") return;
    order.status = "payee";
    order.payment = { provider: "stripe", status: "authorized", reference };
    changed = true;
    total = order.total;
  });
  if (changed) {
    await notifyOrderPaid(id);
    runAfterResponse(() => logAuditEvent("order.paid", "Commandes", `Paiement Stripe confirmé pour ${id} (${(total / 100).toFixed(2)} €)`));
  }
  touch();
}

/** Libère le stock d'une commande jamais payée et la retire. Sans effet si elle a été payée entre-temps. */
export async function releaseUnpaidOrder(id: string) {
  await updateStore((data) => {
    const order = data.orders.find((item) => item.id === id);
    if (!order || order.status !== "en_attente") return;
    restoreStock(data, order);
    data.orders = data.orders.filter((item) => item.id !== id);
  });
  touch();
}

/**
 * Retour « annuler » depuis Stripe. Exige le jeton secret de la commande,
 * puis expire la session Stripe : si le client a payé entre-temps, l'expiration
 * échoue et la commande est conservée.
 */
export async function cancelCheckout(id: string, token: string) {
  const order = await getOrder(id);
  if (!order || order.status !== "en_attente" || !order.cancelToken || order.cancelToken !== token) return;
  const stripe = await getStripe();
  const reference = order.payment?.reference;
  if (stripe && reference) {
    try {
      const session = await stripe.checkout.sessions.retrieve(reference);
      if (session.payment_status === "paid") return;
      if (session.status === "open") await stripe.checkout.sessions.expire(reference);
    } catch {
      return;
    }
  }
  await releaseUnpaidOrder(id);
}

export async function settleCheckoutReturn(orderId: string, sessionId?: string) {
  if (sessionId && (await stripeEnabled())) {
    const stripe = await getStripe();
    if (stripe) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.metadata?.orderId === orderId && session.payment_status === "paid") {
        await markOrderPaid(orderId, session.id);
      }
    }
  }
  return getOrder(orderId);
}
