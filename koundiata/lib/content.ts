import { cache } from "react";
import { cookies } from "next/headers";
import { readStore } from "@/lib/store";

export const getStoreCached = cache(readStore);

export async function visibleContent() {
  const preview = (await cookies()).get("kd-preview")?.value === "1";
  const store = await getStoreCached();
  return {
    content: preview ? store.draft : store.published,
    preview,
    store,
  };
}
