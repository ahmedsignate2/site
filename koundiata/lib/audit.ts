import { uid } from "@/lib/format";
import { updateStore } from "@/lib/store";
import type { AdminUser, AuditLogEntry } from "@/lib/types";

/** Aucun compte par défaut : le premier propriétaire est créé à partir de ADMIN_EMAIL / ADMIN_PASSWORD. */
export const DEFAULT_ADMIN_USERS: AdminUser[] = [];

/** Identifiants des faux comptes livrés dans les anciennes données de démonstration. */
export const LEGACY_DEMO_USER_IDS = ["usr_owner", "usr_logistics", "usr_support"];

export type AuditActor = Pick<AdminUser, "id" | "name">;

const SYSTEM_ACTOR: AuditActor = { id: "system", name: "Système" };

export async function logAuditEvent(action: string, resource: string, details: string, actor: AuditActor = SYSTEM_ACTOR) {
  const entry: AuditLogEntry = {
    id: uid("audit"),
    timestamp: new Date().toISOString(),
    userId: actor.id,
    userName: actor.name,
    action,
    resource,
    details,
  };

  await updateStore((data) => {
    if (!data.auditLogs) data.auditLogs = [];
    data.auditLogs.unshift(entry);
    if (data.auditLogs.length > 500) data.auditLogs.length = 500;
  });

  return entry;
}
