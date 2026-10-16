"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  clearSessionCookie,
  currentUser,
  hashPassword,
  passwordProblem,
  requirePermission,
  requireUser,
  setSessionCookie,
  toPublicUser,
  verifyPassword,
} from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { runAfterResponse } from "@/lib/automation";
import { isEmail, uid } from "@/lib/format";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { readStore, updateStore } from "@/lib/store";
import type { AdminRole, AdminUser } from "@/lib/types";

// Hachage factice : une adresse inconnue coûte autant qu'une vraie, sans révéler qui a un compte.
const dummyHash = hashPassword("compte-inexistant-0");

const ROLES: AdminRole[] = ["owner", "admin", "order_manager", "catalog_manager", "support"];

export type LoginState = { error?: string; email?: string } | undefined;

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/studio") && !next.startsWith("//") ? next : "/studio";
}

/** Premier démarrage : aucun compte n'a de mot de passe, on crée le propriétaire depuis ADMIN_EMAIL / ADMIN_PASSWORD. */
async function bootstrapOwner(email: string, password: string): Promise<AdminUser | null> {
  const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const envPassword = process.env.ADMIN_PASSWORD;
  if (!envEmail || !envPassword || email !== envEmail || password !== envPassword) return null;
  if (passwordProblem(envPassword)) return null;
  const passwordHash = await hashPassword(envPassword);
  let created: AdminUser | null = null;
  await updateStore((data) => {
    const users = data.adminUsers || (data.adminUsers = []);
    if (users.some((user) => user.passwordHash)) return;
    created = {
      id: uid("usr"),
      name: process.env.ADMIN_NAME?.trim() || "Propriétaire",
      email: envEmail,
      role: "owner",
      active: true,
      primary: true,
      passwordHash,
      sessionVersion: 0,
    };
    users.unshift(created);
  });
  return created;
}

export async function login(_state: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const ip = clientIp(await headers());
  if (!rateLimit(`login-ip:${ip}`, 20, 15 * 60_000).ok || !rateLimit(`login-email:${email}`, 6, 15 * 60_000).ok) {
    return { error: "Trop de tentatives. Patientez 15 minutes avant de réessayer.", email };
  }
  if (!isEmail(email) || !password) return { error: "Indiquez votre e-mail et votre mot de passe.", email };

  const data = await readStore();
  const hasAccounts = (data.adminUsers || []).some((user) => user.passwordHash);
  let user = (data.adminUsers || []).find((item) => item.email.toLowerCase() === email) ?? null;
  let ok = false;
  if (!hasAccounts) {
    user = await bootstrapOwner(email, password);
    ok = Boolean(user);
  } else if (user) {
    ok = await verifyPassword(password, user.passwordHash);
  } else {
    // Même coût de calcul qu'un vrai compte, pour ne pas révéler les adresses existantes.
    await verifyPassword(password, await dummyHash);
  }
  if (!ok || !user || !user.active) return { error: "E-mail ou mot de passe incorrect.", email };

  const userId = user.id;
  await updateStore((store) => {
    const target = store.adminUsers?.find((item) => item.id === userId);
    if (target) target.lastLoginAt = new Date().toISOString();
  });
  await setSessionCookie(user);
  runAfterResponse(() => logAuditEvent("auth.login", "Studio", `Connexion de ${user.email}`, user));
  // Première installation : on guide le propriétaire vers le branchement des services.
  redirect(hasAccounts ? safeNext(form.get("next")) : "/studio/installation");
}

export async function logout() {
  const user = await currentUser();
  await clearSessionCookie();
  if (user) runAfterResponse(() => logAuditEvent("auth.logout", "Studio", `Déconnexion de ${user.email}`, user));
  redirect("/connexion");
}

function activeOwners(users: AdminUser[]) {
  return users.filter((user) => user.role === "owner" && user.active && user.passwordHash).length;
}

