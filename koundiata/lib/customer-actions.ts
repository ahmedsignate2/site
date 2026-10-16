"use server";

import { createHash, randomBytes } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth";
import { clearCustomerCookie, currentCustomer, setCustomerCookie, toPublicCustomer } from "@/lib/customer-auth";
import { dispatchAutomation } from "@/lib/automation";
import { isEmail, uid } from "@/lib/format";
import { siteOrigin } from "@/lib/origin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { readStore, updateStore } from "@/lib/store";
import type { Customer, CustomerAddress } from "@/lib/types";

export type FormState = { error?: string; ok?: string; fields?: Record<string, string> } | undefined;

const dummyHash = hashPassword("compte-inexistant-0");

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/studio") ? next : "/compte";
}

async function limited(scope: string, limit: number, minutes: number) {
  const ip = clientIp(await headers());
  return !rateLimit(`${scope}:${ip}`, limit, minutes * 60_000).ok;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function requireCustomer() {
  const customer = await currentCustomer();
  if (!customer) throw new Error("Session expirée : reconnectez-vous.");
  return customer;
}

/* ---------- Inscription, connexion ---------- */

export async function registerCustomer(_state: FormState, form: FormData): Promise<FormState> {
  const fields = {
    firstName: String(form.get("firstName") || "").trim(),
    lastName: String(form.get("lastName") || "").trim(),
    email: String(form.get("email") || "").trim().toLowerCase(),
    phone: String(form.get("phone") || "").trim(),
  };
  const password = String(form.get("password") || "");
  if (await limited("register", 8, 30)) return { error: "Trop de créations de compte. Réessayez plus tard.", fields };
  if (!fields.firstName || !fields.lastName) return { error: "Indiquez votre prénom et votre nom.", fields };
  if (!isEmail(fields.email)) return { error: "Indiquez une adresse e-mail valide.", fields };
  const problem = passwordProblem(password);
  if (problem) return { error: problem, fields };
  if (form.get("terms") !== "on") return { error: "Acceptez les conditions générales de vente pour créer votre compte.", fields };

  const passwordHash = await hashPassword(password);
  let created: Customer | null = null;
  try {
    await updateStore((data) => {
      const customers = data.customers || (data.customers = []);
      if (customers.some((item) => item.email === fields.email)) throw new Error("exists");
      created = {
        id: uid("cli"),
        ...fields,
        passwordHash,
        sessionVersion: 0,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        emailVerified: false,
        marketingOptIn: form.get("marketing") === "on",
        blocked: false,
        addresses: [],
        wishlist: [],
      };
      customers.unshift(created);
      if (created.marketingOptIn && !data.subscribers.some((item) => item.email === fields.email)) {
        data.subscribers.unshift({ id: uid("sub"), email: fields.email, createdAt: new Date().toISOString() });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "exists") {
      return { error: "Un compte existe déjà avec cet e-mail. Connectez-vous ou réinitialisez votre mot de passe.", fields };
    }
    throw error;
  }
  if (!created) return { error: "Le compte n'a pas pu être créé.", fields };
  await setCustomerCookie(created);
  dispatchAutomation("customer.welcome", fields.email, {
    customer_name: fields.firstName,
    account_url: `${await siteOrigin()}/compte`,
  }).catch(() => {});
  redirect(safeNext(form.get("next")));
}

export async function loginCustomer(_state: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const fields = { email };
  if ((await limited("customer-login", 30, 15)) || !rateLimit(`customer-login-email:${email}`, 8, 15 * 60_000).ok) {
    return { error: "Trop de tentatives. Patientez 15 minutes.", fields };
  }
  const data = await readStore();
  const customer = (data.customers || []).find((item) => item.email === email);
  const ok = customer ? await verifyPassword(password, customer.passwordHash) : (await verifyPassword(password, await dummyHash), false);
  if (!customer || !ok) return { error: "E-mail ou mot de passe incorrect.", fields };
  if (customer.blocked) return { error: "Ce compte est suspendu. Contactez le service client.", fields };
  await updateStore((store) => {
    const target = store.customers?.find((item) => item.id === customer.id);
    if (target) target.lastLoginAt = new Date().toISOString();
  });
  await setCustomerCookie(customer);
  redirect(safeNext(form.get("next")));
}

export async function logoutCustomer() {
  await clearCustomerCookie();
  redirect("/");
}

/* ---------- Mot de passe oublié ---------- */

export async function requestPasswordReset(_state: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const done: FormState = { ok: "Si un compte existe avec cette adresse, un e-mail vient d'être envoyé. Le lien est valable 1 heure." };
  if (await limited("reset", 5, 30)) return { error: "Trop de demandes. Réessayez plus tard." };
  if (!isEmail(email) || !rateLimit(`reset-email:${email}`, 3, 60 * 60_000).ok) return done;
  const token = randomBytes(32).toString("base64url");
  let name = "";
  await updateStore((data) => {
    const customer = data.customers?.find((item) => item.email === email);
    if (!customer || customer.blocked) return;
    name = customer.firstName;
    customer.tokens = (customer.tokens || []).filter((item) => item.kind !== "reset" && new Date(item.expiresAt) > new Date());
    customer.tokens.push({ kind: "reset", hash: tokenHash(token), expiresAt: new Date(Date.now() + 60 * 60_000).toISOString() });
  });
  if (name) {
    await dispatchAutomation("customer.password_reset", email, {
      customer_name: name,
      reset_url: `${await siteOrigin()}/compte/reinitialiser?email=${encodeURIComponent(email)}&jeton=${token}`,
    });
  }
  return done;
}

export async function resetPassword(_state: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const token = String(form.get("token") || "");
  const password = String(form.get("password") || "");
  if (await limited("reset-confirm", 10, 30)) return { error: "Trop de tentatives. Réessayez plus tard." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  const passwordHash = await hashPassword(password);
  let updated: Customer | null = null;
  await updateStore((data) => {
    const customer = data.customers?.find((item) => item.email === email);
    const match = customer?.tokens?.find((item) => item.kind === "reset" && item.hash === tokenHash(token) && new Date(item.expiresAt) > new Date());
    if (!customer || !match || customer.blocked) return;
    customer.passwordHash = passwordHash;
    customer.sessionVersion += 1;
    customer.tokens = customer.tokens?.filter((item) => item.kind !== "reset");
    updated = { ...customer };
  });
  if (!updated) return { error: "Lien invalide ou expiré. Refaites une demande de réinitialisation." };
  await setCustomerCookie(updated);
  redirect("/compte");
}

/* ---------- Espace client ---------- */

export async function updateProfile(input: { firstName: string; lastName: string; phone: string; marketingOptIn: boolean }) {
  const me = await requireCustomer();
  if (!input.firstName.trim() || !input.lastName.trim()) throw new Error("Indiquez votre prénom et votre nom.");
  const data = await updateStore((store) => {
    const customer = store.customers?.find((item) => item.id === me.id);
    if (!customer) return;
    customer.firstName = input.firstName.trim();
    customer.lastName = input.lastName.trim();
    customer.phone = input.phone.trim();
    customer.marketingOptIn = input.marketingOptIn;
    const subscribed = store.subscribers.some((item) => item.email === customer.email);
    if (input.marketingOptIn && !subscribed) store.subscribers.unshift({ id: uid("sub"), email: customer.email, createdAt: new Date().toISOString() });
    if (!input.marketingOptIn) store.subscribers = store.subscribers.filter((item) => item.email !== customer.email);
  });
  return toPublicCustomer(data.customers!.find((item) => item.id === me.id)!);
}

export async function changeCustomerPassword(current: string, next: string) {
  const me = await requireCustomer();
  if (!(await verifyPassword(current, me.passwordHash))) throw new Error("Mot de passe actuel incorrect.");
  const problem = passwordProblem(next);
  if (problem) throw new Error(problem);
  const passwordHash = await hashPassword(next);
  let updated: Customer | null = null;
  await updateStore((store) => {
    const customer = store.customers?.find((item) => item.id === me.id);
    if (!customer) return;
    customer.passwordHash = passwordHash;
    customer.sessionVersion += 1;
    updated = { ...customer };
  });
  if (updated) await setCustomerCookie(updated);
}

function cleanAddress(input: Partial<CustomerAddress>): Omit<CustomerAddress, "id" | "isDefault"> {
  const address = {
    label: (input.label || "Domicile").trim().slice(0, 40),
    firstName: (input.firstName || "").trim(),
    lastName: (input.lastName || "").trim(),
    phone: (input.phone || "").trim(),
    address: (input.address || "").trim(),
    postal: (input.postal || "").trim(),
    city: (input.city || "").trim(),
    country: (input.country || "France").trim(),
  };
  if (!address.firstName || !address.lastName) throw new Error("Indiquez le nom du destinataire.");
  if (address.address.length < 4) throw new Error("Indiquez une adresse.");
  if (!/^[A-Za-z0-9 -]{3,10}$/.test(address.postal)) throw new Error("Code postal invalide.");
  if (!address.city) throw new Error("Indiquez une ville.");
  if (address.phone.replace(/\D/g, "").length < 8) throw new Error("Indiquez un téléphone.");
  return address;
}

export async function saveAddress(input: Partial<CustomerAddress>) {
  const me = await requireCustomer();
  const clean = cleanAddress(input);
  const data = await updateStore((store) => {
    const customer = store.customers?.find((item) => item.id === me.id);
    if (!customer) return;
    const existing = input.id ? customer.addresses.find((item) => item.id === input.id) : undefined;
    if (existing) Object.assign(existing, clean);
    else {
      if (customer.addresses.length >= 10) throw new Error("10 adresses maximum.");
      customer.addresses.push({ id: uid("adr"), ...clean, isDefault: customer.addresses.length === 0 });
    }
    if (input.isDefault) {
      const targetId = existing?.id ?? customer.addresses[customer.addresses.length - 1].id;
      for (const address of customer.addresses) address.isDefault = address.id === targetId;
    }
  });
  return data.customers!.find((item) => item.id === me.id)!.addresses;
}

export async function deleteAddress(id: string) {
  const me = await requireCustomer();
  const data = await updateStore((store) => {
    const customer = store.customers?.find((item) => item.id === me.id);
    if (!customer) return;
    customer.addresses = customer.addresses.filter((item) => item.id !== id);
    if (customer.addresses.length && !customer.addresses.some((item) => item.isDefault)) customer.addresses[0].isDefault = true;
  });
  return data.customers!.find((item) => item.id === me.id)!.addresses;
}

export async function setDefaultAddress(id: string) {
  const me = await requireCustomer();
  const data = await updateStore((store) => {
    const customer = store.customers?.find((item) => item.id === me.id);
    if (!customer || !customer.addresses.some((item) => item.id === id)) return;
    for (const address of customer.addresses) address.isDefault = address.id === id;
  });
  return data.customers!.find((item) => item.id === me.id)!.addresses;
}

/** Favoris : renvoie la liste du compte connecté (null pour un visiteur). */
export async function getWishlist() {
  const me = await currentCustomer();
  return me ? me.wishlist : null;
}

/** Remplace les favoris du compte connecté (sans effet pour un visiteur). */
export async function setWishlist(ids: string[]) {
  const me = await currentCustomer();
  if (!me || !Array.isArray(ids)) return null;
  const clean = [...new Set(ids.filter((id) => typeof id === "string" && id.length < 80))].slice(0, 200);
  await updateStore((store) => {
    const customer = store.customers?.find((item) => item.id === me.id);
    if (customer) customer.wishlist = clean;
  });
  return clean;
}

export async function toggleWishlist(productId: string) {
  const me = await requireCustomer();
  const data = await updateStore((store) => {
    const customer = store.customers?.find((item) => item.id === me.id);
    if (!customer) return;
    customer.wishlist = customer.wishlist.includes(productId)
      ? customer.wishlist.filter((id) => id !== productId)
      : [productId, ...customer.wishlist].slice(0, 200);
  });
  return data.customers!.find((item) => item.id === me.id)!.wishlist;
}

/* ---------- RGPD ---------- */

export async function exportMyData() {
  const me = await requireCustomer();
  const data = await readStore();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      account: toPublicCustomer(me),
      orders: data.orders.filter((order) => order.customerId === me.id || order.customer.email === me.email).map((order) => ({ ...order, cancelToken: undefined })),
      messages: data.messages.filter((message) => message.email === me.email),
      newsletter: data.subscribers.some((item) => item.email === me.email),
    },
    null,
    2,
  );
}

/** Supprime le compte. Les commandes sont conservées (obligation comptable) mais anonymisées. */
export async function deleteMyAccount(password: string) {
  const me = await requireCustomer();
  if (!(await verifyPassword(password, me.passwordHash))) throw new Error("Mot de passe incorrect.");
  await updateStore((store) => {
    store.customers = (store.customers || []).filter((item) => item.id !== me.id);
    store.subscribers = store.subscribers.filter((item) => item.email !== me.email);
    for (const order of store.orders) {
      if (order.customerId !== me.id && order.customer.email !== me.email) continue;
      order.customerId = undefined;
      order.customer = {
        ...order.customer,
        firstName: "Client",
        lastName: "supprimé",
        email: `supprime-${order.id.toLowerCase()}@invalid`,
        phone: "",
        address: "",
      };
    }
  });
  await clearCustomerCookie();
  redirect("/");
}
