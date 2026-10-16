import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentUser, toPublicUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { readStore } from "@/lib/store";
import { StudioShell } from "@/components/studio/studio";
import type { StoreData } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Studio", robots: { index: false, follow: false } };

export default async function Layout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/connexion");
  const data = await readStore();
  // N'envoyer au navigateur que ce que ce rôle a le droit de voir, et jamais les mots de passe.
  const visible: StoreData = {
    ...data,
    orders: can(user.role, "orders") ? data.orders : [],
    messages: can(user.role, "messages") ? data.messages : [],
    subscribers: can(user.role, "orders") ? data.subscribers : [],
    emailLogs: can(user.role, "automations") ? data.emailLogs : [],
    auditLogs: can(user.role, "team") ? data.auditLogs : [],
    adminUsers: (can(user.role, "team") ? data.adminUsers || [] : [user]).map(toPublicUser),
  };
  return (
    <StudioShell initial={visible} me={toPublicUser(user)}>
      {children}
    </StudioShell>
  );
}