export async function createStaff(input: { name: string; email: string; role: AdminRole; password: string }) {
  const actor = await requirePermission("team");
  const email = input.email.trim().toLowerCase();
  if (input.name.trim().length < 2) throw new Error("Indiquez un nom.");
  if (!isEmail(email)) throw new Error("Adresse e-mail invalide.");
  if (!ROLES.includes(input.role)) throw new Error("Rôle inconnu.");
  const problem = passwordProblem(input.password);
  if (problem) throw new Error(problem);
  const passwordHash = await hashPassword(input.password);
  await updateStore((data) => {
    const users = data.adminUsers || (data.adminUsers = []);
    if (users.some((user) => user.email.toLowerCase() === email)) throw new Error("Un compte existe déjà avec cet e-mail.");
    users.push({ id: uid("usr"), name: input.name.trim(), email, role: input.role, active: true, passwordHash, sessionVersion: 0 });
  });
  runAfterResponse(() => logAuditEvent("team.create", "Équipe", `Compte créé pour ${email} (${input.role})`, actor));
  revalidatePath("/studio", "layout");
  return listStaff();
}

export async function updateStaff(id: string, patch: { role?: AdminRole; active?: boolean; name?: string }) {
  const actor = await requirePermission("team");
  if (patch.role && !ROLES.includes(patch.role)) throw new Error("Rôle inconnu.");
  await updateStore((data) => {
    const users = data.adminUsers || [];
    const user = users.find((item) => item.id === id);
    if (!user) throw new Error("Compte introuvable.");
    if (user.primary && id !== actor.id) throw new Error("Le propriétaire principal ne peut être ni modifié, ni rétrogradé, ni désactivé.");
    if (id === actor.id && (patch.active === false || (patch.role && patch.role !== user.role))) {
      throw new Error("Vous ne pouvez pas modifier votre propre rôle ni désactiver votre compte.");
    }
    const before = { role: user.role, active: user.active };
    if (patch.name?.trim()) user.name = patch.name.trim();
    if (patch.role) user.role = patch.role;
    if (typeof patch.active === "boolean") user.active = patch.active;
    if (activeOwners(users) === 0) {
      user.role = before.role;
      user.active = before.active;
      throw new Error("Il doit rester au moins un propriétaire actif.");
    }
    if (before.role !== user.role || before.active !== user.active) user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  });
  runAfterResponse(() => logAuditEvent("team.update", "Équipe", `Compte ${id} modifié (${JSON.stringify(patch)})`, actor));
  revalidatePath("/studio", "layout");
  return listStaff();
}

export async function resetStaffPassword(id: string, password: string) {
  const actor = await requirePermission("team");
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const passwordHash = await hashPassword(password);
  await updateStore((data) => {
    const user = data.adminUsers?.find((item) => item.id === id);
    if (!user) throw new Error("Compte introuvable.");
    if (user.primary && id !== actor.id) throw new Error("Seul le propriétaire principal peut changer son propre mot de passe.");
    user.passwordHash = passwordHash;
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  });
  runAfterResponse(() => logAuditEvent("team.password_reset", "Équipe", `Mot de passe réinitialisé pour ${id}`, actor));
  if (id === actor.id) await clearSessionCookie();
  return listStaff();
}

export async function changeOwnPassword(current: string, next: string) {
  const user = await requireUser();
  if (!(await verifyPassword(current, user.passwordHash))) throw new Error("Mot de passe actuel incorrect.");
  const problem = passwordProblem(next);
  if (problem) throw new Error(problem);
  const passwordHash = await hashPassword(next);
  let updated: AdminUser | null = null;
  await updateStore((data) => {
    const target = data.adminUsers?.find((item) => item.id === user.id);
    if (!target) return;
    target.passwordHash = passwordHash;
    target.sessionVersion = (target.sessionVersion ?? 0) + 1;
    updated = { ...target };
  });
  if (updated) await setSessionCookie(updated);
  runAfterResponse(() => logAuditEvent("auth.password_change", "Studio", "Mot de passe modifié", user));
}

async function listStaff() {
  const data = await readStore();
  return (data.adminUsers || []).map(toPublicUser);
}
