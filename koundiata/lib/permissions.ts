import type { AdminRole } from "@/lib/types";

/**
 * Ce que chaque rôle peut faire dans le studio.
 * Partagé entre le serveur (contrôle réel) et le navigateur (masquage des menus).
 */
export type Permission =
  | "content" // pages, produits, thème, navigation, publication
  | "orders" // consulter et faire avancer les commandes
  | "refunds" // rembourser
  | "messages" // messages clients
  | "promos" // codes promo
  | "automations" // e-mails automatiques
  | "danger" // supprimer des commandes
  | "team"; // gérer les comptes du studio

const MATRIX: Record<AdminRole, Permission[]> = {
  owner: ["content", "orders", "refunds", "messages", "promos", "automations", "danger", "team"],
  admin: ["content", "orders", "refunds", "messages", "promos", "automations", "danger"],
  order_manager: ["orders", "refunds", "messages"],
  catalog_manager: ["content", "promos"],
  support: ["orders", "messages"],
};

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  order_manager: "Commandes et stocks",
  catalog_manager: "Catalogue",
  support: "Support client",
};

export function can(role: AdminRole | undefined | null, permission: Permission) {
  if (!role) return false;
  return MATRIX[role]?.includes(permission) ?? false;
}

/** Permission nécessaire pour ouvrir chaque écran du studio. */
export function permissionForStudioPath(path: string): Permission {
  if (path.startsWith("/studio/commandes") || path.startsWith("/studio/expeditions") || path.startsWith("/studio/clients")) return "orders";
  if (path.startsWith("/studio/analyses")) return "orders";
  if (path.startsWith("/studio/messages")) return "messages";
  if (path.startsWith("/studio/promotions")) return "promos";
  if (path.startsWith("/studio/automatisations")) return "automations";
  if (path.startsWith("/studio/audit") || path.startsWith("/studio/installation")) return "team";
  return "content";
}
