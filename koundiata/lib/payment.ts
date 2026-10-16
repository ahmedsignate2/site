import Stripe from "stripe";
import { getConfig } from "@/lib/config";
import type { OrderItem, PaymentRecord } from "@/lib/types";

export async function stripeEnabled() {
  return Boolean((await getConfig()).stripeSecretKey);
}

let stripeClient: { key: string; client: Stripe } | null = null;

export async function getStripe() {
  const key = (await getConfig()).stripeSecretKey;
  if (!key) return null;
  if (!stripeClient || stripeClient.key !== key) stripeClient = { key, client: new Stripe(key) };
  return stripeClient.client;
}

export function paymentNotice(live: boolean) {
  return live
    ? "Vous serez redirigé vers Stripe pour payer par carte. La commande n'est confirmée qu'une fois le paiement accepté."
    : "Paiement simulé : aucune carte n'est débitée. Ajoutez la clé Stripe dans Studio → Installation pour encaisser vraiment.";
}

export async function simulatedAuthorization(amountCents: number, orderId: string): Promise<PaymentRecord> {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Le montant à encaisser est invalide.");
  }
  return { provider: "simulated", status: "authorized", reference: `sim_${orderId}` };
}

export async function createCardCheckout(input: {
  orderId: string;
  email: string;
  items: OrderItem[];
  shippingCents: number;
  discountCents?: number;
  promoCode?: string;
  origin: string;
  cancelToken: string;
}) {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe n'est pas configuré.");
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = input.items.map((item) => ({
    quantity: item.qty,
    price_data: {
      currency: "eur",
      unit_amount: item.price,
      product_data: { name: item.name },
    },
  }));
  if (input.shippingCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: input.shippingCents,
        product_data: { name: "Livraison" },
      },
    });
  }
  // Remise : coupon Stripe à usage unique, du montant exact calculé côté serveur.
  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  if (input.discountCents && input.discountCents > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: input.discountCents,
      currency: "eur",
      duration: "once",
      max_redemptions: 1,
      name: input.promoCode ? `Code ${input.promoCode}` : "Remise",
    });
    discounts = [{ coupon: coupon.id }];
  }
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ...(discounts ? { discounts } : {}),
    locale: "fr",
    customer_email: input.email,
    client_reference_id: input.orderId,
    metadata: { orderId: input.orderId },
    payment_intent_data: { metadata: { orderId: input.orderId } },
    line_items: lineItems,
    success_url: `${input.origin}/commande/confirmation?id=${encodeURIComponent(input.orderId)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/commande?annulee=1&commande=${encodeURIComponent(input.orderId)}&jeton=${encodeURIComponent(input.cancelToken)}`,
  });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé de page de paiement.");
  return { url: session.url, reference: session.id };
}
