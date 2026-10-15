"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isEmail, uid } from "@/lib/format";
import { createCardCheckout, getStripe, simulatedAuthorization, stripeEnabled } from "@/lib/payment";
import { shippingCost } from "@/lib/catalog";
import { restoreStock, takeStock } from "@/lib/stock";
import { readStore, updateStore } from "@/lib/store";
import type { CheckoutInput, OrderItem, OrderStatus, SiteContent } from "@/lib/types";

function touch() {
  revalidatePath("/", "layout");
}

export async function loadStudioData() {
  return readStore();
}

export async function saveDraft(draft: SiteContent) {
  await updateStore((data) => {
    data.draft = draft;
  });
  touch();
}

export async function publishSite() {
  const data = await updateStore((store) => {
    store.published = structuredClone(store.draft);
  });
  touch();
  return data.published;
}

export async function discardDraft() {
  const data = await updateStore((store) => {
    store.draft = structuredClone(store.published);
  });
  touch();
  return data.draft;
}

export async function placeOrder(input: CheckoutInput) {
  const errors: Record<string, string> = {};
  if (!input.firstName.trim()) errors.firstName = "Indiquez votre prénom.";
  if (!input.lastName.trim()) errors.lastName = "Indiquez votre nom.";
  if (!isEmail(input.email)) errors.email = "Indiquez une adresse e-mail valide.";
  if (input.phone.trim().length < 8) errors.phone = "Indiquez un téléphone.";
  if (input.address.trim().length < 4) errors.address = "Indiquez une adresse.";
  if (!/^\d{5}$/.test(input.postal.trim())) errors.postal = "Le code postal doit comporter 5 chiffres.";
  if (!input.city.trim()) errors.city = "Indiquez une ville.";
  if (!input.items.length) errors.form = "Votre panier est vide.";

  if (Object.keys(errors).length) {
    return { ok: false as const, errors };
  }

  try {
    const orderId = `KD-${Date.now().toString().slice(-6)}`;
    const liveCard = stripeEnabled();
    const headerList = await headers();
    const proto = headerList.get("x-forwarded-proto") ?? "http";
    const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "127.0.0.1:3847";
    const origin = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;
    let items: OrderItem[] = [];
    let subtotal = 0;
    let shipping = 0;
    await updateStore((data) => {
      items = input.items.map((line) => {
        const product = data.published.products.find((item) => item.id === line.productId);
        if (!product) throw new Error("Produit introuvable.");
        if (line.qty < 1 || line.qty > 8) throw new Error("Quantité invalide.");
        return {
          productId: product.id,
          name: product.name,
          price: product.price,
          qty: line.qty,
          image: product.images[0] ?? "",
        };
      });
      subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
      shipping = shippingCost(data.published, subtotal);
      takeStock(data, items);
      data.orders.unshift({
        id: orderId,
        createdAt: new Date().toISOString(),
        status: liveCard ? "en_attente" : "payee",
        demo: false,
        stockHeld: true,
        payment: liveCard
          ? { provider: "stripe", status: "pending", reference: "" }
          : { provider: "simulated", status: "authorized", reference: `sim_${orderId}` },
        customer: {
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          email: input.email.trim().toLowerCase(),
          phone: input.phone.trim(),
          address: input.address.trim(),
          postal: input.postal.trim(),
          city: input.city.trim(),
          country: input.country.trim() || "France",
        },
        items,
        subtotal,
        shipping,
        total: subtotal + shipping,
      });
    });
    if (!liveCard) {
      await simulatedAuthorization(subtotal + shipping, orderId);
      touch();
      return { ok: true as const, orderId, redirectUrl: null as string | null };
    }
    try {
      const checkout = await createCardCheckout({
        orderId,
        email: input.email.trim().toLowerCase(),
        items,
        shippingCents: shipping,
        origin,
      });
      await updateStore((data) => {
        const order = data.orders.find((item) => item.id === orderId);
        if (order?.payment) order.payment.reference = checkout.reference;
      });
      touch();
      return { ok: true as const, orderId, redirectUrl: checkout.url };
    } catch (error) {
      await releaseUnpaidOrder(orderId);
      throw error;
    }
  } catch (error) {
    return {
      ok: false as const,
      errors: { form: error instanceof Error ? error.message : "La commande n'a pas pu être enregistrée." },
    };
  }
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  await updateStore((data) => {
    const order = data.orders.find((item) => item.id === id);
    if (!order) return;
    if ((status === "annulee" || status === "echouee") && order.stockHeld) restoreStock(data, order);
    order.status = status;
  });
  touch();
}

export async function deleteOrder(id: string) {
  await updateStore((data) => {
    const order = data.orders.find((item) => item.id === id);
    if (order) restoreStock(data, order);
    data.orders = data.orders.filter((item) => item.id !== id);
  });
  touch();
}

export async function releaseUnpaidOrder(id: string) {
  await updateStore((data) => {
    const order = data.orders.find((item) => item.id === id);
    if (!order || order.status !== "en_attente") return;
    restoreStock(data, order);
    order.status = "annulee";
    if (order.payment) order.payment.status = "failed";
  });
  touch();
}

export async function markOrderPaid(id: string, reference: string) {
  await updateStore((data) => {
    const order = data.orders.find((item) => item.id === id);
    if (!order || order.status !== "en_attente") return;
    order.status = "payee";
    order.payment = { provider: "stripe", status: "authorized", reference };
  });
  touch();
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

export async function ordersForEmail(email: string) {
  if (!isEmail(email)) return [];
  const data = await readStore();
  const needle = email.trim().toLowerCase();
  return data.orders.filter((order) => order.customer.email === needle);
}

export async function getOrder(id: string) {
  const data = await readStore();
  return data.orders.find((order) => order.id === id) ?? null;
}

export async function subscribeEmail(email: string) {
  if (!isEmail(email)) return { ok: false as const, error: "Indiquez une adresse e-mail valide." };
  const clean = email.trim().toLowerCase();
  await updateStore((data) => {
    if (!data.subscribers.some((item) => item.email === clean)) {
      data.subscribers.unshift({ id: uid("sub"), email: clean, createdAt: new Date().toISOString() });
    }
  });
  touch();
  return { ok: true as const };
}

export async function sendMessage(input: { name: string; email: string; subject: string; body: string }) {
  const errors: Record<string, string> = {};
  if (input.name.trim().length < 2) errors.name = "Indiquez votre nom.";
  if (!isEmail(input.email)) errors.email = "Indiquez une adresse e-mail valide.";
  if (!input.subject.trim()) errors.subject = "Choisissez un sujet.";
  if (input.body.trim().length < 12) errors.body = "Écrivez quelques mots de plus, pour que nous puissions répondre.";
  if (Object.keys(errors).length) return { ok: false as const, errors };
  await updateStore((data) => {
    data.messages.unshift({
      id: uid("msg"),
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      subject: input.subject.trim(),
      body: input.body.trim(),
      createdAt: new Date().toISOString(),
      read: false,
    });
  });
  touch();
  return { ok: true as const };
}

export async function markMessageRead(id: string) {
  await updateStore((data) => {
    const message = data.messages.find((item) => item.id === id);
    if (message) message.read = true;
  });
  touch();
}
