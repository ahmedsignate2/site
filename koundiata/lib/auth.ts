import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import { readStore } from "@/lib/store";
import { can, type Permission } from "@/lib/permissions";
import type { AdminUser, PublicAdminUser } from "@/lib/types";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = "kd-session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET manquant ou trop court (32 caractères minimum).");
  }
  return "dev-only-secret-change-me-dev-only-secret";
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | undefined) {
  if (!stored) return false;
  const [algo, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64url"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function passwordProblem(password: string) {
  if (password.length < 10) return "Le mot de passe doit comporter au moins 10 caractères.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return "Le mot de passe doit contenir des lettres et des chiffres.";
  return null;
}

type SessionPayload = { uid: string; v: number; exp: number };

function sign(body: string, scope = "admin") {
  return createHmac("sha256", secret()).update(`${scope}:${body}`).digest("base64url");
}

/** Jeton signé générique (sessions client, etc.). Le « scope » empêche de réutiliser un jeton d'un usage à l'autre. */
export function signPayload(payload: object, scope: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, scope)}`;
}

export function readPayload<T extends { exp: number }>(token: string | undefined, scope: string): T | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body, scope));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as T;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionToken(user: AdminUser) {
  const payload: SessionPayload = { uid: user.id, v: user.sessionVersion ?? 0, exp: Date.now() + SESSION_TTL_MS };
  return signPayload(payload, "admin");
}

function readToken(token: string | undefined) {
  return readPayload<SessionPayload>(token, "admin");
}

export async function setSessionCookie(user: AdminUser) {
  (await cookies()).set(SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export function toPublicUser(user: AdminUser): PublicAdminUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, sessionVersion, ...rest } = user;
  return rest;
}

/** Utilisateur connecté, ou null. Vérifie la signature, l'expiration, le compte actif et la version de session. */
export async function currentUser(): Promise<AdminUser | null> {
  const payload = readToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const data = await readStore();
  const user = (data.adminUsers || []).find((item) => item.id === payload.uid);
  if (!user || !user.active || !user.passwordHash) return null;
  if ((user.sessionVersion ?? 0) !== payload.v) return null;
  return user;
}

export class AccessDenied extends Error {
  constructor(message = "Accès refusé.") {
    super(message);
    this.name = "AccessDenied";
  }
}

/** À appeler en tête de chaque action d'administration. */
export async function requirePermission(permission: Permission) {
  const user = await currentUser();
  if (!user) throw new AccessDenied("Session expirée : reconnectez-vous au studio.");
  if (!can(user.role, permission)) throw new AccessDenied("Votre rôle ne permet pas cette action.");
  return user;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AccessDenied("Session expirée : reconnectez-vous au studio.");
  return user;
}
