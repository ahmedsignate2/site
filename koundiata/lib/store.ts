import { promises as fs } from "fs";
import path from "path";
import { createSeed } from "@/lib/seed";
import type { StoreData } from "@/lib/types";

const file = path.join(process.cwd(), "data", "store.json");

let chain: Promise<unknown> = Promise.resolve();

async function ensure(): Promise<StoreData> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as StoreData;
  } catch {
    const seed = createSeed();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(seed));
    return seed;
  }
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
