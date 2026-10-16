"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isEmail, uid } from "@/lib/format";
import { createCardCheckout, getStripe, simulatedAuthorization, stripeEnabled } from "@/lib/payment";
import { requirePermission } from "@/lib/auth";
import { newCancelToken, newOrderId, releaseUnpaidOrder } from "@/lib/orders";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { shippingCost } from "@/lib/catalog";
import { restoreStock, takeStock } from "@/lib/stock";
import { readStore, updateStore } from "@/lib/store";
import { dispatchAutomation } from "@/lib/automation";
import { logAuditEvent } from "@/lib/audit";
import { SECTOR_PRESETS } from "@/lib/sectors";
import type { BusinessSector, CheckoutInput, OrderItem, OrderStatus, PromoCode, SiteContent } from "@/lib/types";

/*
 * Chaque fonction exportée ici est un point d'accès public (Server Action).
 * Les actions du studio commencent donc toutes par requirePermission(...).
 * Les opérations internes (paiement confirmé, libération de stock) vivent dans lib/orders.ts.
 */

function touch() {
  revalidatePath("/", "layout");
}

async function throttle(scope: string, limit: number, windowMs: number) {
  const ip = clientIp(await headers());
  return rateLimit(`${scope}:${ip}`, limit, windowMs).ok;
}

const ORDER_STATUSES: OrderStatus[] = [
  "en_attente",
  "payee",
  "preparation",
  "expediee",
  "livree",
  "annulee",
  "echouee",
  "remboursee_partiel",
  "remboursee_total",
];

export async function saveDraft(draft: SiteContent) {
  await requirePermission("content");
  if (!draft || typeof draft !== "object" || !Array.isArray(draft.products) || !draft.settings) {
    throw new Error("Brouillon invalide.");
  }
  await updateStore((data) => {
    data.draft = draft;
  });
  touch();
}

export async function publishSite() {
  const user = await requirePermission("content");
  const data = await updateStore((store) => {
    store.published = structuredClone(store.draft);
  });
  logAuditEvent("site.publish", "Site", "Publication du brouillon", user).catch(() => {});
  touch();
  return data.published;
}

export async function discardDraft() {
  await requirePermission("content");
  const data = await updateStore((store) => {
    store.draft = structuredClone(store.published);
  });
  touch();
  return data.draft;
}

