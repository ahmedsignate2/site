"use server";

import { revalidatePath } from "next/cache";
import { isEmail, uid } from "@/lib/format";
import { authorizePayment } from "@/lib/payment";
import { shippingCost } from "@/lib/catalog";
import { readStore, updateStore } from "@/lib/store";
import type { CheckoutInput, OrderStatus, SiteContent } from "@/lib/types";

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
    const preview = await readStore();
    const previewItems = input.items.map((line) => {
      const product = preview.published.products.find((item) => item.id === line.productId);
      if (!product) throw new Error("Produit introuvable.");
      if (line.qty < 1 || line.qty > 8) throw new Error("Quantité invalide.");
      if (product.stock < line.qty) throw new Error(`${product.name} n'est plus disponible dans cette quantité.`);
      return product.price * line.qty;
    });
    const previewSubtotal = previewItems.reduce((sum, price) => sum + price, 0);
    const previewShipping = shippingCost(preview.published, previewSubtotal);
    const payment = await authorizePayment(previewSubtotal + previewShipping, orderId);
    let createdTotal = 0;
    await updateStore((data) => {
      const catalog = data.published.products;
      const items = input.items.map((line) => {
        const product = catalog.find((item) => item.id === line.productId);
        if (!product) throw new Error(`Produit introuvable.`);
        if (line.qty < 1 || line.qty > 8) throw new Error("Quantité invalide.");
        if (product.stock < line.qty) throw new Error(`${product.name} n'est plus disponible dans cette quantité.`);
        return {
          productId: product.id,
          name: product.name,
          price: product.price,
          qty: line.qty,
          image: product.images[0] ?? "",
        };
      });
      for (const line of items) {
        for (const version of [data.published, data.draft]) {
          const product = version.products.find((item) => item.id === line.productId);
          if (product) product.stock -= line.qty;
        }
      }
      const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
      const shipping = shippingCost(data.published, subtotal);
      createdTotal = subtotal + shipping;
      data.orders.unshift({
        id: orderId,
        createdAt: new Date().toISOString(),
        status: "payee",
        demo: false,
        payment,
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
        total: createdTotal,
      });
    });
    touch();
    return { ok: true as const, orderId };
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
    if (order) order.status = status;
  });
  touch();
}

export async function deleteOrder(id: string) {
  await updateStore((data) => {
    data.orders = data.orders.filter((order) => order.id !== id);
  });
  touch();
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
