import { promises as fs } from "fs";
import path from "path";
import { createSeed } from "@/lib/seed";
import type { StoreData } from "@/lib/types";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/automation";
import { DEFAULT_ADMIN_USERS } from "@/lib/audit";

const file = path.join(process.cwd(), "data", "store.json");

let chain: Promise<unknown> = Promise.resolve();

async function ensure(): Promise<StoreData> {
  let data: StoreData;
  try {
    const raw = await fs.readFile(file, "utf8");
    data = JSON.parse(raw) as StoreData;
  } catch {
    data = createSeed();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(data));
    return data;
  }

  let mutated = false;
  if (!data.promoCodes) {
    data.promoCodes = [
      { code: "BIENVENUE10", discountType: "percent", discountValue: 10, minPurchaseCents: 3000, usedCount: 14, active: true },
      { code: "LIVRAISON", discountType: "fixed", discountValue: 590, minPurchaseCents: 4000, usedCount: 8, active: true },
    ];
    mutated = true;
  }
  if (!data.emailTemplates || data.emailTemplates.length === 0) {
    data.emailTemplates = DEFAULT_EMAIL_TEMPLATES;
    mutated = true;
  }
  if (!data.emailLogs) {
    data.emailLogs = [
      {
        id: "log-seed-1",
        event: "order.shipped",
        recipient: "camille.morel@example.com",
        subject: "Votre commande KD-10428 a été expédiée !",
        templateSlug: "order_shipped",
        status: "envoye",
        sentAt: "2026-10-02T14:30:00.000Z",
        idempotencyKey: "order_shipped_camille.morel_10428",
      },
    ];
    mutated = true;
  }
  if (!data.auditLogs) {
    data.auditLogs = [
      {
        id: "aud-seed-1",
        timestamp: "2026-10-14T09:15:00.000Z",
        userId: "usr_owner",
        userName: "Ahmed",
        action: "theme.update",
        resource: "Theme Studio",
        details: "Ajustement de la palette et mise à jour des marges",
      },
    ];
    mutated = true;
  }
  if (!data.adminUsers) {
    data.adminUsers = DEFAULT_ADMIN_USERS;
    mutated = true;
  }
  if (!data.draft.settings.sector) {
    data.draft.settings.sector = "cosmetique";
    mutated = true;
  }
  if (!data.published.settings.sector) {
    data.published.settings.sector = "cosmetique";
    mutated = true;
  }

  if (mutated) {
    await fs.writeFile(file, JSON.stringify(data));
  }

  return data;
}

export async function readStore() {
  const run = chain.then(() => ensure());
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function updateStore(mutate: (data: StoreData) => void) {
  const run = chain.then(async () => {
    const data = await ensure();
    mutate(data);
    await fs.writeFile(file, JSON.stringify(data));
    return data;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
