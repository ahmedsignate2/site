import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getStripe, stripeEnabled } from "@/lib/payment";
import { restoreStock } from "@/lib/stock";
import { readStore, updateStore } from "@/lib/store";
import { dispatchAutomation } from "@/lib/automation";
import { logAuditEvent } from "@/lib/audit";

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

export async function markOrderPaid(id: string, reference: string) {
  let customerEmail = "";
  let customerName = "";
  let brand = "Boutique";
  let supportEmail = "";
  let totalFormatted = "";
  let shippingAddress = "";

  await updateStore((data) => {
    const order = data.orders.find((item) => item.id === id);
    if (!order || order.status !== "en_attente") return;
    order.status = "payee";
    order.payment = { provider: "stripe", status: "authorized", reference };
    customerEmail = order.customer.email;
    customerName = `${order.customer.firstName} ${order.customer.lastName}`;
    brand = data.published.settings.brandName;
    supportEmail = data.published.settings.supportEmail;
    totalFormatted = `${(order.total / 100).toFixed(2)} €`;
    shippingAddress = `${order.customer.address}, ${order.customer.postal} ${order.customer.city}`;
  });

  if (customerEmail) {
    dispatchAutomation("order.created", customerEmail, {
      order_id: id,
      customer_name: customerName,
      total_amount: totalFormatted,
      shipping_address: shippingAddress,
      brand_name: brand,
      support_email: supportEmail,
    }).catch(() => {});
    logAuditEvent("order.paid", "Commandes", `Paiement Stripe confirmé pour ${id} (${totalFormatted})`).catch(() => {});
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
  const stripe = getStripe();
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
  if (sessionId && stripeEnabled()) {
    const stripe = getStripe();
    if (stripe) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.metadata?.orderId === orderId && session.payment_status === "paid") {
        await markOrderPaid(orderId, session.id);
      }
    }
  }
  return getOrder(orderId);
}
