import { cookies } from "next/headers";
import { readPayload, signPayload } from "@/lib/auth";
import { readStore } from "@/lib/store";
import type { Customer, PublicCustomer } from "@/lib/types";

export const CUSTOMER_COOKIE = "kd-client";
const CUSTOMER_TTL_MS = 1000 * 60 * 60 * 24 * 30;

type CustomerSession = { cid: string; v: number; exp: number };

export async function setCustomerCookie(customer: Customer) {
  const token = signPayload({ cid: customer.id, v: customer.sessionVersion, exp: Date.now() + CUSTOMER_TTL_MS } satisfies CustomerSession, "customer");
  (await cookies()).set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CUSTOMER_TTL_MS / 1000,
  });
}

export async function clearCustomerCookie() {
  (await cookies()).delete(CUSTOMER_COOKIE);
}

/** Client connecté, ou null (signature, expiration, blocage et version de session vérifiés). */
export async function currentCustomer(): Promise<Customer | null> {
  const payload = readPayload<CustomerSession>((await cookies()).get(CUSTOMER_COOKIE)?.value, "customer");
  if (!payload) return null;
  const data = await readStore();
  const customer = (data.customers || []).find((item) => item.id === payload.cid);
  if (!customer || customer.blocked || customer.sessionVersion !== payload.v) return null;
  return customer;
}

export function toPublicCustomer(customer: Customer): PublicCustomer {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, sessionVersion, tokens, ...rest } = customer;
  return rest;
}
