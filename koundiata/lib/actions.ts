"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isEmail, uid } from "@/lib/format";
import { createCardCheckout, getStripe, simulatedAuthorization, stripeEnabled } from "@/lib/payment";
import { shippingCost } from "@/lib/catalog";
import { restoreStock, takeStock } from "@/lib/stock";
import { readStore, updateStore } from "@/lib/store";
import { dispatchAutomation } from "@/lib/automation";
import { logAuditEvent } from "@/lib/audit";
import { SECTOR_PRESETS } from "@/lib/sectors";
import type { BusinessSector, CheckoutInput, OrderItem, OrderStatus, PromoCode, SiteContent } from "@/lib/types";

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
        const product =
          data.published.products.find((item) => item.id === line.productId) ||
          data.draft.products.find((item) => item.id === line.productId);
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
      dispatchAutomation("order.created", input.email.trim().toLowerCase(), {
        order_id: orderId,
        customer_name: `${input.firstName} ${input.lastName}`,
        total_amount: `${((subtotal + shipping) / 100).toFixed(2)} €`,
        shipping_address: `${input.address}, ${input.postal} ${input.city}`,
        brand_name: "KOUNDIATA",
        support_email: "bonjour@koundiata.fr",
      }).catch(() => {});
      logAuditEvent("order.created", "Commandes", `Nouvelle commande simulée ${orderId} (${((subtotal + shipping) / 100).toFixed(2)} €)`).catch(() => {});
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
  let customerEmail = "";
  let customerName = "";
  let brand = "Boutique";
  await updateStore((data) => {
    const order = data.orders.find((item) => item.id === id);
    if (!order) return;
    if ((status === "annulee" || status === "echouee") && order.stockHeld) restoreStock(data, order);
    order.status = status;
    customerEmail = order.customer.email;
    customerName = order.customer.firstName;
    brand = data.published.settings.brandName;
  });
  if (customerEmail && status === "expediee") {
    dispatchAutomation("order.shipped", customerEmail, {
      order_id: id,
      customer_name: customerName,
      carrier: "Colissimo",
      tracking_number: `6A${id.replace(/[^0-9]/g, "")}FR`,
      tracking_url: "https://www.laposte.fr",
      brand_name: brand,
    }).catch(() => {});
  }
  logAuditEvent("order.status", "Commandes", `Statut de la commande ${id} mis à jour : ${status}`).catch(() => {});
  touch();
}

export async function updateOrderShipping(
  id: string,
  carrier: string,
  trackingNumber: string,
  trackingUrl?: string,
) {
  let customerEmail = "";
  let customerName = "";
  let brand = "Boutique";
  await updateStore((data) => {
    const order = data.orders.find((item) => item.id === id);
    if (!order) return;
    order.status = "expediee";
    order.shippingDetails = {
      carrier: carrier.trim(),
      trackingNumber: trackingNumber.trim(),
      trackingUrl: trackingUrl?.trim() || `https://www.laposte.fr/outils/suivre-vos-envois?code=${trackingNumber.trim()}`,
      shippedAt: new Date().toISOString(),
    };
    customerEmail = order.customer.email;
    customerName = order.customer.firstName;
    brand = data.published.settings.brandName;
  });
  if (customerEmail) {
    dispatchAutomation("order.shipped", customerEmail, {
      order_id: id,
      customer_name: customerName,
      carrier: carrier.trim(),
      tracking_number: trackingNumber.trim(),
      tracking_url: trackingUrl?.trim() || `https://www.laposte.fr/outils/suivre-vos-envois?code=${trackingNumber.trim()}`,
      brand_name: brand,
    }).catch(() => {});
  }
  logAuditEvent("order.shipping", "Expéditions", `Colis pour ${id} expédié via ${carrier} (${trackingNumber})`).catch(() => {});
  touch();
}

export async function processOrderRefund(id: string, amountCents: number, reason: string) {
  let customerEmail = "";
  let customerName = "";
  let brand = "Boutique";
  await updateStore((data) => {
    const order = data.orders.find((item) => item.id === id);
    if (!order) return;
    if (!order.refunds) order.refunds = [];
    order.refunds.push({
      id: uid("ref"),
      amount: amountCents,
      reason: reason.trim(),
      date: new Date().toISOString(),
      stripeRefundId: `re_sim_${Date.now()}`,
    });
    const totalRefunded = order.refunds.reduce((sum, r) => sum + r.amount, 0);
    order.status = totalRefunded >= order.total ? "remboursee_total" : "remboursee_partiel";
    customerEmail = order.customer.email;
    customerName = order.customer.firstName;
    brand = data.published.settings.brandName;
  });
  if (customerEmail) {
    dispatchAutomation("order.refunded", customerEmail, {
      order_id: id,
      customer_name: customerName,
      refund_amount: `${(amountCents / 100).toFixed(2)} €`,
      refund_reason: reason.trim(),
      brand_name: brand,
    }).catch(() => {});
  }
  logAuditEvent("order.refund", "Finances", `Remboursement de ${(amountCents / 100).toFixed(2)} € sur commande ${id} (Motif: ${reason})`).catch(() => {});
  touch();
}

export async function validatePromoCode(code: string, subtotalCents: number) {
  const data = await readStore();
  const clean = code.trim().toUpperCase();
  const promo = (data.promoCodes || []).find((p) => p.code.toUpperCase() === clean && p.active);
  if (!promo) return { valid: false as const, error: "Code promotionnel invalide ou inactif." };
  if (subtotalCents < promo.minPurchaseCents) {
    return {
      valid: false as const,
      error: `Minimum d'achat de ${(promo.minPurchaseCents / 100).toFixed(2)} € requis pour ce code.`,
    };
  }
  const discountCents =
    promo.discountType === "percent"
      ? Math.round((subtotalCents * promo.discountValue) / 100)
      : Math.min(subtotalCents, promo.discountValue);
  return { valid: true as const, code: promo.code, discountCents };
}

