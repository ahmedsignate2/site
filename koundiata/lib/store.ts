import { promises as fs } from "fs";
import path from "path";
import postgres from "postgres";
import { createSeed } from "@/lib/seed";
import type { StoreData } from "@/lib/types";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/automation";
import { DEFAULT_ADMIN_USERS, LEGACY_DEMO_USER_IDS } from "@/lib/audit";

/*
 * Stockage des données de la boutique.
 * - DATABASE_URL défini (Neon, Supabase, Vercel Postgres, Railway…) : Postgres,
 *   compatible serverless (Vercel, Cloudflare, Netlify) et multi-instance.
 * - Sinon : fichier data/store.json, pour le développement ou un serveur unique.
 */

const file = path.join(process.cwd(), "data", "store.json");

/** Neon, Supabase et Vercel exposent l'adresse sous l'un de ces noms. */
function databaseUrl() {
  const env = process.env;
  const direct = env.DATABASE_URL || env.POSTGRES_URL || env.POSTGRES_PRISMA_URL || env.NEON_DATABASE_URL;
  if (direct) return direct;
  // Certaines intégrations ne fournissent que les morceaux (hôte, utilisateur, mot de passe, base).
  const host = env.PGHOST || env.POSTGRES_HOST;
  const user = env.PGUSER || env.POSTGRES_USER;
  const password = env.PGPASSWORD || env.POSTGRES_PASSWORD;
  const database = env.PGDATABASE || env.POSTGRES_DATABASE || "neondb";
  if (host && user && password) {
    return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}/${database}?sslmode=require`;
  }
  return "";
}

export function storageBackend() {
  return databaseUrl() ? "postgres" : "file";
}

const READ_ONLY_HELP =
  "Ce serveur n'autorise pas l'écriture de fichiers (Vercel, Cloudflare, Netlify…). Ajoutez une base Postgres (variable DATABASE_URL, ex. Neon) puis redéployez.";

function isReadOnly(error: unknown) {
  const code = (error as { code?: string })?.code;
  return code === "EROFS" || code === "EACCES" || code === "EPERM";
}

/** Met les anciennes données au format actuel. Renvoie true si quelque chose a changé. */
function migrate(data: StoreData) {
  let mutated = false;
  // Un propriétaire principal, protégé, doit toujours exister dès qu'un compte réel existe.
  const owners = (data.adminUsers || []).filter((user) => user.role === "owner" && user.passwordHash);
  if (owners.length && !data.adminUsers!.some((user) => user.primary)) {
    owners[0].primary = true;
    mutated = true;
  }
  if (!data.customers) {
    data.customers = [];
    mutated = true;
  }
  if (!data.integrations) {
    data.integrations = {};
    mutated = true;
  }
  if (!data.promoCodes) {
    data.promoCodes = [
      { code: "BIENVENUE10", discountType: "percent", discountValue: 10, minPurchaseCents: 3000, usedCount: 14, active: true },
      { code: "LIVRAISON", discountType: "fixed", discountValue: 590, minPurchaseCents: 4000, usedCount: 8, active: true },
    ];
    mutated = true;
  }
  if (!data.emailTemplates || data.emailTemplates.length === 0) {
    data.emailTemplates = structuredClone(DEFAULT_EMAIL_TEMPLATES);
    mutated = true;
  }
  for (const template of DEFAULT_EMAIL_TEMPLATES) {
    if (!data.emailTemplates.some((item) => item.slug === template.slug)) {
      data.emailTemplates.push(structuredClone(template));
      mutated = true;
    }
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
        userId: "system",
        userName: "Système",
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
  // Les anciens comptes de démonstration n'ont pas de mot de passe et ne correspondent à personne.
  const realUsers = data.adminUsers.filter((user) => user.passwordHash || !LEGACY_DEMO_USER_IDS.includes(user.id));
  if (realUsers.length !== data.adminUsers.length) {
    data.adminUsers = realUsers;
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

  return mutated;
}

/* ---------- Fichier local ---------- */

let chain: Promise<unknown> = Promise.resolve();

async function readFileStore(): Promise<StoreData | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as StoreData;
  } catch {
    return null;
  }
}

async function writeFileStore(data: StoreData) {
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(data));
    await fs.rename(temp, file);
  } catch (error) {
    if (isReadOnly(error)) throw new Error(READ_ONLY_HELP);
    throw error;
  }
}

// Sur un disque en lecture seule, la lecture doit continuer de fonctionner (vitrine visible).
let memoryCopy: StoreData | null = null;

async function fileEnsure(): Promise<StoreData> {
  if (memoryCopy) return memoryCopy;
  let data = await readFileStore();
  const fresh = !data;
  if (!data) data = createSeed();
  if (migrate(data) || fresh) {
    try {
      await writeFileStore(data);
    } catch (error) {
      if (!(error instanceof Error && error.message === READ_ONLY_HELP)) throw error;
      console.error(READ_ONLY_HELP);
      memoryCopy = data;
    }
  }
  return data;
}

function serialize<T>(task: () => Promise<T>) {
  const run = chain.then(task);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/* ---------- Postgres ---------- */

type Sql = ReturnType<typeof postgres>;
const globalForSql = globalThis as unknown as { kdSql?: Sql; kdSqlReady?: Promise<void> };

function sql() {
  if (!globalForSql.kdSql) {
    globalForSql.kdSql = postgres(databaseUrl(), {
      max: Number(process.env.DATABASE_POOL_SIZE || 5),
      prepare: false, // compatible avec les poolers (PgBouncer, Supabase, Neon)
      idle_timeout: 20,
    });
  }
  return globalForSql.kdSql;
}

async function pgReady() {
  if (!globalForSql.kdSqlReady) {
    globalForSql.kdSqlReady = (async () => {
      const db = sql();
      await db`create table if not exists kd_store (id integer primary key, data jsonb not null, updated_at timestamptz not null default now())`;
      const rows = await db`select 1 from kd_store where id = 1`;
      if (!rows.length) {
        // Premier démarrage : on reprend data/store.json s'il existe, sinon des données neutres.
        const initial = (await readFileStore()) ?? createSeed();
        migrate(initial);
        await db`insert into kd_store (id, data) values (1, ${db.json(initial as never)}) on conflict (id) do nothing`;
      }
    })().catch((error) => {
      globalForSql.kdSqlReady = undefined;
      throw error;
    });
  }
  return globalForSql.kdSqlReady;
}

async function pgRead(): Promise<StoreData> {
  await pgReady();
  const [row] = await sql()`select data from kd_store where id = 1`;
  const data = row.data as StoreData;
  if (migrate(data)) await pgUpdate(() => {});
  return data;
}

async function pgUpdate(mutate: (data: StoreData) => void): Promise<StoreData> {
  await pgReady();
  return sql().begin(async (tx) => {
    // Verrou de ligne : deux écritures simultanées passent l'une après l'autre.
    const [row] = await tx`select data from kd_store where id = 1 for update`;
    const data = row.data as StoreData;
    migrate(data);
    mutate(data);
    await tx`update kd_store set data = ${tx.json(data as never)}, updated_at = now() where id = 1`;
    return data;
  }) as Promise<StoreData>;
}

/* ---------- API ---------- */

export async function readStore(): Promise<StoreData> {
  if (storageBackend() === "postgres") return pgRead();
  return serialize(fileEnsure);
}

export async function updateStore(mutate: (data: StoreData) => void): Promise<StoreData> {
  if (storageBackend() === "postgres") return pgUpdate(mutate);
  return serialize(async () => {
    const data = await fileEnsure();
    mutate(data);
    await writeFileStore(data);
    return data;
  });
}
