import { uid } from "@/lib/format";
import { updateStore } from "@/lib/store";
import type { AdminRole, AdminUser, AuditLogEntry } from "@/lib/types";

export const DEFAULT_ADMIN_USERS: AdminUser[] = [
  {
    id: "usr_owner",
    name: "Ahmed (Fondateur)",
    email: "ahmed@boutique.pro",
    role: "owner",
    active: true,
    lastLoginAt: new Date().toISOString(),
  },
  {
    id: "usr_logistics",
    name: "Karim (Gestionnaire Commandes & Stocks)",
    email: "karim.expedition@boutique.pro",
    role: "order_manager",
    active: true,
    lastLoginAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "usr_support",
    name: "Claire (Support & Relation Client)",
    email: "support@boutique.pro",
    role: "support",
    active: true,
    lastLoginAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
];

export async function logAuditEvent(
  action: string,
  resource: string,
  details: string,
  userId: string = "usr_owner",
  userName: string = "Ahmed",
) {
  const entry: AuditLogEntry = {
    id: uid("audit"),
    timestamp: new Date().toISOString(),
    userId,
    userName,
    action,
    resource,
    details,
  };

  await updateStore((data) => {
    if (!data.auditLogs) data.auditLogs = [];
    data.auditLogs.unshift(entry);
    // Conserver les 150 dernières entrées pour l'auditabilité
    if (data.auditLogs.length > 150) data.auditLogs.pop();
  });

  return entry;
}

export function canPerformAction(
  role: AdminRole,
  action: "orders" | "products" | "theme" | "settings" | "iam" | "refunds",
): boolean {
  if (role === "owner" || role === "admin") return true;
  if (role === "order_manager") return action === "orders" || action === "refunds";
  if (role === "catalog_manager") return action === "products";
  if (role === "support") return action === "orders";
  return false;
}