export async function placeOrder(input: CheckoutInput) {
  if (!(await throttle("order", 20, 10 * 60_000))) {
    return { ok: false as const, errors: { form: "Trop de tentatives. Réessayez dans quelques minutes." } as Record<string, string> };
  }
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
    const orderId = newOrderId();
    const cancelToken = newCancelToken();
    const liveCard = stripeEnabled();
    const headerList = await headers();
    const proto = headerList.get("x-forwarded-proto") ?? "http";
    const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "127.0.0.1:3847";
    const origin = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;
    let items: OrderItem[] = [];
    let subtotal = 0;
    let shipping = 0;
    let brandName = "";
    let supportEmail = "";
    await updateStore((data) => {
      brandName = data.published.settings.brandName;
      supportEmail = data.published.settings.supportEmail;
      items = input.items.map((line) => {
        // Seuls les produits publiés sont vendables : le brouillon n'est pas encore en ligne.
        const product = data.published.products.find((item) => item.id === line.productId);
        if (!product) throw new Error("Produit introuvable.");
        if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 8) throw new Error("Quantité invalide.");
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
        cancelToken,
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
        brand_name: brandName,
        support_email: supportEmail,
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
        cancelToken,
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
  const user = await requirePermission("orders");
  if (!ORDER_STATUSES.includes(status)) throw new Error("Statut inconnu.");
  if (status === "remboursee_partiel" || status === "remboursee_total") {
    throw new Error("Utilisez le bouton Rembourser pour enregistrer un remboursement.");
  }
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
  logAuditEvent("order.status", "Commandes", `Statut de la commande ${id} mis à jour : ${status}`, user).catch(() => {});
  touch();
}

export async function updateOrderShipping(
  id: string,
  carrier: string,
  trackingNumber: string,
  trackingUrl?: string,
) {
  const user = await requirePermission("orders");
  if (!carrier.trim() || !trackingNumber.trim()) throw new Error("Indiquez le transporteur et le numéro de suivi.");
  if (trackingUrl?.trim() && !/^https?:\/\//i.test(trackingUrl.trim())) throw new Error("Le lien de suivi doit commencer par https://");
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
  logAuditEvent("order.shipping", "Expéditions", `Colis pour ${id} expédié via ${carrier} (${trackingNumber})`, user).catch(() => {});
  touch();
}

export async function processOrderRefund(id: string, amountCents: number, reason: string) {
  const user = await requirePermission("refunds");
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Montant de remboursement invalide.");
  const current = (await readStore()).orders.find((item) => item.id === id);
  if (!current) throw new Error("Commande introuvable.");
  const alreadyRefunded = (current.refunds || []).reduce((sum, r) => sum + r.amount, 0);
  if (alreadyRefunded + amountCents > current.total) throw new Error("Le remboursement dépasse le montant payé.");

  // Paiement réel : le remboursement passe par Stripe avant d'être enregistré.
  let refundReference = `re_sim_${Date.now()}`;
  if (current.payment?.provider === "stripe") {
    const stripe = getStripe();
    if (!stripe) throw new Error("Stripe n'est pas configuré : remboursement impossible.");
    const session = await stripe.checkout.sessions.retrieve(current.payment.reference);
    const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!paymentIntent) throw new Error("Paiement Stripe introuvable pour cette commande.");
    const refund = await stripe.refunds.create(
      { payment_intent: paymentIntent, amount: amountCents, metadata: { orderId: id } },
      { idempotencyKey: `refund_${id}_${alreadyRefunded}_${amountCents}` },
    );
    refundReference = refund.id;
  }

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
      stripeRefundId: refundReference,
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
  logAuditEvent("order.refund", "Finances", `Remboursement de ${(amountCents / 100).toFixed(2)} € sur commande ${id} (Motif: ${reason})`, user).catch(() => {});
  touch();
}

export async function validatePromoCode(code: string, subtotalCents: number) {
  if (!(await throttle("promo", 30, 10 * 60_000))) return { valid: false as const, error: "Trop de tentatives. Réessayez plus tard." };
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
  const user = await requirePermission("content");
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
  logAuditEvent("sector.switch", "Theme Studio", `Bascule de l'univers de marque vers le secteur : ${config.name} (${config.brandName})`, user).catch(() => {});
  touch();
}

export async function sendTestAutomationEmail(templateSlug: string, recipient: string) {
  const user = await requirePermission("automations");
  if (!isEmail(recipient)) throw new Error("Adresse e-mail invalide.");
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
  logAuditEvent("automation.test_email", "Automatisations", `E-mail de test (${templateSlug}) envoyé à ${recipient}`, user).catch(() => {});
  touch();
  return log;
}

export async function savePromoCode(promo: PromoCode) {
  const user = await requirePermission("promos");
  if (!promo.code?.trim() || !Number.isFinite(promo.discountValue) || promo.discountValue < 0) throw new Error("Code promo invalide.");
  if (promo.discountType === "percent" && promo.discountValue > 100) throw new Error("Une remise ne peut pas dépasser 100 %.");
  await updateStore((data) => {
    if (!data.promoCodes) data.promoCodes = [];
    const idx = data.promoCodes.findIndex((p) => p.code.toUpperCase() === promo.code.toUpperCase());
    if (idx >= 0) {
      data.promoCodes[idx] = promo;
    } else {
      data.promoCodes.unshift(promo);
    }
  });
  logAuditEvent("promo.save", "Promotions", `Code promo ${promo.code} enregistré (${promo.discountType === "percent" ? promo.discountValue + "%" : (promo.discountValue / 100).toFixed(2) + " €"})`, user).catch(() => {});
  touch();
}

export async function deleteOrder(id: string) {
  const user = await requirePermission("danger");
  await updateStore((data) => {
    const order = data.orders.find((item) => item.id === id);
    if (order) restoreStock(data, order);
    data.orders = data.orders.filter((item) => item.id !== id);
  });
  logAuditEvent("order.delete", "Commandes", `Commande ${id} supprimée`, user).catch(() => {});
  touch();
}

export async function clearAllOrders() {
  const user = await requirePermission("danger");
  await updateStore((data) => {
    for (const order of data.orders) {
      if (order.stockHeld) {
        restoreStock(data, order);
      }
    }
    data.orders = [];
  });
  logAuditEvent("order.clear", "Commandes", "Toutes les commandes ont été effacées", user).catch(() => {});
  touch();
}

/**
 * Suivi de commande côté client : il faut le numéro ET l'e-mail de la commande.
 * Ne renvoie ni adresse ni téléphone.
 */
export async function lookupOrder(email: string, orderId: string) {
  if (!(await throttle("lookup", 10, 10 * 60_000))) {
    return { ok: false as const, error: "Trop de recherches. Réessayez dans quelques minutes." };
  }
  if (!isEmail(email) || !orderId.trim()) return { ok: false as const, error: "Indiquez votre e-mail et votre numéro de commande." };
  const data = await readStore();
  const needle = email.trim().toLowerCase();
  const id = orderId.trim().toUpperCase();
  const order = data.orders.find((item) => item.id.toUpperCase() === id && item.customer.email === needle);
  if (!order) return { ok: false as const, error: "Aucune commande ne correspond à ces informations." };
  return {
    ok: true as const,
    order: {
      id: order.id,
      createdAt: order.createdAt,
      status: order.status,
      total: order.total,
      items: order.items.map((item) => ({ productId: item.productId, name: item.name, qty: item.qty })),
      tracking: order.shippingDetails
        ? { carrier: order.shippingDetails.carrier, number: order.shippingDetails.trackingNumber, url: order.shippingDetails.trackingUrl }
        : null,
    },
  };
}

export async function subscribeEmail(email: string) {
  if (!(await throttle("subscribe", 10, 10 * 60_000))) return { ok: false as const, error: "Trop de tentatives. Réessayez plus tard." };
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
  if (!(await throttle("message", 5, 10 * 60_000))) {
    return { ok: false as const, errors: { form: "Trop de messages envoyés. Réessayez plus tard." } as Record<string, string> };
  }
  const errors: Record<string, string> = {};
  if (input.body.trim().length > 5000) errors.body = "Message trop long (5 000 caractères maximum).";
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
  await requirePermission("messages");
  await updateStore((data) => {
    const message = data.messages.find((item) => item.id === id);
    if (message) message.read = true;
  });
  touch();
}