export async function switchSectorPreset(sector: BusinessSector) {
  const config = SECTOR_PRESETS[sector];
  if (!config) return;
  await updateStore((data) => {
    data.draft.settings.sector = sector;
    data.draft.settings.brandName = config.brandName;
    data.draft.settings.tagline = config.tagline;
    data.draft.settings.announcement = config.announcement;
    data.draft.theme = { ...data.draft.theme, ...config.theme };
    data.draft.categories = config.categories;
    data.draft.products = config.sampleProducts;

    const heroSec = data.draft.sections.find((s) => s.type === "hero");
    if (heroSec && "hero" in heroSec) {
      heroSec.hero = config.hero;
    }

    const promoSec = data.draft.sections.find((s) => s.type === "promos");
    if (promoSec && "cards" in promoSec) {
      promoSec.cards = config.promos;
    }

    const trustSec = data.draft.sections.find((s) => s.type === "trust");
    if (trustSec && "items" in trustSec) {
      trustSec.items = config.trustItems;
    }

    const gallerySec = data.draft.sections.find((s) => s.type === "gallery");
    if (gallerySec && "images" in gallerySec && config.gallery) {
      gallerySec.title = config.gallery.title;
      gallerySec.images = config.gallery.images;
    }

    data.draft.about = config.about;
    data.draft.footer.blurb = config.footerBlurb;

    const navBase = data.draft.navigation.filter((n) => !n.href.startsWith("/boutique/"));
    const catLinks = config.categories.slice(0, 5).map((cat) => ({
      id: `n-${cat.slug}`,
      label: cat.name.split("&")[0].trim(),
      href: `/boutique/${cat.slug}`,
    }));
    const shopIdx = navBase.findIndex((n) => n.href === "/boutique");
    if (shopIdx >= 0) {
      data.draft.navigation = [
        ...navBase.slice(0, shopIdx + 1),
        ...catLinks,
        ...navBase.slice(shopIdx + 1),
      ];
    }
  });
  logAuditEvent("sector.switch", "Theme Studio", `Bascule de l'univers de marque vers le secteur : ${config.name} (${config.brandName})`).catch(() => {});
  touch();
}

export async function sendTestAutomationEmail(templateSlug: string, recipient: string) {
  const log = await dispatchAutomation(
    "order.created",
    recipient,
    {
      order_id: "KD-98214",
      customer_name: "Ahmed (Test Studio)",
      total_amount: "49,90 €",
      carrier: "Colissimo Suivi",
      tracking_number: "6A98214567FR",
      tracking_url: "https://www.laposte.fr",
      refund_amount: "24,90 €",
      refund_reason: "Démonstration remboursement",
      product_name: "Sérum Éclat Niacinamide",
      product_sku: "KD-SR-30",
      stock_remaining: "2",
      stock_threshold: "10",
      reorder_qty: "50",
      studio_product_url: "/studio/produits",
      brand_name: "Koundiata OS",
      support_email: "support@koundiata.fr",
      shipping_address: "14 Boulevard Haussmann, 75009 Paris",
    },
    templateSlug,
  );
  logAuditEvent("automation.test_email", "Automatisations", `E-mail de test (${templateSlug}) envoyé à ${recipient}`).catch(() => {});
  touch();
  return log;
}

export async function savePromoCode(promo: PromoCode) {
  await updateStore((data) => {
    if (!data.promoCodes) data.promoCodes = [];
    const idx = data.promoCodes.findIndex((p) => p.code.toUpperCase() === promo.code.toUpperCase());
    if (idx >= 0) {
      data.promoCodes[idx] = promo;
    } else {
      data.promoCodes.unshift(promo);
    }
  });
  logAuditEvent("promo.save", "Promotions", `Code promo ${promo.code} enregistré (${promo.discountType === "percent" ? promo.discountValue + "%" : (promo.discountValue / 100).toFixed(2) + " €"})`).catch(() => {});
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
    // Remove unpaid abandoned checkout so it never creates phantom orders in dashboard
    data.orders = data.orders.filter((item) => item.id !== id);
  });
  touch();
}

export async function clearAllOrders() {
  await updateStore((data) => {
    for (const order of data.orders) {
      if (order.stockHeld) {
        restoreStock(data, order);
      }
    }
    data.orders = [];
  });
  logAuditEvent("order.clear", "Commandes", "Toutes les commandes de test ont été effacées").catch(() => {});
  touch();
}

export async function markOrderPaid(id: string, reference: string) {
  let customerEmail = "";
  let customerName = "";
  let brand = "Boutique";
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
    totalFormatted = `${((order.total) / 100).toFixed(2)} €`;
    shippingAddress = `${order.customer.address}, ${order.customer.postal} ${order.customer.city}`;
  });

  if (customerEmail) {
    dispatchAutomation("order.created", customerEmail, {
      order_id: id,
      customer_name: customerName,
      total_amount: totalFormatted,
      shipping_address: shippingAddress,
      brand_name: brand,
      support_email: "bonjour@koundiata.fr",
    }).catch(() => {});
    logAuditEvent("order.paid", "Commandes", `Paiement Stripe confirmé pour ${id} (${totalFormatted})`).catch(() => {});
  }
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
