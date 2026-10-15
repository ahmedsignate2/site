import Stripe from "stripe";
import type { OrderItem, PaymentRecord } from "@/lib/types";

export function stripeEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let stripeClient: Stripe | null = null;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

export function paymentNotice(live: boolean) {
  return live
    ? "Vous serez redirigé vers Stripe pour payer par carte. La commande n'est confirmée qu'une fois le paiement accepté."
    : "Paiement simulé : aucune carte n'est débitée. Ajoutez STRIPE_SECRET_KEY pour encaisser vraiment.";
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
  origin: string;
}) {
  const stripe = getStripe();
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
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    locale: "fr",
    customer_email: input.email,
    client_reference_id: input.orderId,
    metadata: { orderId: input.orderId },
    payment_intent_data: { metadata: { orderId: input.orderId } },
    line_items: lineItems,
    success_url: `${input.origin}/commande/confirmation?id=${encodeURIComponent(input.orderId)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/commande?annulee=1&commande=${encodeURIComponent(input.orderId)}`,
  });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé de page de paiement.");
  return { url: session.url, reference: session.id };
}
